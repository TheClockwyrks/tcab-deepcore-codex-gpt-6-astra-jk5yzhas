import type { Game } from "@clockwyrks/simple-2d";
import type { ParticleSystem } from "@clockwyrks/particle-runtime";
import * as C from "./constants";
import * as M from "./model";
import * as UI from "./ui";
import * as Sim from "./simulation";
import { debug, type DeepcoreDebugApi } from "./debug";
import { render } from "./render";
import { assetFiles } from "./assets";
export type { DeepcoreState } from "./model";
export type { DeepcoreDebugApi } from "./debug";
export const BACKGROUND = "#0b1b27";
export const game: Game<M.DeepcoreState, DeepcoreDebugApi> = {
  async initialize(api) {
    for (const name of C.ACTION_NAMES)
      api.input.register(name, { keys: [...C.ACTIONS[name]] });
    const images: Record<string, ImageBitmap> = {},
      systems: Record<string, ParticleSystem> = {};
    await Promise.all(
      Object.entries(assetFiles).map(async ([key, url]) => {
        const path = url.slice(url.indexOf("assets/") + 7);
        if (key.endsWith(".png"))
          images[key] = await api.assets.loadImage(path);
        else if (key.endsWith(".json"))
          systems[key.replace("fx/", "").replace(".json", "")] = JSON.parse(
            await (await api.assets.load(path)).text(),
          ) as ParticleSystem;
        else if (key.endsWith(".wav"))
          await api.audio.load(
            key.replace("audio/", "").replace(".wav", ""),
            path,
          );
      }),
    );
    const reads: Record<string, (s: M.State) => string | number | boolean> = {
      screen: (s) => s.screen,
      panel: (s) => s.panel ?? "none",
      mode: (s) => s.mode,
      size: (s) => s.worldSize,
      position: (s) => `${s.miner.x.toFixed(1)}, ${s.miner.y.toFixed(1)}`,
      velocity: (s) => `${s.miner.vx.toFixed(1)}, ${s.miner.vy.toFixed(1)}`,
      state: (s) => s.miner.state,
      facing: (s) => s.miner.facing,
      grounded: M.grounded,
      fuel: (s) => `${s.miner.fuel.toFixed(1)}/${M.maxFuel(s)}`,
      hull: (s) => `${s.miner.hull.toFixed(1)}/${M.maxHull(s)}`,
      drill: (s) =>
        s.miner.drilling
          ? `${s.miner.drilling.col}, ${s.miner.drilling.row} / ${M.snapshot(s).miner.drilling?.progress.toFixed(2)}`
          : "none",
      credits: (s) => s.credits,
      depth: M.depth,
      cargo: (s) =>
        `${M.slots(s)}/${C.CARGO_TIERS[s.tiers.cargo - 1]} • ${M.loadKg(s)} kg`,
      overloaded: (s) =>
        M.loadKg(s) >= C.JETPACK_TIERS[s.tiers.jetpack - 1].liftLimitKg,
      satchel: (s) => JSON.stringify(s.satchel),
      tiers: (s) => C.TRACKS.map((t) => `${t}:${s.tiers[t]}`).join(" "),
      core: (s) => s.coreTimer ?? "none",
      scanner: (s) => M.scanner(s).target ?? "none",
    };
    for (const [name, source] of Object.entries(reads))
      api.diagnostics.register(name, source);
    return [M.initial(images, systems), debug];
  },
  update(state, api, dt) {
    let s = M.clone(state);
    s.simTime += dt;
    const pressed = Object.fromEntries(
      C.ACTION_NAMES.map((name) => [name, api.input.pressed(name)]),
    ) as Record<C.ActionName, boolean>;
    if (pressed.mute) api.audio.setMuted(!api.audio.muted());
    s.muted = api.audio.muted();
    api.audio.loop(C.CUES.music);
    const pointer = api.input.pointerSamples();
    for (const p of pointer) {
      if (s.screen !== "in-mine") {
        const index = UI.menu(s).findIndex((_, i) =>
          UI.contains(UI.menuRect(s, i)!, p.x, p.y),
        );
        if (index >= 0) s.menuIndex = index;
        const key = index >= 0 ? `menu:${index}` : null;
        if (p.type === "down") s.pointerDown = key;
        if (p.type === "up") {
          if (key && s.pointerDown === key) s = UI.choose(s);
          s.pointerDown = null;
        }
      } else {
        const control = UI.controls(s).find(
          (c) => c.enabled && UI.contains(c.rect, p.x, p.y),
        );
        const b = !s.panel
          ? M.buildings.find((b) =>
              UI.contains(
                {
                  x: b.x - s.camera.x,
                  y: b.y - s.camera.y + C.HUD_H,
                  w: b.w,
                  h: b.h,
                },
                p.x,
                p.y,
              ),
            )
          : undefined;
        const key = control
          ? `${control.id}:${control.subject}`
          : b
            ? `building:${b.id}`
            : null;
        if (p.type === "down") {
          s.pointerDown = key;
          if (control?.id === "dismiss-notice") s.notice = null;
        }
        if (p.type === "up") {
          if (key && key === s.pointerDown) {
            if (control?.id === "mute") {
              api.audio.setMuted(!api.audio.muted());
              s.muted = api.audio.muted();
            } else if (control) UI.action(s, control.id, control.subject);
            else if (b) UI.activateBuilding(s, b.id);
          }
          s.pointerDown = null;
        }
      }
    }
    if (s.screen !== "in-mine") {
      if (pressed.up)
        s.menuIndex = (s.menuIndex - 1 + UI.menu(s).length) % UI.menu(s).length;
      if (pressed.down) s.menuIndex = (s.menuIndex + 1) % UI.menu(s).length;
      if (pressed.activate) s = UI.choose(s);
      if (
        pressed.pause &&
        ["paused", "size-select", "mode-select", "how-to-play"].includes(
          s.screen,
        )
      )
        UI.back(s);
    } else {
      if (pressed.pause) {
        if (s.panel) s.panel = null;
        else {
          s.screen = "paused";
          s.menuIndex = 0;
        }
      }
      if (pressed.inventory) UI.action(s, "inventory", null);
      if (pressed.jettison) Sim.jettison(s);
      C.ITEM_IDS.forEach((id, i) => {
        if (pressed[`supply${i + 1}` as C.ActionName]) Sim.useItem(s, id);
      });
      if (s.panel) {
        const available = UI.controls(s)
          .slice(3)
          .filter((c) => c.id !== "close");
        const enabled = available
          .map((c, i) => (c.enabled ? i : -1))
          .filter((i) => i >= 0);
        let selected = enabled.indexOf(s.panelIndex);
        if (selected < 0) selected = 0;
        if (pressed.down)
          selected = (selected + 1) % Math.max(1, enabled.length);
        if (pressed.up)
          selected =
            (selected - 1 + enabled.length) % Math.max(1, enabled.length);
        s.panelIndex = enabled[selected] ?? -1;
        const active = available[s.panelIndex];
        if (pressed.activate && active?.enabled)
          UI.action(s, active.id, active.subject);
      } else if (pressed.activate) UI.activateBuilding(s);
    }
    if (s.screen === "in-mine") {
      s.accumulator += dt;
      const step = 1 / 120;
      const held = {
        left: !!api.input.value("left"),
        right: !!api.input.value("right"),
        down: !!api.input.value("down"),
        up: !!api.input.value("up"),
      };
      while (s.accumulator + 1e-9 >= step && s.screen === "in-mine") {
        Sim.tick(s, held, step);
        Sim.camera(s, step);
        s.accumulator -= step;
      }
    }
    // End screens freeze the expedition, but let its final produced effects settle.
    if (
      (s.screen === "game-over" || s.screen === "victory") &&
      state.screen === s.screen
    ) {
      s.effects = s.effects
        .map((e) => ({ ...e, age: e.age + dt }))
        .filter((e) => e.age < 1.4);
      s.shake = Math.max(0, s.shake - dt * 12);
      s.animTime += dt;
    }
    const active = s.screen === "in-mine" && !s.panel;
    const drilling = active && s.miner.drilling !== null;
    const thrust = active && s.miner.state === "jetpack";
    if (drilling) api.audio.loop(C.CUES.drill);
    else api.audio.stop(C.CUES.drill);
    if (thrust) api.audio.loop(C.CUES.thrust);
    else api.audio.stop(C.CUES.thrust);
    for (const cue of s.cues) api.audio.play(cue);
    s.cues = [];
    return s;
  },
  render,
};
