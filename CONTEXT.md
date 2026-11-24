# MPR Air Hockey – Context Document (checkpoint)

Goal: premium 3D arcade air hockey PWA for a single player on their phone. 12-level Championship, Survival (unlocks after
Championship), Quick Match, achievements, local leaderboard, offline, installable. Everything stays on the device (IndexedDB).

## Stack
React 18 + TS + Vite 5, three + @react-three/fiber 8, @dimforge/rapier2d-compat (2D Rapier, wasm inlined so it works offline),
framer-motion, zustand, vite-plugin-pwa (workbox, prompt-to-update), Web Audio API (all sounds synthesised, no asset files).
Rapier is used in 2D: the table is a flat plane, so 2D physics is exact and cheaper; rendering is 3D.

## Layout
- src/core/constants.ts   table units (1 x 2), radii, speed caps, fixed step 1/120
- src/core/physics.ts     Rapier world, walls/goals, kinematic paddles, speed cap, safety net, goal detection
- src/core/ai.ts          AIController (delayed perception, bounce-aware prediction, intercept, strike/approach, aim, bank shots, adaptation)
- src/core/opponents.ts   12 profiles (AIParams), avatars/intros, difficulty rating, survival scaling, quick-match modifier
- src/core/engine.ts      GameEngine: phases, countdown, goals, slow-mo, interpolation, headless runToEnd() for tests
- src/core/progress.ts    SaveData, validation, applyMatch (stats/unlocks/achievements), survival runs, leaderboard provider
- src/core/storage.ts     IndexedDB kv, atomic backup, corruption recovery
- tests/                  vitest: physics, AI constraints, difficulty ordering, frame-rate consistency, scoring, progression, persistence
## Added after the checkpoint
- src/core/flow.ts        pure helpers: championship/survival/quick MatchConfig, SurvRun, resultKind, survivalRank (tests/flow.test.ts)
- src/audio.ts            Web Audio synth: all SFX + looping music, throttled collision sounds, volumes/mute, suspends when tab hidden
- src/haptics.ts          Vibration API patterns (paddle, wall, goal for/against, win, lose, milestone), toggle
- src/store.ts            zustand: screens, session, survival run, results, toasts, settings, serialized IndexedDB writes, reset
- src/render/Arena.tsx    R3F scene: glossy table texture, walls/goals, puck/paddles, reflections, trail, pooled particles, flash light, camera fit + shake, pointer->table raycast
- src/render/GameView.tsx engine lifecycle, events->audio/haptics/HUD, mouse/touch/keyboard input, pause on hide, wake lock, intro, pause menu
- src/ui/*                Avatar (SVG from AvatarSpec), Intro (12 distinct animations), Results (6 presentations), Menu, Levels, QuickMatch, Leaderboard, Achievements, Stats, Settings, Toasts, Pwa
- src/App.tsx, main.tsx, index.css; public/ icons + scripts/make_icons.py; README.md
- engine.ts tweaks: `disposed` flag (no stepping after wasm free), updateRender() in load() so the frozen puck shows at its serve spot during the intro

## UI polish pass (loading + home)
- src/ui/Backdrop.tsx  CSS-only animated background (drifting colour blobs, moving retro grid floor, rising sparks); reused by Loading and Menu
- src/ui/Loading.tsx   animated loader (mini rink with bouncing puck + paddles, wavy title, shimmer bar, rotating tips); used at app start and while the arena loads
- src/ui/Menu.tsx      animated gradient logo with sliding puck, stat pills, staggered spring-in colour-coded buttons (Btn `accent` prop sets --a), opponent avatar marquee
- index.css: new section at the bottom ("Animated backdrop, loading screen and colourful home page"); respects prefers-reduced-motion
- Verified visually only via static HTML + headless Chromium (CSS renders correctly at 390px wide); React behaviour still untested

## Input fix: paddle "sticking" at table edges
- GameView.onPointer now tracks pointer *movement* (ptr ref: raw pointer + clamped target) instead of clamping the absolute pointer position.
  Overshooting past the table edge no longer creates a dead zone; the target eases back onto the pointer once it is inside the playable area.
  State is reset on pointerdown, pause/end, and when the keyboard takes over. Needs play-testing on phone + mouse.

## Status log
- [x] core engine, AI, progression, storage + 21 passing tests (verified by the user's earlier run)
- [x] audio, haptics, store, flow (+6 flow tests; verified here with a vitest shim: all pass)
- [x] 3D arena, all UI screens, PWA icons, README
- [ ] NOT YET RUN: `npm install`, `npm test`, `npm run build`, and real on-device play. The authoring sandbox had no network, so
      the React/three/R3F code was only type-checked against stubs. First steps next session:
      1. `npm install && npm test && npm run build` and fix any type errors
      2. play-test: puck feel, AI difficulty curve, camera framing on phone portrait/landscape, performance on a mid phone
      3. verify install + offline with `npm run preview` over HTTPS
- Known risks to check first: Arena.tsx typings against real @types/three; framer-motion typings on Intro; iOS audio unlock; WebGL context loss handling.
- Ideas: rank-based online leaderboard provider, sound asset pass, per-opponent table skins, tutorial overlay.

## UI polish pass 2 (Quick Match + Championship pages)
- Page (ui/common.tsx) takes optional `theme` ('gold' | 'pink') and `icon`: themed pages get the animated Backdrop in that tone, gradient-flow title, animated underline and glowing section headings. Other pages (Leaderboard, Achievements, Stats, Settings) are unchanged; add `theme="..."` to any of them to opt in.
- Backdrop takes a `tone` prop (default | gold | pink) for blob/grid/spark colours.
- New Segmented component (common.tsx): pill selector with a sliding framer-motion highlight (layoutId); used for Quick Match "First to" and "AI difficulty".
- Pips has an `anim` prop (staggered pop-in).
- Levels.tsx: gold theme, animated progress banner (opponents defeated), opponent-coloured gradient cards, spring stagger-in, hover/tap, NEXT ribbon, check badge, floating avatars, shine sweep.
- QuickMatch.tsx: pink theme, staggered sections, bouncing avatar chips with pulsing ring, VS card with rotating conic border that swaps with a slide on opponent change, coloured sliding pills, pulsing Start button.
- Verified: tsc, build, 27 tests pass, 390px headless-Chromium screenshots with no console errors. Not play-tested on a real phone; "done" level state only reviewed in code (fresh save was used for screenshots).

## Appearance settings (theme + mallet/puck colour)
- Settings gained `theme` ('dark' | 'light'), `paddleColor`, `puckColor` (hex). Defaults + presets in src/core/appearance.ts; validateSave in progress.ts falls back to defaults for old saves / invalid values (test added, 28 tests pass).
- store.applyAppearance sets `data-theme` on <html>, CSS vars `--you` (mallet) / `--puck`, the theme-color meta tag, and mirrors the theme to localStorage ('mpr-theme') so index.html can apply it before first paint (no dark flash).
- Light theme = CSS block at the end of index.css (`:root[data-theme='light']` + overrides).
- Arena.tsx takes playerColor / puckColor / light props: recolours mallet body, ring, handle, side-rail neon, lights, trail/particles and puck; light mode swaps table texture, walls, base, background/fog and grid. Assets rebuild when any of these change (fine from the pause menu).
- Settings > Appearance: Dark/Light selector, live preview (mallets + sliding puck), swatch rows + custom colour picker. The same panel appears in the pause menu.
- IMPORTANT: do NOT use framer-motion `layoutId` inside pages rendered under App's `<AnimatePresence mode="wait">`: after the shared element moved, leaving the page hung the exit and left a blank screen. Segmented now slides its highlight with a plain CSS transform/transition.
