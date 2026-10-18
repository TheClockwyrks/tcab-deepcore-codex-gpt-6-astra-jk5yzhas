import * as C from "./constants";
import type { DeepReadonly } from "ts-essentials";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
export interface Cell {
  kind: C.TileKind;
  band: C.BandName | null;
  ore: C.OreId | null;
  material: C.MaterialId | null;
  health: number | null;
  maxHealth: number | null;
}
export interface Point {
  col: number;
  row: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Effect {
  name: string;
  x: number;
  y: number;
  age: number;
  seed: number;
  tint?: string;
}
export interface DeepcoreState {
  screen: C.ScreenName;
  panel: C.PanelId | null;
  mode: C.Mode;
  worldSize: C.WorldSize;
  coreRow: number;
  menuIndex: number;
  muted: boolean;
  simTime: number;
  elapsedSeconds: number;
  hasSave: boolean;
  credits: number;
  creditsEarned: number;
  deepestDepthMeters: number;
  coreTimer: number | null;
  coreGround: Point | null;
  camera: { x: number; y: number; lead: number };
  miner: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    facing: C.Facing;
    state: C.MinerState;
    travel: boolean;
    drill: boolean;
    fuel: number;
    hull: number;
    drilling: (Point & { dir: "down" | "left" | "right" }) | null;
  };
  cargo: Partial<Record<C.OreId, number>>;
  satchel: { resonite: number; cryenite: number; coreSample: boolean };
  tiers: Record<C.TrackName, number>;
  items: Record<C.ItemId, number>;
  nextTeleportHeight: number | null;
  nextTeleportSpeed: number | null;
  installed: number;
  noticesFired: Record<C.NoticeHazard, boolean>;
  notice: { hazard: C.NoticeHazard; age: number } | null;
  summary: {
    deepestDepthMeters: number;
    creditsEarned: number;
    elapsedSeconds: number;
    mode: C.Mode;
    componentsInstalled: number;
    deathCause: C.DeathCause | null;
  } | null;
  tiles: Cell[];
  images: Record<string, ImageBitmap>;
  systems: Record<string, ParticleSystem>;
  effects: Effect[];
  cues: C.CueName[];
  accumulator: number;
  hitTime: number;
  hurt: number;
  shake: number;
  animTime: number;
  note: string;
  noteTime: number;
  pointerDown: string | null;
  panelIndex: number;
  launchTime: number;
  alarmTime: number;
}
export type State = DeepReadonly<DeepcoreState>;
export const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));
export const bandAt = (r: number, depth: number): C.BandName =>
  C.BANDS[Math.min(3, Math.floor((4 * (r - 1)) / (depth - 1)))];
export function cell(
  kind: C.TileKind,
  band: C.BandName | null,
  ore: C.OreId | null = null,
  material: C.MaterialId | null = null,
): Cell {
  const health =
    band && ["rock", "ore", "material", "gas", "lava"].includes(kind)
      ? C.BAND_HEALTH[band]
      : null;
  return { kind, band, ore, material, health, maxHealth: health };
}
export function emptyMine(depth: number): Cell[] {
  return Array.from({ length: (depth + 1) * C.WORLD_COLS }, (_, i) => {
    const r = Math.floor(i / C.WORLD_COLS),
      c = i % C.WORLD_COLS;
    return cell(
      r === 0
        ? "tunnel"
        : c === 0 || c === C.WORLD_COLS - 1 || r === depth
          ? r === depth && c === C.CORE_COL
            ? "core"
            : "bedrock"
          : "tunnel",
      r > 0 && r < depth ? bandAt(r, depth) : null,
    );
  });
}
export function tile(s: State, col: number, row: number): DeepReadonly<Cell> {
  if (row < 1 && col >= 0 && col < C.WORLD_COLS) return cell("tunnel", null);
  return col < 0 || col >= C.WORLD_COLS || row > s.coreRow
    ? cell("bedrock", null)
    : (s.tiles[row * C.WORLD_COLS + col] ?? cell("bedrock", null));
}
export function put(s: DeepcoreState, col: number, row: number, c: Cell) {
  s.tiles[row * C.WORLD_COLS + col] = c;
}
export function generate(depth: number): Cell[] {
  const grid = emptyMine(depth);
  const set = (
    c: number,
    r: number,
    k: C.TileKind,
    ore: C.OreId | null = null,
    mat: C.MaterialId | null = null,
  ) => (grid[r * C.WORLD_COLS + c] = cell(k, bandAt(r, depth), ore, mat));
  for (let r = 1; r < depth; r++)
    for (let c = 1; c < C.WORLD_COLS - 1; c++) set(c, r, "rock");
  // Exact band quotas keep rare hazards stable even in a quick expedition.
  for (let b = 0; b < 4; b++) {
    const positions: Point[] = [];
    for (let r = 1; r < depth; r++)
      if (bandAt(r, depth) === C.BANDS[b])
        for (let c = 1; c < C.WORLD_COLS - 1; c++)
          positions.push({ col: c, row: r });
    const shuffle = [...positions].sort(() => Math.random() - 0.5);
    let cursor = 0;
    const place = (kind: C.TileKind, count: number) => {
      let n = 0;
      while (n < count && cursor < shuffle.length) {
        const p = shuffle[cursor++];
        if (kind === "ore" && p.row < C.ORE_MIN_ROW) continue;
        if ((kind === "stone" || kind === "lava") && p.col === C.CAVE_MOUTH_COL)
          continue;
        let ore: C.OreId | null = null;
        if (kind === "ore") {
          const f = (p.row - 1) / (depth - 1);
          const weights = C.MINERALS.map(
            (m) => m.pick * Math.max(0, 1 - Math.abs(f - m.peak) / m.spread),
          );
          let pick = Math.random() * weights.reduce((a, v) => a + v, 0);
          ore =
            C.MINERALS[weights.findIndex((w) => (pick -= w) <= 0)]?.id ??
            C.ORE_IDS[0];
        }
        set(p.col, p.row, kind, ore);
        n++;
      }
    };
    place("ore", Math.round(positions.length * C.ORE_DENSITY));
    if (b > 0) {
      const f = (b + 0.5) / 4;
      place(
        "stone",
        Math.round(
          positions.length *
            (C.STONE_DENSITY_MIN +
              ((C.STONE_DENSITY_MAX - C.STONE_DENSITY_MIN) * (f - 0.25)) /
                0.75),
        ),
      );
      place(
        "gas",
        Math.round(
          positions.length *
            (C.GAS_DENSITY_MIN +
              ((C.GAS_DENSITY_MAX - C.GAS_DENSITY_MIN) * (f - 0.25)) / 0.75),
        ),
      );
    }
    if (b >= 2) {
      const f = (b + 0.5) / 4;
      const count = Math.round(
        positions.length *
          (C.LAVA_DENSITY_MIN +
            ((C.LAVA_DENSITY_MAX - C.LAVA_DENSITY_MIN) * (f - 0.5)) / 0.5),
      );
      let placed = 0;
      for (const p of shuffle) {
        if (placed >= count) break;
        for (let dx = 0; dx < 3 && placed < count; dx++) {
          const c = p.col + dx;
          if (c >= 31 || c === C.CAVE_MOUTH_COL) continue;
          const old = grid[p.row * C.WORLD_COLS + c];
          if (old.kind === "rock") {
            set(c, p.row, "lava");
            placed++;
          }
        }
      }
    }
  }
  for (const mat of C.MATERIALS) {
    const rows = Array.from({ length: depth - 1 }, (_, i) => i + 1).filter(
      (r) => bandAt(r, depth) === C.MATERIAL_BAND[mat],
    );
    const row = rows[Math.floor(Math.random() * rows.length)],
      col = 2 + Math.floor(Math.random() * 28);
    for (
      let c = Math.min(col, C.CAVE_MOUTH_COL);
      c <= Math.max(col, C.CAVE_MOUTH_COL);
      c++
    ) {
      const old = grid[row * C.WORLD_COLS + c];
      if (old.kind === "lava" || old.kind === "stone") set(c, row, "rock");
    }
    set(col, row, "material", null, mat);
  }
  for (let c = C.CORE_COL; c <= C.CAVE_MOUTH_COL; c++)
    if (["stone", "lava"].includes(grid[(depth - 1) * C.WORLD_COLS + c].kind))
      set(c, depth - 1, "rock");
  set(C.CAVE_MOUTH_COL, 1, "tunnel");
  return grid;
}
export const buildings = C.BUILDINGS.map((id, i) => ({
  id,
  x: [100, 420, 740, 1020, 1320, 2200][i],
  y: C.SURFACE_Y - 160,
  w: 240,
  h: 160,
}));
export function initial(
  images: Record<string, ImageBitmap> = {},
  systems: Record<string, ParticleSystem> = {},
): DeepcoreState {
  return {
    screen: "title",
    panel: null,
    mode: "standard",
    worldSize: "standard",
    coreRow: C.STANDARD_ROWS,
    menuIndex: 0,
    muted: false,
    simTime: 0,
    elapsedSeconds: 0,
    hasSave: hasSave(),
    credits: 0,
    creditsEarned: 0,
    deepestDepthMeters: 0,
    coreTimer: null,
    coreGround: null,
    camera: { x: 0, y: -288, lead: 0 },
    miner: {
      x: C.SPAWN_COL * C.TILE + 12,
      y: C.SURFACE_Y - C.MINER_H,
      vx: 0,
      vy: 0,
      facing: "east",
      state: "idle",
      travel: true,
      drill: true,
      fuel: C.FUEL_TIERS[0],
      hull: C.HULL_TIERS[0],
      drilling: null,
    },
    cargo: {},
    satchel: { resonite: 0, cryenite: 0, coreSample: false },
    tiers: Object.fromEntries(C.TRACKS.map((t) => [t, 1])) as Record<
      C.TrackName,
      number
    >,
    items: Object.fromEntries(C.ITEM_IDS.map((t) => [t, 0])) as Record<
      C.ItemId,
      number
    >,
    nextTeleportHeight: null,
    nextTeleportSpeed: null,
    installed: 0,
    noticesFired: { gas: false, lava: false },
    notice: null,
    summary: null,
    tiles: emptyMine(C.STANDARD_ROWS),
    images,
    systems,
    effects: [],
    cues: [],
    accumulator: 0,
    hitTime: 0,
    hurt: 0,
    shake: 0,
    animTime: 0,
    note: "",
    noteTime: 0,
    pointerDown: null,
    panelIndex: 0,
    launchTime: 0,
    alarmTime: 0,
  };
}
export function clone(s: State): DeepcoreState {
  return {
    ...s,
    miner: {
      ...s.miner,
      drilling: s.miner.drilling ? { ...s.miner.drilling } : null,
    },
    tiles: s.tiles.slice() as Cell[],
    cargo: { ...s.cargo },
    satchel: { ...s.satchel },
    tiers: { ...s.tiers },
    items: { ...s.items },
    camera: { ...s.camera },
    noticesFired: { ...s.noticesFired },
    notice: s.notice ? { ...s.notice } : null,
    summary: s.summary ? { ...s.summary } : null,
    coreGround: s.coreGround ? { ...s.coreGround } : null,
    images: s.images as Record<string, ImageBitmap>,
    systems: s.systems as Record<string, ParticleSystem>,
    effects: s.effects.map((e) => ({ ...e })),
    cues: [...s.cues],
  };
}
export const maxFuel = (s: State) => C.FUEL_TIERS[s.tiers.fuel - 1];
export const maxHull = (s: State) => C.HULL_TIERS[s.tiers.hull - 1];
export const slots = (s: State) =>
  Object.values(s.cargo).reduce((a, v) => a + (v ?? 0), 0);
export const loadKg = (s: State) =>
  C.MINERALS.reduce((a, m) => a + (s.cargo[m.id] ?? 0) * m.weightKg, 0);
export const position = (s: State) => ({
  col: Math.floor((s.miner.x + C.MINER_W / 2) / C.TILE),
  row: Math.floor((s.miner.y + C.MINER_H / 2) / C.TILE),
});
export const depth = (s: State) =>
  Math.max(
    0,
    ((s.miner.y + C.MINER_H - C.SURFACE_Y) / C.TILE) * C.METERS_PER_ROW,
  );
/** The cut floor remains support when a downward cut is interrupted. */
export function cutSupport(s: State) {
  const feet = s.miner.y + C.MINER_H,
    row = Math.floor((feet + 0.01) / C.TILE),
    col = Math.floor((s.miner.x + C.MINER_W / 2) / C.TILE);
  const t = tile(s, col, row);
  if (t.health !== null && t.maxHealth !== null && t.health < t.maxHealth) {
    const surface = row * C.TILE + (1 - t.health / t.maxHealth) * C.TILE;
    if (feet > row * C.TILE && feet <= surface + 0.1)
      return { col, row, surface };
  }
  return null;
}
export function grounded(s: State) {
  const feet = s.miner.y + C.MINER_H;
  const cut = cutSupport(s);
  if (cut && Math.abs(feet - cut.surface) < 0.5) return true;
  const row = Math.floor((feet + 0.1) / C.TILE);
  if (Math.abs(feet - row * C.TILE) > 0.5) return false;
  return [s.miner.x + 1, s.miner.x + C.MINER_W - 1].some(
    (x) => tile(s, Math.floor(x / C.TILE), row).kind !== "tunnel",
  );
}
export function scanner(s: State) {
  const p = position(s);
  let best: { p: Point; target: C.MaterialId; distance: number } | null = null;
  for (let i = 0; i < s.tiles.length; i++) {
    const t = s.tiles[i];
    if (t.material && s.satchel[t.material] === 0) {
      const point = {
        col: i % C.WORLD_COLS,
        row: Math.floor(i / C.WORLD_COLS),
      };
      const distance = Math.hypot(point.col - p.col, point.row - p.row);
      if (
        distance <= (C.SCANNER_TIERS[s.tiers.scanner - 1] ?? -1) &&
        (!best || distance < best.distance)
      )
        best = { p: point, target: t.material, distance };
    }
  }
  return best
    ? {
        locked: true,
        target: best.target,
        dirX: (best.p.col - p.col) / (best.distance || 1),
        dirY: (best.p.row - p.row) / (best.distance || 1),
        distanceTiles: best.distance,
      }
    : { locked: false, target: null, dirX: 0, dirY: 0, distanceTiles: null };
}
export function snapshot(s: State) {
  return {
    screen: s.screen,
    panel: s.panel,
    mode: s.mode,
    worldSize: s.worldSize,
    coreRow: s.coreRow,
    menuIndex: s.menuIndex,
    muted: s.muted,
    simTime: s.simTime,
    elapsedSeconds: s.elapsedSeconds,
    hasSave: s.hasSave,
    credits: s.credits,
    creditsEarned: s.creditsEarned,
    deepestDepthMeters: s.deepestDepthMeters,
    coreTimer: s.coreTimer,
    coreGround: s.coreGround ? { ...s.coreGround } : null,
    camera: { ...s.camera },
    satchel: { ...s.satchel },
    tiers: { ...s.tiers },
    items: { ...s.items },
    nextTeleportHeight: s.nextTeleportHeight,
    nextTeleportSpeed: s.nextTeleportSpeed,
    noticesFired: { ...s.noticesFired },
    summary: s.summary ? { ...s.summary } : null,
    version: C.DEEPCORE_DEBUG_VERSION,
    depthMeters: depth(s),
    miner: {
      ...s.miner,
      ...position(s),
      grounded: grounded(s),
      maxFuel: maxFuel(s),
      maxHull: maxHull(s),
      overloaded: loadKg(s) >= C.JETPACK_TIERS[s.tiers.jetpack - 1].liftLimitKg,
      drilling: s.miner.drilling
        ? {
            ...s.miner.drilling,
            progress:
              1 -
              (tile(s, s.miner.drilling.col, s.miner.drilling.row).health ??
                0) /
                (tile(s, s.miner.drilling.col, s.miner.drilling.row)
                  .maxHealth ?? 1),
          }
        : null,
    },
    cargo: {
      ore: Object.fromEntries(Object.entries(s.cargo).filter(([, v]) => v)),
      slotsUsed: slots(s),
      slotCap: C.CARGO_TIERS[s.tiers.cargo - 1],
      loadKg: loadKg(s),
      liftLimitKg: C.JETPACK_TIERS[s.tiers.jetpack - 1].liftLimitKg,
    },
    rocket: {
      installed: C.ROCKET_COMPONENT_IDS.slice(0, s.installed),
      nextComponent: C.ROCKET_COMPONENT_IDS[s.installed] ?? null,
    },
    scanner: scanner(s),
    notice: s.notice
      ? { hazard: s.notice.hazard, shown: s.notice.age >= C.NOTICE_DELAY }
      : null,
  };
}
export function note(s: DeepcoreState, text: string) {
  s.note = text;
  s.noteTime = 3;
}
export function effect(
  s: DeepcoreState,
  name: string,
  x = s.miner.x + C.MINER_W / 2,
  y = s.miner.y + C.MINER_H / 2,
) {
  const source = tile(s, Math.floor(x / C.TILE), Math.floor(y / C.TILE));
  const bands = ["#bd9871", "#8da2a8", "#9189ad", "#c5837d"];
  const minerals = [
    "#a7a69c",
    "#dac47c",
    "#e89859",
    "#d4e7e8",
    "#6da9ed",
    "#dcd878",
    "#b1e1ba",
    "#ec754f",
    "#d596b7",
    "#c8eafa",
    "#76e6ab",
    "#e983b6",
    "#f6d281",
  ];
  const tint =
    name === "drill-debris" && source.band
      ? bands[C.BANDS.indexOf(source.band)]
      : name === "ore-sparkle" && source.ore
        ? minerals[C.MINERALS.findIndex((m) => m.id === source.ore)]
        : undefined;
  s.effects.push({
    tint,
    name,
    x,
    y,
    age: 0,
    seed: Math.floor(Math.random() * 100000),
  });
}
const SAVE_KEY = "deepcore-expedition-v1";
export function hasSave() {
  try {
    return !!globalThis.localStorage?.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}
export function clearSave(s: DeepcoreState) {
  try {
    globalThis.localStorage?.removeItem(SAVE_KEY);
  } catch {
    /* Storage can be unavailable. */
  }
  s.hasSave = false;
}
export function save(s: DeepcoreState) {
  if (s.coreTimer !== null) {
    note(s, "Cannot save an unstable Core Sample.");
    return;
  }
  try {
    const { images: _i, systems: _p, ...payload } = s;
    globalThis.localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    s.hasSave = true;
    note(s, "Expedition secured.");
  } catch {
    note(s, "Storage unavailable. Expedition not saved.");
  }
}
export function resume(s: State): DeepcoreState {
  try {
    const raw = globalThis.localStorage?.getItem(SAVE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as DeepcoreState;
      return {
        ...data,
        images: s.images as Record<string, ImageBitmap>,
        systems: s.systems as Record<string, ParticleSystem>,
        screen: "in-mine",
        panel: null,
        menuIndex: 0,
        miner: {
          ...data.miner,
          x: C.SPAWN_COL * C.TILE + 12,
          y: C.SURFACE_Y - C.MINER_H,
          vx: 0,
          vy: 0,
          drilling: null,
        },
        hasSave: true,
        simTime: s.simTime,
        muted: s.muted,
      };
    }
  } catch {
    /* Invalid saves cannot replace a session. */
  }
  return clone(s);
}
export function start(s: State): DeepcoreState {
  const n = initial(
    s.images as Record<string, ImageBitmap>,
    s.systems as Record<string, ParticleSystem>,
  );
  n.mode = s.mode;
  n.worldSize = s.worldSize;
  n.coreRow = Math.round(C.STANDARD_ROWS * C.WORLD_SIZE_SCALE[s.worldSize]);
  n.tiles = generate(n.coreRow);
  n.screen = "in-mine";
  n.muted = s.muted;
  n.simTime = s.simTime;
  clearSave(n);
  note(n, "A way home lies beneath your feet. Drill with S.");
  return n;
}
