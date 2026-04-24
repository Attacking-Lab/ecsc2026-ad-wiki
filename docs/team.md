# Team VMs

<span class=hltext>Cloud-hosted vulnboxes and exploiter VMs are provided by the
organizers to all teams.</span><br> The team router provides access to the
internet via a public IPV4 and IPv6 address, as well as to the [game
network](/network) through WireGuard. The vulnbox and exploiter are *not
reachable* from the internet via their public IPv4 or IPv6 address.

## Setup

Vulnboxes and exploiters run on OVHCloud infrastructure
as <span class=hltext>C3-32</span> instances in Warsaw's WAW1 data center.
With <span class=hltext>16 cores, 32 GB of ram and 400 GB of storage</span> each,
the vulnbox and exploiter should have enough resources to run the services,
exploit their vulnerabilities, and handle exploit as well as checker traffic.

<span class=hltext>Self-hosting services is not officially supported</span>,
and carries a latency and bandwidth penalty. The Wireguard connection
from the vulnbox to the router is established inside a cloud-provider network,
which allows for a faster connection than the public interface a
self-hosted vulnbox would have to proxy traffic over.

Each vulnbox is configured to accept SSH keys by the organizers in
addition to those configured by the teams via the [platform](/platform).
Teams are free to remove these SSH keys, however doing so limits
the amount of support and automated fixes the organizers can provide.

Vulnboxes and exploiters are assigned an IPv4 address in the [Game Network](/network#game-network-ips) and the [Team Cloud Network](/network#team-cloud-network).

## Firewall

Vulnboxes are provisioned with an [iptables](https://linux.die.net/man/8/iptables) firewall that drops all traffic except:

- Ingress connections from the game network to ports exposed by docker
- Ingress connections to SSH (port 22)
- Established connections
- Egress connections

Additionally, the vulnbox is firewall'd at the cloud-provider level from external
access to ensure all game-related traffic runs through the router and misconduct can be accounted for. 

Players may start their vulnbox <span class=hltext>30 minutes</span>
before the CTF begins through [the platform](/platform), but SSH access
will be prevented through the team router until the CTF has officially started.
