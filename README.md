# FlowchartFun

Flowchart practice for OCR GCSE Computer Science (J277). Built with React Router, pnpm, Jest, Playwright and Biome.

## Levels

30 levels in three tiers of 10:

- **Easy**: sequence and a single decision
- **Medium**: nested decisions and simple loops
- **Hard**: loops with decisions inside, validation and several exits

Every level can be played in two modes (`?mode=draw` in the URL for the second):

- **Guided**: the arrows are already drawn. Drag (or click) symbols into the numbered slots.
- **Draw arrows**: place the symbols, then drag from a connection point onto another symbol to draw each arrow. Arrows leaving a diamond must be labelled Yes or No.

Progress is saved in the browser, separately for each mode.

## Scripts

| Command          | What it does                                  |
| ---------------- | --------------------------------------------- |
| `pnpm dev`       | Start the dev server on http://localhost:5173 |
| `pnpm test`      | Jest unit and component tests                 |
| `pnpm test:e2e`  | Playwright tests: every level in both modes   |
| `pnpm lint`      | Biome (`pnpm lint:fix` to auto-fix)           |
| `pnpm typecheck` | Generate route types and run `tsc`            |
| `pnpm build`     | Production build                              |

The first time you run the Playwright tests, install a browser with `pnpm exec playwright install chromium`.

## Adding a level

Levels live in `app/lib/levels.ts`. Each symbol has a grid column (0 to 2) and row, and each arrow names the sides it leaves and enters. `__tests__/levels.test.ts` checks every level for a start and end, Yes/No on every decision, reachability, and arrows that pass through symbols or overlap.
