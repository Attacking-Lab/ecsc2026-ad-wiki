# Game Network

The A/D CTF takes place in the *game network*. Players connect to this
network through a [WireGuard](https://www.wireguard.com/#conceptual-overview) tunnel. WireGuard configuartion files will be made
available one hour before the game starts via the [platform](/platform). They can be
used with standard WireGuard tooling such as [wg-quick](https://www.man7.org/linux/man-pages/man8/wg-quick.8.html).

## VPN Access

Every WireGuard configuration file allows exactly <span class=hltext>one host</span> to connect to
the game network. Trying to use the same configuration on multiple hosts simultaneously will
likely make the connection unstable for all hosts using that configuration. We provide three configuration
files to every player, and 10 additional configs per team, which are only accessible
to captains and players promoted to *Technician* on the platform.

The VPN endpoint will be accessible via IPv4 for the infrastructure demo on
28.09.2025, and most likely only via IPv6 for the final CTF.

The configuration files contain credentials and information about the VPN endpoint.
**Do not share any of this information with anyone outside your team.** This includes the
endpoint information - it is different for every team. Modifying the configuration
files should not be necessary.

The VPN connection is only used to access the game network. Most importantly, your vulnbox,
your team members, other teams' vulnboxes, the flag submission, attack info, and the scoreboard.
Your devices **can not** use the VPN connection to access the internet.

## Game Network IPs

The game network uses the address range: `10.42.0.0/16`.

Every team has its own subnet, the *team network*: `10.42.<TEAM>.0/24`

Each team's *vulnbox* gets the ip `10.42.<TEAM>.2`.

Every team network has a *gateway* `10.42.<TEAM>.254`, controlled by the infrastructure.

Every host connected to the game network has an ip in its team's subnet and is reachable
from other hosts in the team subnet.

The NOP (**no**n-**p**laying) team is assigned the team id **1**. <br>
Therefore, the NOP vulnbox is available at the ip `10.42.1.2`.

The gameserver has the ip address `10.42.251.2`, and hosts the scoreboard (port **80**),
the flag submission (port **1337**) and the [Attack API](/api) (port **8080**).

## Access to the vulnbox

Connecting to vulnboxes is only possible through the VPN, including your own team's
vulnbox. Vulnboxes can access the internet, but they do not have a designated public ip.
They essentially sit behind a NAT. This is done to ensure all interactions can be
properly observed by the organizers and any misconduct can be accounted for. It also
minimizes opportunities for "opsec fails" and attacks that are likely against the rules
of conduct.

Note that the overall bandwidth for each team's in- and outbound VPN traffic is capped
at 1.8gbit/s. Keep this bandwidth budget in mind if you intend to
extract pcaps from your vulnbox to another host.

## Team Cloud Network

Each team's router, exploiter and vulnbox are also connected to an internal cloud network
without WireGuard. Connectivity within this network is mostly unrestricted.

This network has the address range: `10.43.<TEAM>.0/24`

The vulnbox gets the ip `10.43.<TEAM>.2`

The exploiter gets the ip `10.43.<TEAM>.3`

The gateway gets the ip `10.43.<TEAM>.254` 

These addresses of other teams are not reachable via the game network.

## Traffic Anonymization

Connections originating from outside your teams network are anonymized to prevent
[checker fingerprinting](https://wiki.attacking-lab.com/attack-defense/playing/strategy/#Checker%20Fingerprinting).

All connections from checkers and other teams will appear to originate from
`10.42.<TEAM>.254` - your team's *gateway*.

You should consider the following when encountering network issues:

- **Packets with IP header options are rejected** since they are likely used
  unintentionally and are easily fingerprintable. The game network will reply with ICMP type <code>Destination unreachable</code> (3) and code <code>Administratively Prohibited</code> (13).
- **TCP headers are normalized** to prevent teams from telling apart checkers
  from exploiters via patterns in TCP options / flags usage.
- **TTLs of packets entering team networks are capped at 32** such that
  traffic to vulnboxes arrives with the same TTL regardless from where it was sent.
- **TTLs are not decremented in our router mesh** to prevent `traceroute`-ing
  of router topology.
- **We artificially introduce latency and degrade performance** to prevent fingerprinting
  based on network conditions / response time of external exploiters.
- **MTU negotiations are dropped** to prevent using cached
  PMTU values to keep a single host fingerprinted.
- **TCP MSS** is set to a fixed value (MTU - 40) to prevent fingerprinting
  and potentially causing high packet rates.[^1]

[^1]: The router MTU and MSS values for the final CTF will be announced at a later date, since the onsite connection needs to be tested for this. The infrastructure demo on 28.09.2025 will use an MTU of 1340 and a MSS of 1300.

Despite all of this, it might still be advisable to run exploits from the vulnbox if
you suspect your traffic is being fingerprinted.

## Game Firewall

While traffic within one team is almost unrestricted, traffic *between* teams is
heavily restricted. The only allowed traffic is:

- TCP connections, but only to vulnboxes
- ICMP traffic of type `Echo Request` (8), `Echo Reply` (0) and
  `Destination unreachable` (3) with codes 0, 1, 2, 3, 10, and 13.

Note that attacking other teams hosts other than the vulnbox is generally prohibited.

Additionally, the game firewall blocks connections to other teams' vulnboxes in the
port range 8000 to 9000 (exclusive). Using this port range for tooling deployed on
the vulnbox ensures that it can not be easily accessed by other teams - even if the host
firewall would allow it.

Finally, the network drops malformed packets, packets with invalid checksums, and
packets that can't be attributed to connections. These firewall rules are designed to
protect teams and infrastructure from malicious traffic that does not target the
services. You generally won't receive ICMP messages for prohibited traffic, it will
just be discarded.

## Bandwidth Limits

We impose a bandwidth limit on the sum of traffic between any two distinct teams.<br>
This limit is **at least 20mbit/s.**

Note that the bandwidth achievable for a single connection between teams may be significantly
less than **20mbit/s** due to how our traffic anonymization policies affect TCP throughput.

We also impose a bandwidth limit of **at least 20mbit/s** on connections to
the gameserver per team.

Teams should monitor the traffic generated by their exploits to avoid becoming
fingerprintable based on latency introduced by hitting the bandwidth limit.

<div style=width:1;height:50px></div>

