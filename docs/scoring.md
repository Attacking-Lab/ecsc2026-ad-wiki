# Scoring Formula

In Jeopardy CTFs, dynamic scoring is used to infer the difficulty
of a challenge based on the number of teams that can solve it. This scoring
formula applies the same concept to A/D.

In effect, each round is treated as a Jeopardy CTF with the following *challenges*:

- For each flag you capture, you receive **ATK points** based on the number
  of teams that capture that flag.
- For each service and each flag store, you receive **DEF points** for each
  actively exploiting team that did not capture your flag, proportional to the
  number of teams whose flags that team did capture.

Additionally, you gain a **fixed amount of SLA points** for each deployed flag
that is still *valid* (submittable for points) and retrievable from the service,
as long as the checker status is <span class=hl-success>`SUCCESS`</span>
or <span class=hl-recovering>`RECOVERING`</span>.

## Checker Status

The checker returns one of the following results for each service:

- <span class=hl-success>`SUCCESS`</span> if all flags could be successfully deployed and
retrieved, and functionality checks were successful.
- <span class=hl-recovering>`RECOVERING`</span> if all checks for the current round succeed,
  but flags from the past 4 rounds are missing.
- <span class=hl-mumble>`MUMBLE`</span> if any functionality checks for the current round failed.
- <span class=hl-offline>`OFFLINE`</span> if the checker failed to establish a connection to the service.
- <span class=hl-error>`INTERNAL_ERROR`</span> if an internal error occurred. **Please notify us with context in a ticket.**

## Implementation

An *approximate* implementation may be evaluated against
real CTF data using <a href="https://github.com/attacking-lab/scoring-playground">our simulator</a>.

However, the following sections provide the most accurate description of the
actual implementation. Please reference it in questions about scoring
behavior. We try to include real code snippets from the game engine where
possible to help with understanding.

### Dynamic Scoring

Dynamic scaling is applied to each *challenge* by using the ECSC 2025 Jeopardy formula.
We use a lower `base` value to account for the fact that the A/D CTF will
have more dynamically weighted *challenges*, as we do not want scores to become too large.

```python3
def jeopardy(teams: int, base: int = 10):
    return int(base * (30 / (29 + max(teams, 1))) ** 3)
```

??? "Implementation Details"

    - `teams`: The number of teams who have solved this *challenge*.
    - `base`: The maximum number of points that can be earned through a *challenge*.

The value of a challenge is close to `base` when the number of solving `teams`
is low and close to zero when the number of solving teams is
high. In this case, the value will drop down to 8% of `base` at 40 teams.

### Attack Points

To distribute **ATK points**, the gameserver increases the number of submissions
of all valid flags, based on the number of flags submitted each round,
and updates their value accordingly. The value of a flag is calculated
dynamically based on the number of teams who were able to capture it.

```python3
def attack(num_submissions: int):
    return jeopardy(num_submissions)
```

??? "Implementation Details"

    **Context**: This function is called per active <span class=hltext>attacker</span> and for every <span class=hltext>victim</span>, for each <span class=hltext>service</span> and <span class=hltext>flagstore</span> to calculate the value of the stolen <span class=hltext>flag</span>.

    - `num_submissions`: The number of submissions of <span class=hltext>flag</span>.

The scores of teams who have captured flags previously are updated to reflect
the decreased value of those flags by new submissions.

Since an attacker can exploit at most all active teams, which are neither
themselves nor NOP (`max_victims`), the maximum gain from an exploit is `base * max_victims`.

Additional ATK points are awarded to each attacking team based on the DEF points
that other teams earn from defending against their attacks (more if the exploit is
harder to defend against). This prevents scenarios where defenders gain more
DEF points than the attacker can gain ATK points simply because the attacking team
started attacking (in other words, failed exploit attempts do not affect the
score difference between teams).

```python3
def attack_adj(live_round: int, flag_round: int,
               max_victims: int, num_victims: int, num_attackers: int):
    checker_status = defaultdict(lambda: "SUCCESS")
    flag_avail_in = defaultdict(lambda: defaultdict(lambda: True))
    pts = defense_scaled(live_round, flag_round, checker_status, flag_avail_in,
                         max_victims, num_victims, num_attackers, True)
    for flag in flags_stolen:
        pts += attack(flag.num_submissions)
    return pts
```

??? "Implementation Details"

    **Context**: Each <span class=hltext>round</span>, this function is called per <span class=hltext>attack</span>, for the <span class=hltext>service</span> and <span class=hltext>flagstore</span> bein attacked by an <span class=hltext>attackers</span>, to calculate the value of the entire attack over all victims.

    - `flag.num_submissions`: The number of submissions for the <span class=hltext>flag</span> of the current victim.
    - `flags_stolen`: The flags stolen for this <span class=hltext>service</span> and <span class=hltext>flagstore</span> by the attacker that were deployed in `flag_round`.
    - `max_victims`: The number of teams who are not the attacker or NOP, that have atleast one service not in <span class=hl-offline>`OFFLINE`</span> state in the current round.
    - `num_victims`: The number of teams exploited by the attack which points are currently being calculated for.
    - `num_attackers`: The number of teams attacking this <span class=hltext>service</span> and <span class=hltext>flagstore</span>, and obtaining flags stored in <span class=hltext>flag_round</span>.

### Defense Points

To calculate **DEF points**, the gameserver updates the amount of captures
of every flag which is still valid. For each team, the points gained from
defending against a specific attacker are calculated dynamically based on
the number of teams that were (or were not) exploited by them in that flag store
in that round. This is meant to reflect that some exploits
may be much more difficult to defend against than others and rewards teams
that can construct solid defenses.

This value is scaled by the number of active teams (excluding the attacking
team and NOP), and divided by the number of attackers for that flag store.
Defense points are only awarded for *active* attackers, i.e., those teams
that submit at least one flag from that flag store and round. If no teams are
exploited, no teams receive DEF points.


```python3
def defense(max_victims: int, num_victims: int,
            num_attackers: int, exploited: bool):
    if exploited or num_victims == 0:
        return 0
    return jeopardy(max_victims - num_victims) * max_victims / num_attackers
```

??? "Implementation Details"

    **Context**: Each <span class=hltext>round</span>, this function is called per <span class=hltext>service</span> and <span class=hltext>flag store</span>, for each active <span class=hltext>attacker</span> and for every <span class=hltext>team</span>, to update the value of teams defending / not defending the <span class=hltext>attack</span>.

    - `max_victims`: The number of teams who are not the attacker or NOP, that have atleast one service not in <span class=hl-offline>`OFFLINE`</span> state in the current round.
    - `num_victims`: The number of teams exploited by the attack which points are currently being calculated for.
    - `num_attackers`: The number of teams submitting flags from this <span class=hltext>service</span> and <span class=hltext>flag store</span> deployed in a specific <span class=hltext>round</span>.
    - `exploited`: Is this <span class=hltext>team</span> currently being exploited?

The defense points are scaled so that an ideal patch that blocks all
active attackers does not gain more points than the attacker would from the
exploit itself. When a patch blocks all attackers, it gains
`defense(..) * num_attackers` or `jeopardy(max_victims - num_victims) * max_victims / num_attackers * num_attackers` points, which is at most `base * max_victims` (the same as for attack points
but significantly harder to achieve).

To ensure that deleting flags in your own service is not a viable strategy for
earning DEF points, we award the defense points for a flag spread across all
rounds for which this flag must be retained. If a flag is unavailable
in a specific round, no defense points are awarded for that flag in that
round. Intuitively, this reflects the idea that defense points should be
gained for successful defending; if no flags are at risk, no reward is
earned.

```python3
def defense_scaled(live_round: int, flag_round: int, checker_status: dict[int, str],
                   flag_avail_in: dict[int, dict[tuple[int, int, int, int], bool],
                   max_victims: int, num_victims: int, num_attackers: int, exploited: bool,
                   flag_rounds_valid: int = 5):
    pts = 0
    max_round = max(live_round + 1, flag_round + flag_rounds_valid)
    for round in range(flag_round, max_round):
        if checker_status[round] not in {"SUCCESS", "RECOVERING"}:
            continue
        if flag_avail_in[round][flag_round, team, service, flagstore]:
            pts += defense(max_victims, num_victims, num_attackers, exploited) \
                   / flag_rounds_valid
    return pts
```

??? "Implementation Details"

    **Context**: Each <span class=hltext>round</span>, this function is called per <span class=hltext>service</span> and <span class=hltext>flag store</span>, for each active <span class=hltext>attacker</span> and for every <span class=hltext>team</span>, to update the value of teams defending / not defending the <span class=hltext>attack</span>.

    - `live_round`: The round of the game in which the defense points are being updated.
    - `flag_round`: The round of the game in which the flag being stolen was deployed.
    - `checker_status`: The status of the checker for this service for each round of the game.
    - `flag_avail_in`: A mapping for which flags were retrievable from a specific specific round (first key), depending on the team, service, flagstore and round they were deployed in. **Remember:** each round the checker checks that valid flags can be retrieved.
    - `max_victims`: The number of teams who are not the attacker or NOP, that have atleast one service not in <span class=hl-offline>`OFFLINE`</span> state in the current round.
    - `num_victims`: The number of teams exploited by the attack which points are currently being calculated for.
    - `num_attackers`: The number of teams attacking this <span class=hltext>service</span> and <span class=hltext>flagstore</span>, and obtaining flags stored in <span class=hltext>flag_round</span>.
    - `exploited`: Is this <span class=hltext>team</span> being exploited by the attack which points are currently being calculated for?
    - `flag_rounds_valid`: The number of rounds each flag is valid for.

Since defense points are recalculated for rounds in which still-valid flags
were deployed, `max_round` eventually reaches `flag_round + flag_rounds_valid`.

At the end of the game, some flags need to be retained for fewer rounds. This
means that protecting these flags earns proportionally fewer points over time,
as there was also less time for other teams to capture them. However, the
total number of flags you need to protect (and thus the defense points
that can be earned in each round) does not change at the end of the game.


### SLA Points

To determine **SLA points**, the gameserver calculates the ratio between the
number of valid flags retrievable from a service and the number of rounds
a flag is valid for.

```python3
def sla(checker_status: str, flags_avail: int,
        base: int = 10, flag_rounds_valid: int = 5):
    if checker_status == "SUCCESS":
        return base * flagstores
    elif checker_status == "RECOVERING":
        return base * flags_avail / flag_rounds_valid
    else:
        return 0
```

??? "Implementation Details"

    **Context**: Each <span class=hltext>round</span>, this function is called per <span class=hltext>team</span> and per <span class=hltext>service</span>.

    - `checker_status`: The status returned by the checker for <span class=hltext>team</span> and <span class=hltext>service</span>.
    - `flags_avail`: The number of flags available in the last 5 rounds from all flagstores of <span class=hltext>service</span> for <span class=hltext>team</span>.
    - `base`: The maximum value of each *challenge*, see `jeopardy(..)` definition.
    - `flag_rounds_valid`: The number of rounds each flag is valid for.

This means that at the start of the CTF, SLA points ramp up from zero to `base`
over the first five rounds, as the validity period is five rounds long.


### Total Points

The total score is the sum of the **ATK** (`attack_adj`), **DEF** (`defense_scaled`) and **SLA** (`sla`) components.

## Notes

- Since the capture count of each stored flag determines its worth,
  attackers are rewarded based on how difficult it is to exploit each specific
  team.
- The same goes for defense; a patch is rewarded based on the number of other
  teams that could not defend against the exploiting team. If a
  vulnerability is harder to patch or a specific exploit is harder to defend
  against, successfully doing so earns more defense points.
- Not attacking a team effectively gives that team defense points. Thus, there
  is an additional incentive to attack as many teams as possible
  beyond attack points. Teams will need to decide if the points gained from
  not attacking a team offset the expected loss of having the exploit stolen
  from the attack traffic.
- The maximum points gained from defending a flag store are never more than
  an exploiting team stands to gain.
- The NOP team does not gain attack or defense points.

## Aggregated Scoring

After the Jeopardy and A/D CTF, teams' scores in these two categories
are combined to yield a single final scoreboard, which should fairly
represent the skill demonstrated in both contests.

Our goal in using the same dynamic scaling as the Jeopardy CTF is that
the final team scores of both scoreboards approximate player skill with
points *in the same way*, and thus allow for fairer merging.

The Jeopardy and A/D score are merged using the following formula from
the handbook:

```python3
ad_normalized_score = ad_score * (jeopardy_winner / ad_winner)
aggregated_score = jeopardy_score + ad_normalized_score
```

Since defense points are awarded for not being attacked, and NOP team is
never awarded defense points, NOP team score represents a team which only
managed to keep their services up, without exploiting anyone or defending
against any exploits (by not receiving DEF points for any of them).

To avoid SLA points from inflating `ad_score` before merging and thus
devaluing Jeopardy challenges, we subtract the NOP team score in the
final scoreboard.

```python3
ad_score = max(0, ad_score_unadj - nop_score)
```

## FAQ

??? question "Why is our team *losing* defense / attack points?"

    Teams may appear to *lose* defense or attack points when the value of the attacks
    they defended against or the flags they submitted decreases. This calculation
    is retroactive, as flags may be submitted up to 4 rounds *after* the round
    in which they are deployed.

??? question "Why are the defense points not zero in a round our service status is neither <span class=hl-success>`SUCCESS`</span> or <span class=hl-recovering>`RECOVERING`</span>?"

    Most likely, a team was attacking your service before it went down and submitted
    (at least some of) those flags in the round before it went down. These flags
    are only considered in the next round, and you are then awarded
    defense points for defending against this exploit from the previous round
    retroactively.
    Crucially, you do not gain defense points for any flag stores not retrievable
    in the round in which your service was down.

??? question "Why are the defense points zero in the first round after our service is available if we didnt get exploited?"

    The defense points may be zero in this round because no other team is
    attacking the flag store yet. Attackers typically rely on
    <a href="https://wiki.attacking-lab.com/attack-defense/#attack_info:~:text=attack%20info">attack info</a>,
    which is only released in the subsequent round. If your service was
    unavailable for multiple rounds before this one, then no team will have
    attack info to attack the service with in the first round it is available.
