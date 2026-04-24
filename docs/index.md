# ECSC 2025 A/D

The [European Cybersecurity Challenge 2025](https://ecsc.eu) will take place from the 6th to 10th of October
2025 at the [COS Torwar Arena in Warsaw](https://maps.app.goo.gl/EEJWaPx9QjvhiB4XA).
The Attack-Defense CTF will take place on <span class=hltext>8th of October</span>,
starting at <span class=hltext>10:00 CEST</span> and lasting
<span class=hltext>8 hours</span> until <span class=hltext>18:00 CEST</span>.

## Attack-Defense

<span class=hltext>Attack-Defense CTFs are a type of cybersecurity competition
in which participating teams host services and attempt to exploit each other over a
shared, private network.</span> The goal of the game is to *earn points* by
stealing secrets stored in your opponents' service instances,
and to *avoid losing points*, by preventing your own secrets from being stolen
and submitted, all the while keeping the services available and functioning.
<span class=hltext>The team with the most points by the end wins.</span>


## CTF Schedule

The schedule for the day of the Attack-Defense CTF:<span style=width:1px;height:0.5em;margin:0px;display:block></span>

| Time<sup>1</sup> | Event / State change                                                               |
|:----------------:|------------------------------------------------------------------------------------|
|    *earlier*     | Players receive credentials to the [platform](/platform) via the ECSC 2025 Discord |
|      09:00       | Players can download wireguard configuration to access the game network            |
|      09:30       | Players can start their vulnbox and exploiter using the platform                   |
|      10:00       | <span class=hltext>The Attack-Defense CTF officially begins</span>                 |
|        -         | SSH access to vulnboxes and exploiters is unblocked                                |
|        -         | [API endpoints](/api#Firewall) are available to test connectivity                  |
|        -         | Flag submission at `10.42.251.2:1337` accepts connections                          |
|        -         | Scoreboard at `10.42.251.2` is available (empty)                                   |
|        -         | Team router and scoreboard respond to pings                                        |
|        -         | VPN Connection works within but not between teams                                  |
|      11:00       | Network opens and teams can communicate with other vulnboxes                       |
|      17:00       | The scoreboard scores are frozen                                                   |
|      18:00       | <span class=hltext>The Attack-Defense CTF officially ends</span>                   |

<span style=margin-top:-2em;font-size:0.6rem;display:block;width:100%;text-align:right><sup>1</sup> all times CEST</span>


