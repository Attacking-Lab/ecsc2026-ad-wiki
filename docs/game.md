# Game Overview

<span class=hltext>
Each team is given root access to a [cloud-hosted Linux-based virtual machine](/vulnbox)
that exposes vulnerable services to other teams over a [private virtual network](/network).
</span>

Over the course of every **round**, lasting 60 seconds, so-called **checkers**
store text snippets called **flags** in the services on each team's vulnbox
and test their functionality to make sure they are working as intended.
Extracting these flags from other teams' services and submitting them to a
central flag submission each round to earn <b><abbr title="Attack">ATK</abbr>-points</b>
is the primary goal of the game.

!!! info "flag stores"
    A checker may store multiple unique flags each round in distinct areas of
    a service, and there may be more than one intended vulnerability to reach each one.

To incentivize teams to keep their services available to other teams to exploit,
a series of checks is performed each round against every service of every team
by the organizers' **checkers**. These tests define the so-called *Service-Level
Agreement* (**SLA**); the functionality required for a team to earn
**SLA-points** each round.

!!! info "attack info"
    Checkers may provide hints for successfully stored flags to help guide
    exploits.
    In some cases, this info is crucial to exploiting the vulnerability at all.
    It can be retrieved via the [attack api](/api).

Each round a team receives <b><abbr title="Defense">DEF</abbr>-points</b> for 
every service. The amount of points earned is highest when the service is
unexploited and decreases with the amount of other teams exploiting it.

These points combine to calculate the team score using the
[scoring formula](scoring.md).

## Flags

<span class=hltext>Each flag is matched by the regular expression `/^ECSC\{[A-Za-z0-9-_]{32}\}$/`</span>

<span class=hltext>Checkers retrieve flags from the previous **5** rounds in addition to the current round</span>
to enable exploits which take longer than a single round to complete.
The SLA penalty for missing any of the flags in this [*retention period*](/scoring)
incentivizes teams to keep them available for capture.

<span class=hltext>Flags will award points upon submission for 5 rounds
including the round they were deployed in.</span>

Each flag consists of a prefix and suffix, that wrap a base64-encoded[^1] payload with the following format:

- `2 bytes`: round id
- `2 bytes`: team id
- `2 bytes`: service id
- `2 bytes`: flagstore id
- `16 bytes`: SHA256-HMAC (of first 8 bytes)

[^1]: This payload is encoded using the [base64url charset](https://en.wikipedia.org/wiki/Base64#Implementations_and_history)

## Flag Submission

Players can submit stolen flags by sending them line-delimited in a plain TCP
connection to `10.42.251.2` on port `1337`. This must be done via the game
network, since the source ip is used to determine the submitting team.

For each line, in the order that they are received, the flag submission will
return one of the following results on a new line:

- `[OK]`: The flag is valid and was accepted
- `[ERR] Invalid format`: The flag is malformed
- `[ERR] Invalid flag`: The signature of the flag is incorrect
- `[ERR] Expired`: The flag was submitted after the retention period
- `[ERR] Already submitted`: The flag has already been submitted by this team
- `[ERR] Can't submit flag from NOP team`: The flag submitted is from NOP
- `[ERR] This is your own flag`: The flag is from the submitting team

