# WINDWARD — Coast Patrol

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/tau-breath/flight-game-20261126/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/tau-breath/flight-game-20261126/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

An entry in **[make.fun's "Make the best flight game" bounty](https://make.fun/bounty/best-flight-game-20261126-0057)** — an
original combat flight game for the browser, built with three.js and plain static files: no build step, no
network request, nothing to install. Open `game/index.html` from any static server and fly.

A 1930s-poster archipelago called the Cradle Coast: ochre cliffs, a long fjord, a lighthouse cape and a
clifftop airfield, flown in an open-cockpit monoplane, the **Kestrel Mk.I** — two cowl guns, four rockets
and three flare pods against rust-liveried raiders and the flotilla they screen.

## Fly it

```sh
node serve.ts          # serves game/ on http://localhost:8080
```

- `W` / `S` — pitch down / up
- `A` / `D` — roll left / right
- `Q` / `E` — rudder
- `Shift` / `Ctrl` — throttle up / down
- `Space` — fire the guns; `F` — launch a rocket at the locked bandit
- `X` — flares, `Z` — barrel roll, `Tab` — cycle the lock
- `G` — landing gear, `C` — cockpit or chase view
- `M` — mute, `P` or `Esc` — pause, `R` — restart
- Mouse: hold and move to steer, wheel to throttle. On a touch screen the cockpit shows a stick,
  a FIRE button, RKT, FLR and ROLL.

## The four sorties

| sortie | goal |
|---|---|
| **Strike Run** | four stages: three run-in gates, splash a raider pair, silence a gunboat and two flak barges, then exit through the last gate (250 s) |
| **Ridge Rings** | thread eight rings along the headland ridge in 150 s |
| **Fjord Run** | six gates down the fjord, 45 m off the water, 180 s |
| **Home Approach** | two waypoints, then land on Skyhaven's runway 09 — graded on the touchdown |

## The fight

- **Lock and fire.** Hold the nose on a bandit and the lock ring fills; the bracket turns red and names
  the range and closing speed, then `F` sends a guided rocket. `Tab` cycles targets, and every live
  contact on the scope or off the nose gets its own marker.
- **Raiders.** Two rust monoplanes hunt in pairs: lead pursuit, a break turn inside 260 m, a break for
  home below 40 % health, and a falling wreck that burns all the way down.
- **The flotilla.** A gunboat and two flak barges put predicted bursts into the sky. Flares break their
  tracking; the burst radius still hurts.
- **Hull, fuel and ammo are one decision.** Gun hits, flak and a hard landing all take hull; the guns
  carry 1,150 rounds and the rockets four, so a sortie is a budget. Combos multiply hit score; an
  accuracy and kill summary closes the debrief.
- **Escape.** The barrel roll turns the world over for a second and takes 75 % off incoming fire.

Fuel burns faster at high throttle, hard ground contact costs damage, and flying under the stall speed
(33 m/s) drops the nose and sounds the horn.

## How it is made

`game/` holds the whole game as static files: `index.html`, one ES module per job under `game/src/`
(`flight.js` the flight model, `combat.js` guns, rockets, lock and damage, `enemies.js` raiders,
gunboats and their AI, `terrain.js` the heightfield and sea, `sky.js` the sky and clouds,
`aircraft.js` the Kestrel, `rings.js` the gates, `missions.js` the staged sorties, `hud.js` the
instruments and the fight board), and `game/vendor/` the unmodified three.js build. `main.ts` is the
hand-in program: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json`
with the vendored make.fun library.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Every texture, glyph and sound is made in code (canvas textures, Web Audio) or drawn with the fonts under
`game/fonts/` (Barlow Condensed and Inter, SIL Open Font License). Screenshots in `screenshots/` are real
renders of this game's own code at 1280 × 800, taken from the game's own staged camera: `?shot=strike`,
`?shot=guns`, `?shot=missile`, `?shot=landing` (also `ring`, `menu`).

## License

MIT — see `LICENSE`. three.js is MIT (see `game/vendor/THREE-LICENSE.txt`); the two fonts are
SIL Open Font License 1.1.
