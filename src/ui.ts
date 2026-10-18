import * as C from "./constants";
import {
  type DeepcoreState,
  type State,
  type Rect,
  buildings,
  depth,
  loadKg,
  slots,
  maxFuel,
  maxHull,
  start,
  resume,
  note,
  save,
} from "./model";
import * as Sim from "./simulation";
export interface Control {
  id: string;
  subject: string | null;
  rect: Rect;
  label: string;
  detail?: string;
  enabled: boolean;
}
export function menu(s: State): readonly string[] {
  switch (s.screen) {
    case "title":
      return s.hasSave ? C.TITLE_ITEMS : C.TITLE_ITEMS.slice(1);
    case "mode-select":
      return C.MODE_ITEMS;
    case "size-select":
      return C.SIZE_ITEMS;
    case "how-to-play":
      return C.HOW_TO_PLAY_ITEMS;
    case "paused":
      return C.PAUSE_ITEMS;
    case "victory":
      return C.VICTORY_ITEMS;
    case "game-over":
      return s.mode === "standard" && s.hasSave
        ? C.GAME_OVER_SAVE_ITEMS
        : C.GAME_OVER_ITEMS;
    default:
      return [];
  }
}
export function menuRect(s: State, index: number): Rect | null {
  return index < 0 || index >= menu(s).length
    ? null
    : {
        x: 86,
        y: s.screen === "how-to-play" ? 610 : 360 + index * 66,
        w: 450,
        h: 52,
      };
}
export function back(s: DeepcoreState) {
  const old = s.screen;
  if (old === "paused") {
    s.screen = "in-mine";
    s.menuIndex = 0;
  } else if (old === "size-select") {
    s.screen = "mode-select";
    s.menuIndex = C.MODES.indexOf(s.mode);
  } else {
    s.screen = "title";
    s.menuIndex = menu(s).indexOf(
      old === "how-to-play" ? "HOW TO PLAY" : "NEW EXPEDITION",
    );
  }
}
export function choose(s: DeepcoreState): DeepcoreState {
  const choice = menu(s)[s.menuIndex];
  if (choice === "CONTINUE" || choice === "CONTINUE FROM SAVE")
    return resume(s);
  if (choice === "NEW EXPEDITION") {
    s.screen = "mode-select";
    s.menuIndex = 0;
  } else if (choice === "HOW TO PLAY") {
    s.screen = "how-to-play";
    s.menuIndex = 0;
  } else if (
    choice === "BACK" ||
    choice === "MENU" ||
    choice === "QUIT TO MENU"
  )
    back(s);
  else if (choice === "RESUME") back(s);
  else if (choice === "PLAY AGAIN" || choice === "RESTART") return start(s);
  else if (s.screen === "mode-select") {
    s.mode = C.MODES[s.menuIndex];
    s.screen = "size-select";
    s.menuIndex = 0;
  } else if (s.screen === "size-select") {
    s.worldSize = C.WORLD_SIZES[s.menuIndex];
    return start(s);
  }
  return s;
}
const title = (s: string) => s.replace(/-/g, " ").toUpperCase();
export function controls(s: State): Control[] {
  if (s.screen !== "in-mine") return [];
  const list: Control[] = [
    {
      id: "inventory",
      subject: null,
      rect: { x: 1040, y: 9, w: 100, h: 38 },
      label: "BAG  [I]",
      enabled: true,
    },
    {
      id: "pause",
      subject: null,
      rect: { x: 1148, y: 9, w: 50, h: 38 },
      label: "Ⅱ",
      enabled: true,
    },
    {
      id: "mute",
      subject: null,
      rect: { x: 1205, y: 9, w: 62, h: 38 },
      label: s.muted ? "OFF" : "SND",
      enabled: true,
    },
  ];
  const add = (
    id: string,
    label: string,
    enabled = true,
    subject: string | null = null,
    detail = "",
  ) => {
    const i = list.length - 3;
    list.push({
      id,
      subject,
      label,
      detail,
      enabled,
      rect: { x: 258, y: 213 + i * 49, w: 764, h: 41 },
    });
  };
  switch (s.panel) {
    case "fuel-depot":
      add(
        "buy-fuel",
        `FUEL +${C.FUEL_BUY_INCREMENT}`,
        s.credits > 0 && s.miner.fuel < maxFuel(s),
        null,
        `${C.FUEL_PRICE} Cr / unit`,
      );
      add(
        "fill-fuel",
        "FILL TANK",
        s.credits > 0 && s.miner.fuel < maxFuel(s),
        null,
        `${Math.ceil(maxFuel(s) - s.miner.fuel)} units missing`,
      );
      add(
        "buy-repair",
        `REPAIR +${C.REPAIR_BUY_INCREMENT}`,
        s.credits > 0 && s.miner.hull < maxHull(s),
        null,
        `${C.REPAIR_PRICE} Cr / point`,
      );
      add(
        "repair-full",
        "REPAIR TO FULL",
        s.credits > 0 && s.miner.hull < maxHull(s),
      );
      break;
    case "ore-market":
      add(
        "sell",
        C.SELL,
        slots(s) > 0,
        null,
        `${C.MINERALS.reduce((a, m) => a + (s.cargo[m.id] ?? 0) * m.value, 0)} Cr • ${slots(s)} minerals`,
      );
      break;
    case "upgrade-shop":
      for (const track of C.TRACKS) {
        const tier = s.tiers[track],
          price = C.UPGRADE_PRICES[tier - 1];
        const vals: Record<C.TrackName, string> = {
          fuel: `${C.FUEL_TIERS[tier] ?? maxFuel(s)} capacity`,
          hull: `${C.HULL_TIERS[tier] ?? maxHull(s)} integrity`,
          drill: `Power ${Math.min(tier + 1, 5)}`,
          cargo: `${C.CARGO_TIERS[tier] ?? 120} slots`,
          jetpack: `${C.JETPACK_TIERS[tier]?.liftLimitKg ?? 12700} kg lift`,
          radiator: `${Math.round((C.RADIATOR_TIERS[tier] ?? 0.8) * 100)}% heat reduction`,
          scanner: `${C.SCANNER_TIERS[tier] ?? 32} tile range`,
        };
        add(
          "buy-upgrade",
          `${title(track)}  /  TIER ${tier}`,
          tier < C.MAX_TIER[track] && s.credits >= price,
          track,
          tier < C.MAX_TIER[track]
            ? `${vals[track]}  •  ${price} Cr`
            : "MAXIMUM",
        );
      }
      break;
    case "supply-depot":
      for (const item of C.ITEMS)
        add(
          "buy-item",
          item.name.toUpperCase(),
          s.credits >= item.price,
          item.id,
          `${item.price} Cr  •  ${s.items[item.id]} held`,
        );
      break;
    case "launch-pad": {
      for (let i = 0; i < C.ROCKET_COMPONENTS.length; i++) {
        const part = C.ROCKET_COMPONENTS[i];
        add(
          "component",
          `${i < s.installed ? "✓" : "0" + (i + 1)}  ${part.name.toUpperCase()}`,
          false,
          part.id,
          `${part.credits} Cr${part.material ? " + " + part.material : ""}`,
        );
      }
      const part = C.ROCKET_COMPONENTS[s.installed];
      add(
        s.installed === 5 ? "launch" : "fabricate",
        s.installed === 5 ? C.LAUNCH : C.FABRICATE,
        s.installed === 5 ||
          (!!part &&
            s.credits >= part.credits &&
            (!part.material ||
              (part.material === "core-sample"
                ? s.satchel.coreSample
                : s.satchel[part.material] > 0))),
      );
      break;
    }
    case "inventory": {
      for (const m of C.MINERALS)
        if (s.cargo[m.id])
          add(
            "drop-ore",
            `${m.name.toUpperCase()} × ${s.cargo[m.id]}`,
            true,
            m.id,
            `${m.weightKg * (s.cargo[m.id] ?? 0)} kg   •   DROP ONE`,
          );
      for (const item of C.ITEMS)
        if (s.items[item.id])
          add(
            "use-item",
            `${item.name.toUpperCase()} × ${s.items[item.id]}`,
            true,
            item.id,
            C.USE,
          );
      if (s.satchel.coreSample) add("jettison", C.JETTISON);
      if (list.length > 12) {
        list.slice(3).forEach((c, i) => {
          c.rect = {
            x: 252 + (i % 2) * 390,
            y: 210 + Math.floor(i / 2) * 37,
            w: 376,
            h: 33,
          };
        });
      }
      break;
    }
  }
  if (s.panel)
    list.push({
      id: "close",
      subject: null,
      rect: { x: 973, y: 120, w: 52, h: 44 },
      label: "×",
      enabled: true,
    });
  if (s.notice && s.notice.age >= C.NOTICE_DELAY)
    list.push({
      id: "dismiss-notice",
      subject: null,
      rect: { x: 330, y: 610, w: 620, h: 76 },
      label:
        s.notice.hazard === "gas"
          ? "VOLATILE GAS • Watch for pale wisps. Upgrade your hull."
          : "MOLTEN ROCK • Go around pools. A radiator reduces burns.",
      enabled: true,
    });
  return list;
}
export function action(s: DeepcoreState, id: string, subject: string | null) {
  switch (id) {
    case "inventory":
      s.panel = s.panel === "inventory" ? null : "inventory";
      s.panelIndex = 0;
      break;
    case "pause":
      s.screen = "paused";
      s.menuIndex = 0;
      break;
    case "close":
      s.panel = null;
      break;
    case "dismiss-notice":
      s.notice = null;
      break;
    case "sell":
      Sim.sell(s);
      break;
    case "buy-fuel":
      Sim.purchase(s, "fuel", false);
      break;
    case "fill-fuel":
      Sim.purchase(s, "fuel", true);
      break;
    case "buy-repair":
      Sim.purchase(s, "hull", false);
      break;
    case "repair-full":
      Sim.purchase(s, "hull", true);
      break;
    case "buy-upgrade":
      Sim.buyUpgrade(s, subject as C.TrackName);
      break;
    case "buy-item":
      Sim.buyItem(s, subject as C.ItemId);
      break;
    case "use-item":
      Sim.useItem(s, subject as C.ItemId);
      break;
    case "drop-ore": {
      const ore = subject as C.OreId;
      if (s.cargo[ore]) s.cargo[ore]!--;
      break;
    }
    case "jettison":
      Sim.jettison(s);
      break;
    case "fabricate":
      Sim.fabricate(s);
      break;
    case "launch":
      Sim.launch(s);
      break;
  }
}
export function activateBuilding(s: DeepcoreState, id?: C.BuildingId) {
  const b = buildings.find(
    (b) =>
      (!id || b.id === id) &&
      s.miner.x + C.MINER_W > b.x &&
      s.miner.x < b.x + b.w &&
      Math.abs(s.miner.y + C.MINER_H - C.SURFACE_Y) < 12,
  );
  if (!b) {
    note(s, "Stand at a camp building to interact.");
    return;
  }
  if (b.id === "save-pad") save(s);
  else {
    s.panel = b.id;
    s.panelIndex = 0;
  }
}
export const contains = (r: Rect, x: number, y: number) =>
  x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
export function panelSubtitle(s: State) {
  if (s.panel === "inventory")
    return `${slots(s)} / ${C.CARGO_TIERS[s.tiers.cargo - 1]} slots   •   ${loadKg(s)} kg   •   Resonite ${s.satchel.resonite}   Cryenite ${s.satchel.cryenite}`;
  if (s.panel === "launch-pad")
    return `${s.installed} / 5 COMPONENTS INSTALLED  •  YOUR TICKET OFF THIS ROCK`;
  return `${Math.floor(s.credits).toLocaleString()} CREDITS AVAILABLE   •   ${Math.floor(depth(s))} m BELOW CAMP`;
}
