import * as C from "./constants";
import * as M from "./model";
import * as S from "./simulation";
import { menu, menuRect, controls } from "./ui";
function valid(condition: unknown): asserts condition {
  if (!condition)
    throw new RangeError("Deepcore: invalid debug argument or state");
}
function number(v: number, min = 0, max = Infinity) {
  valid(Number.isFinite(v) && v >= min && v <= max);
}
function member<T>(value: T, list: readonly T[]) {
  valid(list.includes(value));
}
function change(s: M.State, fn: (n: M.DeepcoreState) => void) {
  const n = M.clone(s);
  fn(n);
  return n;
}
function coordinate(s: M.State, c: number, r: number) {
  number(c, 0, C.WORLD_COLS - 1);
  number(r, 1, s.coreRow);
  valid(Number.isInteger(c) && Number.isInteger(r));
}
function replace(
  s: M.State,
  c: number,
  r: number,
  kind: C.TileKind,
  ore: C.OreId | null = null,
  mat: C.MaterialId | null = null,
) {
  coordinate(s, c, r);
  return change(s, (n) =>
    M.put(n, c, r, M.cell(kind, M.bandAt(r, s.coreRow), ore, mat)),
  );
}
const oreIds = C.MINERALS.map((m) => m.id);
export const debug = {
  version: C.DEEPCORE_DEBUG_VERSION,
  snapshot: M.snapshot,
  tileAt: M.tile,
  findTile(s: M.State, kind: C.TileKind) {
    member(kind, C.TILE_KINDS);
    let best: M.Point | null = null,
      d = Infinity;
    const p = M.position(s);
    s.tiles.forEach((t, i) => {
      if (t.kind === kind) {
        const q = { col: i % C.WORLD_COLS, row: Math.floor(i / C.WORLD_COLS) },
          distance = Math.hypot(q.col - p.col, q.row - p.row);
        if (distance < d) {
          d = distance;
          best = q;
        }
      }
    });
    return best;
  },
  buildings(_s: M.State) {
    return M.buildings.map((b) => ({ ...b }));
  },
  menuItemRect: menuRect,
  controlRect(s: M.State, control: string, subject: string | null) {
    return (
      controls(s).find((c) => c.id === control && c.subject === subject)
        ?.rect ?? null
    );
  },
  reset(s: M.State) {
    const n = M.initial(
      s.images as Record<string, ImageBitmap>,
      s.systems as M.DeepcoreState["systems"],
    );
    n.muted = s.muted;
    return n;
  },
  reconcile(s: M.State) {
    return M.clone(s);
  },
  generateMine(s: M.State) {
    return { ...M.clone(s), tiles: M.generate(s.coreRow) };
  },
  clearMine(s: M.State) {
    return { ...M.clone(s), tiles: M.emptyMine(s.coreRow) };
  },
  clearCargo(s: M.State) {
    return { ...M.clone(s), cargo: {} };
  },
  clearItems(s: M.State) {
    return change(s, (n) => {
      for (const id of C.ITEM_IDS) n.items[id] = 0;
    });
  },
  setTile(s: M.State, c: number, r: number, kind: C.TileKind) {
    member(kind, ["rock", "gas", "lava", "stone", "bedrock", "tunnel", "core"]);
    return replace(s, c, r, kind);
  },
  setOreTile(s: M.State, c: number, r: number, ore: C.OreId) {
    member(ore, oreIds);
    return replace(s, c, r, "ore", ore);
  },
  setMaterialTile(s: M.State, c: number, r: number, mat: C.MaterialId) {
    member(mat, C.MATERIALS);
    return replace(s, c, r, "material", null, mat);
  },
  setTileHealth(s: M.State, c: number, r: number, health: number) {
    coordinate(s, c, r);
    const t = M.tile(s, c, r);
    valid(t.maxHealth !== null);
    number(health, Number.MIN_VALUE, t.maxHealth);
    return change(s, (n) => M.put(n, c, r, { ...t, health }));
  },
  placeCoreSample(s: M.State, c: number, r: number) {
    coordinate(s, c, r);
    valid(s.coreTimer === null && M.tile(s, c, r).kind === "tunnel");
    return change(s, (n) => {
      n.coreGround = { col: c, row: r };
      n.coreTimer = C.CORE_TIMER;
    });
  },
  setMinerPosition(s: M.State, x: number, y: number) {
    number(x, -Infinity);
    number(y, -Infinity);
    return change(s, (n) => {
      n.miner.x = x;
      n.miner.y = y;
    });
  },
  setMinerVelocity(s: M.State, vx: number, vy: number) {
    number(vx, -Infinity);
    number(vy, -Infinity);
    return change(s, (n) => {
      n.miner.vx = vx;
      n.miner.vy = vy;
    });
  },
  setFacing(s: M.State, facing: C.Facing) {
    member(facing, C.FACINGS);
    return change(s, (n) => {
      n.miner.facing = facing;
    });
  },
  setFuel(s: M.State, value: number) {
    number(value);
    return change(s, (n) => {
      n.miner.fuel = value;
    });
  },
  setHull(s: M.State, value: number) {
    number(value);
    return change(s, (n) => {
      n.miner.hull = value;
    });
  },
  setMinerTravel(s: M.State, enabled: boolean) {
    valid(typeof enabled === "boolean");
    return change(s, (n) => {
      n.miner.travel = enabled;
    });
  },
  setMinerDrill(s: M.State, enabled: boolean) {
    valid(typeof enabled === "boolean");
    return change(s, (n) => {
      n.miner.drill = enabled;
    });
  },
  setScreen(s: M.State, screen: C.ScreenName) {
    member(screen, C.SCREENS);
    return { ...M.clone(s), screen };
  },
  setPanel(s: M.State, panel: C.PanelId | null) {
    if (panel !== null) member(panel, C.PANELS);
    return { ...M.clone(s), panel };
  },
  setMenuIndex(s: M.State, index: number) {
    number(index, 0, menu(s).length - 1);
    valid(Number.isInteger(index));
    return { ...M.clone(s), menuIndex: index };
  },
  setMode(s: M.State, mode: C.Mode) {
    member(mode, C.MODES);
    return { ...M.clone(s), mode };
  },
  setWorldSize(s: M.State, worldSize: C.WorldSize) {
    member(worldSize, C.WORLD_SIZES);
    const n = M.clone(s),
      coreRow = Math.round(C.STANDARD_ROWS * C.WORLD_SIZE_SCALE[worldSize]);
    const grid = M.emptyMine(coreRow);
    for (let r = 1; r < Math.min(coreRow, s.coreRow); r++)
      for (let c = 0; c < C.WORLD_COLS; c++)
        grid[r * C.WORLD_COLS + c] = { ...M.tile(s, c, r) };
    n.worldSize = worldSize;
    n.coreRow = coreRow;
    n.tiles = grid;
    return n;
  },
  setCredits(s: M.State, value: number) {
    number(value);
    return { ...M.clone(s), credits: value };
  },
  setTier(s: M.State, track: C.TrackName, tier: number) {
    member(track, C.TRACKS);
    number(tier, 1, C.MAX_TIER[track]);
    valid(Number.isInteger(tier));
    return change(s, (n) => {
      n.tiers[track] = tier;
      n.miner.fuel = Math.min(n.miner.fuel, M.maxFuel(n));
      n.miner.hull = Math.min(n.miner.hull, M.maxHull(n));
    });
  },
  setCargo(s: M.State, ore: C.OreId, count: number) {
    member(ore, oreIds);
    number(count);
    valid(Number.isInteger(count));
    return change(s, (n) => {
      n.cargo[ore] = count;
    });
  },
  setMaterial(s: M.State, material: C.MaterialId, count: number) {
    member(material, C.MATERIALS);
    number(count);
    valid(Number.isInteger(count));
    return change(s, (n) => {
      n.satchel[material] = count;
    });
  },
  setCoreCarried(s: M.State, carried: boolean) {
    valid(typeof carried === "boolean" && (!carried || s.coreTimer === null));
    return change(s, (n) => {
      n.satchel.coreSample = carried;
      if (carried) n.coreTimer = C.CORE_TIMER;
      else if (!n.coreGround) n.coreTimer = null;
    });
  },
  setCoreTimer(s: M.State, seconds: number) {
    number(seconds, Number.MIN_VALUE);
    valid(s.coreTimer !== null);
    return { ...M.clone(s), coreTimer: seconds };
  },
  setItemCount(s: M.State, item: C.ItemId, count: number) {
    member(item, C.ITEM_IDS);
    number(count);
    valid(Number.isInteger(count));
    return change(s, (n) => {
      n.items[item] = count;
    });
  },
  setRocketInstalled(s: M.State, count: number) {
    number(count, 0, C.ROCKET_COMPONENT_IDS.length);
    valid(Number.isInteger(count));
    return { ...M.clone(s), installed: count };
  },
  setNoticeFired(s: M.State, hazard: C.NoticeHazard, fired: boolean) {
    member(hazard, C.NOTICE_HAZARDS);
    valid(typeof fired === "boolean");
    return change(s, (n) => {
      n.noticesFired[hazard] = fired;
    });
  },
  setCameraLead(s: M.State, lead: number) {
    number(lead, -C.CAM_LEAD_MAX, C.CAM_LEAD_MAX);
    return change(s, (n) => {
      n.camera.lead = lead;
    });
  },
  setElapsed(s: M.State, seconds: number) {
    number(seconds);
    return { ...M.clone(s), elapsedSeconds: seconds };
  },
  clearSave(s: M.State) {
    return change(s, M.clearSave);
  },
  setNextTeleportHeight(s: M.State, tiles: number | null) {
    if (tiles !== null)
      number(tiles, C.TELEPORT_HEIGHT_TILES_MIN, C.TELEPORT_HEIGHT_TILES_MAX);
    return { ...M.clone(s), nextTeleportHeight: tiles };
  },
  setNextTeleportSpeed(s: M.State, speed: number | null) {
    if (speed !== null)
      number(speed, C.TELEPORT_SPEED_MIN, C.TELEPORT_SPEED_MAX);
    return { ...M.clone(s), nextTeleportSpeed: speed };
  },
  dropOre(s: M.State, ore: C.OreId) {
    member(ore, oreIds);
    return change(s, (n) => {
      if (n.cargo[ore]) n.cargo[ore]!--;
    });
  },
  sell(s: M.State) {
    return change(s, S.sell);
  },
  buyFuel(s: M.State) {
    return change(s, (n) => S.purchase(n, "fuel", false));
  },
  fillFuel(s: M.State) {
    return change(s, (n) => S.purchase(n, "fuel", true));
  },
  buyRepair(s: M.State) {
    return change(s, (n) => S.purchase(n, "hull", false));
  },
  repairFull(s: M.State) {
    return change(s, (n) => S.purchase(n, "hull", true));
  },
  buyUpgrade(s: M.State, track: C.TrackName) {
    member(track, C.TRACKS);
    return change(s, (n) => S.buyUpgrade(n, track));
  },
  buyItem(s: M.State, item: C.ItemId) {
    member(item, C.ITEM_IDS);
    return change(s, (n) => S.buyItem(n, item));
  },
  useItem(s: M.State, item: C.ItemId) {
    member(item, C.ITEM_IDS);
    return change(s, (n) => S.useItem(n, item));
  },
  jettison(s: M.State) {
    return change(s, S.jettison);
  },
  fabricate(s: M.State) {
    return change(s, S.fabricate);
  },
  launch(s: M.State) {
    return change(s, S.launch);
  },
  save(s: M.State) {
    return change(s, M.save);
  },
  dismissNotice(s: M.State) {
    return { ...M.clone(s), notice: null };
  },
};
export type DeepcoreDebugApi = typeof debug;
