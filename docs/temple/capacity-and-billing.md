# GGTemple Cloudflare capacity and cost assessment (2026-11-16)

## Architecture inspected

- A single `temple-main-v1` SQLite-backed Durable Object stores sessions, world state, media, and room history.
- Client sends a state frame at most every **90 ms** (about **11.1 incoming messages/s/player**); the server accepts frames at least 70 ms apart.
- Each accepted state frame runs an `UPDATE sessions` SQL query (at least one row written), and immediately broadcasts that state to every other live WebSocket.
- The DO uses `acceptWebSocket()` and automatic ping/pong response, allowing socket hibernation between traffic bursts, but a frequently active room still incurs compute.
- At most **4 fighters + 2 spectators** may join because seats are hard-coded in `cloudflare/worker.js`, `src/shared/temple-rules.js`, and the front-end/UI/tests. Removing only the admission guard would break seat assignment and UI assumptions.

## Illustrative load (all players connected and continuously transmitting)

| Connected players | State frames/s | Outgoing state messages/s | Minimum SQL session-write rows/hour |
| ---: | ---: | ---: | ---: |
| 6 | 67 | 333 | 240,000 |
| 12 | 133 | 1,467 | 480,000 |
| 20 | 222 | 4,222 | 800,000 |
| 40 | 444 | 17,333 | 1,600,000 |

This is a throughput model, **not a benchmark**. Additional writes (alarms, session joins, gameplay changes, activity) and read, compute, and bandwidth costs are omitted. Each player's idle client currently continues sending state frames, so idle is not free.

At 20 continuously online users, 50 million included SQL written rows would be consumed in approximately **62.5 total room-hours/month**; 6 users take ~208 room-hours. On a **paid** plan this is not a forced stop: exceeding included usage incurs additional fees. At $1 per additional million written rows, 20 players for an *additional* 10 room-hours implies roughly $8 in extra SQL writes alone.

## Pricing and stop conditions

Official sources:
- Durable Objects pricing: https://developers.cloudflare.com/durable-objects/platform/pricing/
- Durable Objects limits: https://developers.cloudflare.com/durable-objects/platform/limits/
- Durable Objects spending limits: https://developers.cloudflare.com/durable-objects/platform/spend-management/
- Workers spending limits: https://developers.cloudflare.com/workers/platform/spend-management/

The Workers Paid plan has its own base fee and allowance, and Durable Object requests/duration, SQL reads/writes, and stored data can incur additional costs. For DO WebSocket message billing, 20 incoming messages count as one billable DO request; outgoing messages are not charged as DO requests. There is no fixed published concurrent-player guarantee for this game. A single DO is single-threaded and the platform has a soft ~1,000 requests-per-second limit, but this is **not** a guarantee that GGTemple can handle that rate.

On 2026-11-13 Cloudflare introduced **Spending Limits** for Workers and Durable Objects. Configure BOTH separately in **Billing > Spend limits** and add email alerts. These limits apply **account-wide**, not only to GGTemple; fees for stored data and subscription are excluded, and open WebSocket traffic and enforcement delay may allow overages. Limits are not a precise invoice ceiling.

## Recommendation

1. **Do not switch to unlimited players without load testing.** First verify six-player regression on a clean, isolated Worker + SQLite Durable Object. Test 8, 12, and 20 concurrent clients on a staging room with representative movement, PvP, effects, and chat.
2. Fix client idle state transmission: send only when motion/animation state changes, with low-frequency keepalive; maintain predictable expiry and retry behavior.
3. Batch or reduce SQL session writes. Consider keeping transient positions in DO memory while active, persisting on a lower cadence; account for hibernation/restart and crash recovery.
4. Broadcast snapshots or changes at a fixed tick, not every inbound frame, and remove unnecessary duplicate world/roster broadcasts.
5. For 12–20 participants, inspect CPU, object duration, SQL writes/reads, response latency, WebSocket disconnects, and mobile GPU FPS under load. Use these measurements to choose the room size.
6. Keep an **explicit admission cap** and a reserved GM seat during rollout. An unexpectedly full room should reject new joins cleanly instead of allowing backpressure and a cascading outage.

**Deployment warning:** No production backend deploy or Pages publish is performed by this document/branch. The current production room and player data are not changed.
