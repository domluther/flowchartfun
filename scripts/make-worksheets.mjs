// Builds printable PDF workbooks (one per mode, plus an answer key) by
// screenshotting the real level pages with Playwright.
// Usage: pnpm worksheets   (starts the dev server itself if one isn't running)
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const PORT = 5173;
const BASE = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const OUT = new URL("../worksheets/", import.meta.url);

const MODES = {
  shapes: {
    title: "Draw shapes",
    file: "draw-shapes.pdf",
    howTo:
      "The text and arrows are already drawn. Draw the correct flowchart shape around the text in each box, and write Yes or No on each arrow leaving a decision.",
  },
  guided: {
    title: "Guided",
    file: "guided.pdf",
    howTo:
      "The arrows are already drawn. Decide which symbol belongs in each numbered box, then draw it in (or cut out the symbols and stick them in). Some symbols are not needed.",
  },
  draw: {
    title: "Draw arrows",
    file: "draw-arrows.pdf",
    howTo:
      "No arrows are drawn. Decide which symbol belongs in each numbered box and draw it in (or cut out the symbols and stick them in), then draw every arrow between them. Arrows leaving a diamond must be labelled Yes or No. Some symbols are not needed.",
  },
};

const esc = (s) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const PRINT_STYLE = `
  html, body { background: #fff !important; }
  aside { background: #fff !important; }
  div.select-none { background: #fff; outline: 2px solid #9ca3af; }
  [data-side] { display: none !important; }
`;

async function isUp() {
  try {
    return (await fetch(BASE)).ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (process.env.BASE_URL || (await isUp())) return null;
  const child = spawn("pnpm", ["dev", "--port", String(PORT), "--strictPort"], {
    stdio: "ignore",
  });
  for (let i = 0; i < 60; i++) {
    if (await isUp()) return child;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  child.kill();
  throw new Error("The dev server did not start in time.");
}

const png = async (locator) => (await locator.screenshot()).toString("base64");

/** Click every symbol into its slot. */
async function solve(page) {
  const slots = await page
    .locator("[data-slot]")
    .evaluateAll((els) => els.map((el) => el.dataset.slot));
  for (const id of slots) {
    const item = page.getByTestId(`item-${id}`);
    if (await item.count()) {
      await item.click();
      await page.getByTestId(`slot-${id}`).click();
    }
  }
}

async function capture(page, id, mode, solved) {
  const query = mode === "guided" ? "" : `?mode=${mode}`;
  await page.goto(`${BASE}/level/${id}${query}`, { waitUntil: "networkidle" });
  // biome-ignore lint/performance/useDomNodeTextContent: innerText is needed for rendered text (CSS capitalize)
  const title = await page.getByRole("heading", { level: 1 }).innerText();
  // biome-ignore lint/performance/useDomNodeTextContent: innerText is needed for rendered text (CSS capitalize)
  const tier = await page.locator("span.capitalize").first().innerText();
  // biome-ignore lint/performance/useDomNodeTextContent: innerText is needed for rendered text (CSS capitalize)
  const instructions = await page.locator("p.border-l-4").innerText();

  if (solved) await solve(page);
  await page.addStyleTag({ content: PRINT_STYLE });
  // Leave the Yes/No spots blank for students to fill in.
  await page.evaluate(() => {
    for (const t of document.querySelectorAll("svg text")) {
      if (t.textContent === "Drop Yes/No") t.textContent = "";
    }
  });

  const chart = await png(page.locator("div.select-none"));
  const tools = [];
  if (!solved) {
    const selector =
      mode === "shapes" ? '[data-testid^="shape-"]' : '[data-testid^="item-"]';
    const buttons = page.locator(selector);
    for (let i = 0; i < (await buttons.count()); i++) {
      const button = buttons.nth(i);
      const caption =
        mode === "shapes"
          ? ((await button.getAttribute("aria-label")) ?? "")
          : "";
      tools.push({ img: await png(button), caption });
    }
  }
  return { title, tier, instructions, chart, tools };
}

const CSS = `
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Poppins", system-ui, sans-serif; color: #111; }
  section { height: 270mm; display: flex; flex-direction: column; break-after: page; }
  section:last-child { break-after: auto; }
  h1 { margin: 0; font-size: 18pt; color: #1e40af; }
  .meta { margin: 1mm 0 3mm; font-size: 9pt; color: #6b7280; text-transform: capitalize; }
  .box { margin: 0 0 3mm; padding: 3mm 4mm; font-size: 10.5pt; border-left: 1.2mm solid #3b82f6; background: #eff6ff; }
  .how { font-size: 9pt; color: #78350f; background: #fffbeb; border-left-color: #f59e0b; }
  .chart { flex: 1; min-height: 0; display: flex; justify-content: center; align-items: flex-start; }
  .chart img { max-width: 100%; max-height: 100%; object-fit: contain; }
  .tools { display: flex; flex-wrap: wrap; justify-content: center; gap: 3mm; margin-top: 4mm; }
  .tool { text-align: center; font-size: 7.5pt; color: #374151; }
  .tool img { display: block; height: 13mm; margin: 0 auto; }
  .cover { justify-content: center; align-items: center; text-align: center; }
  .cover h1 { font-size: 30pt; }
  .cover p { max-width: 140mm; font-size: 12pt; color: #374151; }
  .name { margin-top: 14mm; font-size: 12pt; }
`;

function levelPage(data, mode, isKey) {
  const how = isKey ? "Answer key" : MODES[mode].howTo;
  const tools = data.tools
    .map(
      (t) =>
        `<div class="tool"><img src="data:image/png;base64,${t.img}">${esc(t.caption)}</div>`,
    )
    .join("");
  return `<section>
    <h1>${esc(data.title)}</h1>
    <div class="meta">${esc(data.tier)} · ${isKey ? "Answer key" : esc(MODES[mode].title)}</div>
    <div class="box">${esc(data.instructions)}</div>
    <div class="box how">${esc(how)}</div>
    <div class="chart"><img src="data:image/png;base64,${data.chart}"></div>
    ${tools ? `<div class="tools">${tools}</div>` : ""}
  </section>`;
}

function coverPage(title, blurb, student) {
  return `<section class="cover">
    <h1>FlowchartFun</h1>
    <h1 style="font-size:20pt;color:#111">${esc(title)}</h1>
    <p>OCR GCSE Computer Science (J277) flowchart practice.</p>
    <p>${esc(blurb)}</p>
    ${student ? '<div class="name">Name: ______________________ &nbsp; Class: __________</div>' : ""}
  </section>`;
}

async function writePdf(browser, file, body) {
  const page = await browser.newPage();
  await page.setContent(
    `<!doctype html><meta charset="utf-8">
     <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,600;0,700;1,600&display=swap">
     <style>${CSS}</style>${body}`,
    { waitUntil: "networkidle" },
  );
  await page.pdf({
    path: fileURLToPath(new URL(file, OUT)),
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.close();
  console.log(`Wrote worksheets/${file}`);
}

const server = await ensureServer();
const browser = await chromium.launch();
try {
  await mkdir(OUT, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 2000 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  const count = await page.locator('a[href^="/level/"]').count();

  for (const [mode, info] of Object.entries(MODES)) {
    let body = coverPage(info.title, info.howTo, true);
    for (let id = 1; id <= count; id++) {
      body += levelPage(await capture(page, id, mode, false), mode, false);
    }
    await writePdf(browser, info.file, body);
  }

  let key = coverPage(
    "Answer key",
    "Completed flowcharts for every level. The same answers apply to all three modes.",
    false,
  );
  for (let id = 1; id <= count; id++) {
    key += levelPage(await capture(page, id, "guided", true), "guided", true);
  }
  await writePdf(browser, "answer-key.pdf", key);
} finally {
  await browser.close();
  server?.kill();
}
