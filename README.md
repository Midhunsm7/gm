# MPR Air Hockey

Premium 3D arcade air hockey PWA: 12-level Championship, Survival Mode (unlocks after the Championship), Quick Match,
achievements, local leaderboard, haptics, synthesised audio, offline + installable. All data stays on the device (IndexedDB).

## Run it
```bash
npm install
npm test          # vitest: physics, AI constraints, difficulty ordering, frame-rate consistency, scoring, progression, persistence, flow
npm run dev       # dev server (also reachable from your phone on the LAN)
npm run build     # tsc --noEmit + production build + service worker
npm run preview   # serve the production build; use this to test install + offline
npm run icons     # regenerate PNG icons (python3 + Pillow)
```
Install/offline only work from the **production build** served over HTTPS (or localhost). Open it once online, then it works offline.
- Android Chrome / desktop Chrome & Edge: use the in-app Install button or the browser's Install option.
- iOS Safari: Share -> Add to Home Screen (iOS has no vibration API, so haptics are unavailable there).

## Controls
Mouse (or touch-drag) moves the paddle directly; WASD / arrow keys also work. Esc or P pauses. Touch has an adjustable offset so the paddle stays visible above your finger.
The paddle is confined to your half and obeys the same speed/acceleration limits as the AI.

## Architecture (src/)
| Area | Files |
|---|---|
| Simulation (no UI) | `core/physics.ts` (Rapier 2D, fixed 1/120 s step), `core/engine.ts`, `core/ai.ts`, `core/opponents.ts` |
| Progression | `core/progress.ts` (pure save logic, achievements, leaderboard provider), `core/flow.ts` (match configs, result kinds), `core/storage.ts` (IndexedDB + backup/recovery) |
| Platform | `audio.ts` (Web Audio synth, no asset files), `haptics.ts`, `store.ts` (zustand session + persistence) |
| Rendering | `render/Arena.tsx` (React Three Fiber scene, trails, pooled particles, shake), `render/GameView.tsx` (input, HUD, pause) |
| UI | `ui/*` (menu, levels, quick match, leaderboard, achievements, stats, settings, intro, results, toasts, PWA) |

Gameplay state never goes through React per frame: the engine updates inside `useFrame`; React only changes on goals, phases and countdown ticks.
The leaderboard uses a `LeaderboardProvider` interface, so an online provider can replace `LocalLeaderboard` without touching the game.

## Rules worth knowing
- Championship: first to 5 (the Champion: first to 7). Winning a level unlocks the next. Survival unlocks after beating all 12 in one run.
- Survival: first to 5 each match, difficulty rises every win (reaction, prediction, aim, power, aggression, defence, bank shots, adaptation), never above the player's physical speed. Milestones at 5/10/15/20/25. Quitting a live run banks it.
- Quick Match only updates overall stats; records, streaks and leaderboards are untouched.
