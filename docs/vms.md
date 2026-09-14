# Team VMs

<span class=hltext>Cloud-hosted vulnboxes and exploiter VMs are provided by the
organizers to all teams.</span>
These VMs are controlled via the [platform](/platform).
They have access to the internet via a
public IPv4 and IPv6 address, as well as to the [game network](/network)
through WireGuard, but they are not reachable from the internet.

## Setup

Vulnboxes are provisioned by the organizers with
<span class=hltext>4 cores</span> and exploiters with <span class=hltext>3
cores</span>, both with <span class=hltext>32 GB of RAM
and 128 GB of storage</span>. <span class=hltext>Self-hosting is allowed</span>,
but to avoid [checker fingerprinting](https://wiki.attacking-lab.com/attack-defense/playing/strategy/#checker-fingerprinting), we highly recommend using the supplied VMs
and only offloading compute where necessary.

Each vulnbox is provisioned with an organizer SSH key in `/root/.ssh/authorized_keys`.
Teams are free to remove this SSH key; however, doing so limits
the amount of support and automated fixes we can provide.

