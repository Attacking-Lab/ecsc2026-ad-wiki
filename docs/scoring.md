# Scoring Formula

In Jeopardy CTFs, dynamic scoring is used to infer the difficulty
of a challenge based on the number of teams that can solve it. This scoring
formula applies the same concept to A/D.

In effect, each round is treated as a Jeopardy CTF with the following *challenges*:

- For each flag you capture, you receive **ATK points** based on the number
  of teams that capture that flag.
- For each service and each flag store, you receive **DEF points** for each
  actively exploiting team that did not capture your flag, weighted by how
  difficult that team's exploit was to defend against, inferred (via the
  dynamic scoring formula) from how few teams managed to defend against it.

Additionally, you gain a fixed amount of **SLA points** per flag
store, split evenly across its flags that are still *valid* (submittable for
points). You earn the share of each such flag that is retrievable from the
service, as long as the checker status is <span class=hl-success>`SUCCESS`</span>
or <span class=hl-recovering>`RECOVERING`</span>.

## Checker Status

The checker returns one of the following results for each service:

- <span class=hl-success>`SUCCESS`</span> if all flags could be successfully deployed and
retrieved, and functionality checks were successful.
- <span class=hl-recovering>`RECOVERING`</span> if all checks for the current round succeed,
  but at least one flag from the past 4 rounds is missing.
- <span class=hl-mumble>`MUMBLE`</span> if any functionality checks for the current round failed.
- <span class=hl-offline>`OFFLINE`</span> if the checker failed to establish a connection to the service.
- <span class=hl-error>`INTERNAL_ERROR`</span> if an internal error occurred. **Please notify us with context in a ticket.**

## Implementation

The formula may be evaluated against
real CTF data using <a href="https://github.com/attacking-lab/adctf-scoring">our simulator</a>,
whose implementation has been tested to match the gameserver.

In the following sections, we will reference code from the simulator to aid the
explanation of different components of the scoring formula.

### Dynamic Scoring

NFITS chose the following dynamic scoring formula for the ECSC 2026 Jeopardy
CTF, so we base the A/D dynamic scoring on it. Using the same formula
for both contests means points map to skill *in the same way* across the two
scoreboards, which is what makes merging them fair.
We scale the value range to make it more AD-friendly.[^1]

The formula determines the value of each *challenge* by anchoring it at two
exact fixed points: `(1, max_points)` and `(teams, min_points)`.
The value of a challenge is exactly `max_points` when only one team solves it
and exactly `min_points` when every team solves it.

<div class="code-link" markdown="1">
<a class="code-link__btn" href="https://github.com/attacking-lab/adctf-scoring/blob/main/src/adctf_scoring/scoring/ecsc2026.py#L61-L64" title="View in adctf-scoring" target="_blank" rel="noopener"></a>

```python3
def dynamic_points(solves: int, teams: int, max_points: float = 10,
        min_points: float = 1, alpha: float = 0.705):
    score_ratio = min_points / max_points
    solve_ratio = max(0, solves - 1) / max(1, teams - 1)
    return max_points * score_ratio ** (solve_ratio ** alpha)
```

</div>

With the default
`alpha = 0.705`, the value drops steeply for the first few solves and then
flattens out, so that rare exploits remain clearly the most valuable.

<div class="scoring-live" data-scoring-chart="jeopardy"></div>

[^1]: For the A/D we scale the original jeopardy `max_value` and `min_value` down by a factor of 100 to prevent
the scores from getting unwieldy, but this does not affect the final ranking
and does not devalue the A/D points since only linear operations are applied
to the jeopardy formula. The scaling cancels out when the
aggregated scores are calculated by normalization.

### Attack Points

You earn **ATK points** for every flag you capture. Each flag's value comes from
the [dynamic scoring formula](#dynamic-scoring): the fewer teams that capture it,
the more it is worth. Every round the gameserver recounts how many teams have
submitted each still-valid flag and recalculates its value, so a flag is worth
less the more often it is stolen. When a flag's value decreases, so do the scores
of the teams that captured it in earlier rounds, to match its reduced worth.

<div class="code-link" markdown="1">
<a class="code-link__btn" href="https://github.com/attacking-lab/adctf-scoring/blob/main/src/adctf_scoring/scoring/ecsc2026.py#L109-L110" title="View in adctf-scoring" target="_blank" rel="noopener"></a>

```python3
def attack_points_capture(captures: int, teams: int):
    return dynamic_points(captures, teams)
```

</div>

On top of each flag's value, an attacker also receives a bonus equal to the DEF
points a team would earn from defending against that attack with perfect uptime.
This ensures an attack never earns its targets more DEF points than it earns
the attacker.

<div class="code-link" markdown="1">
<a class="code-link__btn" href="https://github.com/attacking-lab/adctf-scoring/blob/main/src/adctf_scoring/scoring/ecsc2026.py#L112-L126" title="View in adctf-scoring" target="_blank" rel="noopener"></a>

```python3
def attack_points_flagstore(put_round: int, live_round: int, attackers: int,
        teams: int, captured: set[int]):
    max_round = min(live_round, put_round + flag_rounds_valid)
    points = defense_points_attack(len(captured), attackers, teams,
            put_round, max_round, lambda _: True)
    for flag in captured:
        captures = flag_captures[flag]
        points += attack_points_capture(captures, teams)
    return points
```

</div>

<div class="scoring-live" data-scoring-chart="attack"></div>

### Defense Points

You earn **DEF points** for every attacker you successfully defend against.
The value of defending a flag is set by the
[dynamic scoring formula](#dynamic-scoring) from how many teams held off that
same attacker: the fewer teams that managed to defend, the harder the exploit
was to defend against, and the more each successful defense is worth.

These points are scaled up by the maximum number of victims, so that defending
stays roughly as rewarding as attacking. We divide by the number of
active attackers, but this cancels out roughly with the number of attackers you
were actually able to defend against.

<div class="code-link" markdown="1">
<a class="code-link__btn" href="https://github.com/attacking-lab/adctf-scoring/blob/main/src/adctf_scoring/scoring/ecsc2026.py#L147-L152" title="View in adctf-scoring" target="_blank" rel="noopener"></a>

```python3
def defense_points_attack_max(victims: int, attackers: int, teams: int):
    max_victims = teams - 2
    points = dynamic_points(max_victims - victims + 1, max_victims)
    return points * max_victims / attackers
```

</div>

A flag's defense points are spread evenly across all rounds it must stay
retrievable, and a round only pays out if the flag was actually available.
The `flag_ok` parameter is a per-team, per-flag predicate: the service
must be <span class=hl-success>`SUCCESS`</span>
or <span class=hl-recovering>`RECOVERING`</span> that round *and* retrieving the
flag must have succeeded.
This stops teams from deleting their own flags to dodge attacks: if a flag is
not at risk, defending it earns nothing.

<div class="code-link" markdown="1">
<a class="code-link__btn" href="https://github.com/attacking-lab/adctf-scoring/blob/main/src/adctf_scoring/scoring/ecsc2026.py#L154-L164" title="View in adctf-scoring" target="_blank" rel="noopener"></a>

```python3
def defense_points_attack(victims: int, attackers: int, teams: int,
        put_round: int, live_round: int, flag_ok):
    max_points = defense_points_attack_max(victims, attackers, teams)
    rounds_retrievable = sum(flag_ok(r) for r in range(put_round, live_round))
    return max_points * rounds_retrievable / flag_rounds_valid
```

</div>

The total defense points per flag store per round are calculated by summing
over every active attack we are not a victim of. 
As an exception, the NOP team does not gain defense points.

<div class="code-link" markdown="1">
<a class="code-link__btn" href="https://github.com/attacking-lab/adctf-scoring/blob/main/src/adctf_scoring/scoring/ecsc2026.py#L166-L192" title="View in adctf-scoring" target="_blank" rel="noopener"></a>

```python3
def defense_points_flagstore(put_round: int, live_round: int, team: str,
        teams: int, service: str, flagstore: int):
    max_round = min(live_round, put_round + flag_rounds_valid)
    points = 0
    attackers = victim_map[put_round, service, flagstore]
    for attacker, captures in attackers.items():
        victims = {flag_owner[flag] for flag in captures}
        if team in victims or attacker == team:
            continue
        flag_ok = flag_ok_fn(put_round, team, service, flagstore)
        points += defense_points_attack(len(victims), len(attackers),
                teams, put_round, max_round, flag_ok)
    return points
```

</div>

<div class="scoring-live" data-scoring-chart="defense"></div>

### SLA Points

You earn **SLA points** each round for keeping your services healthy and their
flags retrievable. A service in <span class=hl-success>`SUCCESS`</span> earns the
full reward (`sla_scale * max_points` for each of its flag stores) each round,
while a <span class=hl-recovering>`RECOVERING`</span> service earns a partial reward,
based on the fraction of flags in play that are actually retrievable.
Any other checker status earns nothing.

At game start, no flags have been deployed yet, and thus fewer flags are in play
to be checked. SLA is scaled to compensate for these missing flags, such that
one round of downtime always costs at least `sla_scale * max_points` per flagstore,
and more if flags were not able to be placed and/or remain unretrievable.
This necessarily increases the lifetime value of early game flags.

<div class="code-link" markdown="1">
<a class="code-link__btn" href="https://github.com/attacking-lab/adctf-scoring/blob/main/src/adctf_scoring/scoring/ecsc2026.py#L204-L215" title="View in adctf-scoring" target="_blank" rel="noopener"></a>

```python3
def sla_points_flagstore(put_round: int, live_round: int,
        flag_ok: Callable, sla_scale: float = 5.0):
    max_round = min(live_round, put_round + flag_rounds_valid)
    points = sum(flag_ok(r) / min(r + 1, flag_rounds_valid)
                 for r in range(put_round, max_round))
    return sla_scale * max_points * points
```

</div>

<div class="scoring-live" data-scoring-chart="sla"></div>


### Total Points

The component points are the previously defined scores summed over every flag store of every
service, for every round played so far. A team's total score is the sum of all
three components; the scoreboard displays them separately as ATK <svg class="score-icon" viewBox="0 0 512 512" aria-hidden="true"><path d="M500 224h-30.364C455.724 130.325 381.675 56.276 288 42.364V12c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v30.364C130.325 56.276 56.276 130.325 42.364 224H12c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h30.364C56.276 381.675 130.325 455.724 224 469.636V500c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12v-30.364C381.675 455.724 455.724 381.675 469.636 288H500c6.627 0 12-5.373 12-12v-40c0-6.627-5.373-12-12-12zM288 404.634V364c0-6.627-5.373-12-12-12h-40c-6.627 0-12 5.373-12 12v40.634C165.826 392.232 119.783 346.243 107.366 288H148c6.627 0 12-5.373 12-12v-40c0-6.627-5.373-12-12-12h-40.634C119.768 165.826 165.757 119.783 224 107.366V148c0 6.627 5.373 12 12 12h40c6.627 0 12-5.373 12-12v-40.634C346.174 119.768 392.217 165.757 404.634 224H364c-6.627 0-12 5.373-12 12v40c0 6.627 5.373 12 12 12h40.634C392.232 346.174 346.243 392.217 288 404.634zM288 256c0 17.673-14.327 32-32 32s-32-14.327-32-32c0-17.673 14.327-32 32-32s32 14.327 32 32z"/></svg>, DEF <svg class="score-icon" viewBox="0 0 512 512" aria-hidden="true"><path d="M466.5 83.7l-192-80a48.15 48.15 0 0 0-36.9 0l-192 80C27.7 91.1 16 108.6 16 128c0 198.5 114.5 335.7 221.5 380.3 11.8 4.9 25.1 4.9 36.9 0C360.1 472.6 496 349.3 496 128c0-19.4-11.7-36.9-29.5-44.3zM256.1 446.3l-.1-381 175.9 73.3c-3.3 151.4-82.1 261.1-175.8 307.7z"/></svg>, and SLA <svg class="score-icon" viewBox="0 0 576 512" aria-hidden="true"><path d="M288 32C128.94 32 0 160.94 0 320c0 52.8 14.25 102.26 39.06 144.8 5.61 9.62 16.3 15.2 27.44 15.2h443c11.14 0 21.83-5.58 27.44-15.2C561.75 422.26 576 372.8 576 320c0-159.06-128.94-288-288-288zm0 64c14.71 0 26.58 10.13 30.32 23.65-1.11 2.26-2.64 4.23-3.45 6.67l-9.22 27.67c-5.13 3.49-10.97 6.01-17.64 6.01-17.67 0-32-14.33-32-32S270.33 96 288 96zM96 384c-17.67 0-32-14.33-32-32s14.33-32 32-32 32 14.33 32 32-14.33 32-32 32zm48-160c-17.67 0-32-14.33-32-32s14.33-32 32-32 32 14.33 32 32-14.33 32-32 32zm246.77-72.41l-61.33 184C343.13 347.33 352 364.54 352 384c0 11.72-3.38 22.55-8.88 32H232.88c-5.5-9.45-8.88-20.28-8.88-32 0-33.94 26.5-61.43 59.9-63.59l61.34-184.01c4.17-12.56 17.73-19.45 30.36-15.17 12.57 4.19 19.35 17.79 15.17 30.36zm14.66 57.2l15.52-46.55c3.47-1.29 7.13-2.23 11.05-2.23 17.67 0 32 14.33 32 32s-14.33 32-32 32c-11.38-.01-20.89-6.28-26.57-15.22zM480 384c-17.67 0-32-14.33-32-32s14.33-32 32-32 32 14.33 32 32-14.33 32-32 32z"/></svg>.

### Final Scores

The final team scores are calculated at the end of the game by subtracting
the NOP team score from each team's total score.
Given that it earns neither attack nor defense points, the NOP team represents
a team that only managed to keep its services up, without exploiting anyone
or defending against any exploits. We thereby treat its score as a baseline
of points which did not require any effort by teams to be earned.

It is highly unlikely for a playing team to earn fewer points than NOP.

## Insights

- A flag is worth more the fewer teams capture it, so attackers are rewarded for
  pulling off harder exploits.
- Defense works the same way: the fewer teams that fend off an attack, the more
  each successful defense against it is worth.
- Defending a flag store never earns more than the attacker gains from that attack.
- Attacking every team but one effectively hands that team the defense points,
  so it pays to attack as widely as possible.
- Reducing an attacker's attack points is realistically never worth
  the cost of downtime for the victim.
- The NOP team earns neither attack points nor defense points.


## FAQ

??? question "Why is our team *losing* defense/attack points?"

    Teams may appear to *lose* defense or attack points when the value of the attacks
    they defended against or the flags they submitted decreases. This calculation
    is retroactive, as flags may be submitted up to 4 rounds *after* the round
    in which they are deployed.

??? question "Why can the defense points be non-zero in a round our service status is neither <span class=hl-success>`SUCCESS`</span> nor <span class=hl-recovering>`RECOVERING`</span>?"

    Most likely, a team was attacking your service before it went down and submitted
    (at least some of) those flags in the round before it went down. These flags
    are only considered in the next round, and you are then awarded
    defense points for defending against this exploit from the previous round
    retroactively.
    Crucially, you do not gain defense points for any flag stores not retrievable
    in the round in which your service was down.

