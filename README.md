# FlowchartFun

Flowchart practice for OCR GCSE Computer Science (J277). Built with React Router, pnpm, Jest, Playwright and Biome.

## Levels

30 levels in three tiers of 10:

- **Easy**: sequence and a single decision
- **Medium**: nested decisions and simple loops
- **Hard**: loops with decisions inside, validation and several exits

Every level can be played in three modes:

- **Guided**: the arrows are already drawn. Drag (or click) symbols into the numbered slots.
- **Draw arrows**: place the symbols, then drag from a connection point onto another symbol to draw each arrow. Arrows leaving a diamond must be labelled Yes or No.
- **Draw shapes** (`?mode=shapes`): the flowchart text and arrows are already shown. Drag a stadium, parallelogram, rectangle or rhombus onto each labelled box, or tap a shape and then a box on touch devices. The toolbox keeps a copy of each shape for reuse.

Progress is saved in the browser, separately for each mode.

## Scripts

| Command           | What it does                                        |
| ----------------- | --------------------------------------------------- |
| `pnpm dev`        | Start the dev server on http://localhost:5173       |
| `pnpm test`       | Jest unit and component tests                       |
| `pnpm test:e2e`   | Playwright tests: every level in all modes          |
| `pnpm lint`       | Biome (`pnpm lint:fix` to auto-fix)                 |
| `pnpm typecheck`  | Generate route types and run `tsc`                  |
| `pnpm build`      | Production build                                    |
| `pnpm worksheets` | Generate printable PDF workbooks into `worksheets/` |

The first time you run the Playwright tests, install a browser with `pnpm exec playwright install chromium`.

## Printable workbooks

`pnpm worksheets` runs `scripts/make-worksheets.mjs`, which drives Playwright through every level and writes four A4 PDFs to `worksheets/`: `guided.pdf`, `draw-arrows.pdf`, `draw-shapes.pdf` and `answer-key.pdf`. Each has a cover page and one page per level. It starts the dev server itself if one isn't running (or set `BASE_URL`), takes about 2 minutes, and needs a Playwright browser installed. Re-run it after changing levels or chart styling.

## Adding a level

Levels live in `app/lib/levels.ts`. Each symbol has a grid column (0 to 2) and row, and each arrow names the sides it leaves and enters. `__tests__/levels.test.ts` checks every level for a start and end, Yes/No on every decision, reachability, and arrows that pass through symbols or overlap.
