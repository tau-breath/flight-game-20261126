# WINDWARD — Coast Patrol

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/tau-breath/flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/tau-breath/flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

An entry in **[make.fun's "Make the best flight game" bounty](https://make.fun/bounty/best-flight-game-20261126-0057)** — an
original flight game for the browser, built with three.js and plain static files: no build step, no network
request, nothing to install. Open `game/index.html` from any static server and fly.

A 1930s-poster archipelago called the Cradle Coast: ochre cliffs, a long fjord, a lighthouse cape and a
clifftop airfield, flown in an open-cockpit monoplane, the **Kestrel Mk.I**.

## Fly it

```sh
node serve.ts          # serves game/ on http://localhost:8080
```

- `W` / `S` — pitch down / up
- `A` / `D` — roll left / right
- `Q` / `E` — rudder
- `Shift` / `Ctrl` — throttle up / down
- `G` — landing gear, `C` — cockpit or chase view
- `M` — mute, `P` or `Esc` — pause, `R` — restart
- Mouse: hold and move to steer, wheel to throttle

## The three sorties

| sortie | goal |
|---|---|
| **Ridge Rings** | thread eight rings along the headland ridge in 150 s |
| **Fjord Run** | six gates down the fjord, 45 m off the water, 180 s |
| **Home Approach** | two waypoints, then land on Skyhaven's runway 09 — graded on the touchdown |

Fuel burns faster at high throttle, hard ground contact costs damage, and flying under the stall speed
(33 m/s) drops the nose and sounds the horn.

## How it is made

`game/` holds the whole game as static files: `index.html`, one ES module per job under `game/src/`
(`flight.js` the flight model, `terrain.js` the heightfield and sea, `sky.js` the sky and clouds,
`aircraft.js` the Kestrel, `rings.js` the gates, `missions.js` the sorties, `hud.js` the instruments),
and `game/vendor/` the unmodified three.js build. `main.ts` is the hand-in program: it copies `game/` and
`screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Every texture, glyph and sound is made in code (canvas textures, Web Audio) or drawn with the fonts under
`game/fonts/` (Barlow Condensed and Inter, SIL Open Font License). Screenshots in `screenshots/` are real
renders of this game's own code at 1280 × 800.

## License

MIT — see `LICENSE`. three.js is MIT (see `game/vendor/THREE-LICENSE.txt`); the two fonts are
SIL Open Font License 1.1.
