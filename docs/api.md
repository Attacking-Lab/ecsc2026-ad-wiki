# Attack API

We provide a documented API on the gameserver (at `10.42.251.2` on port `8080`),
which returns filterable game-related information for use by team infrastructure.

## Endpoints

You may try the api live at <a href="https://api.demo.ad.ecsc2025.pl">https://api.demo.ad.ecsc2025.pl</a>.

<details class=simple><summary><code>/api/v1/services</code> : Fine-grained service info</summary>
This endpoint returns service information, by default for all services.
Data for a specific <code>service</code> may be queried through the
use of URL parameters.<br>

<div style=margin-top:1em>
Example API usage:
</div>
```sh
curl http://10.42.251.2:8080/api/v1/services
```
```json
{
    # service id : service info
    "0": {
        "name": "fooserv",
        "flagstores": 2,
    },
    ..
}
```
<div style=width:100%;height:1px;margin-top:-4px></div>
```sh
curl http://10.42.251.2:8080/api/v1/services?service=fooserv
```
```json
{
    "name": "fooserv",
    "flagstores": 2,
}
```
</details>


<details class=simple><summary><code>/api/v1/teams</code> : Fine-grained team info</summary>
This endpoint returns team information, by default for all teams.
Data for a specific <code>team</code> may be queried through the
use of URL parameters.<br>
<div style=margin-top:1em>
Example API usage:
</div>
```sh
curl http://10.42.251.2:8080/api/v1/teams
```
```json
{
    ..,
    # team id : team info
    "2": {
        "name": "Team Europe",
        "affiliation": "Team Europe",
        "logo": "/static/109381717838108471.png"
    },
    ..
}
```
<div style=width:100%;height:1px;margin-top:-5px></div>
```sh
curl http://10.42.251.2:8080/api/v1/teams?team=2
```
```json
{
    "name": "Team Europe",
    "affiliation": "Team Europe",
    "logo": "/static/109381717838108471.png"
}
```
</details>

<details class=simple><summary><code>/api/v1/score</code> : Fine-grained scoring info</summary>
This endpoint returns scoring related information, by default for the
current round. Data for a specific <code>round</code>, <code>team</code> and
<code>service</code> may be queried through
the use of URL parameters.<br>
An example of a valid response:
<div style=margin-top:1em>
Example API usage:
</div>
```sh
curl http://10.42.251.2:8080/api/v1/score
```
```json
{ # for current round id
    # team id : team info
    "12": {
        # service name : service info
        "fooserv": {
            "checker": "SUCCESS",
            "total": 632.7,
            "components": {
                "attack": 432.7,
                "defense": 0,
                "sla": 200.0
            },
            "flags_gained": 43,
            "flags_lost": 0
        },
        ..
    },
    ..
}
```
<div style=width:100%;height:1px;margin-top:-5px></div>
```sh
curl http://10.42.251.2:8080/api/v1/score?team=12&service=fooserv
```
```json
{
    "checker": "SUCCESS",
    "total": 632.7,
    "components": {
        "attack": 432.7,
        "defense": 0,
        "sla": 200.0
    },
    "flags_gained": 43,
    "flags_lost": 0
}
```
</details>

<details class=simple><summary><code>/api/v1/attack_info</code> : Fine-grained attack info</summary>
This endpoint returns <i>attack info</i> for services, by default for the
current round. Data for a specific <code>round</code>, <code>team</code>,
<code>service</code> or <code>flagstore</code> may be queried through
the use of URL parameters.<br>
<div style=margin-top:1em>
Example API usage:
</div>
```sh
curl http://10.42.251.2:8080/api/v1/attack_info
```
```json
{
    # latest round with attack info : round info
    "123": {
        # team id : team info
        "12": {
            # service name : service info
            "fooserv": {
                # flagstore id : attack info
                "0": "target is 10cd9l7rt3",
                "1": null
            },
            ..
        },
        ..
    }
}
```
<div style=width:100%;height:1px;margin-top:-5px></div>
```sh
curl http://10.42.251.2:8080/api/v1/attack_info?service=fooserv
```
```json
{
    "123": {
        "12": {
            "0": "target is 10cd9l7rt3",
            "1": null
        },
        ..
    }
}
```
</details>

<details class=simple><summary><code>/api/v1/current_round</code> : current round time and id</summary>
    This endpoint returns the current round id and start time as an ISO-8601
    UTC timestamp with second precision.
    If the game has not started, this endpoint will return round <code>0</code>.
    <div style=margin-top:1em>
    Example API usage:
    ```sh
    curl http://10.42.251.2:8080/api/v1/current_round
    ```
    ```json
    {
        "round": 4,
        "time": "2025-09-15T13:58:21"
    }
    ```
    </details>

<details class=simple><summary><code>/api/v1/next_round</code> : next round time and id</summary>
    This endpoint waits for the current round to complete before returning the
    new round start time as an ISO-8601 UTC timestamp with second precision.
    The connection may timeout if the new round has not started after two rounds worth of time.<br>
    <div style=margin-top:1em>
    Example API usage:
    ```sh
    curl http://10.42.251.2:8080/api/v1/next_round
    ```
    ```json
    {
        "round": 5,
        "time": "2025-09-15T13:59:00"
    }
    ```
    </details>

<details class=simple><summary><code>/api/faustctf2024/teams.json</code> : Attack Info (FaustCTF 2024)</summary>
This endpoint returns attack info in the FaustCTF 2024 <code>/teams.json</code> format.<br>
<div style=margin-top:1em>
Example API usage:
```sh
curl http://10.42.251.2:8080/api/faustctf2024/teams.json
```
```json
{
    "teams": [
        # team ids
        123, 456, 789,
        ..
    ],
    "flag_ids": {
        # service name : service info
        "service1": {
            # team id : attack infos for validity period
            "123": ["abc123", "def456"],
            "124": ["xxx", "yyy"],
            ..
        },
        ..
    }
}
```
</details>

<details class=simple><summary><code>/api/saarctf2024/attack.json</code> : Attack Info (SaarCTF 2024)</summary>
This endpoint returns attack info in the SaarCTF 2024 <code>/attack.json</code> format.
<div style=margin-top:1em>
Example API usage:
```sh
curl http://10.42.251.2:8080/api/saarctf2024/attack.json
```
```json
{
    "teams": [
        # team infos
        {
            "id": 1,
            "name": "NOP",
            "ip": "10.42.1.2"
        },
        ..
    ],
    "flag_ids": {
        # service name : service info
        "fooserv": {
            # team vulnbox ip : team info
            "10.42.1.2": {
                # round id : attack info
                "123": ["info_flag1", "info_flag2"]
                ..
            },
            ..
        },
        "barserv": {
            "10.42.1.2": {
                "123": "info_single"
            },
            ..
        }
    }
}
```
</details>

## API Details

The API returns attack info generated *at the start* of the round specified by the request.
Scoring data returned by the api is the state of team scores *at the start* of
the round specified in the request.

!!! info "Round schedule drift"
    Even though *successful* rounds are guaranteed to stay aligned with the
    round interval of <span class=hltext>60 seconds</span>, *single rounds may be cancelled in rare cases*,
    such as when the gameserver needs to be restarted to address an infrastructure
    issue. To keep players in sync with the round schedule despite this albeit
    rare possibility, please use the `/api/v1/next_round` endpoint.


## Parameters

The first played round of the CTF has the id **1**.

Player team ids start at **2**, since id **1** is reserved for the NOP Team.

Service ids are indexed starting at **1**.

Flagstore ids are indexed starting at **0**.


## Scoreboard

*Any APIs made available through the scoreboard host at `10.42.251.2` on port
`80` exist solely for enabling the client-side functionality of the scoreboard.
No guarantees are made for the availability or contents of these APIs.*

