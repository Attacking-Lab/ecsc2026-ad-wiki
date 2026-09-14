# ECSC 2026 A/D

The [European Cybersecurity Challenge 2026]({{ event_url }}) will take place from the 12th to 16th of October
2026 in Bochum, Germany, hosted by [NFITS e.V.](https://nfits.de/).
The Attack-Defense CTF will be organized by [Attacking-Lab](https://attacking-lab.com)
and take place on <span class=hltext>15th of October</span>,
with the scored game starting at <span class=hltext>11:00 CEST</span> and lasting
<span class=hltext>8 hours</span> until <span class=hltext>19:00 CEST</span>.

## Attack-Defense

<span class=hltext>Attack-Defense CTFs are a type of cybersecurity competition
in which participating teams host services and attempt to exploit each other over a
shared, private network.</span> The goal of the game is to *earn points* by
stealing secrets stored in your opponents' service instances,
and to *avoid losing points* by preventing your own secrets from being stolen
and submitted, all the while keeping the services available and functioning.
<span class=hltext>The team with the most points by the end wins.</span>


## Test and Demo Slots

Several slots are reserved ahead of the competition for demos and for players to
set up and test their vulnbox and exploiter. Only the [scored game](#ctf-schedule)
counts towards the main score.

| Slot         | Date & Time<sup>1</sup>                     |
|--------------------------|---------------------------------|
| Demo 1                   | 19.09.2026 @ 12:00 – 20.09.2026 @ 20:00  |
| Demo 2                   | 03.10.2026 @ 12:00 – 04.10.2026 @ 20:00      |
| Onsite test              | 14.10.2026 @ 10:00 – 12:00  |
| Final setup and test     | 15.10.2026 @ 10:00 – 11:00  |


## CTF Schedule

The schedule for the day of the Attack-Defense CTF:<span style=width:1px;height:0.5em;margin:0px;display:block></span>

| Time<sup>1</sup> | Event / State change                                                               |
|:----------------:|------------------------------------------------------------------------------------|
|      10:00       | [Platform](/platform) goes online, players may login via Discord |
|        -         | Players can download WireGuard configs and connect to the game network            |
|        -         | Players submit SSH keys to the platform            |
|        -         | Scoreboard `10.60.249.1` and flag submission `10.60.249.2` are pingable  |
|        -         | VPN Connection works within but not between teams                                  |
|      10:30       | Organizers start all vulnboxes and exploiters with submitted keys  |
|      11:00       | <span class=hltext>The Attack-Defense CTF officially begins</span>                 |
|        -         | Network access to vulnboxes and exploiters is unblocked                                |
|        -         | Players are given control over their VMs via the platform |
|        -         | Scoreboard serves game state (empty during network close)                              |
|        -         | Flag submission at `10.60.249.2:31337` accepts connections                         |
|      12:00       | Network opens and teams can communicate with other vulnboxes                       |
|      18:00       | The scoreboard scores are frozen for the last hour                                 |
|      19:00       | <span class=hltext>The Attack-Defense CTF officially ends</span>                   |

<span style=margin-top:-2em;font-size:0.6rem;display:block;width:100%;text-align:right><sup>1</sup> all times CEST</span>


