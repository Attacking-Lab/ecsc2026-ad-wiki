# CTF Platform

<span class=hltext>The CTF platform is hosted at <a href="{{ platform_url }}">{{ platform_url | replace("https://", "") }}</a>.</span>
It is used for distributing WireGuard configs,
collecting SSH keys for VM access, and controlling teams' cloud-hosted
VM instances.

Players may log in via their Discord account; they will be automatically
joined to their respective team.

## VM Control

<span class=hltext>Each team can reboot or reset their vulnbox and exploiter
independently from the platform.</span>

- **Reboot** restarts the VM. Everything on disk is left untouched.
- **Reset** wipes the VM back to the organizer-provided initial state,
  discarding all changes made to it since - including any patches you
  applied and SSH keys you added or removed (see [Setup](vms.md#setup)).
  Use this if your VM is broken beyond repair.

!!! warning "Downtime costs points"
    Both actions take the VM offline for a short while. Checkers will
    register this as a failed check for the affected round(s), costing you
    SLA points, so time your reboots and resets accordingly.
