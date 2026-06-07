# Douyin Interactive Space Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a two-team, full-gameplay, horizontal Demo whose uncompressed multi-file output is no larger than 8 MiB and uses only relative local paths.

**Architecture:** Runtime configuration limits the Demo to France and Curacao and gives it an isolated save key. A dedicated Vite mode builds code without copying `public/`, then a Node packaging script copies an explicit asset allowlist, subsets the font, creates a lightweight pitch image, validates paths and size, and writes a submission ZIP.

**Tech Stack:** React 19, Vite 8, Phaser 3, Vitest, Node.js, FontTools, Pillow

---

### Task 1: Runtime Demo Boundary

**Files:**
- Create: `src/config/runtime.js`
- Modify: `src/data/teams.js`
- Modify: `src/utils/saveManager.js`
- Modify: `src/components/HomeScreen.jsx`
- Test: `src/app-regression.test.jsx`

- [ ] Add pure helpers that select all ten teams in full mode and France/Curacao in Demo mode.
- [ ] Add a regression test for the two-team selection boundary.
- [ ] Use a separate localStorage key for Demo saves.
- [ ] Disable the large home background and second Logo frame only in Demo mode.
- [ ] Run `npm test -- --run` and confirm all tests pass.

### Task 2: Dedicated Build Mode

**Files:**
- Modify: `vite.config.js`
- Modify: `package.json`
- Create: `scripts/build-douyin-demo.mjs`
- Modify: `.gitignore`

- [ ] Configure `douyin` mode with `base: './'`, `publicDir: false`, and `dist-douyin`.
- [ ] Add `npm run build:demo`.
- [ ] Build code and copy only the approved shared assets, France, Curacao, flags, and their badges.
- [ ] Generate a subset TTF from characters found in source files.
- [ ] Generate a nearest-neighbor lightweight pitch image without changing the original.
- [ ] Rewrite and validate any remaining `/assets/` references.
- [ ] Fail the build when the output exceeds 8 MiB.
- [ ] Package `dist-douyin/` as `deliverables/剑指美加墨-抖音互动空间-Demo.zip`.

### Task 3: Verification

**Files:**
- Test: generated `dist-douyin/`

- [ ] Run `npm test -- --run`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `npm run build:demo`.
- [ ] Serve `dist-douyin/` from a nested URL and verify the home, team selection, recruitment, lineup, and match screens.
- [ ] Confirm all requested images load and the console has no missing-resource errors.
- [ ] Confirm directory and ZIP sizes are both under 8 MiB.
- [ ] Commit and push the Demo build support.

