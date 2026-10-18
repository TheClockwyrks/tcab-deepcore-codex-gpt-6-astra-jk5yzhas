# Deepcore

A browser mining expedition about the cost of getting home. Drill through four geological bands, haul weighted ore to a derelict camp, improve your suit, and fabricate a five-part escape rocket. Resonite and Cryenite lie buried below; the final Core Sample starts a 90-second race to the launch pad.

## Run

```sh
npm ci
npm run dev
```

Open the local Vite address. Choose Standard or Hardcore, then a Quick, Standard, or Marathon mine. Standard lets you restore your last Save Pad record after death; Hardcore deletes that record.

```sh
npm run build
npm run preview
```

The production site is `dist/index.html`. Serve the entire `dist/` directory with any static server, including under a subdirectory. There is no backend or external service.

## Controls

| Input | Action |
| --- | --- |
| A / D or Left / Right | Walk; drill a wall when grounded against it |
| S or Down | Drill downward |
| W / Up / Space | Jetpack thrust |
| E / Enter | Activate a camp building; confirm a menu or panel action |
| I | Inventory, ore disposal, and field supplies |
| 1–6 | Dynamite, plastic explosives, quantum teleporter, matter transmitter, nanobots, emergency fuel |
| J | Jettison a live Core Sample |
| Escape / P | Close a panel or pause; resume from pause |
| M | Mute all sound |
| Backtick | Engine diagnostics |

Menus, panels, and the status bar also support mouse, pen, and touch. Use Up/Down and Enter to navigate panels by keyboard. Driving the miner requires a keyboard.

Fuel and repairs are bought at camp, never granted by returning there. Cargo slots limit quantity; the jetpack's lift limit constrains weight. Drop ore in the inventory if you become overloaded. The Save Pad is the only save point, and it refuses a live Core Sample.

## Verification

```sh
npm run typecheck
npm run lint
npm run format
npm test
```

The tests run the real Simple 2D engine over a native canvas with a controlled clock, plus render-free simulation scenarios. They cover immutable transitions, input, fixed-step consistency, mining, generation, resizing, weight, hazards, transactions, saves, supplies, and rocket completion.

## Source and assets

`src/model.ts` owns terrain and state, `simulation.ts` advances the expedition, `ui.ts` defines the shared controls and their hit regions, `render.ts` draws the scene, and `debug.ts` implements the engine's automation surface. `src/game.ts` registers actions, loads assets and audio through the engine, and coordinates those modules. The supplied engine, constants, entry point, and configuration remain intact.

All shipped art and audio are committed under `assets/`. The `art-source/` directory includes original drawing-operation logs and the one-time authoring scripts used with `draw`, `draw-sheet`, `particle-2d`, `sfx-synth`, `sfx-sample`, and `music`. The production build only bundles these files; it never invokes an asset generator. The sole added development dependency, `@types/node`, types the native-canvas test host.

`showcase/` contains real canvas screenshots and a four-second engine recording. To recapture them while the development server runs on port 5173, run `node art-source/capture.mjs`. The capture harness poses an expedition through the same debug surface used by tests, then drives the actual drill and jetpack using keyboard events.
