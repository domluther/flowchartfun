# AGENTS.md: FlowchartFun

Guide for AI agents extending this project. Read it fully before changing code.

## What this is

A flowchart-practice website for OCR GCSE Computer Science (J277), made by a teacher for students. It was inspired by https://lga-resources.my.canva.site/interactive-flowchart-game-2.

- Repo: https://github.com/domluther/flowchartfun (branch `main`)
- Live: https://flowchartfun.netlify.app (Netlify auto-deploys from GitHub)
- 30 levels in three **tiers** (Easy, Medium, Hard; 10 each). Each level can be played in two **modes**.

### Vocabulary (do not mix these up)

| Term            | Meaning                                                                                                                                              |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tier**        | Level difficulty group: `easy`, `medium`, `hard` (`Tier` type, `level.tier`).                                                                        |
| **Mode**        | How a level is played: `guided` or `draw` (`Mode` type).                                                                                             |
| **Guided**      | Arrows are pre-drawn. The student drags (or clicks) symbols into slots.                                                                              |
| **Draw arrows** | The student places the symbols, then drags arrows between connection points. Arrows leaving a diamond must be labelled Yes or No. URL: `?mode=draw`. |

## Stack and conventions

- React Router 8 (framework mode, Vite) in **SPA mode** (`ssr: false`), React 19, Tailwind 4, TypeScript.
- **pnpm** only. **Jest** (swc, jsdom) for unit tests. **Biome** for lint and format. **Playwright** for e2e.
- Style: double quotes, space indentation. Biome also formats Markdown, so run `pnpm lint:fix` after editing any file.
- Edit existing files rather than recreating them.

### Commands

| Command                       | Purpose                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `pnpm dev`                    | Dev server on http://localhost:5173                                                 |
| `pnpm lint` / `pnpm lint:fix` | Biome check / auto-fix                                                              |
| `pnpm typecheck`              | `react-router typegen && tsc`                                                       |
| `pnpm test`                   | Jest (about 490 tests)                                                              |
| `pnpm test:e2e`               | Playwright (about 154 tests, about 1.5 min; starts its own dev server on port 5173) |
| `pnpm build`                  | Production build into `build/client`                                                |

**Definition of done for any change:** `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm test:e2e` all pass. Add or extend tests for new behaviour.

## Deployment (Netlify)

- `netlify.toml` runs `pnpm build` and publishes `build/client`.
- `public/_redirects` (`/* /index.html 200`) makes deep links such as `/level/5?mode=draw` work.
- Because the app is a static SPA, **do not add server loaders, actions or other server-only code**. If SSR is ever needed, the Netlify config must change too.
- The `Dockerfile` and `pnpm start` target the old SSR build and are unused.

## Architecture

```
app/
  routes.ts              route table: / (home), /level/:id
  routes/home.tsx        tiered menu, mode toggle, per-tier progress
  routes/level.tsx       loads a level by id, handles unknown ids
  components/
    LevelPlayer.tsx      the game screen for both modes
    ArrowLayer.tsx       SVG arrows, drag preview, Yes/No labels
  lib/
    types.ts             Level, NodeDef, EdgeDef, Item, Tier, Mode, Side, Shape
    levels.ts            all 30 levels, TIERS, getLevel, INTERCHANGEABLE
    game.ts              placements, check(), progress storage
    edges.ts             draw-mode arrow logic and checkEdges()
    layout.ts            grid to pixel positions, routeEdge, nearestSide, labels
    mode.ts              parseMode / withMode for the ?mode= param
__tests__/               Jest suites
e2e/levels.spec.ts       Playwright suite
```

### Data model (`app/lib/types.ts`)

- `Item`: a symbol in the bank (`id`, `shape`, `text`). Shapes: `terminator`, `io`, `process`, `decision`.
- `NodeDef`: a slot on the chart (`id`, `col`, `row`, `answer` = the correct item id, optional `fixed` = pre-placed and locked).
- `EdgeDef`: an arrow (`from`, `to` node ids; `fromSide`, `toSide`; optional `label` of `"Yes"` or `"No"`).
- `Level`: `id`, `tier`, `title`, `topic`, `instructions`, `items`, `nodes`, `edges`, optional `interchangeable`.

### Checking logic

- **Symbols** (`game.ts` `check`): each slot must hold an item with the same shape and text as its answer. Identical-looking items are interchangeable.
- **Interchangeable slots**: `level.interchangeable` lists groups of slot ids whose order doesn't matter (for example two consecutive inputs). The checker treats each group as a multiset. The groups are defined in `INTERCHANGEABLE` in `levels.ts`, keyed by level id, and attached when `levels` is exported.
- **Arrows** (`edges.ts` `checkEdges`, draw mode only): arrow sides are ignored. The arrow set must match exactly. Extra, missing or reversed arrows are wrong, and so is an unlabelled or mislabelled diamond exit. There is one arrow per ordered pair of nodes, and edge ids are `from->to`.
- Draw mode shows the Yes/No chooser only when the source slot currently holds a decision symbol.
- Progress is saved in `localStorage` under `flowchartfun-progress-v3` as `{guided: number[], draw: number[]}`. **Bump the key version if the shape changes.**

## Adding or editing levels

Levels are built in `levels.ts` with the `easy`, `medium` and `hard` helpers. The `twoWay` and `nestedSelection` helpers cover common patterns.

```ts
easy(
  { id: 1, title: "…", topic: "Sequence", instructions: "…" },
  [
    // nodes: [id, col, row, shape, text, fixed?]
    ["start", 1, 0, "terminator", "Start"],
    ["inA", 1, 1, "io", "Input A"],
  ],
  [
    // edges: [from, fromSide, to, toSide, label?]
    ["start", "b", "inA", "t"],
  ],
  [["process", "A distractor symbol"]], // optional distractors
);
```

Rules:

- Node id equals its item id (the `answer`). Distractors become `distractor-N` items and have no slot.
- Level ids are sequential 1 to 30 with 10 per tier (`__tests__/levels.test.ts` enforces this). Titles are unique.
- Every level needs a Start and End terminator, and every decision needs Yes and No exits.
- Layout is a grid of at most 3 columns (0 to 2), about 820px wide, with rows going down.
- `routeEdge` in `layout.ts` is a simple orthogonal router. Layout rules the tests enforce:
  - No arrow may pass through a symbol.
  - No collinear overlapping arrows (arrows that merge must share an endpoint and side).
  - Avoid `b` to `t` links between different columns on adjacent rows, because the stub is too short.
  - Loops back up use `l` to `l` (left, outside the columns) or `r` to `r` (right).
- If the order of two steps does not change the result, add them to `INTERCHANGEABLE`. Group members must share a shape.
- Keep diamond text short, because long text wraps badly. Check new levels visually: the geometry tests do not catch text overflow.
- Changing the level count means updating the tier tests, the e2e home page tests and this file.

## Testing notes

### Jest

- `react-router` is ESM-only, so tests mock it. Follow the existing mocks in `__tests__`.
- `__tests__/levels.test.ts` runs structural checks over all 30 levels, so new levels get validated automatically.
- `drawMode.test.tsx` uses level 5 (node ids `in0`, `dec`, `yes`, `no`).

### Playwright (`e2e/levels.spec.ts`)

It solves every level in both modes, checks that swapped symbols are rejected, tests each interchangeable group's alternative order, and tests the home page, progress and draw-mode behaviours. Known workarounds, which you should keep:

- `locator.dragTo` scrolls mid-drag on tall pages. Symbol drops use dispatched DOM `dragstart`/`dragover`/`drop` events with a shared `DataTransfer`. Arrow drawing uses real mouse moves.
- Wait for `networkidle` after `goto`. Events fired before React hydrates are lost.
- Straight arrows have a zero-width bounding box, so Playwright treats them as hidden. Use `click({ force: true })` to delete one.
- The viewport is 1280x2000 (set **inside** the project's `use` in `playwright.config.ts`, because `devices[...]` overrides a top-level viewport). A shorter viewport breaks `elementFromPoint` for off-screen drop targets.
- Any new level must pass the generic solve and swap tests in both modes. New interactions need their own tests.

## Gotchas

- Fixed symbols (such as Start or End) use `aria-disabled`, not `disabled`. A disabled button swallows the pointer-up when an arrow is dropped on it.
- The Yes/No chooser closes after a pick via `setSelectedEdge(null)`.
- Dropping an arrow on a symbol body uses `facingSide` to choose the side. Dropping on a dot uses the dot's `data-side`.
- Never use `rm` and `create` for the same file in one parallel batch.

## Ideas not yet built

- More levels or an extra tier, and a level-select showing the best attempt.
- Hints, a "show solution" button, or a count of checks used.
- Printable or exportable flowcharts, and teacher view or class progress. Progress is local to the browser only.
- Pseudocode-to-flowchart or flowchart-to-pseudocode tasks.
- Touch support for arrow drawing, and keyboard accessibility for drag actions.
- Allowing more interchangeable orderings, such as the output order inside loops.
