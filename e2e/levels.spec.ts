import { expect, type Locator, type Page, test } from "@playwright/test";
import { levels, TIERS } from "../app/lib/levels";
import type { Level } from "../app/lib/types";

const SIDE_KEY = { top: "t", bottom: "b", left: "l", right: "r" } as const;
type Mode = "guided" | "draw";
const modes: Mode[] = ["guided", "draw"];

const levelUrl = (level: Level, mode: Mode) =>
  `/level/${level.id}${mode === "draw" ? "?mode=draw" : ""}`;

const sideKey = (side: string) =>
  SIDE_KEY[side as keyof typeof SIDE_KEY] ?? side;

// dragTo scrolls mid-drag on tall pages and grabs the wrong element, so fire the drag events directly.
async function dragAndDrop(source: Locator, target: Locator) {
  const dataTransfer = await source
    .page()
    .evaluateHandle(() => new DataTransfer());
  await source.dispatchEvent("dragstart", { dataTransfer });
  await target.dispatchEvent("dragover", { dataTransfer });
  await target.dispatchEvent("drop", { dataTransfer });
}

// Events fired before React hydrates are lost, so wait for the page to settle.
async function openLevel(page: Page, level: Level, mode: Mode) {
  await page.goto(levelUrl(level, mode));
  await page.waitForLoadState("networkidle");
}

async function placeSymbols(page: Page, level: Level, how: "drag" | "click") {
  for (const node of level.nodes.filter((n) => !n.fixed)) {
    const item = page.getByTestId(`item-${node.answer}`);
    const slot = page.getByTestId(`slot-${node.id}`);
    if (how === "drag") await dragAndDrop(item, slot);
    else {
      await item.click();
      await slot.click();
    }
  }
  const total = level.nodes.length;
  await expect(page.getByText(`${total}/${total} placed.`)).toBeVisible();
}

async function dragArrow(
  page: Page,
  from: string,
  fromSide: string,
  to: string,
) {
  const handle = page.getByTestId(`handle-${from}-${sideKey(fromSide)}`);
  const target = page.getByTestId(`slot-${to}`);
  await handle.scrollIntoViewIfNeeded();
  const h = await handle.boundingBox();
  const t = await target.boundingBox();
  if (!h || !t) throw new Error(`Cannot locate ${from} -> ${to}`);
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2, { steps: 10 });
  await page.mouse.up();
}

async function drawArrows(page: Page, level: Level) {
  for (const edge of level.edges) {
    await dragArrow(page, edge.from, edge.fromSide, edge.to);
    if (edge.label) {
      const options = page.getByLabel("Arrow options");
      await expect(options).toBeVisible();
      await options
        .getByRole("button", { name: edge.label, exact: true })
        .click();
      await expect(options).toBeHidden();
    }
  }
  await expect(
    page.getByText(`${level.edges.length}/${level.edges.length} arrows drawn.`),
  ).toBeVisible();
}

const status = (page: Page) => page.getByRole("status");

for (const mode of modes) {
  test.describe(`${mode} mode`, () => {
    for (const level of levels) {
      test(`level ${level.id}: ${level.title} can be solved`, async ({
        page,
      }) => {
        await openLevel(page, level, mode);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          `Level ${level.id}: ${level.title}`,
        );
        await expect(page.getByText(level.instructions)).toBeVisible();
        await placeSymbols(page, level, mode === "guided" ? "drag" : "click");
        if (mode === "draw") await drawArrows(page, level);
        await page.getByRole("button", { name: "Check Answer" }).click();
        await expect(status(page)).toContainText("Correct");

        const next = levels.find((l) => l.id === level.id + 1);
        if (next) {
          await expect(
            page.getByRole("link", { name: /Next level/ }),
          ).toHaveAttribute("href", levelUrl(next, mode));
        }
      });
    }

    for (const level of levels) {
      test(`level ${level.id}: ${level.title} rejects swapped symbols`, async ({
        page,
      }) => {
        await openLevel(page, level, mode);
        const movable = level.nodes.filter((n) => !n.fixed);
        const [a, b] = movable;
        const swapped = {
          ...Object.fromEntries(movable.map((n) => [n.id, n.answer])),
        };
        swapped[a.id] = b.answer;
        swapped[b.id] = a.answer;
        for (const n of movable) {
          await page.getByTestId(`item-${swapped[n.id]}`).click();
          await page.getByTestId(`slot-${n.id}`).click();
        }
        await page.getByRole("button", { name: "Check Answer" }).click();
        await expect(status(page)).not.toContainText("Correct");
      });
    }

    test("progress is saved for this mode only", async ({ page }) => {
      const level = levels[0];
      await openLevel(page, level, mode);
      await placeSymbols(page, level, "click");
      if (mode === "draw") await drawArrows(page, level);
      await page.getByRole("button", { name: "Check Answer" }).click();
      await expect(status(page)).toContainText("Correct");

      const other: Mode = mode === "guided" ? "draw" : "guided";
      const stored = await page.evaluate(() =>
        JSON.parse(localStorage.getItem("flowchartfun-progress-v3") ?? "{}"),
      );
      expect(stored[mode]).toContain(level.id);
      expect(stored[other] ?? []).not.toContain(level.id);
    });
  });
}

test.describe("draw mode drawing", () => {
  const level = levels[4];

  test("an arrow with the wrong Yes/No label is marked wrong", async ({
    page,
  }) => {
    await openLevel(page, level, "draw");
    await placeSymbols(page, level, "click");
    for (const edge of level.edges) {
      await dragArrow(page, edge.from, edge.fromSide, edge.to);
      if (edge.label) {
        const wrong = edge.label === "Yes" ? "No" : "Yes";
        await page
          .getByLabel("Arrow options")
          .getByRole("button", { name: wrong, exact: true })
          .click();
      }
    }
    await page.getByRole("button", { name: "Check Answer" }).click();
    await expect(status(page)).not.toContainText("Correct");
  });

  test("an unlabelled arrow from a diamond is not accepted", async ({
    page,
  }) => {
    await openLevel(page, level, "draw");
    await placeSymbols(page, level, "click");
    for (const edge of level.edges) {
      await dragArrow(page, edge.from, edge.fromSide, edge.to);
      if (edge.label) {
        await page
          .getByLabel("Arrow options")
          .getByRole("button", { name: "Close" })
          .click();
      }
    }
    await page.getByRole("button", { name: "Check Answer" }).click();
    await expect(status(page)).not.toContainText("Correct");
  });

  test("a missing arrow is not accepted", async ({ page }) => {
    await openLevel(page, level, "draw");
    await placeSymbols(page, level, "click");
    await page.getByRole("button", { name: "Check Answer" }).click();
    await expect(status(page)).not.toContainText("Correct");
  });

  test("click a dot then click a symbol also draws an arrow", async ({
    page,
  }) => {
    await openLevel(page, level, "draw");
    await placeSymbols(page, level, "click");
    const [first] = level.edges;
    await page
      .getByTestId(`handle-${first.from}-${sideKey(first.fromSide)}`)
      .click();
    await page.getByTestId(`slot-${first.to}`).click();
    await expect(
      page.getByText(`1/${level.edges.length} arrows drawn.`),
    ).toBeVisible();
  });

  test("a drawn arrow can be deleted", async ({ page }) => {
    await openLevel(page, level, "draw");
    await placeSymbols(page, level, "click");
    const [first] = level.edges;
    await dragArrow(page, first.from, first.fromSide, first.to);
    await expect(
      page.getByText(`1/${level.edges.length} arrows drawn.`),
    ).toBeVisible();
    // A straight arrow has a zero-width bounding box, so Playwright thinks it is hidden.
    await page
      .getByRole("button", { name: /^Arrow from/ })
      .click({ force: true });
    await page
      .getByLabel("Arrow options")
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(
      page.getByText(`0/${level.edges.length} arrows drawn.`),
    ).toBeVisible();
  });
});

test.describe("home page", () => {
  for (const tier of TIERS) {
    test(`lists 10 ${tier.label} levels that open`, async ({ page }) => {
      await page.goto("/");
      const section = page.getByRole("region", {
        name: new RegExp(`^${tier.label}`),
      });
      const links = section.getByRole("link");
      await expect(links).toHaveCount(10);
      const expected = levels.filter((l) => l.tier === tier.id);
      for (const [i, level] of expected.entries()) {
        await expect(links.nth(i)).toContainText(level.title);
        await expect(links.nth(i)).toHaveAttribute(
          "href",
          `/level/${level.id}`,
        );
      }
      await links.first().click();
      await expect(page).toHaveURL(`/level/${expected[0].id}`);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        expected[0].title,
      );
    });
  }

  test("toggling to draw arrows changes every level link", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Draw arrows" }).click();
    await expect(page).toHaveURL(/mode=draw/);
    for (const level of levels) {
      await expect(
        page.locator(`a[href="/level/${level.id}?mode=draw"]`),
      ).toHaveCount(1);
    }
  });

  test("shows completed levels with a tick and updates the count", async ({
    page,
  }) => {
    const level = levels[0];
    await openLevel(page, level, "guided");
    await placeSymbols(page, level, "click");
    await page.getByRole("button", { name: "Check Answer" }).click();
    await expect(status(page)).toContainText("Correct");
    await page.getByRole("link", { name: "Back" }).click();
    await expect(
      page.getByText(`1 of ${levels.length} levels complete`),
    ).toBeVisible();
    await expect(
      page.locator(`a[href="/level/${level.id}"]`).getByText("✓"),
    ).toBeVisible();

    await page.getByRole("link", { name: "Draw arrows" }).click();
    await expect(
      page.getByText(`0 of ${levels.length} levels complete`),
    ).toBeVisible();
  });
});

test("the last level has no next-level link", async ({ page }) => {
  const level = levels[levels.length - 1];
  await openLevel(page, level, "guided");
  await placeSymbols(page, level, "click");
  await page.getByRole("button", { name: "Check Answer" }).click();
  await expect(status(page)).toContainText("Correct");
  await expect(page.getByRole("link", { name: /Next level/ })).toHaveCount(0);
});

test("an unknown level shows a helpful message", async ({ page }) => {
  await page.goto("/level/999");
  await expect(page.getByText("That level doesn't exist.")).toBeVisible();
});
