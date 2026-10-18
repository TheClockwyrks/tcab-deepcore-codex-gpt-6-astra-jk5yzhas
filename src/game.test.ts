/// <reference types="node" />
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { createEngine, ConstantClock } from "@clockwyrks/simple-2d";
import { readFile } from "node:fs/promises";
import { game } from "./game";
import { debug } from "./debug";
import * as M from "./model";
import * as C from "./constants";
import * as Sim from "./simulation";
import * as UI from "./ui";
const quiet = { left: false, right: false, up: false, down: false };
class TestAudio {
  decodeAudioData() {
    return Promise.resolve({ duration: 1 });
  }
  close() {
    return Promise.resolve();
  }
}
beforeAll(() => {
  vi.stubGlobal(
    "fetch",
    async (url: string) => new Response(await readFile(url.split("?")[0])),
  );
  vi.stubGlobal("createImageBitmap", async (blob: Blob) =>
    loadImage(new Uint8Array(await blob.arrayBuffer())),
  );
  vi.stubGlobal("AudioContext", TestAudio);
  const data = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  });
});
afterAll(() => vi.unstubAllGlobals());
async function setup() {
  const events = new EventTarget();
  const canvas = createCanvas(1280, 720);
  const engine = createEngine({
    canvas: canvas as unknown as HTMLCanvasElement,
    width: 1280,
    height: 720,
    game,
    clock: new ConstantClock(1000 / 60),
    surface: {
      cssWidth: () => 1280,
      cssHeight: () => 720,
      dpr: () => 1,
      events: () => events,
    },
  });
  await engine.initialize();
  const key = (code: string, down: boolean) => {
    const ev = new Event(down ? "keydown" : "keyup");
    Object.defineProperties(ev, {
      code: { value: code },
      repeat: { value: false },
    });
    events.dispatchEvent(ev);
  };
  return { engine, key };
}
function posed() {
  let s = M.initial();
  s = debug.setScreen(s, "in-mine");
  s = debug.setMinerPosition(s, 5 * C.TILE + 12, 10 * C.TILE - C.MINER_H);
  s = debug.setTile(s, 5, 10, "rock");
  s = debug.setTile(s, 5, 11, "rock");
  return s;
}
describe("engine-driven expedition", () => {
  it("loads real produced assets, registers diagnostics, navigates, and drills immutable terrain", async () => {
    const { engine, key } = await setup();
    expect(Object.keys(engine.state.images).length).toBeGreaterThan(80);
    expect(engine.debug.version).toBe(1);
    for (let i = 0; i < 3; i++) {
      key("Enter", true);
      await engine.advance(1);
      key("Enter", false);
      await engine.advance(1);
    }
    expect(engine.state.screen).toBe("in-mine");
    const before = engine.state;
    key("KeyS", true);
    await engine.advance(60);
    key("KeyS", false);
    expect(engine.state.miner.y).toBeGreaterThan(before.miner.y);
    expect(before.miner.fuel).toBe(100);
    expect(engine.state.miner.fuel).toBeLessThan(100);
    expect(engine.diagnostics().length).toBeGreaterThan(15);
    engine.destroy();
  });
  it("holds pause while simTime advances and Core time freezes", async () => {
    const { engine, key } = await setup();
    engine.apply((s) => debug.setScreen(s, "in-mine"));
    engine.apply((s) => debug.setCoreCarried(s, true));
    key("KeyP", true);
    await engine.advance(60);
    expect(engine.state.screen).toBe("paused");
    expect(engine.state.coreTimer).toBe(C.CORE_TIMER);
    expect(engine.state.simTime).toBeCloseTo(1);
    engine.destroy();
  });
  it("uses identical outcomes for different engine frame partitions", async () => {
    const a = await setup(),
      b = await setup();
    for (const e of [a.engine, b.engine]) {
      e.apply((s) => debug.setScreen(s, "in-mine"));
      e.apply((s) => debug.setMinerPosition(s, 400, -700));
    }
    b.engine.setClock(new ConstantClock(1000 / 30));
    await a.engine.advance(30);
    await b.engine.advance(15);
    expect(a.engine.state.miner.y).toBeCloseTo(b.engine.state.miner.y, 8);
    expect(a.engine.state.miner.vy).toBeCloseTo(b.engine.state.miner.vy, 8);
    a.engine.destroy();
    b.engine.destroy();
  });
});
describe("interrupted cuts and pointer controls", () => {
  it("lets thrust escape a partial down cut without destroying its remaining health", () => {
    const s = posed();
    for (let i = 0; i < 16; i++) Sim.tick(s, { ...quiet, down: true }, 1 / 120);
    const partial = M.tile(s, 5, 10).health;
    expect(partial).toBe(3);
    Sim.tick(s, quiet, 1 / 120);
    expect(M.grounded(s)).toBe(true);
    const y = s.miner.y;
    for (let i = 0; i < 30; i++) Sim.tick(s, { ...quiet, up: true }, 1 / 120);
    expect(s.miner.y).toBeLessThan(y);
    expect(M.tile(s, 5, 10).health).toBe(partial);
  });
  it("all panel controls share their rendered hit regions and operate without navigation gates", () => {
    let s = debug.setCredits(posed(), 50000);
    for (const panel of C.PANELS) {
      s = debug.setPanel(s, panel);
      for (const c of UI.controls(s)) {
        if (c.id === "close") continue;
        expect(debug.controlRect(s, c.id, c.subject)).toEqual(c.rect);
      }
    }
    s = debug.setPanel(s, null);
    s = debug.setScreen(s, "title");
    s = debug.buyItem(s, "emergency-fuel");
    s = debug.setFuel(s, 1);
    s = debug.useItem(s, "emergency-fuel");
    expect(s.miner.fuel).toBe(31);
  });
  it("destroys a ground Sample on death, with mode-specific save consequences", () => {
    let s = debug.save(posed());
    s = debug.placeCoreSample(s, 20, 20);
    s = debug.setHull(s, 0);
    Sim.tick(s, quiet, 0.01);
    expect(s.coreGround).toBeNull();
    expect(s.coreTimer).toBeNull();
    expect(s.hasSave).toBe(true);
    s = debug.setMode(M.resume(s), "hardcore");
    s = debug.setHull(s, 0);
    Sim.tick(s, quiet, 0.01);
    expect(s.hasSave).toBe(false);
  });
});
describe("mine, debug poses and physics", () => {
  it.each(C.WORLD_SIZES)(
    "generates bounded %s terrain and exactly one of each material",
    (size) => {
      const depth = C.STANDARD_ROWS * C.WORLD_SIZE_SCALE[size],
        grid = M.generate(depth);
      for (const mat of C.MATERIALS)
        expect(grid.filter((t) => t.material === mat)).toHaveLength(1);
      expect(grid[depth * 32 + C.CORE_COL].kind).toBe("core");
      expect(grid[32 + C.CAVE_MOUTH_COL].kind).toBe("tunnel");
      for (let b = 0; b < 4; b++) {
        const cells = grid.filter(
          (t) => t.band === C.BANDS[b] && t.kind !== "bedrock",
        );
        const fraction = cells.filter((t) => t.ore).length / cells.length;
        expect(fraction).toBeGreaterThan(
          C.ORE_DENSITY * (1 - C.DENSITY_TOLERANCE),
        );
        expect(fraction).toBeLessThan(
          C.ORE_DENSITY * (1 + C.DENSITY_TOLERANCE),
        );
      }
    },
  );
  it("resizes without changing carried cell bands or health", () => {
    let s = debug.setOreTile(M.initial(), 5, 200, "argenite");
    s = debug.setTileHealth(s, 5, 200, 3);
    s = debug.setWorldSize(s, "quick");
    expect(debug.tileAt(s, 5, 200)).toMatchObject({
      band: "rockbed",
      health: 3,
      ore: "argenite",
    });
    s = debug.setWorldSize(s, "marathon");
    expect(debug.tileAt(s, 16, 250).kind).toBe("tunnel");
    expect(debug.tileAt(s, 16, 1000).kind).toBe("core");
  });
  it("gates travel without gating drill fuel or persistent damage", () => {
    let s = posed();
    s = debug.setMinerTravel(s, false);
    const original = s;
    const next = M.clone(s);
    for (let i = 0; i < 15; i++)
      Sim.tick(next, { ...quiet, down: true }, 1 / 120);
    expect(next.miner.y).toBe(original.miner.y);
    expect(M.tile(next, 5, 10).health).toBe(3);
    expect(M.tile(original, 5, 10).health).toBe(4);
    expect(next.miner.fuel).toBeLessThan(original.miner.fuel);
  });
  it("does not drill when its faculty is disabled", () => {
    let s = posed();
    s = debug.setMinerDrill(s, false);
    for (let i = 0; i < 120; i++)
      Sim.tick(s, { ...quiet, down: true }, 1 / 120);
    expect(M.tile(s, 5, 10).health).toBe(4);
    expect(s.miner.drilling).toBeNull();
  });
  it("weight prevents takeoff until ore is dropped", () => {
    let s = posed();
    s = debug.setCargo(s, "ferron", 35);
    for (let i = 0; i < 60; i++) Sim.tick(s, { ...quiet, up: true }, 1 / 120);
    expect(s.miner.vy).toBe(0);
    s = debug.dropOre(s, "ferron");
    for (let i = 0; i < 60; i++) Sim.tick(s, { ...quiet, up: true }, 1 / 120);
    expect(s.miner.vy).toBeLessThan(0);
  });
  it("gas deals depth-scaled damage and lava obeys radiator", () => {
    let s = posed();
    s = debug.setHull(s, 500);
    Sim.gas(s, 5, 10);
    expect(s.miner.hull).toBe(440);
    expect(s.noticesFired.gas).toBe(true);
    s = debug.setTier(s, "radiator", 5);
    s = debug.setTile(s, 5, 10, "lava");
    const h = s.miner.hull;
    Sim.breakCell(s, 5, 10);
    expect(h - s.miner.hull).toBeCloseTo(C.LAVA_DRILL_DEEPSTONE * 0.2);
  });
  it("ground Core blast is location-aware and timer continues in panels", () => {
    let s = posed();
    s = debug.placeCoreSample(s, 10, 10);
    s = debug.setCoreTimer(s, 0.01);
    s = debug.setPanel(s, "inventory");
    Sim.tick(s, quiet, 0.02);
    expect(s.coreTimer).toBeNull();
    expect(s.screen).toBe("in-mine");
    s = debug.setCoreCarried(s, true);
    s = debug.setCoreTimer(s, 0.01);
    Sim.tick(s, quiet, 0.02);
    expect(s.summary?.deathCause).toBe("core-detonation");
  });
  it("continuous hull check runs even inside inventory", () => {
    let s = posed();
    s = debug.setPanel(s, "inventory");
    s = debug.setHull(s, 0);
    Sim.tick(s, quiet, 0.01);
    expect(s.screen).toBe("game-over");
  });
  it("rejects invalid poses loudly and reconcile is idempotent", () => {
    const s = posed();
    expect(() => debug.setTier(s, "drill", 6)).toThrow();
    expect(() => debug.setTileHealth(s, 2, 2, 3)).toThrow();
    expect(() => debug.setCoreTimer(s, 2)).toThrow();
    expect(debug.reconcile(debug.reconcile(s))).toEqual(s);
  });
});
describe("economy, supplies and UI transactions", () => {
  it("sells at canonical values and upgrades increase capacity without free refills", () => {
    let s = posed();
    s = debug.setCargo(s, "cuprite", 10);
    s = debug.sell(s);
    expect(s.credits).toBe(650);
    expect(s.creditsEarned).toBe(650);
    s = debug.setFuel(s, 30);
    s = debug.buyUpgrade(s, "fuel");
    expect(s.miner.fuel).toBe(105);
    expect(s.credits).toBe(350);
    s = debug.fillFuel(s);
    expect(s.miner.fuel).toBe(175);
    expect(s.credits).toBe(280);
  });
  it("refuses unaffordable purchases and supplies that change nothing", () => {
    let s = posed();
    s = debug.buyItem(s, "dynamite");
    expect(s.items.dynamite).toBe(0);
    s = debug.setItemCount(s, "nanobots", 1);
    s = debug.useItem(s, "nanobots");
    expect(s.items.nanobots).toBe(1);
  });
  it("explosives destroy ore and stone while preserving material", () => {
    let s = posed();
    s = debug.setOreTile(s, 4, 9, "ferron");
    s = debug.setTile(s, 5, 9, "stone");
    s = debug.setMaterialTile(s, 6, 9, "resonite");
    s = debug.setItemCount(s, "dynamite", 1);
    s = debug.useItem(s, "dynamite");
    expect(M.tile(s, 4, 9).kind).toBe("tunnel");
    expect(M.tile(s, 5, 9).kind).toBe("tunnel");
    expect(M.tile(s, 6, 9).kind).toBe("material");
    expect(M.slots(s)).toBe(0);
  });
  it("teleport consumes separately posed draws and transmitter is safe", () => {
    let s = posed();
    s = debug.setItemCount(s, "quantum-teleporter", 1);
    s = debug.setNextTeleportHeight(s, 8);
    s = debug.setNextTeleportSpeed(s, 700);
    s = debug.useItem(s, "quantum-teleporter");
    expect(s.miner.y + C.MINER_H).toBe(C.SURFACE_Y - 8 * C.TILE);
    expect(s.miner.vy).toBe(700);
    expect(s.nextTeleportHeight).toBeNull();
    s = debug.setItemCount(s, "matter-transmitter", 1);
    s = debug.useItem(s, "matter-transmitter");
    expect(s.miner.vy).toBe(0);
    expect(M.depth(s)).toBe(0);
  });
  it("fabricates in order, consumes materials and stops Core timer", () => {
    let s = posed();
    s = debug.setCredits(s, C.ROCKET_TOTAL_CREDITS);
    s = debug.setMaterial(s, "resonite", 1);
    s = debug.setMaterial(s, "cryenite", 1);
    s = debug.setCoreCarried(s, true);
    for (let i = 0; i < 5; i++) s = debug.fabricate(s);
    expect(s.installed).toBe(5);
    expect(s.credits).toBe(0);
    expect(s.coreTimer).toBeNull();
    s = debug.launch(s);
    for (let i = 0; i < 400 && s.screen === "in-mine"; i++)
      Sim.tick(s, quiet, 1 / 120);
    expect(s.screen).toBe("victory");
  });
  it("saves mine damage and resumes at surface, refusing live Samples", () => {
    let s = posed();
    s = debug.clearSave(s);
    s = debug.setTileHealth(s, 5, 10, 2);
    s = debug.save(s);
    expect(s.hasSave).toBe(true);
    const restored = M.resume(M.initial());
    expect(M.tile(restored, 5, 10).health).toBe(2);
    expect(M.depth(restored)).toBe(0);
    s = debug.clearSave(s);
    s = debug.setCoreCarried(s, true);
    s = debug.save(s);
    expect(s.hasSave).toBe(false);
  });
  it("reports actual menu and panel rectangles and returns to the named entry", () => {
    let s = M.initial();
    s.hasSave = false;
    s.menuIndex = 1;
    s = UI.choose(s);
    expect(s.screen).toBe("how-to-play");
    UI.back(s);
    expect(UI.menu(s)[s.menuIndex]).toBe("HOW TO PLAY");
    s = debug.setScreen(s, "in-mine");
    s = debug.setPanel(s, "upgrade-shop");
    expect(debug.controlRect(s, "buy-upgrade", "hull")?.w).toBeGreaterThan(0);
    expect(debug.menuItemRect(s, 0)).toBeNull();
  });
});
