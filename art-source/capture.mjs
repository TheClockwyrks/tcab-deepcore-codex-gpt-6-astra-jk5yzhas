/** Run against `npm run dev`; captures the real game through its engine. */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (error) => globalThis.console.error(error));
await page.route("**/capture.html", (route) =>
  route.fulfill({
    contentType: "text/html",
    body: '<html><body style="margin:0;background:#0b1b27"><canvas id="stage" style="width:1280px;height:720px"></canvas></body></html>',
  }),
);
await page.goto("http://localhost:5173/capture.html");
await mkdir("showcase", { recursive: true });
for (const scene of ["descent", "surface", "rocket"]) {
  const recording = await page.evaluate(async (scene) => {
    const { createEngine, ConstantClock } =
      await import("/.vendor/engine/@clockwyrks/simple-2d/dist/index.js");
    const { game } = await import("/src/game.ts");
    const canvas = globalThis.document.getElementById("stage");
    const e = createEngine({
      canvas,
      width: 1280,
      height: 720,
      game,
      clock: new ConstantClock(1000 / 30),
      background: "#0b1b27",
    });
    await e.initialize();
    const d = e.debug;
    const pose = (method, ...args) => e.apply((s) => d[method](s, ...args));
    pose("setScreen", "in-mine");
    pose("generateMine");
    pose("setTier", "fuel", 3);
    pose("setFuel", 275);
    pose("setTier", "hull", 3);
    pose("setHull", 220);
    pose("setTier", "drill", 3);
    pose("setTier", "jetpack", 3);
    pose("setTier", "cargo", 3);
    pose("setTier", "scanner", 3);
    pose("setCredits", 2840);
    const key = (code, type) =>
      globalThis.document.dispatchEvent(
        new globalThis.KeyboardEvent(type, { code, bubbles: true }),
      );
    if (scene === "descent") {
      pose("setMinerPosition", 15 * 80 + 12, 147 * 80 - 72);
      pose("setElapsed", 148);
      pose("setCargo", "cuprite", 4);
      pose("setCargo", "argenite", 3);
      for (let r = 137; r < 147; r++) pose("setTile", 15, r, "tunnel");
      for (let c = 9; c < 23; c++) {
        pose("setTile", c, 143, "tunnel");
        pose("setTile", c, 144, "tunnel");
        pose("setTile", c, 147, "rock");
      }
      for (let c = 12; c < 19; c++) pose("setTile", c, 146, "tunnel");
      for (let r = 147; r < 155; r++) pose("setTile", 15, r, "rock");
      for (const [col, row, ore] of [
        [13, 141, "argenite"],
        [14, 141, "argenite"],
        [15, 141, "argenite"],
        [9, 146, "cuprite"],
        [10, 146, "cuprite"],
        [18, 149, "cobaltine"],
        [19, 149, "cobaltine"],
        [20, 149, "cobaltine"],
      ])
        pose("setOreTile", col, row, ore);
      pose("setMaterialTile", 21, 147, "resonite");
      pose("setOreTile", 15, 148, "argenite");
      pose("setOreTile", 15, 150, "cobaltine");
      pose("setOreTile", 17, 149, "verdite");
      pose("setTile", 20, 146, "gas");
      await e.advance(1);
      e.startRecording();
      key("KeyS", "keydown");
      await e.advance(75);
      key("KeyS", "keyup");
      key("Space", "keydown");
      await e.advance(28);
      key("Space", "keyup");
      await e.advance(17);
      const rec = e.stopRecording();
      pose("setMinerPosition", 15 * 80 + 12, 148 * 80 - 72);
      pose("setMinerVelocity", 0, 0);
      await e.advance(1);
      e.destroy();
      return rec;
    }
    if (scene === "rocket") {
      pose("setRocketInstalled", 4);
      pose("setMaterial", "resonite", 1);
      pose("setMaterial", "cryenite", 1);
      pose("setMinerPosition", 2280, 8);
      pose("setCredits", 5200);
      pose("setCoreCarried", true);
      pose("setCoreTimer", 34);
      pose("setPanel", "launch-pad");
    }
    await e.advance(1);
    e.destroy();
    return null;
  }, scene);
  await page.screenshot({ path: `showcase/${scene}.png` });
  if (recording)
    await writeFile(
      "showcase/descent.json.gz",
      gzipSync(JSON.stringify(recording)),
    );
}
await browser.close();
