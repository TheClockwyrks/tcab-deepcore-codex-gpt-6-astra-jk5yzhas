import type { RenderApi } from "@clockwyrks/simple-2d";
import { ParticleCanvasPlayer } from "@clockwyrks/particle-runtime/canvas";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import * as C from "./constants";
import * as M from "./model";
import { menu, menuRect, controls, panelSubtitle } from "./ui";
const ink = "#e5e4d2",
  muted = "#91a6aa",
  gold = "#edbd70",
  teal = "#81d8c3";
function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size = 16,
  color = ink,
  weight = 400,
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${weight >= 700 ? "Arial, sans-serif" : '"Courier New", monospace'}`;
  ctx.fillText(str, x, y);
}
function box(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke?: string,
) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
}
function sprite(
  s: M.State,
  ctx: CanvasRenderingContext2D,
  key: string,
  x: number,
  y: number,
  w = 80,
  h = 80,
) {
  const img = s.images[key];
  if (img) ctx.drawImage(img, x, y, w, h);
}
const counts: Record<C.MinerState, number> = {
  idle: 4,
  walk: 6,
  "drill-down": 4,
  "drill-side": 4,
  jetpack: 4,
  fall: 3,
  hurt: 3,
  "fuel-out": 3,
};
function miner(
  s: M.State,
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale = 1,
) {
  const state = s.miner.state;
  const frame =
    state === "hurt"
      ? Math.min(counts[state] - 1, Math.floor(s.animTime * C.ANIM_FPS))
      : Math.floor(s.animTime * C.ANIM_FPS) % counts[state];
  ctx.save();
  ctx.translate(x + 40 * scale, y);
  ctx.scale(s.miner.facing === "west" ? -scale : scale, scale);
  sprite(
    s,
    ctx,
    `miner/${state}/frame${String(frame).padStart(2, "0")}.png`,
    -40,
    0,
  );
  ctx.restore();
}
function particle(s: M.State, ctx: CanvasRenderingContext2D, e: M.Effect) {
  let sys = s.systems[e.name] as ParticleSystem | undefined;
  if (!sys) return;
  if (e.tint)
    sys = {
      ...sys,
      emitters: sys.emitters.map((emitter) => ({
        ...emitter,
        particle: {
          ...emitter.particle,
          colorGradient: emitter.particle?.colorGradient?.map((stop, i) => ({
            ...stop,
            color: i === 0 ? e.tint! : stop.color,
          })),
        },
      })),
    };
  ctx.save();
  const scale = e.name === "core-detonation" ? 2.5 : 1;
  ctx.translate(e.x - 128 * scale, e.y - 128 * scale);
  ctx.scale(scale, scale);
  let visible = false;
  const proxy = new Proxy(ctx, {
    get(target, key) {
      if (key === "fill" && !visible) return () => {};
      if (key === "canvas") return { width: 256, height: 256 };
      const v = Reflect.get(target, key, target);
      return typeof v === "function" ? v.bind(target) : v;
    },
    set(target, key, value) {
      return Reflect.set(target, key, value, target);
    },
  });
  const player = new ParticleCanvasPlayer(sys as ParticleSystem, proxy, {
    seed: e.seed,
    clear: false,
    pixelRadius: 4,
  });
  visible = true;
  player.update(e.age);
  ctx.restore();
}
function terrain(s: M.State, ctx: CanvasRenderingContext2D) {
  const x0 = Math.max(0, Math.floor(s.camera.x / C.TILE)),
    x1 = Math.min(C.WORLD_COLS - 1, x0 + 17),
    y0 = Math.max(1, Math.floor(s.camera.y / C.TILE)),
    y1 = Math.min(s.coreRow, Math.ceil((s.camera.y + C.VIEW_H) / C.TILE));
  for (let r = y0; r <= y1; r++)
    for (let c = x0; c <= x1; c++) {
      const t = M.tile(s, c, r),
        x = c * C.TILE,
        y = r * C.TILE;
      const variant = (c * 7 + r * 13) % C.TILE_VARIANTS;
      const band = t.band ?? "coreshell";
      sprite(s, ctx, `tiles/${band}-${variant}.png`, x, y);
      if (t.kind === "tunnel" || t.kind === "lava") {
        const match = (a: number, b: number) =>
          M.tile(s, a, b).kind === t.kind || (b === 0 && t.kind === "tunnel");
        const l = match(c - 1, r),
          rr = match(c + 1, r),
          u = match(c, r - 1),
          d = match(c, r + 1);
        const inset = 6;
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(
          x + (l ? 0 : inset),
          y + (u ? 0 : inset),
          80 - (l ? 0 : inset) - (rr ? 0 : inset),
          80 - (u ? 0 : inset) - (d ? 0 : inset),
          [
            u || l ? 0 : 10,
            u || rr ? 0 : 10,
            d || rr ? 0 : 10,
            d || l ? 0 : 10,
          ],
        );
        ctx.clip();
        sprite(
          s,
          ctx,
          t.kind === "lava"
            ? `hazards/lava/frame${String(Math.floor(s.simTime * 6) % 4).padStart(2, "0")}.png`
            : "tiles/tunnel.png",
          x,
          y,
        );
        ctx.restore();
        // Convex dirt nubs preserve the diagonal wall at bends.
        for (const [dx, dy, ax, ay] of [
          [-1, -1, 0, 0],
          [1, -1, 80, 0],
          [-1, 1, 0, 80],
          [1, 1, 80, 80],
        ])
          if (match(c + dx, r) && match(c, r + dy) && !match(c + dx, r + dy)) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(x + ax, y + ay, 6, 0, Math.PI * 2);
            ctx.clip();
            sprite(s, ctx, `tiles/${band}-${variant}.png`, x, y);
            ctx.restore();
          }
      } else if (t.kind === "bedrock")
        sprite(s, ctx, "tiles/bedrock.png", x, y);
      else if (t.kind === "stone")
        sprite(s, ctx, `tiles/stone-${(r + c) % 2}.png`, x, y);
      else if (t.ore) sprite(s, ctx, `ore/${t.ore}.png`, x, y);
      else if (t.material) sprite(s, ctx, `materials/${t.material}.png`, x, y);
      else if (t.kind === "core") sprite(s, ctx, "materials/core.png", x, y);
      if (t.health !== null && t.maxHealth !== null && t.health < t.maxHealth) {
        const frame = Math.min(
          C.CRACK_FRAMES - 1,
          Math.floor((1 - t.health / t.maxHealth) * C.CRACK_FRAMES),
        );
        sprite(
          s,
          ctx,
          `tiles/crack/frame${String(frame).padStart(2, "0")}.png`,
          x,
          y,
        );
      }
      if (t.kind === "gas") {
        const age = (s.simTime + (c + r) * 0.137) % C.GAS_SEEP_PERIOD;
        if (age < 1.4)
          particle(s, ctx, {
            name: "gas-seep",
            x: x + 40,
            y: y + 40,
            age,
            seed: r * 32 + c,
          });
      }
      ctx.strokeStyle = "#0a16231a";
      ctx.strokeRect(x + 0.5, y + 0.5, 79, 79);
    }
}
function world(s: M.State, ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, C.HUD_H, C.VIEW_W, C.VIEW_H);
  ctx.clip();
  box(ctx, 0, C.HUD_H, 1280, 664, "#0d1c28");
  if (s.camera.y < 80) {
    sprite(
      s,
      ctx,
      "surface/sky.png",
      0,
      C.HUD_H,
      1280,
      Math.max(400, 80 - s.camera.y),
    );
  }
  const shake = s.shake * Math.sin(s.simTime * 93);
  ctx.translate(
    -s.camera.x + shake,
    C.HUD_H - s.camera.y + Math.cos(s.simTime * 71) * s.shake * 0.5,
  );
  terrain(s, ctx);
  if (s.camera.y < 160) {
    for (let c = 1; c < 31; c++)
      if (c !== C.CAVE_MOUTH_COL)
        sprite(s, ctx, "surface/ground.png", c * 80, 80, 80, 24);
    sprite(s, ctx, "surface/cave-mouth.png", C.CAVE_MOUTH_COL * 80, 1);
    for (const b of M.buildings) {
      sprite(s, ctx, `surface/${b.id}.png`, b.x, b.y, b.w, b.h);
      text(
        ctx,
        b.id.replace(/-/g, " ").toUpperCase(),
        b.x + 10,
        b.y - 14,
        13,
        muted,
      );
      if (b.id === "launch-pad")
        sprite(
          s,
          ctx,
          `rocket/stage${s.installed}.png`,
          b.x + 40,
          b.y - 40 - s.launchTime * s.launchTime * 70,
          160,
          200,
        );
    }
    text(ctx, "↓  MINE ENTRANCE", C.CAVE_MOUTH_COL * 80 - 24, -16, 13, gold);
  }
  if (!s.launchTime) miner(s, ctx, s.miner.x - 12, s.miner.y - 1);
  if (s.coreGround) {
    sprite(
      s,
      ctx,
      "materials/core-sample.png",
      s.coreGround.col * 80,
      s.coreGround.row * 80,
    );
    text(
      ctx,
      `${Math.ceil(s.coreTimer ?? 0)}s`,
      s.coreGround.col * 80 + 15,
      s.coreGround.row * 80 - 8,
      20,
      gold,
      700,
    );
  }
  for (const e of s.effects) particle(s, ctx, e);
  ctx.restore();
  // An atmospheric vignette, without hiding nearby terrain.
  const vignette = ctx.createRadialGradient(640, 370, 200, 640, 370, 740);
  vignette.addColorStop(0, "#07121a00");
  vignette.addColorStop(1, "#07121a77");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 56, 1280, 664);
  if (s.screen === "in-mine" && !s.panel) {
    const building = M.buildings.find(
      (b) =>
        s.miner.x + 56 > b.x &&
        s.miner.x < b.x + b.w &&
        Math.abs(s.miner.y + 72 - 80) < 12,
    );
    if (building) {
      box(ctx, 470, 589, 340, 41, "#0b1a25e8", "#526565");
      text(
        ctx,
        `[E]  ${building.id.replace(/-/g, " ").toUpperCase()}`,
        493,
        615,
        17,
        gold,
      );
    }
    text(
      ctx,
      "A D  MOVE     S  DRILL     W / SPACE  THRUST     E  INTERACT",
      28,
      696,
      13,
      muted,
    );
  }
}
function hud(s: M.State, ctx: CanvasRenderingContext2D) {
  box(ctx, 0, 0, 1280, 56, "#10232e");
  box(ctx, 0, 55, 1280, 1, "#53615b");
  const gauge = (
    name: string,
    x: number,
    value: number,
    max: number,
    col: string,
  ) => {
    sprite(s, ctx, `icons/${name}.png`, x, 16, 24, 24);
    text(ctx, name.toUpperCase(), x + 32, 20, 10, muted);
    text(ctx, `${Math.ceil(value)} / ${max}`, x + 32, 37, 14, col, 700);
    box(ctx, x + 32, 44, 122, 3, "#263e48");
    box(ctx, x + 32, 44, 122 * M.clamp(value / max, 0, 1), 3, col);
  };
  gauge(
    "fuel",
    18,
    s.miner.fuel,
    M.maxFuel(s),
    s.miner.fuel < M.maxFuel(s) * C.LOW_FUEL_FRACTION ? "#f17c62" : gold,
  );
  gauge(
    "hull",
    196,
    s.miner.hull,
    M.maxHull(s),
    s.miner.hull < M.maxHull(s) * C.LOW_HULL_FRACTION ? "#f17c62" : teal,
  );
  sprite(s, ctx, "icons/cargo.png", 378, 16, 24, 24);
  const overload =
    M.loadKg(s) >= C.JETPACK_TIERS[s.tiers.jetpack - 1].liftLimitKg;
  text(
    ctx,
    overload
      ? C.OVERLOAD
      : `CARGO  ${M.slots(s)}/${C.CARGO_TIERS[s.tiers.cargo - 1]}`,
    410,
    22,
    12,
    overload || M.slots(s) >= C.CARGO_TIERS[s.tiers.cargo - 1]
      ? "#f17c62"
      : muted,
  );
  text(ctx, `${M.loadKg(s)} kg`, 410, 41, 16, ink, 700);
  sprite(s, ctx, "icons/credits.png", 562, 16, 24, 24);
  text(ctx, "CREDITS", 594, 20, 10, muted);
  text(ctx, Math.floor(s.credits).toLocaleString(), 594, 40, 18, gold, 700);
  sprite(s, ctx, "icons/depth.png", 710, 16, 24, 24);
  text(ctx, "DEPTH", 742, 20, 10, muted);
  text(ctx, `${Math.floor(M.depth(s))} m`, 742, 40, 18, ink, 700);
  for (const [i, mat] of C.MATERIALS.entries()) {
    ctx.globalAlpha = s.satchel[mat] ? 1 : 0.25;
    sprite(s, ctx, `icons/${mat}.png`, 892 + i * 46, 16, 24, 24);
    ctx.globalAlpha = 1;
  }
  if (s.satchel.coreSample)
    sprite(s, ctx, "icons/core-sample.png", 984, 16, 24, 24);
}
function drawButton(
  ctx: CanvasRenderingContext2D,
  r: M.Rect,
  label: string,
  selected: boolean,
  enabled = true,
  detail?: string,
  supply?: C.ItemId,
) {
  box(
    ctx,
    r.x,
    r.y,
    r.w,
    r.h,
    selected && enabled ? "#dcb16b" : enabled ? "#18303c" : "#122630",
    selected && enabled ? "#f2d19a" : "#3b5158",
  );
  if (selected && enabled) box(ctx, r.x, r.y, 4, r.h, "#fff0c5");
  text(
    ctx,
    label,
    r.x + (supply ? 54 : 18),
    r.y + r.h / 2 + 6,
    r.h < 38 ? 12 : 16,
    selected && enabled ? "#172b34" : enabled ? ink : "#61777e",
    700,
  );
  if (supply) {
    ctx.save();
    ctx.translate(r.x + 17, r.y + r.h / 2 - 11);
    ctx.strokeStyle = supply === "quantum-teleporter" ? "#b8a0f0" : teal;
    ctx.fillStyle = gold;
    ctx.lineWidth = 2;
    if (supply === "dynamite" || supply === "plastic-explosives") {
      ctx.fillStyle = "#d77e60";
      for (let i = 0; i < (supply === "dynamite" ? 3 : 2); i++)
        ctx.fillRect(i * 6, 5, 5, 16);
      ctx.strokeStyle = gold;
      ctx.beginPath();
      ctx.moveTo(8, 6);
      ctx.lineTo(13, 0);
      ctx.lineTo(20, 3);
      ctx.stroke();
    } else if (
      supply === "quantum-teleporter" ||
      supply === "matter-transmitter"
    ) {
      ctx.beginPath();
      ctx.arc(11, 11, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(11, 11, 5, 0, Math.PI * 2);
      ctx.stroke();
      if (supply === "matter-transmitter") ctx.fillRect(9, 0, 4, 22);
    } else if (supply === "nanobots") {
      ctx.fillStyle = teal;
      ctx.fillRect(8, 1, 6, 20);
      ctx.fillRect(1, 8, 20, 6);
    } else {
      ctx.fillRect(4, 5, 15, 16);
      ctx.fillRect(7, 0, 9, 4);
      ctx.fillStyle = "#29474d";
      ctx.fillRect(7, 11, 9, 3);
    }
    ctx.restore();
  }
  if (detail) {
    ctx.textAlign = "right";
    text(
      ctx,
      detail,
      r.x + r.w - 18,
      r.y + r.h / 2 + 5,
      13,
      selected && enabled ? "#39453f" : muted,
    );
    ctx.textAlign = "left";
  }
}
function menuScene(s: M.State, ctx: CanvasRenderingContext2D) {
  box(ctx, 0, 0, 1280, 720, "#0b1b27");
  sprite(s, ctx, "surface/sky.png", 0, 0, 1280, 400);
  // The title's cutaway is made entirely from the produced terrain and miner art.
  ctx.save();
  ctx.beginPath();
  ctx.rect(660, 0, 620, 720);
  ctx.clip();
  for (let r = 0; r < 10; r++)
    for (let c = 0; c < 9; c++) {
      const x = 640 + c * 80,
        y = r * 80 - 20;
      const band = C.BANDS[Math.min(3, Math.floor(r / 3))];
      sprite(s, ctx, `tiles/${band}-${(c + r) % 3}.png`, x, y);
      if (
        (c === 3 && r < 6) ||
        (r === 5 && c > 2 && c < 7) ||
        (c === 6 && r > 4)
      )
        sprite(s, ctx, "tiles/tunnel.png", x, y);
      else if ((r * 7 + c * 11) % 9 === 0 && r > 1)
        sprite(s, ctx, `ore/${C.ORE_IDS[Math.min(9, r)]}.png`, x, y);
    }
  sprite(s, ctx, "materials/resonite.png", 715, 365, 100, 100);
  sprite(s, ctx, "materials/cryenite.png", 1120, 512, 100, 100);
  miner(s, ctx, 854, 320, 1.65);
  sprite(s, ctx, "hazards/lava/frame00.png", 960, 660, 160, 80);
  ctx.restore();
  const shade = ctx.createLinearGradient(450, 0, 900, 0);
  shade.addColorStop(0, "#0b1b27");
  shade.addColorStop(1, "#0b1b2700");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 1000, 720);
  text(ctx, "//  A SUBTERRANEAN EXPEDITION", 86, 105, 14, teal);
  text(ctx, C.TITLE_TEXT, 80, 203, 88, gold, 900);
  text(ctx, "THE ONLY WAY OUT IS DOWN.", 86, 242, 18, ink, 700);
  text(ctx, "Dig deep. Carry less. Make it home.", 86, 282, 16, muted);
  const headings: Partial<Record<C.ScreenName, string>> = {
    "mode-select": "01 / CHOOSE YOUR STAKES",
    "size-select": "02 / CHOOSE YOUR DEPTH",
    paused: "EXPEDITION PAUSED",
    "game-over": "SIGNAL LOST",
    victory: "YOU MADE IT HOME",
  };
  if (headings[s.screen])
    text(ctx, headings[s.screen]!, 86, 330, 17, teal, 700);
  const items = menu(s);
  for (let i = 0; i < items.length; i++) {
    const r = menuRect(s, i)!;
    drawButton(ctx, r, items[i], s.menuIndex === i);
  }
  if (s.screen === "mode-select") {
    text(ctx, "STANDARD", 590, 404, 15, gold, 700);
    text(ctx, "Return to your last Save Pad record.", 590, 429, 14, ink);
    text(ctx, "HARDCORE", 590, 482, 15, gold, 700);
    text(ctx, "Death erases your save. One expedition.", 590, 507, 14, ink);
  }
  if (s.screen === "size-select") {
    [
      "1,250 m  /  A shorter descent",
      "2,500 m  /  The full expedition",
      "5,000 m  /  A long way home",
    ].forEach((v, i) => text(ctx, v, 570, 394 + i * 66, 17, ink));
  }
  if (s.screen === "title") {
    text(ctx, "01  EXTRACT", 86, 579, 13, teal, 700);
    text(ctx, "02  UPGRADE", 260, 579, 13, teal, 700);
    text(ctx, "03  ESCAPE", 435, 579, 13, teal, 700);
    text(ctx, "A lost prospector. Five rocket components.", 86, 615, 15, muted);
    text(ctx, "A planet that would rather keep you.", 86, 639, 15, muted);
  }
  if (s.screen === "how-to-play") {
    box(ctx, 70, 308, 1140, 280, "#0d2230f5", "#3c5259");
    const lines = [
      "BUILD YOUR WAY HOME • Sell ore and fabricate five rocket components.",
      "A / D move and cut walls. S drills down. W / SPACE fires your jetpack.",
      "You cannot drill upward: keep a clear route back. E opens camp buildings.",
      "Fuel buys height. Cargo slots limit quantity; weight limits lift. I opens your bag.",
      "Drop heavy ore if overloaded. Watch gas wisps, lava, and hard landings.",
      "Upgrade your scanner to find Resonite and Cryenite. The Core Sample lasts 90s.",
      "Save at the Save Pad. Standard can reload; Hardcore death erases the save.",
      "1–6 use supplies. J jettisons the Sample. P / ESC pauses. M mutes audio.",
    ];
    lines.forEach((l, i) => text(ctx, l, 92, 339 + i * 31, 15, i ? ink : gold));
  }
  if (s.summary) {
    box(ctx, 582, 340, 550, 240, "#0c2230ed", "#536460");
    text(
      ctx,
      s.summary.deathCause?.replace(/-/g, " ").toUpperCase() ??
        "ESCAPE ROCKET • FLIGHT CONFIRMED",
      610,
      379,
      20,
      gold,
      700,
    );
    text(
      ctx,
      `DEEPEST POINT    ${Math.floor(s.summary.deepestDepthMeters)} m`,
      610,
      421,
      18,
      ink,
    );
    text(ctx, `CREDITS EARNED   ${s.summary.creditsEarned}`, 610, 456, 18, ink);
    text(
      ctx,
      `ELAPSED         ${Math.floor(s.summary.elapsedSeconds / 60)}m ${Math.floor(s.summary.elapsedSeconds % 60)}s`,
      610,
      491,
      18,
      ink,
    );
    text(
      ctx,
      `${s.mode.toUpperCase()}    ${s.installed}/5 COMPONENTS`,
      610,
      538,
      16,
      teal,
    );
  }
  text(ctx, "W S / ↑ ↓  SELECT     ENTER  CONFIRM", 86, 690, 12, muted);
  text(ctx, "DEEP SPACE SALVAGE DIVISION  /  07", 864, 690, 11, muted);
}
export function render(s: M.State, api: RenderApi) {
  const ctx = api.ctx;
  ctx.imageSmoothingEnabled = false;
  if ((s.screen === "game-over" || s.screen === "victory") && s.summary) {
    world(s, ctx);
    hud(s, ctx);
    box(ctx, 0, 56, 1280, 664, "#081722bb");
    text(
      ctx,
      s.screen === "victory" ? "FLIGHT CONFIRMED" : "EXPEDITION ENDED",
      86,
      173,
      15,
      teal,
    );
    text(
      ctx,
      s.screen === "victory" ? "HOMEBOUND." : "SIGNAL LOST.",
      82,
      241,
      64,
      gold,
      900,
    );
    text(
      ctx,
      s.summary.deathCause?.replace(/-/g, " ").toUpperCase() ??
        "Your work here is done.",
      86,
      284,
      18,
      ink,
    );
    menu(s).forEach((label, i) =>
      drawButton(ctx, menuRect(s, i)!, label, i === s.menuIndex),
    );
    box(ctx, 600, 341, 560, 236, "#102631ee", "#52696b");
    text(ctx, "EXPEDITION RECORD", 629, 382, 22, teal, 700);
    text(
      ctx,
      `DEEPEST POINT     ${Math.floor(s.summary.deepestDepthMeters)} m`,
      629,
      425,
      18,
      ink,
    );
    text(
      ctx,
      `CREDITS EARNED    ${s.summary.creditsEarned}`,
      629,
      461,
      18,
      ink,
    );
    text(
      ctx,
      `TIME             ${Math.floor(s.summary.elapsedSeconds / 60)}m ${Math.floor(s.summary.elapsedSeconds % 60)}s`,
      629,
      497,
      18,
      ink,
    );
    text(
      ctx,
      `${s.mode.toUpperCase()}  /  ${s.installed} OF 5 COMPONENTS`,
      629,
      543,
      16,
      gold,
    );
    return;
  }
  if (s.screen !== "in-mine" && s.screen !== "paused") {
    menuScene(s, ctx);
    return;
  }
  world(s, ctx);
  hud(s, ctx);
  if (s.screen === "paused") {
    box(ctx, 0, 56, 1280, 664, "#081722d9");
    text(ctx, "EXPEDITION PAUSED", 86, 260, 40, gold, 700);
    menu(s).forEach((label, i) =>
      drawButton(ctx, menuRect(s, i)!, label, i === s.menuIndex),
    );
    return;
  }
  if (s.panel) {
    box(ctx, 0, 56, 1280, 664, "#07131cbb");
    box(ctx, 230, 105, 820, 530, "#102631", "#5c6d69");
    box(ctx, 230, 105, 820, 4, gold);
    text(
      ctx,
      s.panel.replace(/-/g, " ").toUpperCase(),
      258,
      155,
      28,
      gold,
      700,
    );
    text(ctx, panelSubtitle(s), 258, 187, 13, muted);
    text(
      ctx,
      "↑ ↓  SELECT    ENTER  CONFIRM    ESC  CLOSE",
      258,
      610,
      12,
      muted,
    );
    if (s.panel === "ore-market") {
      let y = 326;
      for (const m of C.MINERALS)
        if (s.cargo[m.id]) {
          text(
            ctx,
            `${m.name} × ${s.cargo[m.id]}   /   ${m.value * (s.cargo[m.id] ?? 0)} Cr`,
            280,
            y,
            17,
            ink,
          );
          y += 23;
        }
    }
    if (
      s.panel === "inventory" &&
      !M.slots(s) &&
      !Object.values(s.items).some(Boolean)
    )
      text(
        ctx,
        "YOUR CARGO BAY IS EMPTY. THE MINE IS NOT.",
        280,
        280,
        16,
        muted,
      );
  }
  const cs = controls(s);
  cs.forEach((c, i) => {
    const selected = s.panel && i === s.panelIndex + 3;
    drawButton(
      ctx,
      c.rect,
      c.label,
      !!selected,
      c.enabled,
      c.detail,
      c.id === "buy-item" || c.id === "use-item"
        ? (c.subject as C.ItemId)
        : undefined,
    );
  });
  if (s.coreTimer !== null && s.satchel.coreSample) {
    box(ctx, 440, 75, 400, 62, "#462e32", "#efaa75");
    text(
      ctx,
      `CORE UNSTABLE   ${Math.ceil(s.coreTimer)}s`,
      463,
      102,
      23,
      gold,
      700,
    );
    text(ctx, "J  JETTISON  /  RETURN TO LAUNCH PAD", 463, 123, 12, ink);
  }
  if (!s.panel) {
    const scan = M.scanner(s);
    if (scan.locked) {
      box(ctx, 940, 76, 310, 48, "#102e3ce8", "#4d8b88");
      ctx.save();
      ctx.translate(964, 100);
      ctx.rotate(Math.atan2(scan.dirY, scan.dirX));
      ctx.strokeStyle = teal;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(10, 0);
      ctx.moveTo(3, -6);
      ctx.lineTo(10, 0);
      ctx.lineTo(3, 6);
      ctx.stroke();
      ctx.restore();
      text(
        ctx,
        `${scan.target?.toUpperCase()} ${scan.distanceTiles?.toFixed(1)} tiles`,
        987,
        106,
        16,
        teal,
      );
    }
    if (s.noteTime > 0) {
      ctx.textAlign = "center";
      box(ctx, 350, 643, 580, 32, "#0b1b27ed");
      text(ctx, s.note, 640, 665, 15, gold);
      ctx.textAlign = "left";
    }
  }
}
