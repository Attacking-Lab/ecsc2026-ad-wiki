# Game Network

<span class=hltext>The A/D CTF takes place in a dedicated game network.</span>
Players connect to this
network through a [WireGuard](https://www.wireguard.com/#conceptual-overview) tunnel.
WireGuard configuration files will be made available before the game starts via the [platform](/platform). They can be
used with standard WireGuard tooling such as [wg-quick](https://www.man7.org/linux/man-pages/man8/wg-quick.8.html).

## VPN Access

Every WireGuard config allows exactly <span class=hltext>one host</span> to connect to
the game network. Trying to use the same config on multiple hosts simultaneously will
make the connection unstable for all hosts using that config.
Your *personal* config will be highlighted and not available for download by other players.
Additional configs are provided for other infrastructure you may want to hook
up to the network - coordinate to avoid using the same config in different places.

The config files contain credentials and information about the VPN endpoint.
**Do not share any of this information with anyone outside your team.** This includes the
endpoint information - it is different for every team. All VPN endpoints
support both IPv4 and IPv6.

The VPN connection is used to access the game network. Most importantly, your vulnbox,
your team members, other teams' vulnboxes, the flag submission, attack info, and the scoreboard.
Your devices **cannot** use the VPN connection to access the internet.

## Game Network IPs

The game network uses the address range: `10.60.0.0/16`.

Every team has its own subnet, the *team network*: `10.60.<TEAM>.0/24`

Each team's *vulnbox* gets the IP `10.60.<TEAM>.2`, its *exploiter* the IP `10.60.<TEAM>.3`.

Every team network has a *gateway* `10.60.<TEAM>.254`, controlled by the infrastructure.

Every host connected to the game network has an IP in its team's subnet and is reachable
from other hosts in the team subnet.

The NOP (**no**n-**p**laying) team is assigned the team ID **1**. <br>
Therefore, the NOP vulnbox is available at the IP `10.60.1.2`.

The scoreboard is hosted at `10.60.249.1` (port **80**) and the flag submission
at `10.60.249.2` (port **31337**). Attack info, scores, team and service metadata
are available via the [`ecsc2026ad`](https://pypi.org/project/ecsc2026ad/) Python
package, which handles client-side caching.

## Bandwidth Limits

We impose a bandwidth limit on traffic between any two distinct teams.
Each team may send **10mbps** of traffic via outbound connections,
and reply with **10mbps** to inbound traffic.

The overall bandwidth for each team's in- and outbound VPN traffic is capped
at **1gbit/s** respectively. Keep this in mind if you plan to ship
pcaps from your vulnbox to another host.

Note that the effective bandwidth for game network connections
may be lower due to how our traffic anonymization policies affect TCP throughput.

<div style=width:1;height:50px></div>

## Traffic Anonymization

Connections originating from outside your team's network are anonymized to prevent
[checker fingerprinting](https://wiki.attacking-lab.com/attack-defense/playing/strategy/#checker-fingerprinting).

All connections from checkers and other teams will appear to originate from
`10.60.<TEAM>.254` - your team's *gateway*.

You should consider the following when encountering network issues:

- **Packets with IP header options are rejected** since they are likely used
  unintentionally and are easily fingerprintable. The game network will reply with ICMP type <code>Destination unreachable</code> (3) and code <code>Administratively Prohibited</code> (13).
- **TCP headers are normalized** to prevent teams from telling apart checkers
  from exploiters via patterns in TCP options/flags usage.
- **TTLs of packets entering team networks are capped at 32** such that
  traffic to vulnboxes arrives with the same TTL regardless of where it was sent.
- **TTLs are not decremented in our router mesh** to prevent `traceroute`-ing
  of router topology.
- **We artificially introduce latency and degrade performance** to prevent fingerprinting
  based on network conditions/response time of external exploiters.
- **MTU negotiations are dropped** to prevent using cached
  PMTU values to keep a single host fingerprinted.
- **TCP MSS** is set to a fixed value (MTU - 40) to prevent fingerprinting
  and potentially causing high packet rates.[^1]

[^1]: The router MTU and MSS values for the final CTF will be announced at a later date, since the on-site connection needs to be tested for this. The infrastructure demo will use an MTU of 1420 and an MSS of 1380.

## Game Firewall

While traffic within one team is almost unrestricted, traffic *between* teams is
heavily restricted. The only allowed traffic is:

- TCP connections, but only to vulnboxes
- ICMP traffic of type `Echo Request` (8), `Echo Reply` (0), and
  `Destination unreachable` (3) with codes 0, 1, 2, 3, 10, and 13.

Additionally, the game firewall blocks connections to your vulnbox from other
teams except in the service port range 9000 to 9999 (inclusive).
This ensures tooling outside this port range can not be easily accessed
by other teams - even if the host firewall would allow it.

Note that attacking other teams' hosts other than the vulnbox is generally prohibited.

Finally, the network drops malformed packets, packets with invalid checksums, and
packets that can't be attributed to connections. These firewall rules are designed to
protect teams and infrastructure from malicious traffic that does not target the
services. You generally won't receive ICMP messages for prohibited traffic; it will
just be discarded.

