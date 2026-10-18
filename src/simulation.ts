import * as C from "./constants";
import {
  type DeepcoreState,
  type State,
  type Point,
  cell,
  tile,
  put,
  position,
  depth,
  grounded,
  cutSupport,
  maxFuel,
  maxHull,
  loadKg,
  slots,
  effect,
  note,
  clearSave,
  clamp,
} from "./model";
export function finish(s: DeepcoreState, cause: C.DeathCause | null) {
  s.summary = {
    deepestDepthMeters: s.deepestDepthMeters,
    creditsEarned: s.creditsEarned,
    elapsedSeconds: s.elapsedSeconds,
    mode: s.mode,
    componentsInstalled: s.installed,
    deathCause: cause,
  };
  s.screen = cause ? "game-over" : "victory";
  s.panel = null;
  s.menuIndex = 0;
  if (cause) {
    s.cargo = {};
    s.satchel.coreSample = false;
    s.coreTimer = null;
    s.coreGround = null;
    effect(s, "death-burst");
    s.cues.push(C.CUES.death);
  }
  if (!cause || s.mode === "hardcore") clearSave(s);
}
function damage(s: DeepcoreState, amount: number, hazard?: C.NoticeHazard) {
  s.miner.hull = Math.max(0, s.miner.hull - amount);
  s.hurt = C.HURT_TIME;
  if (hazard && !s.noticesFired[hazard]) {
    s.noticesFired[hazard] = true;
    s.notice = { hazard, age: 0 };
  }
}
export function gas(s: DeepcoreState, col: number, row: number) {
  const x = (col + 0.5) * C.TILE,
    y = (row + 0.5) * C.TILE;
  effect(s, "gas-explosion", x, y);
  s.cues.push(C.CUES.gasExplosion);
  s.shake = 14;
  const dx = s.miner.x + C.MINER_W / 2 - x,
    dy = s.miner.y + C.MINER_H / 2 - y,
    d = Math.hypot(dx, dy);
  if (d <= C.GAS_BLAST_TILES * C.TILE) {
    damage(
      s,
      C.GAS_DAMAGE_MIN +
        ((C.GAS_DAMAGE_MAX - C.GAS_DAMAGE_MIN) *
          Math.max(0, (row - 1) / (s.coreRow - 1) - 0.25)) /
          0.75,
      "gas",
    );
    if (s.miner.travel) {
      s.miner.vx = (dx / (d || 1)) * C.GAS_KNOCKBACK;
      s.miner.vy = (dy / (d || 1)) * C.GAS_KNOCKBACK;
    }
  }
}
export function breakCell(
  s: DeepcoreState,
  col: number,
  row: number,
  collect = true,
) {
  const t = tile(s, col, row);
  if (collect && t.ore) {
    if (slots(s) < C.CARGO_TIERS[s.tiers.cargo - 1]) {
      s.cargo[t.ore] = (s.cargo[t.ore] ?? 0) + 1;
      note(s, "+ " + C.MINERALS.find((m) => m.id === t.ore)!.name);
      effect(s, "ore-sparkle", (col + 0.5) * C.TILE, (row + 0.5) * C.TILE);
      s.cues.push(C.CUES.orePickup);
    } else note(s, "Cargo full — ore lost");
  }
  if (collect && t.material) {
    s.satchel[t.material]++;
    effect(s, "material-shimmer");
    s.cues.push(C.CUES.materialChime);
    note(s, t.material.toUpperCase() + " secured");
  }
  if (t.kind === "gas") gas(s, col, row);
  if (collect && t.kind === "lava") {
    damage(
      s,
      (t.band === "coreshell"
        ? C.LAVA_DRILL_CORESHELL
        : C.LAVA_DRILL_DEEPSTONE) *
        (1 - C.RADIATOR_TIERS[s.tiers.radiator - 1]),
      "lava",
    );
    effect(s, "lava-embers");
    s.cues.push(C.CUES.lavaSizzle);
  }
  put(s, col, row, cell("tunnel", t.band));
}
export function sell(s: DeepcoreState) {
  const value = C.MINERALS.reduce(
    (n, m) => n + (s.cargo[m.id] ?? 0) * m.value,
    0,
  );
  s.credits += value;
  s.creditsEarned += value;
  s.cargo = {};
  note(s, `${value} Credits banked`);
  if (value) s.cues.push(C.CUES.fabricate);
}
export function purchase(
  s: DeepcoreState,
  kind: "fuel" | "hull",
  full: boolean,
) {
  const price = kind === "fuel" ? C.FUEL_PRICE : C.REPAIR_PRICE;
  const maximum = kind === "fuel" ? maxFuel(s) : maxHull(s);
  const amount = Math.max(
    0,
    Math.min(
      maximum - s.miner[kind],
      s.credits / price,
      full
        ? Infinity
        : kind === "fuel"
          ? C.FUEL_BUY_INCREMENT
          : C.REPAIR_BUY_INCREMENT,
    ),
  );
  s.miner[kind] += amount;
  s.credits -= amount * price;
  note(
    s,
    amount
      ? `${kind === "fuel" ? "Fuel" : "Hull"} restored`
      : "No purchase available",
  );
  if (amount) s.cues.push(C.CUES.fabricate);
}
export function buyUpgrade(s: DeepcoreState, track: C.TrackName) {
  const tier = s.tiers[track];
  const price = C.UPGRADE_PRICES[tier - 1];
  if (tier >= C.MAX_TIER[track] || price > s.credits) {
    note(s, "Upgrade unavailable");
    return;
  }
  const fuel = maxFuel(s),
    hull = maxHull(s);
  s.credits -= price;
  s.tiers[track]++;
  s.miner.fuel += maxFuel(s) - fuel;
  s.miner.hull += maxHull(s) - hull;
  s.cues.push(C.CUES.fabricate);
  note(s, track.toUpperCase() + " upgraded");
}
export function buyItem(s: DeepcoreState, id: C.ItemId) {
  const item = C.ITEMS.find((i) => i.id === id)!;
  if (s.credits < item.price) {
    note(s, "Not enough Credits");
    return;
  }
  s.credits -= item.price;
  s.items[id]++;
  s.cues.push(C.CUES.fabricate);
  note(s, item.name + " acquired");
}
export function useItem(s: DeepcoreState, id: C.ItemId) {
  if (!s.items[id]) {
    note(s, "No supply held");
    return;
  }
  if (
    (id === "nanobots" && s.miner.hull >= maxHull(s)) ||
    (id === "emergency-fuel" && s.miner.fuel >= maxFuel(s))
  ) {
    note(s, "Already full");
    return;
  }
  const p = position(s);
  if (id === "dynamite" || id === "plastic-explosives") {
    const r =
      id === "dynamite" ? C.DYNAMITE_RADIUS : C.PLASTIC_EXPLOSIVES_RADIUS;
    let changed = false;
    for (let y = p.row - r; y <= p.row + r; y++)
      for (let x = p.col - r; x <= p.col + r; x++) {
        const t = tile(s, x, y);
        if (!["tunnel", "bedrock", "core", "material"].includes(t.kind)) {
          breakCell(s, x, y, false);
          changed = true;
        }
      }
    if (!changed) {
      note(s, "Nothing to blast");
      return;
    }
    effect(s, "gas-explosion");
    s.cues.push(C.CUES.gasExplosion);
    s.shake = 12;
  }
  if (id === "nanobots") {
    s.miner.hull = Math.min(maxHull(s), s.miner.hull + C.NANOBOT_HULL);
    effect(s, "material-shimmer");
  }
  if (id === "emergency-fuel") {
    s.miner.fuel = Math.min(maxFuel(s), s.miner.fuel + C.EMERGENCY_FUEL);
    effect(s, "material-shimmer");
  }
  if (id === "quantum-teleporter" || id === "matter-transmitter") {
    if (
      id === "matter-transmitter" &&
      s.miner.y === C.SURFACE_Y - C.MINER_H &&
      s.miner.vy === 0
    ) {
      note(s, "Already at the surface");
      return;
    }
    s.miner.x = C.SPAWN_COL * C.TILE + 12;
    s.miner.y = C.SURFACE_Y - C.MINER_H;
    s.miner.vx = 0;
    s.miner.vy = 0;
    if (id === "quantum-teleporter") {
      s.miner.y -=
        (s.nextTeleportHeight ??
          C.TELEPORT_HEIGHT_TILES_MIN +
            Math.random() *
              (C.TELEPORT_HEIGHT_TILES_MAX - C.TELEPORT_HEIGHT_TILES_MIN)) *
        C.TILE;
      s.miner.vy =
        s.nextTeleportSpeed ??
        C.TELEPORT_SPEED_MIN +
          Math.random() * (C.TELEPORT_SPEED_MAX - C.TELEPORT_SPEED_MIN);
      s.nextTeleportHeight = null;
      s.nextTeleportSpeed = null;
    }
    s.miner.drilling = null;
    effect(s, "core-extract");
  }
  s.items[id]--;
  s.cues.push(C.CUES.fabricate);
  if (s.miner.hull <= 0) finish(s, "hull-destroyed");
}
export function jettison(s: DeepcoreState) {
  if (!s.satchel.coreSample) return;
  s.satchel.coreSample = false;
  s.coreGround = position(s);
  note(s, "Sample jettisoned. Get clear.");
}
export function fabricate(s: DeepcoreState) {
  const component = C.ROCKET_COMPONENTS[s.installed];
  if (!component) return;
  const material = component.material;
  const has =
    material === null ||
    (material === "core-sample" && s.satchel.coreSample) ||
    (material !== "core-sample" &&
      material !== null &&
      s.satchel[material] > 0);
  if (s.credits < component.credits || !has) {
    note(s, "Credits or material missing");
    return;
  }
  s.credits -= component.credits;
  if (material === "core-sample") {
    s.satchel.coreSample = false;
    s.coreTimer = null;
  } else if (material) s.satchel[material]--;
  s.installed++;
  s.cues.push(C.CUES.fabricate);
  note(s, component.name + " installed");
}
export function launch(s: DeepcoreState) {
  if (s.installed < C.ROCKET_COMPONENTS.length) {
    note(s, "Complete the rocket first");
    return;
  }
  s.launchTime = 0.001;
  s.panel = null;
  s.cues.push(C.CUES.launch);
  effect(s, "launch-exhaust", 2320, 80);
}
function collides(s: State, x: number, y: number, ignore: Point | null = null) {
  for (
    let r = Math.floor(y / C.TILE);
    r <= Math.floor((y + C.MINER_H - 0.01) / C.TILE);
    r++
  )
    for (
      let c = Math.floor(x / C.TILE);
      c <= Math.floor((x + C.MINER_W - 0.01) / C.TILE);
      c++
    ) {
      if (ignore && ignore.col === c && ignore.row === r) continue;
      if (tile(s, c, r).kind !== "tunnel") return true;
    }
  return false;
}
function move(s: DeepcoreState, dx: number, dy: number) {
  const m = s.miner;
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 5) || 1;
  const support = cutSupport(s);
  const ignore = m.drilling?.dir === "down" ? m.drilling : support;
  for (let i = 0; i < steps; i++) {
    if (!collides(s, m.x + dx / steps, m.y, ignore)) m.x += dx / steps;
    else {
      const sign = Math.sign(dx);
      if (sign)
        m.x =
          sign > 0
            ? Math.floor((m.x + C.MINER_W) / C.TILE) * C.TILE - C.MINER_W
            : Math.ceil(m.x / C.TILE) * C.TILE;
      m.vx = 0;
      dx = 0;
    }
    if (support && dy > 0 && m.y + C.MINER_H + dy / steps >= support.surface) {
      m.y = support.surface - C.MINER_H;
      m.vy = 0;
      dy = 0;
    } else if (!collides(s, m.x, m.y + dy / steps, ignore)) m.y += dy / steps;
    else {
      if (dy > 0) {
        m.y = Math.floor((m.y + C.MINER_H) / C.TILE) * C.TILE - C.MINER_H;
        const hurt =
          Math.max(0, m.vy - C.IMPACT_SAFE_SPEED) * C.IMPACT_DAMAGE_RATE;
        if (hurt) {
          damage(s, hurt);
          effect(s, "impact-dust", m.x + 28, m.y + C.MINER_H);
          s.cues.push(C.CUES.impact);
          s.shake = Math.max(3, hurt / 3);
        }
      } else if (dy < 0) m.y = Math.ceil(m.y / C.TILE) * C.TILE;
      m.vy = 0;
      dy = 0;
    }
  }
}
export interface Held {
  left: boolean;
  right: boolean;
  down: boolean;
  up: boolean;
}
export function tick(s: DeepcoreState, h: Held, dt: number) {
  s.elapsedSeconds += dt;
  s.hurt = Math.max(0, s.hurt - dt);
  s.shake = Math.max(0, s.shake - dt * 12);
  s.noteTime = Math.max(0, s.noteTime - dt);
  s.animTime += dt;
  s.effects = s.effects
    .map((e) => ({ ...e, age: e.age + dt }))
    .filter((e) => e.age < 1.4);
  if (s.notice) {
    s.notice.age += dt;
    if (s.notice.age > C.NOTICE_DELAY + C.NOTICE_FADE) s.notice = null;
  }
  if (s.launchTime) {
    s.launchTime += dt;
    if (Math.floor(s.launchTime * 8) !== Math.floor((s.launchTime - dt) * 8))
      effect(s, "launch-exhaust", 2320, 80 - s.launchTime * s.launchTime * 70);
    if (s.launchTime > 3) finish(s, null);
    return;
  }
  if (s.coreTimer !== null) {
    s.coreTimer -= dt;
    if (s.coreTimer <= 0) {
      const p = s.coreGround;
      effect(
        s,
        "core-detonation",
        p ? (p.col + 0.5) * C.TILE : undefined,
        p ? (p.row + 0.5) * C.TILE : undefined,
      );
      s.shake = 24;
      s.cues.push(C.CUES.gasExplosion);
      const kill =
        s.satchel.coreSample ||
        (p !== null &&
          Math.hypot(
            s.miner.x + C.MINER_W / 2 - (p.col + 0.5) * C.TILE,
            s.miner.y + C.MINER_H / 2 - (p.row + 0.5) * C.TILE,
          ) <=
            C.CORE_BLAST_TILES * C.TILE);
      s.coreTimer = null;
      s.coreGround = null;
      s.satchel.coreSample = false;
      if (kill) {
        finish(s, "core-detonation");
        return;
      }
    }
  }
  const m = s.miner;
  if (m.hull <= 0) {
    finish(s, "hull-destroyed");
    return;
  }
  if (m.fuel <= 0 && depth(s) > 0) {
    m.state = "fuel-out";
    finish(s, "fuel-out");
    return;
  }
  s.alarmTime += dt;
  if (
    s.alarmTime >
    (s.coreTimer === null ? 1 : Math.max(0.18, s.coreTimer / C.CORE_TIMER))
  ) {
    s.alarmTime = 0;
    if (m.fuel < maxFuel(s) * C.LOW_FUEL_FRACTION)
      s.cues.push(C.CUES.alarmFuel);
    if (s.coreTimer !== null) s.cues.push(C.CUES.alarmCore);
  }
  if (s.panel) return;
  const thrust = h.up && m.fuel > 0,
    dir = Number(h.right) - Number(h.left),
    onGround = grounded(s) || m.drilling?.dir === "down";
  if (dir) m.facing = dir > 0 ? "east" : "west";
  if (depth(s) > 0) m.fuel -= C.LIFE_SUPPORT_BURN * dt;
  if (thrust) {
    const up = Math.max(0, -m.vy);
    m.fuel -=
      (C.THRUST_BURN_MAX +
        (C.THRUST_BURN_MIN - C.THRUST_BURN_MAX) *
          Math.min(1, up / C.CRUISE_SPEED)) *
      C.THRUST_BURN_SIZE_MULT[s.worldSize] *
      dt;
  }
  if (dir && !onGround) m.fuel -= C.AIR_BURN * dt;
  let target: (Point & { dir: "down" | "left" | "right" }) | null = null;
  if (m.drill && onGround && !thrust && m.fuel > 0) {
    if (h.down) {
      target =
        m.drilling?.dir === "down"
          ? { ...m.drilling }
          : {
              col: Math.floor((m.x + C.MINER_W / 2) / C.TILE),
              row: Math.floor((m.y + C.MINER_H + 0.1) / C.TILE),
              dir: "down",
            };
    } else if (dir) {
      const col =
        dir > 0
          ? Math.floor((m.x + C.MINER_W + 0.1) / C.TILE)
          : Math.floor((m.x - 0.1) / C.TILE);
      if (collides(s, m.x + dir * 0.2, m.y))
        target = {
          col,
          row: Math.floor((m.y + C.MINER_H / 2) / C.TILE),
          dir: dir > 0 ? "right" : "left",
        };
    }
  }
  if (target) {
    const t = tile(s, target.col, target.row);
    if (t.kind === "core" && target.dir === "down") {
      if (s.coreTimer === null) {
        s.coreTimer = C.CORE_TIMER;
        s.satchel.coreSample = true;
        effect(s, "core-extract");
        s.cues.push(C.CUES.materialChime);
        note(s, "CORE SAMPLE • 90 seconds to get home");
      }
      target = null;
    } else if (t.health === null) target = null;
  }
  if (target) {
    if (m.drilling?.col !== target.col || m.drilling?.row !== target.row)
      s.hitTime = 0;
    m.drilling = target;
    s.hitTime += dt;
    while (s.hitTime + 1e-8 >= C.DRILL_HIT_INTERVAL) {
      s.hitTime -= C.DRILL_HIT_INTERVAL;
      m.fuel -= C.DRILL_HIT_FUEL;
      const t = { ...tile(s, target.col, target.row) };
      t.health = (t.health ?? 0) - C.DRILL_DAMAGE_TIERS[s.tiers.drill - 1];
      put(s, target.col, target.row, t);
      effect(
        s,
        "drill-debris",
        (target.col + 0.5) * C.TILE,
        target.dir === "down" ? m.y + C.MINER_H : (target.row + 0.5) * C.TILE,
      );
      if (t.health <= 0) {
        breakCell(s, target.col, target.row);
        if (
          m.travel &&
          target.dir === "down" &&
          tile(s, target.col, target.row + 1).kind !== "tunnel" &&
          tile(s, target.col, target.row + 1).kind !== "lava"
        )
          m.y = (target.row + 1) * C.TILE - C.MINER_H;
        m.drilling = null;
        break;
      }
    }
    if (m.travel && m.drilling && target.dir === "down") {
      const t = tile(s, target.col, target.row);
      if (
        !["tunnel", "lava"].includes(tile(s, target.col, target.row + 1).kind)
      ) {
        const progress = 1 - (t.health ?? 0) / (t.maxHealth ?? 1);
        m.y = target.row * C.TILE - C.MINER_H + progress * C.TILE;
      }
    }
  } else {
    m.drilling = null;
    s.hitTime = 0;
  }
  if (m.travel) {
    const pack = C.JETPACK_TIERS[s.tiers.jetpack - 1],
      load = loadKg(s) / pack.liftLimitKg;
    m.vx = s.hurt > 0 ? m.vx : dir * C.WALK_SPEED;
    if (m.drilling?.dir === "down") m.vy = 0;
    else if (thrust)
      m.vy = Math.max(
        -pack.emptyClimb * (1 - (1 - C.CLIMB_CAP_FLOOR) * Math.min(1, load)),
        m.vy - pack.emptyAccel * Math.max(0, 1 - load) * dt,
      );
    else
      m.vy = Math.min(
        C.FALL_TERMINAL_EMPTY +
          (C.FALL_TERMINAL_LOADED - C.FALL_TERMINAL_EMPTY) * Math.min(1, load),
        m.vy + C.GRAVITY * dt,
      );
    if (m.drilling?.dir !== "down") move(s, m.vx * dt, m.vy * dt);
  }
  for (
    let r = Math.floor(m.y / C.TILE);
    r <= Math.floor((m.y + C.MINER_H) / C.TILE);
    r++
  )
    for (
      let c = Math.floor(m.x / C.TILE);
      c <= Math.floor((m.x + C.MINER_W) / C.TILE);
      c++
    )
      if (
        tile(s, c, r).kind === "lava" &&
        !(m.drilling?.col === c && m.drilling.row === r)
      ) {
        damage(
          s,
          C.LAVA_CONTACT_DPS *
            (1 - C.RADIATOR_TIERS[s.tiers.radiator - 1]) *
            dt,
          "lava",
        );
        if (Math.floor(s.animTime * 5) !== Math.floor((s.animTime - dt) * 5)) {
          effect(s, "lava-embers");
          s.cues.push(C.CUES.lavaSizzle);
        }
      }
  if (
    thrust &&
    Math.floor(s.animTime * 9) !== Math.floor((s.animTime - dt) * 9)
  )
    effect(s, "jetpack-exhaust", m.x + 16, m.y + 60);
  m.fuel = Math.max(0, m.fuel);
  const old = m.state;
  m.state = m.drilling
    ? m.drilling.dir === "down"
      ? "drill-down"
      : "drill-side"
    : s.hurt > 0
      ? "hurt"
      : m.fuel <= 0 && depth(s) > 0
        ? "fuel-out"
        : thrust
          ? "jetpack"
          : !grounded(s)
            ? "fall"
            : dir && m.travel
              ? "walk"
              : "idle";
  if (old !== m.state) s.animTime = 0;
  s.deepestDepthMeters = Math.max(s.deepestDepthMeters, depth(s));
  if (m.hull <= 0) finish(s, "hull-destroyed");
  else if (m.fuel <= 0 && depth(s) > 0) finish(s, "fuel-out");
}
export function camera(s: DeepcoreState, dt: number) {
  const m = s.miner;
  const target =
    Math.abs(m.vy) <= C.CAM_STILL_SPEED ? 0 : Math.sign(m.vy) * C.CAM_LEAD_MAX;
  let lead = s.camera.lead;
  const unwinding =
    lead !== 0 &&
    (Math.sign(lead) !== Math.sign(target) ||
      Math.abs(target) < Math.abs(lead));
  const step =
    (C.CAM_LEAD_MAX / C.CAM_LEAD_RAMP) *
    dt *
    (unwinding ? C.CAM_UNWIND_MULT : 1);
  lead += clamp(target - lead, -step, step);
  s.camera = {
    x: clamp(m.x + C.MINER_W / 2 - C.VIEW_W / 2, 0, C.WORLD_W - C.VIEW_W),
    y: Math.min(
      (s.coreRow + 1) * C.TILE - C.VIEW_H,
      m.y + C.MINER_H / 2 - C.VIEW_H / 2 + lead,
    ),
    lead,
  };
}
