const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '..', 'MistriaCompanion', 'gml', 'MistriaCompanion.gml'), 'utf8');
const privateName = name => `__MistriaCompanion_${name}`;
const publicName = name => `MistriaCompanion_${name}`;
const configurationDefaults = {
  bug_alerts_enabled: false,
  bug_markers_enabled: true,
  diving_spot_alerts_enabled: false,
  mist_spot_markers_enabled: true,
  dig_spot_alerts_enabled: false,
  dig_spot_markers_enabled: true,
  legendary_fish_alerts_enabled: false,
};
const alertPreferenceFunctions = [
  'configuration_options', 'sighting_alerts_enabled', 'any_alerts_enabled', 'apply_alert_preferences',
].map(privateName);

test('v51 manifest and MMAPI registration declare the same version', () => {
  const manifest = JSON.parse(readFileSync(join(__dirname, '..', 'MistriaCompanion', 'manifest.json'), 'utf8'));
  assert.equal(manifest.version, '1.0.51');
  assert.ok(source.includes(`mmapi_mod_declare("mistria_item_details", "${manifest.version}");`));
});

// Execute actual function source, translating only GML struct access and typeof.
// JS functions stand in for GML methods; method() saves/restores VM self so nested
// NPC-bound callbacks retain their receiver. This is not a real game VM: engine
// types/coercion, JSON parsing, native input dispatch, and FSM execution are not simulated.
function load(names, overrides = {}) {
  const context = vm.createContext({
    array_create: (count, value) => Array(count).fill(value),
    array_length: value => value.length,
    array_push: (array, value) => array.push(value),
    array_sort: (array, compare) => array.sort(compare),
    is_array: Array.isArray,
    is_struct: value => value !== null && typeof value === 'object' && !Array.isArray(value),
    is_real: value => typeof value === 'number' && Number.isFinite(value),
    is_string: value => typeof value === 'string',
    gml_typeof: value => typeof value === 'boolean' ? 'bool'
      : typeof value === 'function' ? 'method' : typeof value,
    min: Math.min,
    max: Math.max,
    ceil: Math.ceil,
    floor: Math.floor,
    string: String,
    __MistriaCompanion_field: (value, key) => value?.[key],
    ...overrides,
  });
  if (!overrides.method) {
    context.method = (receiver, callback) => (...args) => {
      const previous = context.self;
      context.self = receiver;
      try {
        return callback(...args);
      } finally {
        context.self = previous;
      }
    };
  }
  for (const name of names) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `Missing source function ${name}`);
    const next = source.indexOf('\nfunction ', start + 1);
    assert.notEqual(next, -1, `Expected another declaration after ${name}`);
    const executable = source.slice(start, next)
      .replace(/\[\$\s*([^\]]+)\]/g, '[$1]')
      .replace(/\btypeof\s*\(/g, 'gml_typeof(');
    vm.runInContext(executable, context, { filename: `${name}.gml` });
  }
  return context;
}

const searchNames = [
  'gift_slot_cost', 'copy_array', 'gift_assignment_is_better',
  'gift_priority_upper_can_beat', 'gift_capacity_upper',
  'gift_branch_can_improve', 'search_gift_assignment',
].map(privateName);
const search = load(searchNames);

function seedMakerHarness() {
  const runtime = { frame: 0 };
  const guide = { inputs: [undefined, undefined], want_reset: false };
  const input = { held: false, pressed: false, muted: false };
  const game = { paused: false, state: 'default', eligible: true, allowPress: true, consume: true };
  const entries = [];
  const logs = [];
  const guards = [];
  const conversions = [];
  const inspections = [];
  const item = { item_id: 17, infusion: 0 };
  const slots = [{ item, count: 100 }, { item: { ...item }, count: 100 }];
  const player = { id: 1, x: 100, y: 120, cardinal: 0, exists: true };
  player.fsm = { current_state_id: () => game.state };
  const context = load([
    'seed_repeat_ready', 'seed_interaction_index', 'seed_context_valid', 'seed_repeat_valid',
    'seed_action', 'seed_interact_held', 'seed_attempt', 'install_seed_maker',
    'seed_hint_active', 'update_seed_hint', 'record_seed_hint',
  ].map(privateName).concat([
    publicName('update_seed_makers'), publicName('reset_save'), publicName('seed_interact_label'),
  ]), {
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_menu: () => guide,
    Menu: { GlyphGuide: 'glyph-guide' },
    obj_ari: player, obj_node_renderer: 'renderer',
    ARI: {
      inventory: { slot: index => slots[index] }, held_item_index: 0,
      held_item: () => slots[context.ARI.held_item_index].item,
      fire_breath_time: 0,
    },
    GRID: {},
    MIST: { running: false },
    PlayerState: { Default: 'default', MountDefault: 'mounted' },
    ObjectId: { SeedMaker: 'seed-maker' },
    InputId: { Interact: 0, SecondaryInteract: 1 },
    BindingType: { Keyboard: 'keyboard', Mouse: 'mouse', GamepadButton: 'pad', GamepadAxis: 'axis' },
    DigitalStatus: { On: 1, Muted: 8 },
    KEYBOARD_INPUTS: [69], MOUSE_BUTTONS: [1], GAMEPAD_BUTTONS: [100],
    BINDINGS: { bindings: [[{ type: 'keyboard', keycode: 69 }], []] },
    array_index: (values, value) => {
      const index = values.indexOf(value);
      return index < 0 ? undefined : index;
    },
    has_flag: (value, flag) => (value & flag) !== 0,
    INPUT: {
      check: id => { assert.equal(id, 0); return input.held && !input.muted; },
      input_overrides: [false, false],
      raw_keyboard: [0], raw_mouse: [0], raw_gp_buttons: [0],
    },
    game_paused: () => game.paused,
    instance_exists: instance => {
      assert.notEqual(instance, undefined, 'native instance_exists requires an instance, not undefined');
      return instance.exists === true;
    },
    INTERACTABLES: { count: () => entries.length, get: index => entries[index] },
    mmapi_warn_rate_limited: (...args) => logs.push(args),
    mmapi_check_guards: (hook, ctx) => {
      assert.equal(hook, 'input.take_press');
      guards.push(ctx);
      return game.allowPress;
    },
  });
  function makeRenderer(objectId = 'seed-maker') {
    const renderer = { exists: true, object_index: 'renderer', node: { object_id: objectId } };
    const callback = context.method(renderer, () => {
      assert.equal(context.self, renderer, 'keep the native callback bound to its renderer');
      if (!game.consume) return false;
      const slot = slots[context.ARI.held_item_index];
      assert.ok(slot.count > 0, 'never pop an empty slot');
      conversions.push({ renderer, item: slot.item, frame: runtime.frame });
      if (--slot.count === 0) slot.item = undefined;
      return game.result;
    });
    const condition = context.method(renderer, () => game.eligible
      && context.ARI.held_item()?.item_id === 17);
    // Furniture.gml registers both the Seed Maker's conversion and its Inspect action.
    const interactions = [{
      input_id: context.InputId.Interact, local_key: 'misc_local/interact', callback,
      can_interact_callback: condition,
    }, {
      input_id: context.InputId.SecondaryInteract, local_key: 'misc_local/inspect',
      callback: context.method(renderer, () => {
        assert.equal(context.self, renderer);
        inspections.push(renderer);
        return game.inspectResult;
      }),
      can_interact_callback: () => true,
    }];
    renderer.interactions = { count: () => interactions.length, get: index => interactions[index] };
    renderer.attempt_interact = context.method(renderer, force => {
      assert.equal(context.self, renderer, 'keep the native dispatcher bound to its renderer');
      if (context.ARI.fire_breath_time > 0) return undefined;
      let output;
      for (const entry of interactions) {
        if (!entry.can_interact_callback()) continue;
        if (guide.inputs[entry.input_id]?.local_key !== entry.local_key) guide.want_reset = true;
        guide.inputs[entry.input_id] = {
          input_id: entry.input_id, local_key: entry.local_key, triggered_this_frame: true,
        };
        const secondary = entry.input_id === context.InputId.SecondaryInteract;
        const pressed = secondary ? input.inspectPressed && !input.inspectMuted
          : input.pressed && !input.muted;
        if (pressed) {
          input[secondary ? 'inspectMuted' : 'muted'] = true;
          if (!secondary) context.INPUT.raw_keyboard[0] |= context.DigitalStatus.Muted;
        }
        if ((pressed && context.mmapi_check_guards('input.take_press', {
          subject: renderer, input_id: entry.input_id, local_key: entry.local_key, interaction: entry,
        }) !== false) || force) {
          output = entry.callback;
          force = false;
        }
      }
      return output;
    });
    renderer.entries = interactions;
    entries.push(renderer);
    return renderer;
  }
  const renderer = makeRenderer();
  const original = renderer.attempt_interact;
  const update = () => context.MistriaCompanion_update_seed_makers();
  update();
  function frame({
    pressed = false, held = true, selected = renderer, force = false, after = false, inspectPressed = false,
  } = {}) {
    Object.assign(input, { pressed, held, inspectPressed, inspectMuted: false });
    // Input.begin_frame preserves keyboard Muted until a new press, including while held.
    if (pressed) input.muted = false;
    context.INPUT.raw_keyboard[0] = (held ? context.DigitalStatus.On : 0)
      | (input.muted ? context.DigitalStatus.Muted : 0);
    runtime.frame++;
    for (const entry of guide.inputs) if (entry) entry.triggered_this_frame = false;
    if (!after) update();
    let result;
    if (selected) {
      const callback = selected.attempt_interact(force);
      if (callback !== undefined) result = callback();
    }
    if (after) update();
    return result;
  }
  const advance = (count, options) => { for (let i = 0; i < count; i++) frame(options); };
  return { context, runtime, input, game, player, renderer, original, entries, slots,
    logs, guards, conversions, inspections, makeRenderer, frame, advance, update, guide };
}

test('Seed Maker action hints explain holding without changing native bindings, callbacks, or labels', () => {
  const h = seedMakerHarness();
  const label = value => h.context.MistriaCompanion_seed_interact_label(value, 'misc_local/interact');
  const entries = h.renderer.entries.map(entry => ({ ...entry }));
  assert.equal(label('Interact'), undefined);
  h.frame({ held: false });
  assert.equal(label('Interact'), 'Interact (hold to repeat)');
  assert.equal(label('Interagir'), 'Interagir (hold to repeat)', 'keep the game-localized action name');
  assert.equal(h.context.MistriaCompanion_seed_interact_label('Inspect', 'misc_local/inspect'), undefined);
  assert.equal(label(undefined), undefined);
  assert.equal(h.guide.inputs[h.context.InputId.Interact].local_key, 'misc_local/interact');
  assert.deepEqual(h.renderer.entries, entries, 'this is a display filter, not an extra Interact action');
  assert.equal(h.conversions.length, 0);
  h.guide.want_reset = false;
  h.advance(15, { held: false });
  assert.equal(h.guide.want_reset, false, 'a stable hint must not rebuild the native guide every frame');
  h.context.BINDINGS.bindings[h.context.InputId.Interact] = [{ type: 'pad', keycode: 100 }];
  h.frame({ held: false });
  assert.equal(label('Interact'), 'Interact (hold to repeat)');
  assert.equal(h.guide.inputs[h.context.InputId.Interact].input_id, h.context.InputId.Interact,
    'the native glyph still resolves the current keyboard/controller binding');
  h.frame({ selected: null, held: false });
  h.frame({ selected: null, held: false });
  assert.equal(label('Interact'), undefined);
  assert.equal(h.guide.want_reset, true, 'leaving the target refreshes the guide back to its native label');
});

test('Seed Maker hold hints clear for unavailable actions, movement, menus, scenes, and save resets', () => {
  for (const change of [
    h => { h.player.x++; },
    h => { h.player.cardinal = 1; },
    h => { h.game.paused = true; },
    h => { h.context.MIST.running = true; },
    h => { h.renderer.exists = false; },
    h => { h.renderer.attempt_interact = () => undefined; },
    h => { h.context.MistriaCompanion_reset_save({}); },
  ]) {
    const h = seedMakerHarness();
    h.frame({ held: false });
    change(h);
    assert.equal(h.context.MistriaCompanion_seed_interact_label('Interact', 'misc_local/interact'), undefined);
  }
  const h = seedMakerHarness();
  h.frame({ held: false });
  h.game.eligible = false;
  h.frame({ held: false });
  assert.equal(h.context.MistriaCompanion_seed_interact_label('Interact', 'misc_local/interact'), undefined);
  assert.equal(h.renderer.entries[1].local_key, 'misc_local/inspect');
});

test('Seed Maker taps stay single and held input repeats at exactly 30 then 12 frame intervals', () => {
  for (const after of [false, true]) {
    const h = seedMakerHarness();
    assert.equal(h.frame({ pressed: true, after }), undefined, 'preserve native undefined success return');
    assert.equal(h.input.muted, true, 'native press consumption still happens');
    assert.ok(h.runtime.seed_repeat, 'the consumed press must still arm the hold');
    h.advance(29, { after });
    assert.equal(h.conversions.length, 1);
    h.frame({ after });
    assert.deepEqual(h.conversions.map(entry => entry.frame), [1, 31]);
    h.advance(11, { after });
    assert.equal(h.conversions.length, 2);
    h.frame({ after });
    assert.deepEqual(h.conversions.map(entry => entry.frame), [1, 31, 43]);
    h.frame({ held: false, after });
    assert.equal(h.runtime.seed_repeat, undefined);
    h.advance(60, { after });
    assert.equal(h.conversions.length, 3, 'holding again without a fresh press does not restart');
    h.frame({ pressed: true, after });
    h.frame({ held: false, after });
    h.advance(60, { held: false, after });
    assert.equal(h.conversions.length, 4, 'a tap never repeats');
  }
});

test('native Seed Maker Interact and Inspect coexist without disabling repetition', () => {
  const h = seedMakerHarness();
  assert.deepEqual(h.renderer.entries.map(entry => [entry.input_id, entry.local_key]), [
    [0, 'misc_local/interact'], [1, 'misc_local/inspect'],
  ]);
  assert.notEqual(h.renderer.attempt_interact, h.original);
  assert.equal(h.logs.length, 0);
  h.frame({ pressed: true });
  h.advance(54);
  assert.deepEqual(h.conversions.map(entry => entry.frame), [1, 31, 43, 55]);
  assert.equal(h.inspections.length, 0);
});

test('Seed Maker held bindings ignore native mute without clearing it or bypassing overrides', () => {
  const h = seedMakerHarness();
  const held = h.context.__MistriaCompanion_seed_interact_held;
  h.frame({ pressed: true });
  assert.equal(h.context.INPUT.check(h.context.InputId.Interact), false);
  assert.equal(held(), true);
  const mutedOn = h.context.DigitalStatus.Muted | h.context.DigitalStatus.On;
  assert.equal(h.context.INPUT.raw_keyboard[0], mutedOn, 'do not restore pressed or clear mute');
  h.advance(30);
  assert.equal(h.conversions.length, 2);
  assert.equal(h.context.INPUT.raw_keyboard[0], mutedOn);
  h.context.INPUT.input_overrides[h.context.InputId.Interact] = true;
  assert.equal(held(), false, 'explicit input suppression still blocks repetition');
  h.frame();
  assert.equal(h.runtime.seed_repeat, undefined);
  h.context.INPUT.input_overrides[h.context.InputId.Interact] = false;
  h.advance(60);
  assert.equal(h.conversions.length, 2, 'lifting suppression does not restart a hold');
  h.frame({ held: false });
  assert.equal(held(), false);
  assert.equal(h.context.INPUT.raw_keyboard[0], h.context.DigitalStatus.Muted);
});

test('Seed Maker held lookup follows keyboard, mouse, and controller Interact remappings', () => {
  const h = seedMakerHarness();
  const held = h.context.__MistriaCompanion_seed_interact_held;
  const mutedOn = h.context.DigitalStatus.On | h.context.DigitalStatus.Muted;
  for (const [type, keycode, raw] of [
    ['keyboard', 69, 'raw_keyboard'], ['mouse', 1, 'raw_mouse'], ['pad', 100, 'raw_gp_buttons'],
  ]) {
    h.context.BINDINGS.bindings[h.context.InputId.Interact] = [undefined, { type, keycode }];
    h.context.INPUT[raw][0] = mutedOn;
    assert.equal(held(), true, type);
    assert.equal(h.context.INPUT[raw][0], mutedOn);
    h.context.INPUT[raw][0] = h.context.DigitalStatus.Muted;
    assert.equal(held(), false, `${type} release or disconnect`);
    h.context.INPUT[raw][0] = 0;
  }
  h.context.KEYBOARD_INPUTS.push(70);
  h.context.INPUT.raw_keyboard = [mutedOn, 0];
  h.context.BINDINGS.bindings[h.context.InputId.Interact] = [{ type: 'keyboard', keycode: 70 }];
  assert.equal(held(), false, 'holding E does nothing after Interact is remapped to F');
  h.context.INPUT.raw_keyboard[1] = mutedOn;
  assert.equal(held(), true);
  h.context.INPUT.raw_keyboard[1] = 0;
  h.context.BINDINGS.bindings[h.context.InputId.Interact] = [];
  assert.equal(held(), false, 'unbound Interact does not use a hard-coded key');
  h.context.BINDINGS.bindings[h.context.InputId.Interact] = [{ type: 'axis', keycode: 200 }];
  h.context.INPUT.check = () => true;
  assert.equal(held(), true, 'unmuted axis bindings keep the native input result');
});

test('native Seed Maker Inspect retains its callback and cancels rather than joining a held conversion', () => {
  const h = seedMakerHarness();
  const inspect = h.renderer.entries[1].callback;
  const result = { inspection: true };
  h.game.inspectResult = result;
  assert.equal(h.frame({ held: false, inspectPressed: true }), result);
  assert.equal(h.inspections.length, 1);
  assert.equal(h.conversions.length, 0);
  assert.equal(h.runtime.seed_repeat, undefined);
  assert.equal(h.renderer.entries[1].callback, inspect);

  h.frame({ pressed: true });
  h.advance(29);
  assert.equal(h.frame({ inspectPressed: true }), result, 'Inspect takes priority on a repeat-due frame');
  assert.equal(h.inspections.length, 2);
  assert.equal(h.conversions.length, 1);
  assert.equal(h.runtime.seed_repeat, undefined);
  h.advance(60);
  assert.equal(h.conversions.length, 1);
});

test('Seed Maker conversion lookup is independent of the Inspect entry ordering', () => {
  const h = seedMakerHarness();
  const renderer = h.makeRenderer();
  renderer.entries.reverse();
  h.update();
  h.frame({ pressed: true, selected: renderer });
  h.advance(42, { selected: renderer });
  assert.equal(h.conversions.length, 3);
  assert.equal(h.inspections.length, 0);
  assert.equal(h.logs.length, 0);
});

test('Seed Maker repeat starts only after a successful native conversion, never from holding nearby', () => {
  const h = seedMakerHarness();
  h.advance(90);
  assert.equal(h.conversions.length, 0);
  h.game.consume = false;
  assert.equal(h.frame({ pressed: true }), false);
  assert.equal(h.runtime.seed_repeat, undefined);
  h.game.consume = true;
  h.advance(60);
  assert.equal(h.conversions.length, 0);
  h.game.result = true;
  assert.equal(h.frame({ pressed: true }), true);
  assert.equal(h.conversions.length, 1);
});

test('Seed Maker repeat stops on the last selected item and never uses another stack', () => {
  const h = seedMakerHarness();
  h.slots[0].count = 3;
  h.frame({ pressed: true });
  h.advance(100);
  assert.equal(h.conversions.length, 3);
  assert.equal(h.slots[0].item, undefined);
  assert.equal(h.slots[1].count, 100);
  assert.equal(h.runtime.seed_repeat, undefined);
  h.slots[0] = { item: { item_id: 17, infusion: 0 }, count: 20 };
  h.advance(60);
  assert.equal(h.conversions.length, 3, 'refilling an empty slot does not restart an old hold');
});

test('Seed Maker holds cancel on movement, selection changes, pause, transitions, and invalid targets', () => {
  const scenarios = {
    move: h => { h.player.x++; },
    turn: h => { h.player.cardinal++; },
    slot: h => { h.context.ARI.held_item_index = 1; },
    item: h => { h.slots[0].item = { item_id: 17, infusion: 0 }; },
    variant: h => { h.slots[0].item.infusion = 2; },
    menu: h => { h.game.paused = true; },
    cutscene: h => { h.context.MIST.running = true; },
    jump: h => { h.game.state = 'jump'; },
    pendingState: h => { h.player.fsm.next_state = 'transition'; },
    fireBreath: h => { h.context.ARI.fire_breath_time = 10; },
    animal: h => { h.context.ARI.held_animal_id = 2; },
    area: h => { h.context.GRID = {}; },
    removed: h => { h.renderer.exists = false; },
    replaced: h => { h.renderer.node = { object_id: 'seed-maker' }; },
    changedObject: h => { h.renderer.node.object_id = 'chest'; },
    inventory: h => { h.context.ARI.inventory = { slot: index => h.slots[index] }; },
    player: h => { h.player.id = 2; },
  };
  for (const [name, change] of Object.entries(scenarios)) {
    const h = seedMakerHarness();
    h.frame({ pressed: true });
    h.advance(10);
    change(h);
    h.frame({ selected: null });
    assert.equal(h.runtime.seed_repeat, undefined, name);
    h.advance(40, { selected: null });
    assert.equal(h.conversions.length, 1, name);
  }
});

test('leaving the selected Seed Maker even for a frame cancels rather than resuming on return', () => {
  const h = seedMakerHarness();
  h.frame({ pressed: true });
  h.advance(20);
  h.frame({ selected: null });
  h.advance(60);
  assert.equal(h.conversions.length, 1);
  const second = h.makeRenderer();
  h.update();
  h.frame({ pressed: true });
  h.frame({ selected: second });
  h.advance(60, { selected: second });
  assert.equal(h.conversions.length, 2, 'moving between Seed Makers does not transfer the hold');
});

test('Seed Maker repeated conversions respect native eligibility and input guard vetoes', () => {
  for (const flag of ['eligible', 'allowPress']) {
    const h = seedMakerHarness();
    h.frame({ pressed: true });
    h.advance(29);
    h.game[flag] = false;
    h.frame();
    assert.equal(h.runtime.seed_repeat, undefined);
    assert.equal(h.conversions.length, 1);
    h.game[flag] = true;
    h.advance(60);
    assert.equal(h.conversions.length, 1, 'lifting a restriction requires a new press');
  }
  const h = seedMakerHarness();
  h.frame({ pressed: true });
  h.advance(30);
  assert.equal(h.guards.length, 2);
  for (const guard of h.guards) {
    assert.equal(guard.subject, h.renderer);
    assert.equal(guard.interaction, h.renderer.entries[0]);
    assert.equal(guard.local_key, 'misc_local/interact');
    assert.equal(guard.input_id, h.context.InputId.Interact);
  }
});

test('Seed Maker normal and forced presses preserve native behavior without arming forced repeats', () => {
  const h = seedMakerHarness();
  h.game.allowPress = false;
  h.frame({ pressed: true });
  h.advance(60);
  assert.equal(h.conversions.length, 0);
  h.frame({ force: true });
  h.advance(60);
  assert.equal(h.conversions.length, 1);
  assert.equal(h.runtime.seed_repeat, undefined);
  h.game.allowPress = true;
  h.game.state = 'mounted';
  h.frame({ pressed: true });
  h.advance(30);
  assert.equal(h.conversions.length, 3, 'the native mounted interaction can repeat too');
});

test('Seed Maker wrappers do not alter other interactables and leave foreign replacements alone', () => {
  const h = seedMakerHarness();
  const wrapped = h.renderer.attempt_interact;
  const callback = h.renderer.entries[0].callback;
  h.update();
  h.update();
  assert.equal(h.renderer.attempt_interact, wrapped);
  assert.equal(h.renderer.entries[0].callback, callback);
  const chest = h.makeRenderer('chest');
  const chestOriginal = chest.attempt_interact;
  const npc = h.makeRenderer();
  npc.object_index = 'npc';
  const npcOriginal = npc.attempt_interact;
  h.entries.push(undefined, { exists: false });
  h.update();
  assert.equal(chest.attempt_interact, chestOriginal);
  assert.equal(npc.attempt_interact, npcOriginal);
  h.frame({ pressed: true });
  const foreign = () => undefined;
  h.renderer.attempt_interact = foreign;
  h.update();
  assert.equal(h.renderer.attempt_interact, foreign);
  assert.equal(h.runtime.seed_repeat, undefined);
});

test('Seed Maker unsupported interaction layouts warn; late initialization and new makers are retried', () => {
  const h = seedMakerHarness();
  const late = h.makeRenderer();
  const original = late.attempt_interact;
  const entries = late.entries.splice(0);
  h.update();
  assert.equal(late.attempt_interact, original);
  late.entries.push(...entries);
  h.update();
  assert.notEqual(late.attempt_interact, original);

  for (const mutate of [
    maker => { maker.entries.push({ ...maker.entries[0] }); },
    maker => { maker.entries[0].input_id = 'secondary'; },
    maker => { maker.entries[0].local_key = 'misc_local/inspect'; },
    maker => { maker.entries[0].callback = undefined; },
    maker => { maker.entries[0].can_interact_callback = undefined; },
    maker => { maker.interactions = {}; },
  ]) {
    const maker = h.makeRenderer();
    const before = maker.attempt_interact;
    mutate(maker);
    const warnings = h.logs.length;
    h.update();
    assert.equal(maker.attempt_interact, before);
    assert.ok(h.logs.length > warnings);
  }
});

test('Seed Maker repeat never catches up with a burst or retains a hold across a save reset', () => {
  const h = seedMakerHarness();
  h.frame({ pressed: true });
  h.runtime.frame += 100;
  h.frame();
  assert.equal(h.conversions.length, 1);
  h.frame({ pressed: true });
  h.context.MistriaCompanion_reset_save({});
  assert.equal(h.runtime.seed_repeat, undefined);
  h.advance(60);
  assert.equal(h.conversions.length, 2);
});

test('changed Seed Maker callbacks and interaction lists cancel holds without overwriting replacements', () => {
  for (const replace of [
    h => { h.renderer.entries[0].callback = () => false; },
    h => { h.renderer.entries[0].can_interact_callback = () => false; },
    h => { h.renderer.entries[0].input_id = 'secondary'; },
    h => { h.renderer.entries[1].input_id = h.context.InputId.Interact; },
    h => { h.renderer.entries.push({ ...h.renderer.entries[0] }); },
    h => { h.renderer.interactions = { count: () => 0, get: () => undefined }; },
  ]) {
    const h = seedMakerHarness();
    h.frame({ pressed: true });
    replace(h);
    h.update();
    assert.equal(h.runtime.seed_repeat, undefined);
    h.advance(60, { selected: null });
    assert.equal(h.conversions.length, 1);
  }
});

test('rapid Seed Maker taps reset the hold delay instead of adding an extra repeated conversion', () => {
  const h = seedMakerHarness();
  h.frame({ pressed: true });
  h.advance(28);
  h.frame({ pressed: true });
  h.advance(29);
  assert.deepEqual(h.conversions.map(entry => entry.frame), [1, 30]);
  h.frame();
  assert.deepEqual(h.conversions.map(entry => entry.frame), [1, 30, 60]);
});

function makeState(candidates, groups, birthdays, freeSlots, limit = 2048) {
  return {
    npc_ids: candidates.map((_, i) => i),
    candidates,
    groups: groups.map(group => ({
      capacity: group.capacity,
      used: 0,
      existing_room: group.existing ?? 0,
      item: { prototype: { max_stack: group.stack ?? 99 } },
    })),
    birthday_count: birthdays,
    free_slots: freeSlots,
    assignment: candidates.map(() => -1),
    best_assignment: candidates.map(() => -1),
    best_count: 0,
    best_birthdays: 0,
    search_nodes: 0,
    search_node_limit: limit,
    search_limited: false,
  };
}

function solve(state) {
  search.__MistriaCompanion_search_gift_assignment(state, 0, 0, 0, 0);
  return state;
}

function objective(assignment, birthdays) {
  const included = Array.from(assignment, value => Number(value !== -1));
  return [
    included.slice(0, birthdays).reduce((a, b) => a + b, 0),
    included.reduce((a, b) => a + b, 0),
    ...included,
  ];
}

function better(left, right) {
  for (let i = 0; i < left.length; i++) {
    if (left[i] !== right[i]) return left[i] > right[i];
  }
  return false;
}

function exhaustiveObjective(state) {
  const assignment = state.npc_ids.map(() => -1);
  const used = state.groups.map(() => 0);
  let best = objective(assignment, state.birthday_count);
  function visit(npc) {
    if (npc === assignment.length) {
      const score = objective(assignment, state.birthday_count);
      if (better(score, best)) best = score;
      return;
    }
    visit(npc + 1);
    for (const index of state.candidates[npc]) {
      const group = state.groups[index];
      if (used[index] === group.capacity) continue;
      used[index]++;
      const slots = state.groups.reduce((total, current, i) =>
        total + Math.ceil(Math.max(0, used[i] - current.existing_room) / current.item.prototype.max_stack), 0);
      if (slots <= state.free_slots) {
        assignment[npc] = index;
        visit(npc + 1);
        assignment[npc] = -1;
      }
      used[index]--;
    }
  }
  visit(0);
  return best;
}

test('birthday coverage outranks a larger non-birthday haul', () => {
  const state = solve(makeState([[0], [1], [1]], [{ capacity: 1 }, { capacity: 2 }], 1, 1));
  assert.equal(state.best_birthdays, 1);
  assert.equal(state.best_count, 1);
  assert.deepEqual(Array.from(state.best_assignment), [0, -1, -1]);
  assert.equal(state.search_limited, false);
});

test('overlapping preferences can reassign gifts to cover everyone', () => {
  const state = solve(makeState([[0, 1], [0], [2]], [
    { capacity: 1 }, { capacity: 1 }, { capacity: 1 },
  ], 1, 3));
  assert.deepEqual(Array.from(state.best_assignment), [1, 0, 2]);
  assert.equal(state.best_count, 3);
});

test('partial stacks work without empty slots and respect item stack limits', () => {
  const state = solve(makeState([[0], [0], [0]], [
    { capacity: 3, existing: 2, stack: 2 },
  ], 0, 0));
  assert.equal(state.best_count, 2);
  assert.deepEqual(Array.from(state.best_assignment), [0, 0, -1]);
  assert.equal(solve(makeState([[0]], [{ capacity: 1 }], 1, 0)).best_count, 0);
  assert.equal(solve(makeState([[0], [0], [0]], [{ capacity: 3, stack: 1 }], 0, 2)).best_count, 2);
});

test('search-budget exhaustion is reported without corrupting assignments', () => {
  const state = solve(makeState([[0], [0]], [{ capacity: 2 }], 1, 1, 2));
  assert.equal(state.search_nodes, 2);
  assert.equal(state.search_limited, true);
  assert.equal(state.best_birthdays, 1);
  assert.equal(state.best_count, 1);
  assert.deepEqual(state.assignment, [-1, -1]);
  assert.deepEqual(state.groups.map(group => group.used), [0]);
});

test('gift groups reuse capacity calculations and do not exceed available room', () => {
  let capacityReads = 0;
  const item = { partial_eq: other => other === item };
  const units = Array.from({ length: 6 }, (_, slot_index) => ({
    slot_index, item, npcs: [true, true],
  }));
  const context = load([privateName('gift_groups')], {
    ARI: { inventory: { room_for_item: () => { capacityReads++; return 2; } } },
    __MistriaCompanion_existing_room: () => 1,
  });
  const groups = context.__MistriaCompanion_gift_groups(units);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].capacity, 2);
  assert.equal(groups[0].units.length, 2);
  assert.equal(groups[0].existing_room, 1);
  assert.equal(capacityReads, 1);
});

test('birthday-aware pruning matches an independent exhaustive solver', () => {
  let seed = 364836;
  function random(max) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % max;
  }
  for (let sample = 0; sample < 600; sample++) {
    const count = 1 + random(6);
    const groups = Array.from({ length: 1 + random(4) }, () => ({
      capacity: 1 + random(4), existing: random(3), stack: 1 + random(3),
    }));
    const candidates = Array.from({ length: count }, () =>
      groups.flatMap((_, i) => random(3) === 0 ? [] : [i]));
    const state = makeState(candidates, groups, random(count + 1), random(4), 100000);
    const expected = exhaustiveObjective(state);
    solve(state);
    assert.equal(state.search_limited, false);
    assert.deepEqual(objective(state.best_assignment, state.birthday_count), expected, `Scenario ${sample}`);
  }
});

const list = values => ({
  contains: value => values.includes(value),
  contains_any_value_from: other => values.some(value => other.contains(value)),
});

test('tooltip and picker gift rules respect infusions, void exceptions, and banned tags', () => {
  const Desire = { Loved: 4, Liked: 3, Neutral: 2, Disliked: 1 };
  const Infusion = { Loveable: 1, Likeable: 2 };
  const ItemId = { VoidNewt: 100, VoidCake: 101 };
  const NpcId = { Juniper: 1, Eiland: 2 };
  const context = load([privateName('gift_desire_for_npc')], { Desire, Infusion, ItemId, NpcId });
  const desire = context.__MistriaCompanion_gift_desire_for_npc;
  const npc = { banned_gift_tags: list(['banned']), loved_gifts: list([3]), liked_gifts: list([4]) };
  const item = (id, infusion = 0, tags = [], giftable = true) => ({
    item_id: id, infusion, prototype: { tags: list(tags), giftable },
  });
  assert.equal(desire(item(3), npc, 0), Desire.Loved);
  assert.equal(desire(item(4), npc, 0), Desire.Liked);
  assert.equal(desire(item(5, Infusion.Loveable), npc, 0), Desire.Loved);
  assert.equal(desire(item(5, Infusion.Likeable), npc, 0), Desire.Liked);
  assert.equal(desire(item(3, Infusion.Likeable), npc, 0), Desire.Loved);
  assert.equal(desire(item(ItemId.VoidNewt, Infusion.Loveable), npc, NpcId.Eiland), Desire.Disliked);
  assert.equal(desire(item(ItemId.VoidNewt), npc, NpcId.Juniper), Desire.Loved);
  assert.equal(desire(item(ItemId.VoidCake), npc, NpcId.Eiland), Desire.Loved);
  assert.equal(desire(item(3, Infusion.Loveable, ['banned']), npc, 0), undefined);
  assert.equal(desire(item(3, 0, [], false), npc, 0), undefined);
  assert.equal(desire(item(4, Infusion.Loveable), npc, 0, false), Desire.Liked,
    'completion mode does not promote a native liked item to loved');
  assert.equal(desire(item(5, Infusion.Likeable), npc, 0, false), Desire.Neutral);
  assert.equal(desire(item(3, Infusion.Likeable), npc, 0, false), Desire.Loved);
  assert.equal(desire(item(3, Infusion.Loveable, ['banned']), npc, 0, false), undefined);
  assert.equal(desire(item(ItemId.VoidNewt, Infusion.Loveable), npc, NpcId.Eiland, false), Desire.Disliked);
});

function giftTooltipHarness() {
  const Desire = { Loved: 4, Liked: 3, Neutral: 2, Disliked: 1 };
  const Infusion = { Loveable: 1, Likeable: 2 };
  const runtime = { recipe_cache: {} };
  const warnings = [];
  const npc = (name, loved, met = true, unlocked = true) => ({
    prototype: {
      name, loved_gifts: list(loved ? [0] : []), liked_gifts: list(loved ? [] : [0]),
      banned_gift_tags: list([]),
    },
    met, unlocked, has_met() { return this.met; },
    gift_flag: true, gifts_given: new Set(), known_gift_preferences: new Set(),
    location_position: { location_id: 1 }, hearts: 0, heart_level() { return this.hearts; },
    birthday: false, is_birthday() { return this.birthday; },
  });
  const npcs = [
    npc('Balor', false), npc('March', true), npc('Olric', true),
    npc('Seridia', true, false), npc('Wheedle', true, true, false),
  ];
  let recipeReads = 0;
  const item = { item_id: 0, infusion: 0, prototype: { giftable: true, tags: list([]) } };
  for (const entry of npcs) {
    entry.gifts_given.contains = entry.gifts_given.has.bind(entry.gifts_given);
  }
  const context = load([
    'npc_is_known', 'npc_needs_gift', 'gift_npcs', 'gift_desire_for_npc', 'join', 'for_item', 'details_text',
    'compact_gift_text', 'gift_highlight_runs', 'clear_gift_highlights', 'update_gift_highlights',
    'has_listed_gift', 'universal_gift_text', 'cooking_base_text', 'cooking_gift_text', 'cooking_description_set',
    'clear_cooking_details', 'update_cooking_details', 'text_popup',
  ].map(privateName).concat([
    publicName('description'), publicName('reset_save'), publicName('update_gift_tooltips'),
    publicName('show_cooking_gifts'), publicName('text_popup_scroll'),
  ]), {
    Desire, Infusion, ItemId: { VoidNewt: 100, VoidCake: 101 }, NpcId: { Juniper: 10, Eiland: 11 },
    Menu: { Crafting: 'crafting' }, RecipeContext: { Cooking: 'cooking' },
    NPCS: npcs,
    LocationId: { Aldaria: 0 }, LOCATIONS: [{}, {}, {}],
    global: {
      __item_data: [{ recipe_key: 'ore' }],
      __npc_prototypes: npcs.map(npc => npc.prototype).concat([{
        name: 'Unmet villager', loved_gifts: list([]), liked_gifts: list([]), banned_gift_tags: list([]),
      }]),
    },
    npc_is_unlocked: id => npcs[id].unlocked,
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_as_array: value => value,
    __MistriaCompanion_npc_name: prototype => prototype.name,
    __MistriaCompanion_recipe_uses_item: () => { recipeReads++; return false; },
    __MistriaCompanion_recipe_summary: () => '',
    string_length: value => Array.from(value).length,
    string_char_at: (value, index) => Array.from(value)[index - 1],
    string_copy: (value, start, count) => Array.from(value).slice(start - 1, start - 1 + count).join(''),
    string_split: (value, separator) => value.split(separator),
    string_replace_all: (value, search, replacement) => value.split(search).join(replacement),
    mmapi_warn_rate_limited: (...args) => warnings.push(args),
  });
  const describe = (base = 'A rare artifact.') => context.MistriaCompanion_description(base, { item });
  const details = () => context.__MistriaCompanion_for_item(item);
  const runs = (text, value = details()) => Array.from(context.__MistriaCompanion_gift_highlight_runs(text, value));
  return { context, runtime, npcs, item, Infusion, describe, details, runs, warnings, recipeReads: () => recipeReads };
}

test('gift tooltips omit unmet, locked, and missing NPCs without filtering daily recipients', () => {
  const h = giftTooltipHarness();
  h.npcs[1].gift_flag = false;
  h.context.global.__npc_prototypes.push(h.npcs[0].prototype);
  assert.equal(h.describe(), 'A rare artifact.\nLiked by: Balor\nLoved by: March, Olric');
  const known = h.context.__MistriaCompanion_npc_is_known;
  assert.equal(known(-1), false);
  assert.equal(known(5), false);
  h.context.NPCS = undefined;
  assert.equal(h.describe(), undefined);
  h.context.NPCS = [undefined];
  assert.equal(known(0), false);
});

test('meeting and gifting update the same item immediately while recipes stay cached', () => {
  const h = giftTooltipHarness();
  h.npcs[2].known_gift_preferences.add(0);
  assert.equal(h.details().gift_sections[1].npcs[1].given, false, 'Gossip is not a given gift');
  h.npcs[2].gifts_given.add(0);
  h.npcs[2].gift_flag = false;
  assert.equal(h.details().gift_sections[1].npcs[1].given, true);
  h.npcs[2].gift_flag = true;
  assert.equal(h.details().gift_sections[1].npcs[1].given, true, 'history survives the next day');
  h.npcs[3].met = true;
  assert.match(h.describe(), /Loved by: March, Olric, Seridia$/);
  h.npcs[4].unlocked = true;
  assert.match(h.describe(), /Seridia, Wheedle$/);
  assert.equal(h.recipeReads(), 1);

  h.context.MistriaCompanion_reset_save({});
  h.npcs[2].gifts_given.clear();
  h.npcs[3].met = false;
  assert.equal(h.details().gift_sections[1].npcs[1].given, false, 'no cross-save highlight cache');
  assert.doesNotMatch(h.describe(), /Seridia/);
  assert.equal(h.recipeReads(), 2);
});

test('gift history is per base item and Likeable/Loveable display lists retain base preferences', () => {
  const h = giftTooltipHarness();
  h.npcs[0].gifts_given.add(0);
  h.npcs[2].gifts_given.add(99);
  assert.equal(h.details().gift_sections[0].npcs[0].given, true);
  assert.equal(h.details().gift_sections[1].npcs[1].given, false);
  h.item.infusion = h.Infusion.Loveable;
  assert.equal(h.describe(''), 'Liked by: Balor\nLoved by: March, Olric');
  assert.equal(h.details().gift_sections[0].npcs[0].given, true);
  assert.equal(h.details().gift_sections[1].npcs[1].given, false);
  h.item.infusion = 0;
  assert.equal(h.details().gift_sections[0].npcs[0].given, true, 'summary formatting never changes gift history');
  h.item.prototype.giftable = false;
  assert.equal(h.describe(), undefined);
});

test('universal item tooltips retain the description and show only the exact Everyone summary', () => {
  const h = giftTooltipHarness();
  for (const npc of h.context.global.__npc_prototypes) {
    npc.liked_gifts = list([]);
    npc.loved_gifts = list([]);
  }
  h.runtime.recipe_cache['0'] = 'Another recipe';
  h.npcs[0].gifts_given.add(0);
  const description = 'A cream-filled donut shaped like a cow. This treat is loved by everyone.';
  for (const [infusion, summary] of [
    [h.Infusion.Loveable, 'Loved by: Everyone'],
    [h.Infusion.Likeable, 'Liked by: Everyone'],
  ]) {
    h.item.infusion = infusion;
    assert.equal(h.describe(description), `${description}\n${summary}`);
    assert.equal(h.describe(''), summary);
    const details = h.details();
    assert.equal(details.universal, summary);
    assert.equal(details.recipes, '');
    assert.equal(details.liked, '');
    assert.equal(details.loved, '');
    assert.equal(details.gift_sections.length, 0);
    assert.equal(h.runs(h.describe(description)).length, 0, 'Everyone is not an individual gift-history highlight');
    assert.equal(h.context.__MistriaCompanion_cooking_gift_text(h.item, details), summary);
  }
  assert.equal(h.npcs[0].gifts_given.has(0), true, 'display summaries do not alter gift history');
});

test('universal summaries distinguish base-item love from mixed positive preferences across all NPCs', () => {
  const h = giftTooltipHarness();
  const prototypes = h.context.global.__npc_prototypes;
  for (const prototype of prototypes) {
    prototype.loved_gifts = list([0]);
    prototype.liked_gifts = list([]);
  }
  assert.equal(h.describe('Original description.'), 'Original description.\nLoved by: Everyone');
  prototypes[0].loved_gifts = list([]);
  prototypes[0].liked_gifts = list([0]);
  assert.equal(h.describe('Original description.'), 'Original description.\nLiked by: Everyone');
  prototypes.at(-1).loved_gifts = list([]);
  assert.equal(h.details().universal, '', 'a neutral unmet NPC prevents a false Everyone label');
  assert.match(h.describe(), /Liked by: Balor\nLoved by: March, Olric$/);
  h.runtime.recipe_cache['0'] = 'Soup';
  assert.match(h.describe(), /Uses: Soup\nLiked by: Balor/, 'non-universal recipe summaries are unchanged');
});

test('universal item summaries need no met NPCs and preserve special-item and banned-gift exceptions', () => {
  const h = giftTooltipHarness();
  const universal = h.context.__MistriaCompanion_universal_gift_text;
  h.item.infusion = h.Infusion.Loveable;
  for (const npc of h.context.global.__npc_prototypes) {
    npc.liked_gifts = list([]);
    npc.loved_gifts = list([]);
  }
  for (const npc of h.npcs) { npc.met = false; npc.unlocked = false; }
  h.context.NPCS = undefined;
  assert.equal(h.describe('A special dish.'), 'A special dish.\nLoved by: Everyone');
  for (const id of [100, 101]) {
    assert.equal(universal({ ...h.item, item_id: id }), '', 'void-item exceptions override universal infusions');
  }
  for (const prototype of h.context.global.__npc_prototypes) {
    prototype.banned_gift_tags = list(['banned']);
  }
  h.item.prototype.tags = list(['banned']);
  assert.equal(universal(h.item), '', 'no eligible recipients is not Everyone');
});

test('Likeable and Loveable dishes list only the NPCs with native preferences and retain their original grouping', () => {
  const h = giftTooltipHarness();
  h.npcs[0].gifts_given.add(0);
  h.npcs[1].prototype.loved_gifts = list([]);
  h.npcs[1].gifts_given.add(0);
  const expected = 'Liked by: Balor\nLoved by: Olric';
  for (const infusion of [0, h.Infusion.Likeable, h.Infusion.Loveable]) {
    h.item.infusion = infusion;
    assert.equal(h.describe(''), expected);
    const details = h.details();
    assert.equal(details.universal, '');
    assert.equal(details.gift_sections[0].npcs[0].given, true);
    assert.equal(details.gift_sections[1].npcs[0].given, false);
    assert.deepEqual(h.runs(h.describe('')).map(run => run.text), ['Balor']);
    assert.doesNotMatch(h.describe(''), /March|Seridia|Wheedle|Everyone/,
      'modifier-only, unmet, and locked recipients are not added to completion lists');
  }
});

test('Likeable Apple Pie retains Eiland and Hayden while default-infused unlisted festival treats use Everyone', () => {
  const h = giftTooltipHarness();
  const prototypes = h.context.global.__npc_prototypes;
  for (const prototype of prototypes) {
    prototype.loved_gifts = list([]);
    prototype.liked_gifts = list([]);
  }
  h.npcs[0].prototype.name = 'Eiland';
  h.npcs[1].prototype.name = 'Hayden';
  h.npcs[0].prototype.liked_gifts = list([0]);
  h.npcs[1].prototype.liked_gifts = list([0]);
  h.npcs[0].gifts_given.add(0);
  const description = 'This dish is universally liked when given as a gift.';
  h.item.infusion = h.Infusion.Likeable;
  assert.equal(h.describe(description), `${description}\nLiked by: Eiland, Hayden`);
  assert.deepEqual(h.runs(h.describe(description)).map(run => run.text), ['Eiland']);
  h.item.infusion = h.Infusion.Loveable;
  assert.equal(h.describe('Universally loved.'), 'Universally loved.\nLiked by: Eiland, Hayden');
  h.context.global.__item_data.push({ recipe_key: 'cow_donut' });
  h.item.item_id = 1;
  h.item.prototype.default_infusion = h.Infusion.Loveable;
  assert.equal(h.describe('A cream-filled donut shaped like a cow.'),
    'A cream-filled donut shaped like a cow.\nLoved by: Everyone');
  assert.equal(h.details().gift_sections.length, 0);
});

test('completion lists do not reveal unmet preferences or fall back to a modifier-expanded Everyone roster', () => {
  const h = giftTooltipHarness();
  h.item.infusion = h.Infusion.Loveable;
  for (const npc of h.npcs) { npc.met = false; npc.unlocked = false; }
  assert.equal(h.details().universal, '', 'existence of native preferences is checked across all NPCs');
  assert.equal(h.details().liked, '');
  assert.equal(h.details().loved, '');
  assert.equal(h.describe(), undefined, 'keep the native description when no known recipients are eligible');
  assert.equal(h.context.__MistriaCompanion_cooking_gift_text(h.item, h.details()),
    'No met villagers have this dish in their liked/loved lists.');
  h.npcs[0].met = true;
  h.npcs[0].unlocked = true;
  assert.equal(h.describe(''), 'Liked by: Balor');
  h.npcs[0].prototype.banned_gift_tags = list(['banned']);
  h.item.prototype.tags = list(['banned']);
  assert.equal(h.details().liked, '', 'native banned-gift rules still apply');
});

test('the chest picker retains actual infusion-aware reactions rather than using completion display lists', () => {
  const h = giftTooltipHarness();
  const picker = load(['npc_is_known', 'npc_needs_gift', 'gift_desire_for_npc', 'gift_desire', 'is_loved_gift']
    .map(privateName), {
    NPCS: h.npcs, global: h.context.global,
    LOCATIONS: h.context.LOCATIONS, LocationId: h.context.LocationId,
    npc_is_unlocked: id => h.npcs[id].unlocked,
    Desire: h.context.Desire, Infusion: h.Infusion, ItemId: h.context.ItemId, NpcId: h.context.NpcId,
  });
  h.item.infusion = h.Infusion.Loveable;
  assert.equal(h.details().liked, 'Balor', 'Balor normally only likes this dish');
  assert.equal(picker.__MistriaCompanion_is_loved_gift(h.item, 0), true,
    'a Loveable infusion still makes the actual gift loved by Balor');
  h.item.infusion = h.Infusion.Likeable;
  assert.equal(picker.__MistriaCompanion_is_loved_gift(h.item, 0), false);
  assert.equal(picker.__MistriaCompanion_is_loved_gift(h.item, 1), true,
    'a normally loved item remains loved with a Likeable infusion');
});

test('given names get exact highlight runs, not commas, headings, or matching description text', () => {
  const h = giftTooltipHarness();
  h.npcs[0].gifts_given.add(0);
  h.npcs[2].gifts_given.add(0);
  const runs = h.runs(h.describe('Olric and Balor.\nUses: Olric'));
  assert.deepEqual(runs.map(run => ({ ...run })), [
    { line: 2, line_text: 'Liked by: Balor', prefix: 'Liked by: ', text: 'Balor' },
    { line: 3, line_text: 'Loved by: March, Olric', prefix: 'Loved by: March, ', text: 'Olric' },
  ]);
  assert.equal(h.runs('Olric is mentioned without the gift lists.').length, 0);
  assert.equal(h.runs('Loved by: Olric').length, 0, 'do not decorate unrelated or stale text');
  assert.equal(h.runs(h.describe() + '\nAnother mod replaced the suffix.').length, 0);
});

test('highlight ranges survive wrapping inside labels and localized multiword names', () => {
  const h = giftTooltipHarness();
  h.npcs[0].prototype.name = 'Céline';
  h.npcs[2].prototype.name = '名 前';
  h.npcs[0].gifts_given.add(0);
  h.npcs[2].gifts_given.add(0);
  const original = h.describe();
  for (let width = 1; width <= 80; width++) {
    const wrapped = original.split('\n').map(line =>
      Array.from(line).reduce((text, char, index) =>
        text + (index > 0 && index % width === 0 ? '\n' : '') + char, '')).join('\n');
    const runs = h.runs(wrapped);
    assert.equal(runs.map(run => run.text).join('').replace(/\s/g, ''), 'Céline名前', `width ${width}`);
    for (const run of runs) {
      assert.equal(wrapped.split('\n')[run.line], run.line_text);
      assert.ok(run.line_text.startsWith(run.prefix + run.text));
    }
  }
});

test('the chest picker still requires a met, unlocked NPC with a daily gift available', () => {
  const h = giftTooltipHarness();
  const needsGift = h.context.__MistriaCompanion_npc_needs_gift;
  assert.equal(needsGift(0), true);
  h.npcs[0].gift_flag = false;
  assert.equal(needsGift(0), false);
  assert.equal(needsGift(3), false);
  assert.equal(needsGift(4), false);
  assert.equal(needsGift(999), false);
});

test('chest recipients follow live daily availability, not whether an NPC instance is in the current room', () => {
  const h = giftTooltipHarness();
  const needsGift = h.context.__MistriaCompanion_npc_needs_gift;
  for (const name of ['Stillwell', 'Darcy', 'Zorel']) {
    h.npcs[0].prototype.name = name;
    h.npcs[0].location_position.location_id = h.context.LocationId.Aldaria;
    assert.equal(needsGift(0), false, `${name} is in the off-world holding area on non-market days`);
    h.npcs[0].location_position.location_id = 1;
    assert.equal(needsGift(0), true, `${name}'s Saturday schedule places them in Town`);
    h.npcs[0].location_position.location_id = h.context.LocationId.Aldaria;
    assert.equal(needsGift(0), false, 'unavailable market schedules remain excluded even on a Saturday');
  }
  h.npcs[0].location_position.location_id = 2;
  h.context.CURRENT_LOCATION_ID = 1;
  h.context.instance_exists = () => false;
  assert.equal(needsGift(0), true, 'regular villagers in another region do not need a loaded actor');
});

test('chest recipients exclude max hearts, preserve birthday order, and keep completion tooltips unchanged', () => {
  const h = giftTooltipHarness();
  const needsGift = h.context.__MistriaCompanion_npc_needs_gift;
  for (const hearts of [0, 1, 9]) {
    h.npcs[0].hearts = hearts;
    assert.equal(needsGift(0), true);
  }
  for (const hearts of [10, 11]) {
    h.npcs[0].hearts = hearts;
    assert.equal(needsGift(0), false);
  }
  h.npcs[0].birthday = true;
  h.npcs[2].birthday = true;
  assert.deepEqual(Array.from(h.context.__MistriaCompanion_gift_npcs()), [2, 1],
    'max hearts are excluded even on birthdays, while remaining birthday recipients stay first');
  h.npcs[2].location_position.location_id = h.context.LocationId.Aldaria;
  assert.deepEqual(Array.from(h.context.__MistriaCompanion_gift_npcs()), [1]);
  assert.match(h.describe(), /Liked by: Balor/);
  assert.match(h.describe(), /Loved by: March, Olric/,
    'availability and heart caps restrict auto-pickup only, not gift-completion information');
});

test('unready or malformed recipient data is skipped with an explicit diagnostic', () => {
  for (const change of [
    h => { h.npcs[0].location_position = undefined; },
    h => { h.npcs[0].location_position.location_id = 999; },
    h => { h.npcs[0].location_position.location_id = -1; },
    h => { h.npcs[0].location_position.location_id = 1.5; },
    h => { h.npcs[0].heart_level = undefined; },
    h => { h.npcs[0].hearts = -1; },
    h => { h.npcs[0].hearts = '10'; },
  ]) {
    const h = giftTooltipHarness();
    change(h);
    assert.equal(h.context.__MistriaCompanion_npc_needs_gift(0), false);
    assert.equal(h.warnings.length, 1);
  }
});

test('chest transfers recheck recipient availability and hearts before removing any items', () => {
  const h = giftTooltipHarness();
  h.npcs[1].hearts = 10;
  h.npcs[2].location_position.location_id = h.context.LocationId.Aldaria;
  let moved = 0;
  const messages = [];
  const item = { partial_eq: other => other === item, clone: () => item };
  const slot = { count: 3, item, remove: count => { slot.count -= count; } };
  const menu = {
    left: { slot: () => slot },
    left_menu: { hand: { size: () => 1, slot: () => ({}) }, refresh() {} },
    right_menu: { refresh() {} },
  };
  const context = load([publicName('collect_loved_gifts')], {
    Menu: { Storage: 'storage' },
    ARI: { inventory: { can_add: () => true, add: () => { moved++; return 0; } } },
    __MistriaCompanion_menu: () => menu,
    __MistriaCompanion_npc_needs_gift: h.context.__MistriaCompanion_npc_needs_gift,
    __MistriaCompanion_gift_plan: () => ({
      eligible_count: 3, matched_count: 3, search_limited: false,
      entries: [0, 1, 2].map(npc_id => ({ npc_id, slot_index: 0, item })),
    }),
    __MistriaCompanion_notify: text => messages.push(text),
    ANCHOR: { wrap_for_local: text => text }, create_notification: text => messages.push(text),
  });
  context.MistriaCompanion_collect_loved_gifts(menu);
  assert.equal(moved, 1);
  assert.equal(slot.count, 2);
  assert.match(messages.at(-1), /^Grabbed 1 loved gift/);
  assert.match(messages.at(-1), /no longer needed/);
  context.__MistriaCompanion_gift_plan = () => ({ eligible_count: 0 });
  context.MistriaCompanion_collect_loved_gifts(menu);
  assert.match(messages.at(-1), /unavailable, at max hearts, or already gifted/);
  assert.doesNotMatch(messages.at(-1), /Every met villager has already received/);
  assert.equal(moved, 1);
});

test('clock release preserves the incoming engine/filter result and save reset clears ownership', () => {
  const runtime = { clock_paused: true, bindings: { wiki: 'F7' }, all_bug_markers_enabled: true };
  const context = load([publicName('clock_advance'), publicName('reset_save')], {
    __MistriaCompanion_runtime: () => runtime,
  });
  assert.equal(context.MistriaCompanion_clock_advance(12, {}), 0);
  assert.equal(context.MistriaCompanion_clock_advance(undefined, {}), undefined);
  context.MistriaCompanion_reset_save({});
  assert.equal(runtime.clock_paused, false);
  assert.equal(context.MistriaCompanion_clock_advance(0, {}), undefined);
  assert.equal(context.MistriaCompanion_clock_advance(12, {}), undefined);
  assert.equal(runtime.bindings.wiki, 'F7');
  assert.equal(runtime.all_bug_markers_enabled, true);
  assert.equal(runtime.dig_spots.length, 0);
  assert.equal(runtime.legendary_sightings.length, 0);
});

function farmStatusHarness() {
  const warnings = [];
  const cropChecks = [];
  const Category = { Crop: 1, Tree: 2, Building: 3, Other: 4 };
  function grid(width = 8, height = 6) {
    return {
      dims: { x: width, y: height }, node_len: width * height, is_setup: false,
      node_parent: Array(width * height).fill(undefined),
      node_object_id: Array(width * height).fill(undefined),
      node_terrain_ground_kind: Array(width * height).fill(0),
      node_terrain_is_watered: Array(width * height).fill(false),
      node_index_for_cell(x, y) {
        assert.ok(x >= 0 && x < width && y >= 0 && y < height);
        return y * width + x;
      },
    };
  }
  function soil(g, x, y, watered = false) {
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
      const i = g.node_index_for_cell(x + dx, y + dy);
      g.node_terrain_ground_kind[i] = 1;
      g.node_terrain_is_watered[i] = watered;
    }
  }
  function object(g, x, y, category = Category.Crop, extra = {}, width = 2, height = 2) {
    const node = {
      top_left_x: x, top_left_y: y,
      prototype: { category_id: category, count: 99 }, stage: 1, matureStage: 2, ...extra,
    };
    for (let dy = 0; dy < height; dy++) for (let dx = 0; dx < width; dx++) {
      const i = g.node_index_for_cell(x + dx, y + dy);
      g.node_parent[i] = node;
      g.node_object_id[i] = category;
    }
    return node;
  }
  const farm = grid();
  const dynamic = [];
  const context = load([
    'farm_status_unavailable', 'farm_status_counts', 'scan_farm_grid',
    'farm_status_add', 'farm_status_snapshot',
  ].map(privateName), {
    GRIDS: [farm], LocationId: { Farm: 0 }, GroundKind: { Soil: 1 },
    ObjectCategory: Category, PlayerBuildingKind: { Greenhouse: 7 },
    DYNAMIC_GRIDS: { count: () => dynamic.length, get: i => dynamic[i] },
    can_interact: node => {
      cropChecks.push(node);
      if (node.no_harvest || (node.managed && node.managed_timer !== undefined)) return false;
      return node.stage === (node.regrow_cycle ? node.regrowStage : node.matureStage);
    },
    mmapi_warn_rate_limited: (...args) => warnings.push(args),
  });
  function greenhouse(x, y, index) {
    return object(farm, x, y, Category.Building, {
      prototype: { category_id: Category.Building, player_building_kind: 7 }, dyn_index: index,
    });
  }
  return {
    context, farm, dynamic, grid, soil, object, greenhouse, Category, warnings, cropChecks,
    snapshot: context.__MistriaCompanion_farm_status_snapshot,
  };
}

test('farm status counts crop plots and unwatered plants across Farm and an unvisited greenhouse', () => {
  const h = farmStatusHarness();
  const f = h.farm;
  h.soil(f, 0, 0);
  h.soil(f, 2, 0, true);
  h.object(f, 2, 0, h.Category.Crop, { stage: 2 });
  h.soil(f, 4, 0);
  h.object(f, 4, 0);
  h.soil(f, 6, 0);
  h.object(f, 6, 0, h.Category.Other); // Wilted plant or another obstruction.
  h.soil(f, 0, 2);
  h.object(f, 0, 2, h.Category.Tree);
  h.object(f, 2, 2); // Wild forage on untilled ground is not a planted plot.
  h.soil(f, 4, 2);
  f.node_terrain_ground_kind[f.node_index_for_cell(6, 2)] = 1;
  h.greenhouse(0, 4, 0);
  const g = h.grid(4, 4);
  h.dynamic.push(g);
  h.soil(g, 0, 0);
  h.object(g, 0, 0, h.Category.Crop, { stage: 2 });
  h.soil(g, 2, 0, true);
  h.object(g, 2, 0, h.Category.Crop, { regrow_cycle: true, stage: 2, regrowStage: 3 });
  h.soil(g, 0, 2);
  h.soil(g, 2, 2);
  h.object(g, 2, 2, h.Category.Crop, { no_harvest: true, stage: 2 });
  h.context.GRID = h.grid(); // The player is somewhere else entirely.
  const before = JSON.stringify([f, g]);
  const report = h.snapshot();
  assert.deepEqual({ ...report.farm }, { empty: 2, ready: 1, growing: 1, unwatered: 1 });
  assert.deepEqual({ ...report.greenhouse }, { empty: 1, ready: 1, growing: 2, unwatered: 2 });
  assert.deepEqual({ ...report.total }, { empty: 3, ready: 2, growing: 3, unwatered: 3 });
  assert.equal(report.greenhouse_count, 1);
  assert.equal(h.cropChecks.length, 5, 'count parents once, not their four occupied cells or item yield');
  assert.equal(JSON.stringify([f, g]), before, 'scanning must not alter stages, flags, watering, or grid data');
  assert.equal(h.warnings.length, 0);
});

test('farm status follows only greenhouse buildings and deduplicates interior references', () => {
  const h = farmStatusHarness();
  h.greenhouse(0, 0, 0);
  h.greenhouse(2, 0, 0);
  h.greenhouse(4, 0, 1);
  for (let i = 0; i < 3; i++) {
    const g = h.grid(2, 2);
    h.soil(g, 0, 0);
    h.object(g, 0, 0, h.Category.Crop, { stage: 2 });
    h.dynamic.push(g);
  }
  h.context.GRIDS.push(h.dynamic[2]); // An unrelated map also has crops.
  const report = h.snapshot();
  assert.equal(report.greenhouse_count, 2);
  assert.equal(report.greenhouse.ready, 2, 'unlinked dynamic interiors and other regions are excluded');
  assert.equal(h.cropChecks.length, 2);
});

test('native regrowth and managed-crop readiness are respected without counting multicell crops twice', () => {
  const h = farmStatusHarness();
  h.soil(h.farm, 0, 0);
  h.soil(h.farm, 2, 0);
  const crop = h.object(h.farm, 0, 0, h.Category.Crop,
    { regrow_cycle: true, regrowStage: 1, stage: 1 }, 4, 2);
  assert.equal(h.snapshot().farm.ready, 1);
  crop.managed = true;
  crop.managed_timer = 0;
  const report = h.snapshot();
  assert.equal(report.farm.ready, 0);
  assert.equal(report.farm.growing, 1);
  assert.equal(report.farm.empty, 0);
  assert.equal(report.farm.unwatered, 1);
});

test('an unbuilt greenhouse has honest zero counts, while missing built interiors fail visibly', () => {
  const h = farmStatusHarness();
  h.context.DYNAMIC_GRIDS = undefined;
  const empty = h.snapshot();
  assert.equal(empty.greenhouse_count, 0);
  assert.deepEqual({ ...empty.greenhouse }, { empty: 0, ready: 0, growing: 0, unwatered: 0 });
  h.greenhouse(0, 0, 0);
  assert.equal(h.snapshot(), undefined);
  assert.equal(h.warnings.length, 1);
});

test('farm status rejects incomplete grid data rather than inventing all-zero totals', () => {
  for (const change of [
    h => { h.context.GRIDS = undefined; },
    h => { h.context.GRIDS[0] = undefined; },
    h => { h.farm.node_parent.length = 1; },
    h => { h.farm.node_object_id[0] = 1; },
    h => { h.object(h.farm, 0, 0).top_left_x = -1; },
    h => { h.greenhouse(0, 0, undefined); },
    h => { h.greenhouse(0, 0, 0); h.dynamic.push(undefined); },
    h => { h.greenhouse(0, 0, 0); h.context.DYNAMIC_GRIDS = {}; },
    h => { h.soil(h.farm, 0, 0); h.object(h.farm, 0, 0); h.farm.node_terrain_is_watered[0] = undefined; },
  ]) {
    const h = farmStatusHarness();
    change(h);
    assert.equal(h.snapshot(), undefined);
    assert.ok(h.warnings.length > 0);
  }
});

test('F4 opens one native farm-status menu with only per-area counts, independent of alerts', () => {
  const runtime = { notifications_enabled: false };
  const menus = [];
  const notices = [];
  let reads = 0;
  let ready = true;
  let paused = false;
  let data = {
    total: { empty: 5, ready: 4, growing: 8, unwatered: 3 },
    farm: { empty: 1, ready: 2, growing: 5, unwatered: 2 },
    greenhouse: { empty: 4, ready: 2, growing: 3, unwatered: 1 },
    greenhouse_count: 1,
  };
  const context = load([privateName('farm_status_section'), publicName('show_farm_status')], {
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_ready: () => ready,
    game_paused: () => paused,
    __MistriaCompanion_dig_notice_blocked: () => false,
    __MistriaCompanion_sightings_transition_active: () => false,
    __MistriaCompanion_farm_status_snapshot: () => { reads++; return data; },
    __MistriaCompanion_notify: text => notices.push(text),
    __MistriaCompanion_text_popup: (title, text) => {
      const popup = { title, text, spawn() { this.spawned = true; } };
      menus.push(popup);
      return popup;
    },
  });
  const show = context.MistriaCompanion_show_farm_status;
  show();
  assert.equal(menus.length, 1);
  assert.equal(menus[0].title, 'Farm status');
  assert.equal(menus[0].spawned, true);
  assert.equal(menus[0].text,
    'Farm\nEmpty tilled spots: 1\nReady to harvest: 2\nPlanted, not ready: 5\nUnwatered crops: 2'
    + '\n\nGreenhouse\nEmpty tilled spots: 4\nReady to harvest: 2\nPlanted, not ready: 3\nUnwatered crops: 1');
  assert.doesNotMatch(menus[0].text, /Hay|Forage|Machines|Cave/);
  paused = true;
  show();
  assert.equal(reads, 1, 'repeated hotkeys do not duplicate an open menu');
  menus[0].close_requested = true;
  show();
  assert.equal(menus.length, 1);
  assert.match(notices.at(-1), /Close menus/);
  paused = false;
  data = undefined;
  show();
  assert.match(notices.at(-1), /not ready/);
  assert.equal(menus.length, 1, 'missing data must not open a success-shaped all-zero report');
  ready = false;
  show();
  assert.match(notices.at(-1), /during gameplay/);
});

test('the farm-status binding preserves old remaps and supports a configurable alternate', () => {
  const h = mountedConfigHarness({ clock: 'F4', farm_status: 'F3', farm_status_alternate: 'SHIFT+F3' });
  h.register();
  assert.equal(h.runtime.bindings.clock, 'F4');
  assert.equal(h.runtime.bindings.farm_status, 'F3');
  assert.deepEqual(h.registrations.filter(row => row.callback === h.context.MistriaCompanion_show_farm_status)
    .map(row => row.binding.name), ['F3', 'SHIFT+F3']);
  const collision = mountedConfigHarness({ clock: 'F4' });
  collision.register();
  assert.equal(collision.runtime.bindings.clock, 'F4', 'a new default must not steal an existing remap');
  assert.equal(collision.runtime.bindings.farm_status, undefined);
  assert.ok(collision.warnings.some(([, message]) => message.includes('Duplicate binding F4')));
});

const hotkeyCallbacks = [
  'toggle_clock', 'show_local_sightings', 'open_wiki',
  'toggle_wiki_hints', 'toggle_all_bug_markers', 'toggle_notifications', 'show_farm_status',
];

function mountedConfigHarness(config) {
  const reads = [];
  const writes = [];
  const registrations = [];
  const warnings = [];
  const context = load([
    ...alertPreferenceFunctions,
    privateName('runtime'), privateName('preference'), privateName('mounted_setting'),
    privateName('save_preferences'),
    privateName('hotkey_actions'), privateName('register_hotkeys'), publicName('reset_save'),
    publicName('toggle_wiki_hints'), publicName('toggle_all_bug_markers'), publicName('toggle_notifications'),
    publicName('toggle_configuration'),
  ], {
    global: {},
    ...Object.fromEntries(hotkeyCallbacks.map(name => [publicName(name), () => name])),
    mmapi_config_read_valid: (...args) => { reads.push(args); return config; },
    mmapi_config_write: (...args) => writes.push(args),
    mmapi_log_warn: (...args) => warnings.push(args),
    __MistriaCompanion_notify: () => {},
    mmapi_hotkey_binding_from_name: name => name === '' ? undefined : { name },
    mmapi_hotkey_register_binding: (binding, callback) => registrations.push({ binding, callback }),
  });
  return {
    context, reads, writes, registrations, warnings,
    runtime: context.__MistriaCompanion_runtime(),
    register: context.__MistriaCompanion_register_hotkeys,
  };
}

test('mounted config defaults enabled and persists explicit boolean values without repeated registration', () => {
  for (const config of [undefined, {}, { mounted_interactions_enabled: true }, { mounted_interactions_enabled: false }]) {
    const { context, runtime, register, reads, writes, registrations, warnings } = mountedConfigHarness(config);
    assert.equal(runtime.mounted_interactions_enabled, true, 'runtime defaults on before config is read');
    register();
    const expected = config?.mounted_interactions_enabled ?? true;
    assert.equal(runtime.mounted_interactions_enabled, expected);
    assert.equal(writes[0][2].mounted_interactions_enabled, expected);
    assert.deepEqual(reads, [['mistria_item_details', 1]]);
    assert.deepEqual(writes[0].slice(0, 2), ['mistria_item_details', 1]);
    assert.deepEqual(registrations.map(row => row.binding.name), ['F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F4']);
    assert.equal(warnings.length, 0);
    context.MistriaCompanion_reset_save({});
    register();
    assert.equal(runtime.mounted_interactions_enabled, expected, 'save reset preserves the configured preference');
    assert.equal(reads.length, 1);
    assert.equal(writes.length, 1);
    assert.equal(registrations.length, 7);
  }
});

test('mounted config rejects string and numeric values with a warning and saves the enabled default', () => {
  for (const value of ['false', 'true', '', 0, 1, -1, 2, [], {}]) {
    const { runtime, register, writes, warnings } = mountedConfigHarness({ mounted_interactions_enabled: value });
    register();
    register();
    assert.equal(runtime.mounted_interactions_enabled, true, `Invalid value: ${JSON.stringify(value)}`);
    assert.equal(writes[0][2].mounted_interactions_enabled, true);
    assert.equal(writes.length, 1);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0][0], 'mistria_item_details');
    assert.match(warnings[0][1], /mounted_interactions_enabled.*true/);
  }
});

test('mounted config treats null or undefined members as missing and saves the enabled default', () => {
  // Check the missing-value policy, not the engine's JSON-null representation.
  for (const value of [null, undefined]) {
    const { runtime, register, writes, warnings } = mountedConfigHarness({ mounted_interactions_enabled: value });
    register();
    register();
    assert.equal(runtime.mounted_interactions_enabled, true);
    assert.equal(writes[0][2].mounted_interactions_enabled, true);
    assert.equal(writes.length, 1);
    assert.equal(warnings.length, 0);
  }
});

test('mounted config preserves custom primary and alternate keybindings while writing the setting once', () => {
  const config = {
    mounted_interactions_enabled: false,
    clock: 'HOME', clock_alternate: 'SHIFT+HOME',
    sightings: 'END', sightings_alternate: '',
    wiki: 'F11', wiki_alternate: 'SHIFT+F11',
    wiki_hints: 'F12', wiki_hints_alternate: '',
    bugs: 'INSERT', bugs_alternate: 'SHIFT+INSERT',
    notifications: 'DELETE', notifications_alternate: '',
    farm_status: 'F3', farm_status_alternate: 'SHIFT+F3',
  };
  const before = { ...config };
  const { context, runtime, register, reads, writes, registrations, warnings } = mountedConfigHarness(config);
  register();
  register();
  assert.deepEqual(config, before, 'registration does not mutate the loaded config');
  assert.deepEqual({ ...writes[0][2] }, {
    ...before, ...configurationDefaults,
    notifications_enabled: false, all_bug_markers_enabled: true, wiki_hints_enabled: true,
  });
  assert.equal(reads.length, 1);
  assert.equal(writes.length, 1);
  assert.equal(warnings.length, 0);
  const actions = context.__MistriaCompanion_hotkey_actions();
  const expected = Array.from(actions).flatMap(action =>
    [config[action.key], config[`${action.key}_alternate`]]
      .filter(Boolean).map(name => ({ name, callback: action.callback })));
  assert.deepEqual(registrations.map(({ binding, callback }) => ({ name: binding.name, callback })), expected);
  for (const [index, action] of Array.from(actions).entries()) {
    assert.equal(runtime.bindings[action.key], config[action.key]);
    assert.equal(runtime.keybind_rows[index].title, action.title);
    assert.deepEqual(Array.from(runtime.keybind_rows[index].bindings),
      [config[action.key], config[`${action.key}_alternate`]].filter(Boolean));
  }
});

function preferenceSessionHarness(store) {
  const h = mountedConfigHarness({});
  const feedback = [];
  h.context.mmapi_config_read_valid = (...args) => {
    h.reads.push(args);
    return store.value?.__config_version === args[1] ? structuredClone(store.value) : {};
  };
  h.context.mmapi_config_write = (mod, version, config) => {
    const serialized = JSON.parse(JSON.stringify({ ...config, __config_version: version }));
    h.writes.push([mod, version, serialized]);
    if (!store.failWrites) store.value = serialized;
  };
  h.context.__MistriaCompanion_notify = text => { feedback.push(text); return true; };
  h.register();
  return { ...h, feedback };
}

test('fresh and legacy configs default automatic alerts off, all bugs on, and wiki hints on', () => {
  for (const value of [undefined, { __config_version: 1, mounted_interactions_enabled: false, wiki: 'F11' }]) {
    const store = { value };
    const h = preferenceSessionHarness(store);
    assert.equal(h.runtime.notifications_enabled, false);
    assert.equal(h.runtime.all_bug_markers_enabled, true);
    assert.equal(h.runtime.wiki_hints_enabled, true);
    assert.equal(store.value.notifications_enabled, false);
    assert.equal(store.value.all_bug_markers_enabled, true);
    assert.equal(store.value.wiki_hints_enabled, true);
    assert.equal(h.feedback.length, 0, 'startup must not announce default settings');
    assert.equal(h.runtime.bindings.notifications, 'F10');
    assert.equal(h.runtime.keybind_rows[5].title, 'Toggle automatic alerts');
    assert.equal(h.runtime.keybind_rows.at(-1).title, 'Farm status');
    if (value) {
      assert.equal(h.runtime.mounted_interactions_enabled, false);
      assert.equal(store.value.wiki, 'F11');
    }
  }
});

test('F8, F9, and F10 choices persist as booleans across fresh sessions and save resets', () => {
  const store = {};
  const first = preferenceSessionHarness(store);
  first.context.MistriaCompanion_toggle_notifications();
  first.context.MistriaCompanion_toggle_all_bug_markers();
  first.context.MistriaCompanion_toggle_wiki_hints();
  assert.deepEqual(first.feedback, [
    'Automatic alerts enabled.', 'Ordinary bug map markers disabled.', 'Wiki hints disabled.',
  ]);
  assert.equal(store.value.notifications_enabled, true);
  assert.equal(store.value.all_bug_markers_enabled, false);
  assert.equal(store.value.wiki_hints_enabled, false);
  for (const key of ['notifications_enabled', 'all_bug_markers_enabled', 'wiki_hints_enabled']) {
    assert.equal(typeof store.value[key], 'boolean');
  }
  const second = preferenceSessionHarness(store);
  assert.equal(second.runtime.notifications_enabled, true);
  assert.equal(second.runtime.all_bug_markers_enabled, false);
  assert.equal(second.runtime.wiki_hints_enabled, false);
  second.runtime.clock_paused = true;
  second.context.MistriaCompanion_reset_save({});
  assert.equal(second.runtime.notifications_enabled, true);
  assert.equal(second.runtime.all_bug_markers_enabled, false);
  assert.equal(second.runtime.wiki_hints_enabled, false);
  assert.equal(second.runtime.clock_paused, false, 'clock pause remains gameplay state, not a saved preference');
  second.runtime.dig_spot_notice = { grid: 'old-scene' };
  second.context.MistriaCompanion_toggle_notifications();
  assert.equal(second.runtime.dig_spot_notice, undefined);
  assert.equal(store.value.notifications_enabled, false);
  assert.equal(preferenceSessionHarness(store).runtime.notifications_enabled, false);
});

test('saved display preferences reject non-booleans with warnings and preserve explicit false', () => {
  const defaults = { notifications_enabled: false, all_bug_markers_enabled: true, wiki_hints_enabled: true };
  for (const [key, fallback] of Object.entries(defaults)) {
    for (const invalid of ['true', 'false', 0, 1, [], {}]) {
      const store = { value: { __config_version: 1, [key]: invalid } };
      const h = preferenceSessionHarness(store);
      assert.equal(h.runtime[key], fallback);
      assert.equal(store.value[key], fallback);
      assert.ok(h.warnings.some(([, message]) => message.includes(`Invalid ${key}`)));
    }
    for (const value of [true, false]) {
      const h = preferenceSessionHarness({ value: { __config_version: 1, [key]: value } });
      assert.equal(h.runtime[key], value);
      assert.equal(h.warnings.length, 0);
    }
  }
});

test('F10 migrates old dig-notification bindings without overriding explicit new bindings', () => {
  const store = { value: { __config_version: 1,
    dig_notifications: 'DELETE', dig_notifications_alternate: 'SHIFT+DELETE',
  } };
  const h = preferenceSessionHarness(store);
  assert.equal(h.runtime.bindings.notifications, 'DELETE');
  assert.deepEqual(Array.from(h.runtime.keybind_rows[5].bindings), ['DELETE', 'SHIFT+DELETE']);
  assert.equal(store.value.notifications, 'DELETE');
  assert.equal(store.value.notifications_alternate, 'SHIFT+DELETE');
  assert.equal(store.value.dig_notifications, undefined);
  assert.equal(h.registrations.find(row => row.binding.name === 'SHIFT+DELETE').callback,
    h.context.MistriaCompanion_toggle_notifications);
  const explicit = preferenceSessionHarness({ value: { __config_version: 1,
    notifications: 'HOME', notifications_alternate: '',
    dig_notifications: 'DELETE', dig_notifications_alternate: 'SHIFT+DELETE',
  } });
  assert.equal(explicit.runtime.bindings.notifications, 'HOME');
  assert.deepEqual(Array.from(explicit.runtime.keybind_rows[5].bindings), ['HOME']);
});

test('saving preferences preserves current bindings and mounted configuration and reports failed writes', () => {
  const store = {};
  const h = preferenceSessionHarness(store);
  store.value.wiki = 'SHIFT+F7';
  store.value.mounted_interactions_enabled = false;
  store.value.future_setting = { enabled: true };
  h.context.MistriaCompanion_toggle_notifications();
  assert.equal(store.value.wiki, 'SHIFT+F7');
  assert.equal(store.value.mounted_interactions_enabled, false);
  assert.deepEqual(store.value.future_setting, { enabled: true });
  store.failWrites = true;
  h.context.MistriaCompanion_toggle_all_bug_markers();
  assert.equal(h.runtime.all_bug_markers_enabled, false, 'the current session still applies the requested change');
  assert.equal(store.value.all_bug_markers_enabled, true, 'a failed write does not pretend to persist');
  assert.match(h.feedback.at(-1), /Preference not saved/);
  assert.ok(h.warnings.some(([, message]) => message.includes('could not be saved')));
  store.failWrites = false;
  assert.equal(preferenceSessionHarness(store).runtime.all_bug_markers_enabled, true);
});

function configurationPopupStub() {
  return {
    hide_requests: 0,
    mistria_configuration_status: { set_text(text) { this.text = text; return this; } },
  };
}

test('v51 exposes the requested independent switches plus legendary fish alerts', () => {
  const h = preferenceSessionHarness({});
  const options = Array.from(h.context.__MistriaCompanion_configuration_options());
  assert.deepEqual(options.map(option => option.key), Object.keys(configurationDefaults));
  assert.deepEqual(options.map(option => option.title), [
    'Show bug alerts', 'Show bugs on the map', 'Show dive spot alerts',
    'Show mist spots on the map', 'Show dig spot alerts', 'Show dig spots on the map',
    'Show legendary fish alerts',
  ]);
  assert.equal(options.filter(option => option.alert).length, 4);
});

test('v51 migrates legacy alerts without overwriting explicit category choices or existing key remaps', () => {
  for (const enabled of [true, false]) {
    const store = { value: {
      __config_version: 1, notifications_enabled: enabled,
      bug_alerts_enabled: !enabled, bug_markers_enabled: false,
      all_bug_markers_enabled: false, wiki_hints_enabled: false,
      wiki: 'F11', notifications: 'HOME', notifications_alternate: 'SHIFT+HOME',
    } };
    const h = preferenceSessionHarness(store);
    assert.equal(h.runtime.bug_alerts_enabled, !enabled, 'an explicit v51 value takes priority');
    for (const key of ['legendary_fish_alerts_enabled', 'diving_spot_alerts_enabled', 'dig_spot_alerts_enabled']) {
      assert.equal(h.runtime[key], enabled, `${key} inherits the legacy F10 choice`);
      assert.equal(store.value[key], enabled);
    }
    assert.equal(h.runtime.bug_markers_enabled, false);
    assert.equal(h.runtime.dig_spot_markers_enabled, true);
    assert.equal(h.runtime.mist_spot_markers_enabled, true);
    assert.equal(h.runtime.all_bug_markers_enabled, false);
    assert.equal(h.runtime.wiki_hints_enabled, false);
    assert.equal(store.value.wiki, 'F11');
    assert.equal(store.value.notifications, 'HOME');
    assert.equal(store.value.notifications_alternate, 'SHIFT+HOME');
    const reloaded = preferenceSessionHarness(store);
    for (const key of Object.keys(configurationDefaults)) assert.equal(reloaded.runtime[key], h.runtime[key]);
  }
});

test('all v51 switches validate boolean input and immediately persist independently across saves and sessions', () => {
  for (const [key, defaultValue] of Object.entries(configurationDefaults)) {
    for (const invalid of ['true', 'false', 0, 1, {}, []]) {
      const h = preferenceSessionHarness({ value: { __config_version: 1, [key]: invalid } });
      assert.equal(h.runtime[key], defaultValue);
      assert.ok(h.warnings.some(([, message]) => message.includes(`Invalid ${key}`)));
    }
    const store = {};
    const h = preferenceSessionHarness(store);
    const popup = configurationPopupStub();
    const before = structuredClone(store.value);
    h.context.MistriaCompanion_toggle_configuration(popup, key);
    for (const other of Object.keys(configurationDefaults)) {
      assert.equal(h.runtime[other], other === key ? !defaultValue : configurationDefaults[other]);
      assert.equal(store.value[other], h.runtime[other]);
      assert.equal(typeof store.value[other], 'boolean');
    }
    assert.equal(store.value.wiki, before.wiki);
    assert.equal(store.value.all_bug_markers_enabled, before.all_bug_markers_enabled);
    assert.equal(store.value.mounted_interactions_enabled, before.mounted_interactions_enabled);
    assert.equal(popup.mistria_configuration_status.text, 'Changes saved automatically.');
    h.context.MistriaCompanion_reset_save({});
    assert.equal(h.runtime[key], !defaultValue);
    const reloaded = preferenceSessionHarness(store);
    assert.equal(reloaded.runtime[key], !defaultValue);
    reloaded.context.MistriaCompanion_toggle_configuration(configurationPopupStub(), key);
    assert.equal(store.value[key], defaultValue);
  }
});

test('F10 toggles all alert categories together for every combination without changing any map preferences', () => {
  const keys = ['bug_alerts_enabled', 'legendary_fish_alerts_enabled',
    'diving_spot_alerts_enabled', 'dig_spot_alerts_enabled'];
  for (let mask = 0; mask < 16; mask++) {
    const store = { value: { __config_version: 1, ...configurationDefaults,
      bug_markers_enabled: false, dig_spot_markers_enabled: false, all_bug_markers_enabled: false,
      ...Object.fromEntries(keys.map((key, index) => [key, !!(mask & (1 << index))])),
    } };
    const h = preferenceSessionHarness(store);
    h.context.MistriaCompanion_toggle_notifications();
    for (const key of keys) assert.equal(store.value[key], mask === 0);
    assert.equal(store.value.notifications_enabled, mask === 0);
    assert.equal(store.value.bug_markers_enabled, false);
    assert.equal(store.value.dig_spot_markers_enabled, false);
    assert.equal(store.value.mist_spot_markers_enabled, true);
    assert.equal(store.value.all_bug_markers_enabled, false);
    h.context.MistriaCompanion_toggle_notifications();
    for (const key of keys) assert.equal(store.value[key], mask !== 0);
  }
});

test('F9 keeps its ordinary-species filter without overriding the all-bugs visibility switch', () => {
  const store = { value: { __config_version: 1, bug_markers_enabled: false, all_bug_markers_enabled: false } };
  const h = preferenceSessionHarness(store);
  h.context.MistriaCompanion_toggle_all_bug_markers();
  assert.equal(h.runtime.all_bug_markers_enabled, true);
  assert.equal(h.runtime.bug_markers_enabled, false);
  assert.equal(store.value.bug_markers_enabled, false);
  assert.match(h.feedback.at(-1), /bug map display is off/);
});

test('configuration reports save failures and rejects unknown or inactive-menu toggles without changing other values', () => {
  const store = {};
  const h = preferenceSessionHarness(store);
  const popup = configurationPopupStub();
  store.failWrites = true;
  h.context.MistriaCompanion_toggle_configuration(popup, 'bug_markers_enabled');
  assert.equal(h.runtime.bug_markers_enabled, false);
  assert.equal(store.value.bug_markers_enabled, true);
  assert.match(popup.mistria_configuration_status.text, /Not saved.*only this session/);
  assert.ok(h.warnings.some(([, message]) => /could not be saved/.test(message)));
  const writes = h.writes.length;
  h.context.MistriaCompanion_toggle_configuration(popup, 'not_a_setting');
  assert.ok(h.warnings.some(([, message]) => /Unknown configuration option/.test(message)));
  for (const inactive of ['close_requested', 'free_requested', 'hide_requests']) {
    popup[inactive] = 1;
    h.context.MistriaCompanion_toggle_configuration(popup, 'bug_markers_enabled');
    popup[inactive] = 0;
  }
  assert.equal(h.writes.length, writes);
  assert.equal(h.runtime.bug_markers_enabled, false);
});

test('legendary fish tracking returns new observations without emitting separate notices', () => {
  const runtime = { notifications_enabled: false, legendary_day: '1', legendary_sightings: [],
    seen_spawns: {} };
  const messages = [];
  const context = load([
    privateName('has_name'), privateName('track_legendary'),
  ], {
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_legendary_day_key: () => '1',
    __MistriaCompanion_ready: () => true,
    __MistriaCompanion_location_name: () => 'The Narrows',
    __MistriaCompanion_name: item => item.name,
    __MistriaCompanion_notify: text => messages.push(text),
    CURRENT_LOCATION_ID: 1,
    global: { __item_data: [{ name: 'Legendary Fish' }, { name: 'Rare Bug' }] },
  });
  assert.equal(context.__MistriaCompanion_track_legendary('Legendary Fish', 0), true);
  assert.equal(context.__MistriaCompanion_track_legendary('Legendary Fish', 0), false);
  assert.equal(messages.length, 0);
  assert.equal(runtime.legendary_sightings.length, 1);
  runtime.notifications_enabled = true;
  runtime.seen_spawns = {};
  assert.equal(context.__MistriaCompanion_track_legendary('Legendary Fish', 0), false,
    'a repeat visit cannot repeat a fish alert from this location on the same day');
  assert.equal(messages.length, 0, 'the combined sighting renderer owns automatic notifications');
});

function localSightingsHarness(priorCatches = []) {
  const runtime = { ...configurationDefaults, notifications_enabled: false, all_bug_markers_enabled: false, legendary_day: '1',
    legendary_sightings: ['Very Rare Bug: Snowball Beetle - Western Ruins'], seen_spawns: {} };
  const state = { day: 1, room: 'town', ready: true, paused: false, cutscene: false, screenHeight: 270,
    traveling: false };
  const actors = { bug: [], fish: [], school: [] };
  const notices = [];
  const toasts = [];
  const nativeToasts = [];
  const feedback = [];
  const warnings = [];
  const keys = ['butterfly', 'snowball_beetle', 'moth', 'legendary_fish', 'common_fish'];
  const items = ['Butterfly', 'Snowball Beetle', 'Moth', 'Legendary Fish', 'Common Fish'].map(name => ({ name }));
  const bugData = [{ rarity: 'common' }, { rarity: 'very_rare' }, { rarity: 'rare' }];
  function node(parent, isText = false) {
    const board = new Map();
    return {
        parent, freed: false, marked_for_death: false, alpha: 1, enabled: true,
        x: 0, y: 0, width: 0, height: 0, text: '', display_text: '',
        set_xy(x, y) { this.x = x; this.y = y; return this; },
        set_x(x) { this.x = x; return this; },
        set_y(y) { this.y = y; return this; },
        set_width(width) { this.width = width; return this; },
        set_height(height) { this.height = height; return this; },
        set_sprite(sprite) { this.sprite = sprite; return this; },
        set_align() { return this; }, set_max_width() { return this; },
        set_lut() { return this; }, allow_line_breaks() { return this; },
        get_x() { return this.x; }, get_y() { return this.y; },
        get_height() { return this.height; }, get_width() { return this.width; },
        get_alpha() { return this.alpha; }, get_enabled() { return this.enabled; },
        set_alpha(alpha) { this.alpha = alpha; return this; },
        disable() { this.enabled = false; return this; },
        get_font: () => 'standard', get_line_height: () => undefined,
        measure() {
          const lines = this.text.split('\n').flatMap(line => {
            const wrapped = [];
            // Simulate native fixed-width toast wrapping without changing the actual report.
            while (line.length > 33) { wrapped.push(line.slice(0, 33)); line = line.slice(33); }
            wrapped.push(line);
            return wrapped;
          });
          this.display_text = lines.join('\n');
          this.width = 132;
          this.height = lines.length * 13;
          return { x: this.width, y: this.height };
        },
        set_text(value) {
          if (isText && !this.initialized) notices.push({ text: value });
          this.initialized = true;
          this.text = value; this.measure(); return this;
        },
        board_get: key => board.get(key),
        board_set(key, value) { board.set(key, value); return this; },
        set_think_callback(callback, args) { this.think = () => callback(...args); return this; },
    };
  }
  const toastMenu = {
    hide_requests: 0, base_y: 70, canvas: node(),
    toasts: {
      is_empty: () => nativeToasts.length === 0, last: () => nativeToasts.at(-1),
      count: () => nativeToasts.length, get: index => nativeToasts[index],
    },
    create_notification: () => assert.fail('sightings must not enter or change the native FIFO queue'),
  };
  const context = load([
    'has_name', 'track_legendary', 'visit_legendary_fish', 'each_live_bug', 'each_live_legendary_fish',
    'local_visit_key', 'add_local_species', 'update_local_sightings', 'live_sightings',
    'collect_local_bug', 'collect_local_fish', 'local_species_rows', 'local_sightings_report',
    'dig_spot_location_name', 'size_sightings_notice', 'create_sightings_notice',
    'sightings_transition_active', 'retire_sightings_notice',
    'configuration_options', 'sighting_alerts_enabled', 'any_alerts_enabled', 'apply_alert_preferences',
  ].map(privateName).concat([
    'show_local_sightings', 'replay_local_sightings', 'sightings_notice_think',
    'reset_local_sightings', 'floor_built', 'reset_save', 'track_local_spawns', 'toggle_configuration',
  ].map(publicName)), {
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_legendary_day_key: () => String(state.day),
    __MistriaCompanion_ready: () => state.ready,
    __MistriaCompanion_name: item => item.name,
    __MistriaCompanion_location_name: id => ['Town', 'Western Ruins', 'The Mines'][id],
    __MistriaCompanion_notify: text => feedback.push(text),
    __MistriaCompanion_save_preferences: () => true,
    __MistriaCompanion_text_popup: () => assert.fail('F6 must never create a modal popup'),
    popup_creator: () => assert.fail('F6 must never acquire a menu pilot or pause the game'),
    __MistriaCompanion_dig_notice_blocked: () => state.cutscene,
    __MistriaCompanion_menu: () => toastMenu,
    game_paused: () => state.paused,
    Menu: { InfoToasts: 'toasts' },
    ANCHOR: {
      wrap_for_local: value => value, get_true_size: () => ({ x: 480, y: state.screenHeight }),
      nine_slice: parent => { const value = node(parent); toasts.push(value); return value; },
      text: parent => node(parent, true), sprite: parent => node(parent),
      free_node: value => { value.marked_for_death = true; value.freed = true; },
    },
    Align: { LeftIn: 'left', Middle: 'middle' }, COMMON_LUT: 0,
    spr_ui_hud_quest_toast_box: 'toast-box', spr_ui_hud_quest_toast_icon: 'toast-icon',
    sprite_get_width: () => 10,
    string_split: (text, separator) => text.split(separator),
    font_line_height: () => 13,
    global: { __item_data: items },
    GAME_STATS: { bugs_caught: structuredClone(priorCatches) },
    CURRENT_LOCATION_ID: 0, CURRENT_DYN_INDEX: 0,
    GRID: { is_setup: true, node_counter: 100 },
    DUNGEON_RUNNER: undefined,
    TAXI: { is_traveling: () => state.traveling },
    BUGS: { get: id => bugData[id] }, FISH: {},
    obj_bug: 'bug', obj_fishy: 'fish', obj_fish_school: 'school',
    instance_number: kind => actors[kind].length,
    instance_find: (kind, index) => actors[kind][index],
    instance_exists: actor => {
      assert.notEqual(actor, undefined, 'native instance lookup must not receive undefined');
      return actor.alive !== false;
    },
    room: () => state.room,
    struct_get_names: value => Object.keys(value),
    try_string_to_item_id: value => {
      const id = keys.indexOf(value);
      return id < 0 ? undefined : id;
    },
    mmapi_warn_rate_limited: (...args) => warnings.push(args),
  });
  const sync = () => context.__MistriaCompanion_update_local_sightings();
  const report = () => context.__MistriaCompanion_local_sightings_report();
  const show = () => context.MistriaCompanion_show_local_sightings();
  const replay = () => context.MistriaCompanion_replay_local_sightings();
  const track = () => context.MistriaCompanion_track_local_spawns();
  function advance(frames = 13) {
    for (let i = 0; i < frames; i++) {
      track();
      replay();
    }
  }
  function expire() {
    for (const toast of toasts) toast.freed = true;
    toasts.length = 0;
    replay();
  }
  function nativeNotice(height = 40, y = 70) {
    const value = node(toastMenu.canvas).set_xy(0, y).set_width(180).set_height(height);
    nativeToasts.push(value);
    return value;
  }
  function bug(item_id) {
    const actor = { item_id, alive: true };
    actors.bug.push(actor);
    return actor;
  }
  function catchBug(actor) {
    context.GAME_STATS.bugs_caught.push({ bug: keys[actor.item_id], day: state.day });
    actor.alive = false;
  }
  sync();
  return { context, runtime, state, actors, notices, toasts, toastMenu, expire, replay,
    feedback, warnings, keys, items, sync, report, show, bug, catchBug, track, advance, nativeToasts, nativeNotice };
}

function setSightingsAlerts(h, enabled) {
  Object.assign(h.runtime, {
    bug_alerts_enabled: enabled, legendary_fish_alerts_enabled: enabled, notifications_enabled: enabled,
  });
}

test('F6 includes ordinary, rare, and very rare local bugs, even with map markers and alerts off', () => {
  const h = localSightingsHarness();
  h.bug(0);
  h.bug(0);
  h.bug(1);
  h.bug(2);
  h.show();
  assert.equal(h.notices.length, 1);
  assert.equal(h.notices[0].text,
    'Butterfly: 2\nSnowball Beetle: 1\nMoth: 1');
  assert.doesNotMatch(h.notices[0].text, /active|caught/);
  assert.doesNotMatch(h.notices[0].text, /Town|^\n/, 'surface notices have no location heading or blank first line');
  h.show();
  h.replay();
  assert.equal(h.notices.length, 1, 'repeated F6 presses do not pile up notices');
  h.expire();
  assert.equal(h.notices.length, 1, 'no second or third notification after the first one expires');
  assert.doesNotMatch(h.notices.map(entry => entry.text).join('\n'), /Western Ruins/);
  assert.equal(h.runtime.notifications_enabled, false);
  assert.equal(h.runtime.all_bug_markers_enabled, false);
  assert.equal(h.feedback.length, 0);
  assert.equal(h.state.paused, false, 'showing sightings must leave gameplay running');
  h.expire();
  assert.equal(h.runtime.sightings_replay, undefined);
});

test('F6 combines remaining bugs and legendary fish while omitting caught bugs', () => {
  const h = localSightingsHarness();
  h.context.CURRENT_LOCATION_ID = 2;
  h.context.DUNGEON_RUNNER = { current_floor: 95, current_level: () => ({ impl: 'ruins' }) };
  h.sync();
  const first = h.bug(0);
  h.catchBug(first);
  h.bug(1);
  h.actors.fish.push({ alive: true, fish_loot: { prototype: { legendary: true, item: 3 } } });
  h.show();
  assert.equal(h.notices.length, 1);
  assert.equal(h.notices[0].text,
    'The Mines Floor 96\nSnowball Beetle: 1\n'
    + 'Legendary fish - Legendary Fish: 1 active');
  assert.equal(h.toasts.length, 1);
  assert.equal(h.state.paused, false);
  h.expire();
  assert.equal(h.notices.length, 1);
});

test('sighting headings appear only in the mines for bug, fish-only, and empty reports', () => {
  for (const inMines of [false, true]) {
    for (const content of ['bugs', 'fish', 'empty']) {
      const h = localSightingsHarness();
      if (inMines) {
        h.context.CURRENT_LOCATION_ID = 2;
        h.context.DUNGEON_RUNNER = { current_floor: 95, current_level: () => ({ impl: 'ruins' }) };
      } else {
        h.context.CURRENT_LOCATION_ID = 1;
      }
      const heading = inMines ? 'The Mines Floor 96\n' : '';
      let body = 'No bugs here. No legendary fish active here.';
      if (content === 'bugs') {
        h.bug(0);
        body = 'Butterfly: 1';
      } else if (content === 'fish') {
        h.actors.fish.push({ alive: true, fish_loot: { prototype: { legendary: true, item: 3 } } });
        body = 'Legendary fish - Legendary Fish: 1 active';
      }
      h.show();
      assert.equal(h.notices[0].text, heading + body);
      assert.doesNotMatch(h.notices[0].text, /^\n|\n\n|Western Ruins/);
    }
  }
});

test('oversized F6 reports stay in one on-screen toast and automatically cycle all lines', () => {
  const h = localSightingsHarness();
  h.state.screenHeight = 200;
  for (let i = 0; i < 24; i++) {
    const id = h.items.length;
    h.items.push({ name: `Another long named bug species ${i}` });
    h.keys.push(`bug_${i}`);
    h.bug(id);
  }
  h.context.BUGS.get = id => ({ rarity: id === 1 ? 'very_rare' : 'common' });
  h.show();
  assert.equal(h.notices.length, 1);
  const toast = h.toasts[0];
  const pages = toast.board_get('mistria_sightings_pages');
  assert.ok(pages.end < pages.lines.length);
  assert.equal(pages.lines.join('').replace(/\s/g, ''), h.notices[0].text.replace(/\s/g, ''),
    'pagination never truncates a species name or count');
  assert.ok(toast.height + h.toastMenu.base_y <= h.state.screenHeight - 8);
  const displayed = [toast.board_get('text').text];
  let frame = 0;
  let previousStart = pages.start;
  while (!toast.freed) {
    toast.think();
    frame++;
    if (pages.start !== previousStart && pages.end > pages.start) {
      displayed.push(toast.board_get('text').text);
      previousStart = pages.start;
      assert.ok(toast.board_get('timer') >= 239, 'every new page gets its own reading interval');
    }
    assert.ok(frame < 10000);
    h.replay();
  }
  assert.equal(displayed.join('\n'), Array.from(pages.lines).join('\n'));
  assert.equal(h.notices.length, 1, 'paging changes only native text, never spawns another toast');
  assert.equal(h.state.paused, false);
});

test('sighting pages adapt around other notices without losing lines or consuming hidden reading time', () => {
  const h = localSightingsHarness();
  const contents = 'one\n\ntwo\nthree\nfour\nfive\nsix\nseven';
  const toast = h.context.__MistriaCompanion_create_sightings_notice(contents, h.toastMenu);
  toast.set_think_callback(h.context.MistriaCompanion_sightings_notice_think,
    [toast, h.runtime.local_sightings, false]);
  const pages = toast.board_get('mistria_sightings_pages');
  const other = h.nativeNotice(110);
  toast.think();
  assert.equal(toast.y, other.y + other.height + 4);
  assert.ok(toast.y + toast.height <= h.state.screenHeight - 8);
  assert.equal(pages.start, 0);
  const shortened = pages.end;
  assert.ok(shortened < pages.lines.length);
  other.set_height(220);
  const remaining = pages.wait;
  for (let i = 0; i < 100; i++) toast.think();
  assert.equal(toast.alpha, 0);
  assert.equal(pages.wait, remaining, 'no room means no lost reading time');
  other.set_height(40);
  toast.think();
  assert.equal(toast.alpha, 1);
  assert.ok(pages.end > shortened, 'use extra room when it becomes available');
  assert.equal(pages.start, 0, 'resizing never skips a partially read page');
  assert.equal(toast.board_get('text').text, contents);
  assert.equal(h.nativeToasts[0], other);
  assert.equal(other.freed, false);
});

test('local report excludes catches and despawns and never accumulates active counts', () => {
  const h = localSightingsHarness();
  const first = h.bug(0);
  const second = h.bug(0);
  const rare = h.bug(1);
  assert.match(h.report(), /Butterfly: 2/);
  h.catchBug(first);
  rare.alive = false;
  let text = h.report();
  assert.equal(text, 'Butterfly: 1');
  assert.doesNotMatch(text, /Snowball Beetle/);
  assert.equal(h.report(), text, 'reopening the report does not count a catch twice');
  h.catchBug(second);
  text = h.report();
  assert.equal(text, 'No bugs here. No legendary fish active here.');
  assert.equal(h.context.GAME_STATS.bugs_caught.length, 2, 'reporting never modifies the game catch log');
  assert.equal(h.runtime.local_sightings.caught['0'].active, 0);
  h.context.ARI = { inventory: { purchasedBugCount: 999 } };
  assert.equal(h.report(), text, 'inventory contents are not treated as catches');
});

test('F6 uses only active legendary fish, including schools, and omits ordinary or disappeared fish', () => {
  const h = localSightingsHarness();
  const legendary = { prototype: { legendary: true, item: 3 } };
  const normal = { prototype: { legendary: false, item: 4 } };
  const individual = { alive: true, fish_loot: legendary };
  const schoolItems = [legendary, normal, undefined];
  h.actors.fish.push(individual, { alive: true, fish_loot: normal }, undefined, { alive: false });
  h.actors.school.push({
    alive: true, fish_in_school: { count: () => schoolItems.length, get: index => schoolItems[index] },
  });
  assert.match(h.report(), /Legendary Fish: 2 active/);
  assert.doesNotMatch(h.report(), /Common Fish/);
  individual.alive = false;
  schoolItems.shift();
  assert.doesNotMatch(h.report(), /Legendary fish -/);
  assert.doesNotMatch(h.report(), /Legendary Fish:/);
});

test('current visit catch counts reset on area, floor, day, grid, or dynamic-room changes', () => {
  for (const change of [
    h => { h.context.CURRENT_LOCATION_ID = 1; },
    h => { h.context.CURRENT_DYN_INDEX = 2; },
    h => { h.state.room = 'another room'; },
    h => { h.state.day++; },
    h => { h.context.GRID = { is_setup: true, node_counter: 100 }; },
    h => { h.context.DUNGEON_RUNNER = { current_floor: 84, current_level: () => ({ impl: 'deep' }) }; },
  ]) {
    const h = localSightingsHarness();
    h.catchBug(h.bug(0));
    h.sync();
    assert.equal(h.runtime.local_sightings.caught['0'].caught, 1);
    change(h);
    assert.doesNotMatch(h.report(), /Butterfly/);
    assert.equal(h.runtime.local_sightings.caught['0'], undefined);
  }
  const h = localSightingsHarness();
  h.context.CURRENT_LOCATION_ID = 2;
  const runner = { current_floor: 83, current_level: () => ({ impl: 'deep' }) };
  h.context.DUNGEON_RUNNER = runner;
  h.sync();
  h.catchBug(h.bug(1));
  h.sync();
  assert.equal(h.runtime.local_sightings.caught['1'].caught, 1);
  runner.current_floor = 84;
  h.show();
  assert.match(h.notices[0].text, /^The Mines Floor 85\n/);
  assert.doesNotMatch(h.notices[0].text, /Snowball Beetle|Western Ruins/);
  h.catchBug(h.bug(2));
  h.sync();
  assert.equal(h.runtime.local_sightings.caught['2'].caught, 1);
});

test('digging or spawning nodes does not reset local catches, but room hooks and save loads do', () => {
  const h = localSightingsHarness([{ bug: 'snowball_beetle', day: 1 }]);
  assert.doesNotMatch(h.report(), /Snowball Beetle/, 'do not import old catches with no location information');
  h.catchBug(h.bug(0));
  h.sync();
  assert.equal(h.runtime.local_sightings.caught['0'].caught, 1);
  h.context.GRID.node_counter++;
  h.sync();
  assert.equal(h.runtime.local_sightings.caught['0'].caught, 1);
  h.context.MistriaCompanion_reset_local_sightings({});
  assert.doesNotMatch(h.report(), /Butterfly/, 'pre/post transition hooks also cover a return to an identical area key');
  assert.equal(h.runtime.local_sightings.caught['0'], undefined);
  h.catchBug(h.bug(0));
  h.sync();
  assert.equal(h.runtime.local_sightings.caught['0'].caught, 1);
  h.context.MistriaCompanion_floor_built({});
  assert.doesNotMatch(h.report(), /Butterfly/);
  assert.equal(h.runtime.local_sightings.caught['0'], undefined);
  h.catchBug(h.bug(0));
  h.report();
  h.show();
  h.context.MistriaCompanion_reset_save({});
  assert.equal(h.runtime.sightings_replay, undefined);
  assert.doesNotMatch(h.report(), /Butterfly/);
  assert.equal(h.runtime.local_sightings.caught['0'], undefined);
});

test('catch-log replacements and malformed entries cannot invent catches or repeat warnings forever', () => {
  const h = localSightingsHarness();
  h.context.GAME_STATS.bugs_caught.push({ bug: 'unknown', day: 1 }, {}, { bug: 'butterfly', day: 1 });
  assert.doesNotMatch(h.report(), /Butterfly/);
  assert.equal(h.runtime.local_sightings.caught['0'].caught, 1);
  assert.equal(h.warnings.length, 2);
  h.report();
  assert.equal(h.warnings.length, 2);
  h.context.GAME_STATS.bugs_caught.length = 0;
  assert.doesNotMatch(h.report(), /Butterfly/);
  assert.equal(h.runtime.local_sightings.caught['0'], undefined);
  h.context.GAME_STATS = { bugs_caught: [{ bug: 'moth', day: 1 }] };
  assert.doesNotMatch(h.report(), /Moth/);
});

test('F6 reports loading separately from an empty area and refreshes without opening menus', () => {
  const h = localSightingsHarness();
  h.state.ready = false;
  h.show();
  assert.equal(h.notices.length, 0);
  assert.match(h.feedback.at(-1), /during gameplay/);
  h.state.ready = true;
  h.context.FISH = undefined;
  h.show();
  assert.equal(h.notices.length, 0);
  assert.match(h.feedback.at(-1), /not ready/);
  h.context.FISH = {};
  h.show();
  assert.match(h.notices[0].text, /No bugs here/);
  h.expire();
  h.bug(2);
  h.show();
  assert.equal(h.notices.length, 2);
  assert.equal(h.notices[1].text, 'Moth: 1');
});

test('F6 notices coexist with native toasts and suspend while menus or cutscenes hide them', () => {
  const h = localSightingsHarness();
  h.bug(0);
  const existing = h.nativeNotice();
  h.show();
  assert.equal(h.notices.length, 1, 'show below the existing notification without waiting for it');
  const toast = h.toasts[0];
  assert.ok(toast.y >= existing.y + existing.height);
  const remaining = toast.board_get('timer');
  h.state.paused = true;
  for (let i = 0; i < 500; i++) toast.think();
  assert.equal(toast.alpha, 0);
  assert.equal(toast.board_get('timer'), remaining);
  h.state.paused = false;
  h.state.cutscene = true;
  toast.think();
  assert.equal(toast.alpha, 0);
  h.state.cutscene = false;
  toast.think();
  assert.equal(h.notices.length, 1);
  assert.equal(toast.alpha, 1);
  assert.equal(h.nativeToasts[0], existing);
  assert.equal(h.nativeToasts.length, 1, 'the companion has its own UI node, not a native queue entry');
  h.state.cutscene = true;
  toast.think();
  assert.equal(toast.alpha, 0);
  assert.equal(h.state.paused, false, 'the notice callback never pauses the game');
});

test('leaving an area cancels pending F6 notices and hides a stale visible sighting', () => {
  const h = localSightingsHarness();
  h.bug(0);
  h.bug(1);
  h.show();
  const toast = h.toasts[0];
  h.context.CURRENT_LOCATION_ID = 1;
  toast.think();
  assert.equal(toast.alpha, 0);
  h.replay();
  assert.equal(h.runtime.sightings_replay, undefined);
  h.expire();
  assert.equal(h.notices.length, 1, 'do not continue emitting the old area list');
  h.show();
  h.context.MistriaCompanion_reset_local_sightings({});
  assert.equal(h.runtime.sightings_replay, undefined);
});

test('automatic entry notice combines every bug rarity, counts, and legendary fish exactly like F6', () => {
  const h = localSightingsHarness();
  setSightingsAlerts(h, true);
  h.runtime.legendary_sightings = [];
  h.bug(0);
  h.bug(1);
  h.bug(1);
  h.bug(2);
  h.actors.bug.push(undefined, { alive: false }, { alive: true });
  h.actors.fish.push({ alive: true, fish_loot: { prototype: { legendary: true, item: 3 } } });
  h.advance(12);
  assert.equal(h.notices.length, 0, 'allow 12 clear frames for the area and spawns to settle');
  h.advance(1);
  assert.equal(h.notices.length, 1);
  assert.equal(h.notices[0].text, h.report());
  assert.equal(h.notices[0].text, 'Butterfly: 1\n'
    + 'Snowball Beetle: 2\nMoth: 1\n'
    + 'Legendary fish - Legendary Fish: 1 active');
  assert.equal(h.runtime.sightings_replay.automatic, true);
  assert.equal(h.state.paused, false);
  assert.equal(h.feedback.length, 0, 'no separate rare-bug, fish, or mine notification');
  h.show();
  h.expire();
  h.advance(30);
  assert.equal(h.notices.length, 1, 'F6 and repeated scans do not duplicate the visible summary');
});

test('automatic sightings remain quiet by default and enabling alerts does not replay old observations', () => {
  const h = localSightingsHarness();
  h.bug(0);
  h.bug(1);
  h.actors.fish.push({ alive: true, fish_loot: { prototype: { legendary: true, item: 3 } } });
  h.advance(30);
  assert.equal(h.notices.length, 0);
  setSightingsAlerts(h, true);
  h.advance(30);
  assert.equal(h.notices.length, 0);
  h.bug(2);
  h.advance();
  assert.equal(h.notices.length, 1);
  assert.equal(h.notices[0].text, 'Moth: 1',
    'enabling alerts mid-visit permits new-species updates, not a replay of the entry list');
});

test('bug and fish alerts independently filter automatic entry and update reports but never manual F6', () => {
  for (const bugs of [false, true]) {
    for (const fish of [false, true]) {
      const h = localSightingsHarness();
      Object.assign(h.runtime, { bug_alerts_enabled: bugs, legendary_fish_alerts_enabled: fish,
        notifications_enabled: false, dig_spot_alerts_enabled: true, diving_spot_alerts_enabled: true });
      h.bug(0);
      h.actors.fish.push({ alive: true, fish_loot: { prototype: { legendary: true, item: 3 } } });
      h.advance();
      assert.equal(h.notices.length, bugs || fish ? 1 : 0, 'legacy summary flag is not a master gate');
      if (bugs || fish) {
        assert.equal(h.notices[0].text.includes('Butterfly'), bugs);
        assert.equal(h.notices[0].text.includes('Legendary fish'), fish);
      }
      h.expire();
      h.bug(2);
      h.advance();
      assert.equal(h.notices.filter(notice => notice.text === 'Moth: 1').length, bugs ? 1 : 0);
      h.expire();
      h.show();
      assert.match(h.notices.at(-1).text, /Butterfly/);
      assert.match(h.notices.at(-1).text, /Legendary fish/);
    }
  }
});

test('disabling one sighting category cancels only its pending entries and retires stale combined toasts', () => {
  const h = localSightingsHarness();
  setSightingsAlerts(h, true);
  h.state.cutscene = true;
  h.bug(0);
  h.actors.fish.push({ alive: true, fish_loot: { prototype: { legendary: true, item: 3 } } });
  h.advance();
  h.context.MistriaCompanion_toggle_configuration(configurationPopupStub(), 'bug_alerts_enabled');
  assert.equal(Object.keys(h.runtime.local_sightings.pending_bugs).length, 0);
  assert.equal(Object.keys(h.runtime.local_sightings.pending_fish).length, 1);
  h.state.cutscene = false;
  h.advance();
  assert.doesNotMatch(h.notices[0].text, /Butterfly/);
  assert.match(h.notices[0].text, /Legendary fish/);
  const automatic = h.toasts[0];
  h.context.MistriaCompanion_toggle_configuration(configurationPopupStub(), 'legendary_fish_alerts_enabled');
  assert.equal(automatic.freed, true);
  assert.equal(h.runtime.sightings_replay, undefined);
  h.context.MistriaCompanion_toggle_configuration(configurationPopupStub(), 'bug_alerts_enabled');
  h.advance(30);
  assert.equal(h.notices.length, 1, 'old sightings do not replay when the category is re-enabled');
  h.show();
  const manual = h.toasts.at(-1);
  h.context.MistriaCompanion_toggle_configuration(configurationPopupStub(), 'bug_alerts_enabled');
  assert.equal(manual.freed, false, 'configuration switches never retire an explicit F6 report');
});

test('changing dig, dive, or map switches does not interrupt a visible automatic bug notice', () => {
  const h = localSightingsHarness();
  setSightingsAlerts(h, true);
  h.bug(0);
  h.advance();
  const replay = h.runtime.sightings_replay;
  for (const key of ['dig_spot_alerts_enabled', 'diving_spot_alerts_enabled',
    'bug_markers_enabled', 'dig_spot_markers_enabled', 'mist_spot_markers_enabled']) {
    h.context.MistriaCompanion_toggle_configuration(configurationPopupStub(), key);
    assert.equal(h.runtime.sightings_replay, replay);
    h.context.MistriaCompanion_toggle_configuration(configurationPopupStub(), key);
    assert.equal(h.runtime.sightings_replay, replay);
    assert.equal(h.toasts[0].freed, false);
  }
});

test('automatic bug summaries repeat for new species, not catches, duplicates, or grid node changes', () => {
  const h = localSightingsHarness();
  setSightingsAlerts(h, true);
  const first = h.bug(0);
  h.advance();
  h.expire();
  h.catchBug(first);
  h.bug(0);
  h.context.GRID.node_counter++;
  h.advance(30);
  assert.equal(h.notices.length, 1);
  h.bug(2);
  h.advance();
  assert.equal(h.notices.length, 2);
  assert.equal(h.notices[1].text, 'Moth: 1');
  h.expire();
  h.show();
  assert.equal(h.notices[2].text, 'Butterfly: 1\nMoth: 1',
    'only F6 requests the full list again during the visit');
});

test('mine-floor bug notices use the combined renderer and include species revealed later', () => {
  const h = localSightingsHarness();
  setSightingsAlerts(h, true);
  h.context.CURRENT_LOCATION_ID = 2;
  const runner = { current_floor: 95, current_level: () => ({ impl: 'ruins' }) };
  h.context.DUNGEON_RUNNER = runner;
  h.bug(0);
  h.bug(0);
  h.advance();
  assert.equal(h.notices[0].text, 'The Mines Floor 96\nButterfly: 2');
  h.expire();
  h.bug(2);
  h.context.GRID.node_counter++;
  h.advance();
  assert.equal(h.notices.length, 2, 'a new species revealed from a rock triggers a small update');
  assert.equal(h.notices[1].text, 'Moth: 1',
    'follow-ups omit the old species and even the mine heading to stay compact');
  h.expire();
  runner.current_floor++;
  h.advance();
  assert.equal(h.notices.length, 3);
  assert.match(h.notices[2].text, /^The Mines Floor 97\n/);
  assert.doesNotMatch(source, /Mine bugs:|function MistriaCompanion_show_mine_bug_spawns/);
});

test('automatic entry detection resets on every visit boundary and save load', () => {
  for (const change of [
    h => { h.context.CURRENT_LOCATION_ID = 1; },
    h => { h.context.CURRENT_DYN_INDEX++; },
    h => { h.state.room = 'another room'; },
    h => { h.state.day++; },
    h => { h.context.GRID = { is_setup: true }; },
    h => h.context.MistriaCompanion_reset_local_sightings({}),
    h => h.context.MistriaCompanion_floor_built({}),
    h => h.context.MistriaCompanion_reset_save({}),
  ]) {
    const h = localSightingsHarness();
    setSightingsAlerts(h, true);
    h.bug(0);
    h.advance();
    h.expire();
    change(h);
    h.advance();
    assert.equal(h.notices.length, 2);
  }
});

test('automatic notices wait for menus and cutscenes but not unrelated native notifications', () => {
  const h = localSightingsHarness();
  setSightingsAlerts(h, true);
  const first = h.bug(0);
  const despawned = h.bug(1);
  const existing = h.nativeNotice();
  h.state.paused = true;
  h.advance(30);
  assert.equal(h.notices.length, 0);
  h.advance(30);
  h.state.paused = false;
  h.state.cutscene = true;
  h.catchBug(first);
  despawned.alive = false;
  h.bug(2);
  h.advance(30);
  assert.equal(h.notices.length, 0);
  h.state.cutscene = false;
  h.advance(12);
  assert.equal(h.notices.length, 0);
  h.advance(1);
  assert.equal(h.notices[0].text, 'Moth: 1');
  assert.equal(h.nativeToasts[0], existing);
  assert.ok(h.toasts[0].y >= existing.y + existing.height);
  h.state.cutscene = true;
  h.toasts[0].think();
  assert.equal(h.toasts[0].alpha, 0);
});

test('the old area cannot create an entry notice between transition hooks and actual arrival', () => {
  const h = localSightingsHarness();
  setSightingsAlerts(h, true);
  h.bug(0);
  h.advance();
  h.expire();
  h.context.MistriaCompanion_reset_local_sightings({}); // Native pre hook.
  h.state.traveling = true;
  h.context.MistriaCompanion_reset_local_sightings({}); // Native post hook schedules, not completes, travel.
  h.advance(31);
  assert.equal(h.state.ready, true, 'the native old grid remains ready throughout the fade');
  assert.equal(h.notices.length, 1, 'never recreate the old region summary when starting to leave');
  assert.equal(h.runtime.local_sightings, undefined);
  h.show();
  assert.match(h.feedback.at(-1), /not ready/);
  h.context.CURRENT_LOCATION_ID = 1;
  h.state.room = 'western ruins';
  h.advance(10);
  assert.equal(h.notices.length, 1, 'changing the room is not sufficient before Taxi finishes arrival');
  h.state.traveling = false;
  h.advance(12);
  assert.equal(h.notices.length, 1);
  h.advance(1);
  assert.equal(h.notices.length, 2);
  assert.equal(h.notices[1].text, 'Butterfly: 1');
});

test('departing retires only the companion notice without changing the native notification queue', () => {
  const h = localSightingsHarness();
  setSightingsAlerts(h, true);
  h.bug(0);
  h.advance();
  const toast = h.toasts[0];
  assert.ok(toast.board_get('timer') >= 240);
  h.context.MistriaCompanion_reset_local_sightings({});
  assert.equal(toast.alpha, 0, 'the pre hook hides an existing notice immediately');
  assert.equal(toast.freed, true, 'the independently owned UI node can be freed immediately');
  assert.equal(h.toasts.length, 1);
  h.state.traveling = true;
  h.advance(31);
  assert.equal(h.notices.length, 1);
  h.context.CURRENT_LOCATION_ID = 1;
  h.state.traveling = false;
  h.expire();
  h.advance();
  assert.equal(h.notices.length, 2);
});

test('automatic notices coalesce discoveries while a notice is visible or pending', () => {
  const h = localSightingsHarness();
  setSightingsAlerts(h, true);
  h.bug(0);
  h.advance();
  h.bug(1);
  h.advance(30);
  h.bug(2);
  h.advance(30);
  assert.equal(h.notices.length, 1);
  h.expire();
  h.advance();
  assert.equal(h.notices.length, 2);
  assert.equal(h.notices[1].text, 'Snowball Beetle: 1\nMoth: 1');
  h.expire();
  h.advance(30);
  assert.equal(h.notices.length, 2, 'multiple discoveries create one update, not a queue of snapshots');
});

test('F6 consumes a pending automatic summary and remains available with alerts off', () => {
  const h = localSightingsHarness();
  setSightingsAlerts(h, true);
  h.bug(0);
  h.advance(3);
  h.show();
  assert.equal(h.notices.length, 1);
  assert.equal(h.runtime.sightings_replay.automatic, false);
  h.expire();
  h.advance(30);
  assert.equal(h.notices.length, 1);
  setSightingsAlerts(h, false);
  h.bug(2);
  h.show();
  h.toasts[0].think();
  assert.equal(h.toasts[0].alpha, 1, 'F10 cannot hide a deliberately requested F6 notice');
  assert.equal(h.notices[1].text, h.report());
});

test('empty areas and uncaught despawns never create an automatic no-sightings notice', () => {
  const h = localSightingsHarness();
  setSightingsAlerts(h, true);
  h.advance(30);
  assert.equal(h.notices.length, 0);
  h.state.cutscene = true;
  const bug = h.bug(0);
  const fish = { alive: true, fish_loot: { prototype: { legendary: true, item: 3 } } };
  h.actors.fish.push(fish);
  h.advance();
  bug.alive = false;
  fish.alive = false;
  h.state.cutscene = false;
  h.advance(30);
  assert.equal(h.notices.length, 0);
});

test('catching every pending bug cancels deferred entry and new-species notices', () => {
  for (const afterEmptyEntry of [false, true]) {
    const h = localSightingsHarness();
    setSightingsAlerts(h, true);
    if (afterEmptyEntry) h.advance();
    h.state.cutscene = true;
    const bug = h.bug(0);
    h.advance();
    h.catchBug(bug);
    h.advance();
    assert.equal(Object.keys(h.runtime.local_sightings.pending_bugs).length, 0);
    h.state.cutscene = false;
    h.advance(30);
    assert.equal(h.notices.length, 0);
    assert.equal(h.report(), 'No bugs here. No legendary fish active here.');
  }
});

test('new-species updates after an empty entry are compact and exclude catches while deferred', () => {
  const h = localSightingsHarness();
  setSightingsAlerts(h, true);
  h.context.CURRENT_LOCATION_ID = 2;
  h.context.DUNGEON_RUNNER = { current_floor: 95, current_level: () => ({ impl: 'ruins' }) };
  h.advance();
  assert.equal(h.notices.length, 0);
  assert.equal(h.runtime.local_sightings.entry_pending, false);
  const first = h.bug(0);
  h.advance(1);
  h.state.cutscene = true;
  h.catchBug(first);
  h.bug(0);
  h.advance();
  h.state.cutscene = false;
  h.advance();
  assert.equal(h.notices[0].text, 'Butterfly: 1');
  h.expire();
  h.bug(0);
  h.advance(30);
  assert.equal(h.notices.length, 1, 'another bug of a known species never triggers an update');
});

test('leaving or disabling alerts discards pending automatic notices and hides visible ones', () => {
  const h = localSightingsHarness();
  setSightingsAlerts(h, true);
  h.state.cutscene = true;
  h.bug(0);
  h.advance();
  h.context.MistriaCompanion_reset_local_sightings({});
  h.actors.bug.length = 0;
  h.state.cutscene = false;
  h.advance(30);
  assert.equal(h.notices.length, 0);
  h.bug(1);
  h.advance(3);
  setSightingsAlerts(h, false);
  h.advance();
  setSightingsAlerts(h, true);
  h.advance(30);
  assert.equal(h.notices.length, 0, 're-enabling does not revive a disabled pending report');
  h.bug(2);
  h.advance();
  assert.equal(h.notices.length, 1);
  setSightingsAlerts(h, false);
  h.toasts[0].think();
  assert.equal(h.toasts[0].alpha, 0);
  h.replay();
  assert.equal(h.runtime.sightings_replay, undefined);
});

test('automatic combined notices use the same bounded native pagination as F6', () => {
  const h = localSightingsHarness();
  setSightingsAlerts(h, true);
  h.state.screenHeight = 200;
  h.context.BUGS.get = () => ({ rarity: 'common' });
  for (let i = 0; i < 24; i++) {
    h.items.push({ name: `Long named automatic bug species ${i}` });
    h.bug(h.items.length - 1);
  }
  h.advance();
  const toast = h.toasts[0];
  const pages = toast.board_get('mistria_sightings_pages');
  assert.ok(pages.end < pages.lines.length);
  assert.equal(pages.lines.join('').replace(/\s/g, ''), h.notices[0].text.replace(/\s/g, ''));
  assert.ok(toast.height + h.toastMenu.base_y <= h.state.screenHeight - 8);
  for (let i = 0; i < 10000 && !toast.freed; i++) toast.think();
  assert.equal(toast.freed, true);
  assert.equal(pages.end, pages.lines.length);
  assert.equal(h.notices.length, 1);
});

test('legendary fish still trigger a combined notice once per species and location per day', () => {
  const h = localSightingsHarness();
  setSightingsAlerts(h, true);
  h.actors.fish.push({ alive: true, fish_loot: { prototype: { legendary: true, item: 3 } } });
  h.advance();
  assert.equal(h.notices[0].text, 'Legendary fish - Legendary Fish: 1 active');
  h.expire();
  h.context.MistriaCompanion_reset_local_sightings({});
  h.advance();
  assert.equal(h.notices.length, 1);
  h.context.CURRENT_LOCATION_ID = 1;
  h.runtime.seen_spawns = {};
  h.advance();
  assert.equal(h.notices.length, 2);
  h.expire();
  h.state.day++;
  h.advance();
  assert.equal(h.notices.length, 3);
});

test('sighting notices slide in and out like native dig alerts without spending their reading time', () => {
  const h = localSightingsHarness();
  h.bug(0);
  h.show();
  const toast = h.toasts[0];
  const width = toast.width;
  const timer = toast.board_get('timer');
  assert.equal(toast.x, -width);
  for (let frame = 1; frame <= 30; frame++) {
    toast.think();
    assert.ok(Math.abs(toast.x + width * ((1 - frame / 30) ** 4)) < 0.00001);
    assert.equal(toast.board_get('timer'), timer, 'slide-in must not shorten the reading interval');
  }
  assert.equal(toast.x, 0);
  for (let frame = 0; frame < timer; frame++) toast.think();
  assert.equal(toast.freed, false, 'expiration starts slide-out, not abrupt deletion');
  for (let frame = 1; frame <= 29; frame++) {
    toast.think();
    assert.ok(Math.abs(toast.x + width * (1 - ((1 - frame / 30) ** 4))) < 0.00001);
    assert.equal(toast.freed, false);
  }
  h.state.cutscene = true;
  const x = toast.x;
  for (let i = 0; i < 60; i++) toast.think();
  assert.equal(toast.x, x, 'a hidden animation must not run down during a cutscene');
  assert.equal(toast.alpha, 0);
  h.state.cutscene = false;
  toast.think();
  assert.equal(toast.x, -width);
  assert.equal(toast.freed, true);
  assert.equal(h.notices.length, 1);
  assert.doesNotMatch(source, /sightings_debug|trace_sightings|\[sightings-v48\]/);
});

test('wiki hints and action feedback remain visible while automatic alerts are off', () => {
  const runtime = { notifications_enabled: false, wiki_hints_enabled: true,
    wiki_title: 'Apple', wiki_hint_title: '', bindings: { wiki: 'F7' } };
  const messages = [];
  const nodes = [];
  const menu = {
    toasts: { is_empty: () => nodes.length === 0, last: () => nodes.at(-1) },
    create_notification(text) {
      messages.push(text);
      nodes.push({ board_get: () => undefined, board_set() {}, set_y() {} });
      return true;
    },
  };
  const context = load([privateName('notify'), privateName('show_wiki_hint')], {
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_menu: () => menu,
    Menu: { InfoToasts: 'toasts' },
    ANCHOR: { wrap_for_local: value => value },
  });
  context.__MistriaCompanion_show_wiki_hint();
  context.__MistriaCompanion_notify('Wiki link copied to clipboard.', 60);
  assert.deepEqual(messages, ['F7 Wiki', 'Wiki link copied to clipboard.']);
});

function mountedHarness() {
  const runtime = { mounted_interactions_enabled: true };
  const state = {
    mounted: true, playerState: 'MountDefault', paused: false,
    textbox: undefined, sleeping: false, unlocked: true, heldReads: 0,
    gossipUnlocked: false, gossipQuestReads: 0,
    held: { amount: 2, prototype: { giftable: true, tags: list([]) } },
  };
  const npcs = [];
  const warnings = [];
  const conditions = [];
  const actions = [];
  const player = {
    alive: true,
    is_mounted: () => state.mounted,
    fsm: { current_state_id: () => state.playerState, next_state: undefined },
  };
  const context = load([
    privateName('mounted_ready'), privateName('mounted_condition'),
    privateName('wrap_mounted_interaction'), privateName('install_mounted_npc'),
    publicName('update_mounted_interactions'),
  ], {
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_menu: kind => {
      assert.equal(kind, 'Textbox');
      return state.textbox;
    },
    ARI: {
      mount: {}, fire_breath_time: 0,
      held_item: () => { state.heldReads++; return state.held; },
    },
    obj_ari: player,
    PlayerState: { MountDefault: 'MountDefault', MountJump: 'MountJump', Default: 'Default' },
    Menu: { Textbox: 'Textbox' },
    NpcId: { Caldarus: 999, Elsie: 1000 },
    InputId: { Interact: 'Interact', Throw: 'Throw', SecondaryInteract: 'SecondaryInteract' },
    QUEST_LOG: { completed: { contains: key => {
      assert.equal(key, 'gossip_for_elsie');
      state.gossipQuestReads++;
      return state.gossipUnlocked;
    } } },
    MIST: { running: false },
    non_cutscene_pause: () => state.paused,
    caldarus_is_sleeping: () => state.sleeping,
    npc_is_unlocked: () => state.unlocked,
    par_NPC: 'par_NPC',
    instance_number: kind => { assert.equal(kind, 'par_NPC'); return npcs.length; },
    instance_find: (kind, index) => { assert.equal(kind, 'par_NPC'); return npcs[index]; },
    instance_exists: instance => instance != null && instance.alive === true,
    mmapi_warn_rate_limited: (...args) => warnings.push(args),
  });
  function interactionList(entries) {
    return {
      reads: 0,
      count: () => entries.length,
      get(index) { this.reads++; return entries[index]; },
    };
  }
  function entry(npc, kind, key, input) {
    return {
      local_key: key,
      input_id: input,
      can_interact_callback: context.method(npc, () => {
        assert.equal(context.self, npc, 'native eligibility keeps its original NPC receiver');
        conditions.push({ npc, kind });
        return npc[`${kind}Result`];
      }),
      callback: context.method(npc, () => {
        assert.equal(context.self, npc, 'native action keeps its original NPC receiver');
        actions.push({ npc, kind });
        if (kind === 'gift') state.held.amount--;
        return `${kind} action`;
      }),
    };
  }
  function makeNpc(id = npcs.length + 1) {
    const npc = {
      npc_id: id, alive: true, talkAllowed: true, questsEmpty: true,
      talkResult: false, giftResult: false, questResult: false,
      me: { gift_flag: true, prototype: { banned_gift_tags: list(['banned']) } },
      fsm: {},
    };
    npc.can_talk = () => npc.talkAllowed;
    npc.my_query_quests = () => ({ is_empty: () => npc.questsEmpty });
    npc.entries = [
      entry(npc, 'talk', 'misc_local/talk', context.InputId.Interact),
      entry(npc, 'gift', 'misc_local/give_item', context.InputId.Throw),
      entry(npc, 'quest', 'misc_local/turn_in_quest_input', context.InputId.Interact),
      entry(npc, 'date', 'date', context.InputId.Interact),
      entry(npc, 'proposal', 'proposal', context.InputId.Throw),
    ];
    npc.interactions = interactionList(npc.entries);
    npcs.push(npc);
    return npc;
  }
  function addGossip(npc, input = context.InputId.SecondaryInteract) {
    const gossip = entry(npc, 'gossip', 'misc_local/gossip', input);
    gossip.can_interact_callback = context.method(npc, () => {
      assert.equal(context.self, npc);
      conditions.push({ npc, kind: 'gossip' });
      return state.gossipUnlocked && !state.mounted;
    });
    npc.entries.push(gossip);
    return gossip;
  }
  return {
    context, runtime, state, player, npcs, warnings, conditions, actions,
    makeNpc, entry, interactionList, addGossip,
    install: context.__MistriaCompanion_install_mounted_npc,
    update: context.MistriaCompanion_update_mounted_interactions,
  };
}

test('mounted wrappers delegate exact native results off-mount or when disabled without rebinding callbacks', () => {
  for (const mode of ['off-mount', 'disabled', 'missing-player']) {
    const { context, state, runtime, player, conditions, makeNpc, update } = mountedHarness();
    const npc = makeNpc();
    const originals = npc.entries.slice(0, 2).map(entry => entry.can_interact_callback);
    update();
    if (mode === 'off-mount') state.mounted = false;
    if (mode === 'disabled') runtime.mounted_interactions_enabled = false;
    if (mode === 'missing-player') player.alive = false;
    npc.can_talk = () => assert.fail('delegated mode must not evaluate mounted predicates');
    context.ARI.held_item = () => assert.fail('delegated mode must not inspect held items');
    context.self = { outer: true };
    const outer = context.self;
    for (const result of [undefined, null, false, true, 0, 7, 'native result', { native: true }]) {
      npc.talkResult = result;
      npc.giftResult = result;
      for (const [index, interaction] of npc.entries.slice(0, 2).entries()) {
        assert.equal(interaction.__mistria_companion_mounted.original, originals[index]);
        assert.equal(interaction.can_interact_callback(), result);
        assert.equal(context.self, outer, 'nested bound calls restore their caller');
      }
    }
    assert.equal(conditions.length, 16);
  }
});

test('mounted ordinary talk preserves can_talk and quest eligibility', () => {
  const { makeNpc, conditions, update } = mountedHarness();
  const npc = makeNpc();
  update();
  const canTalk = () => npc.entries[0].can_interact_callback();
  assert.equal(canTalk(), true);
  npc.talkAllowed = false;
  assert.equal(canTalk(), false);
  npc.talkAllowed = true;
  npc.questsEmpty = false;
  assert.equal(canTalk(), false);
  npc.questsEmpty = true;
  assert.equal(canTalk(), true);
  assert.equal(conditions.length, 0, 'native mount-vetoing predicates are not evaluated in mounted mode');
});

test('mounted quest hand-ins use live native quest eligibility without gift or daily-talk restrictions', () => {
  const h = mountedHarness();
  const npc = h.makeNpc();
  const native = npc.entries[2];
  native.can_interact_callback = h.context.method(npc, () =>
    !npc.my_query_quests().is_empty() && !h.state.mounted);
  assert.equal(native.can_interact_callback(), false, 'the native predicate blocks riding');
  h.update();
  assert.equal(native.can_interact_callback(), false, 'no completed quest is not eligible');
  npc.questsEmpty = false;
  assert.equal(native.can_interact_callback(), true);
  npc.talkAllowed = false;
  npc.me.gift_flag = false;
  h.state.held = undefined;
  assert.equal(native.can_interact_callback(), true, 'quest items need not be held and gifting status is irrelevant');
  assert.equal(h.state.heldReads, 0);
  assert.equal(h.actions.length, 0);
  assert.equal(npc.entries[0].can_interact_callback(), false, 'a ready hand-in keeps priority over ordinary talk');
  npc.questsEmpty = true;
  assert.equal(native.can_interact_callback(), false, 'completing or invalidating the quest removes the action');
  npc.talkAllowed = true;
  assert.equal(npc.entries[0].can_interact_callback(), true);
});

test('mounted quests preserve native requirement and NPC target checks', () => {
  const h = mountedHarness();
  const npc = h.makeNpc();
  const quest = { active: true, target: npc.npc_id, required: 3, items: 2 };
  npc.my_query_quests = () => ({
    is_empty: () => !quest.active || quest.target !== npc.npc_id || quest.items < quest.required,
  });
  h.update();
  const canTurnIn = npc.entries[2].can_interact_callback;
  assert.equal(canTurnIn(), false);
  quest.items = 3;
  assert.equal(canTurnIn(), true);
  quest.target++;
  assert.equal(canTurnIn(), false);
  quest.target = npc.npc_id;
  quest.active = false;
  assert.equal(canTurnIn(), false);
  assert.equal(quest.items, 3, 'eligibility never consumes quest items');
});

test('mounted quest selection and confirmation remain entirely in the unchanged native callback', () => {
  const h = mountedHarness();
  const npc = h.makeNpc();
  // Native NPC order starts with Talk then Turn in quest; wrapping must not depend on indices.
  [npc.entries[1], npc.entries[2]] = [npc.entries[2], npc.entries[1]];
  let readyCount = 1;
  const confirmation = { kind: 'native-confirmation' };
  const selection = { kind: 'native-quest-selection' };
  const calls = [];
  npc.entries[1].callback = h.context.method(npc, () => {
    assert.equal(h.context.self, npc);
    calls.push(readyCount);
    return readyCount > 1 ? selection : confirmation;
  });
  const action = npc.entries[1].callback;
  npc.my_query_quests = () => ({ is_empty: () => readyCount === 0 });
  h.update();
  assert.equal(npc.entries[1].callback, action);
  for (const count of [1, 2]) {
    readyCount = count;
    const chosen = npc.entries.find(entry =>
      entry.input_id === h.context.InputId.Interact && entry.can_interact_callback());
    assert.equal(chosen, npc.entries[1], 'hand-in, not ordinary talk, receives Interact');
    assert.equal(chosen.callback(), count > 1 ? selection : confirmation);
  }
  assert.deepEqual(calls, [1, 2]);
  assert.equal(h.state.held.amount, 2, 'opening either native popup does not consume an item');
  assert.equal(npc.me.gift_flag, true);
  assert.equal(h.state.playerState, 'MountDefault');
  assert.equal(h.player.fsm.next_state, undefined, 'the companion does not force a dismount or state change');
});

test('quest wrappers delegate exact results when off-mount, disabled, or missing the player', () => {
  for (const mode of ['off-mount', 'disabled', 'missing-player']) {
    const h = mountedHarness();
    const npc = h.makeNpc();
    const original = npc.entries[2].can_interact_callback;
    h.update();
    if (mode === 'off-mount') h.state.mounted = false;
    if (mode === 'disabled') h.runtime.mounted_interactions_enabled = false;
    if (mode === 'missing-player') h.player.alive = false;
    npc.my_query_quests = () => assert.fail('delegated mode must use the original condition');
    for (const result of [undefined, false, true, 0, 7, 'native result', { native: true }]) {
      npc.questResult = result;
      assert.equal(npc.entries[2].can_interact_callback(), result);
      assert.equal(npc.entries[2].__mistria_companion_mounted.original, original);
    }
  }
});

test('mounted quest hand-ins respect Caldarus sleep and destroyed NPCs', () => {
  const h = mountedHarness();
  const caldarus = h.makeNpc(h.context.NpcId.Caldarus);
  const npc = h.makeNpc();
  caldarus.questsEmpty = false;
  npc.questsEmpty = false;
  h.update();
  assert.equal(caldarus.entries[2].can_interact_callback(), true);
  h.state.sleeping = true;
  assert.equal(caldarus.entries[2].can_interact_callback(), false);
  assert.equal(npc.entries[2].can_interact_callback(), true);
  npc.alive = false;
  npc.my_query_quests = () => assert.fail('do not query a destroyed NPC');
  assert.equal(npc.entries[2].can_interact_callback(), false);
});

test('late quest registration is wrapped once without replacing subsequent foreign changes', () => {
  const h = mountedHarness();
  const npc = h.makeNpc();
  const quest = npc.entries.splice(2, 1)[0];
  h.update();
  assert.ok(h.warnings.length > 0);
  npc.entries.push(quest);
  h.update();
  const wrapper = quest.can_interact_callback;
  h.update();
  assert.equal(quest.can_interact_callback, wrapper);
  const foreign = () => false;
  quest.can_interact_callback = foreign;
  npc.entries.push(h.entry(npc, 'unrelated', 'unrelated', h.context.InputId.Throw));
  h.update();
  assert.equal(quest.can_interact_callback, foreign);
});

test('mounted Elsie Gossip keeps its quest unlock and native action, including cooldown responses', () => {
  const h = mountedHarness();
  const elsie = h.makeNpc(h.context.NpcId.Elsie);
  const gossip = h.addGossip(elsie);
  const before = { ...gossip };
  h.update();
  h.update();
  assert.notEqual(gossip.can_interact_callback, before.can_interact_callback);
  assert.equal(gossip.callback, before.callback);
  assert.equal(gossip.input_id, h.context.InputId.SecondaryInteract);
  assert.equal(gossip.local_key, 'misc_local/gossip');
  assert.equal(gossip.can_interact_callback(), false, 'the introductory quest still gates Gossip');
  h.state.gossipUnlocked = true;
  elsie.talkAllowed = false;
  elsie.questsEmpty = false;
  for (const alreadyGossiped of [false, true]) {
    h.context.ARI.has_gossiped_today = alreadyGossiped;
    assert.equal(gossip.can_interact_callback(), true, 'Gossip does not inherit ordinary Talk restrictions');
    assert.equal(gossip.callback(), 'gossip action');
    assert.equal(h.context.ARI.has_gossiped_today, alreadyGossiped, 'only the native action owns daily state');
  }
  assert.equal(h.conditions.length, 0, 'the mount-vetoing native predicate is bypassed only while mounted');
  assert.equal(h.state.heldReads, 0);
  assert.equal(h.warnings.length, 0);
  assert.deepEqual(h.actions.map(action => action.kind), ['gossip', 'gossip']);
  assert.ok(h.actions.every(action => action.npc === elsie));
});

test('mounted Elsie Gossip delegates unchanged when off-mount, disabled, or missing the player', () => {
  for (const mode of ['off-mount', 'disabled', 'missing-player']) {
    const h = mountedHarness();
    const elsie = h.makeNpc(h.context.NpcId.Elsie);
    const gossip = h.addGossip(elsie);
    const original = gossip.can_interact_callback;
    h.update();
    if (mode === 'off-mount') h.state.mounted = false;
    if (mode === 'disabled') h.runtime.mounted_interactions_enabled = false;
    if (mode === 'missing-player') h.player.alive = false;
    for (const unlocked of [false, true]) {
      h.state.gossipUnlocked = unlocked;
      assert.equal(gossip.can_interact_callback(), original());
    }
    assert.equal(h.state.gossipQuestReads, 0, 'delegation does not run the mod predicate');
    assert.equal(gossip.__mistria_companion_mounted.original, original);
  }
});

test('mounted Gossip wrapping is restricted to one native Elsie secondary interaction', () => {
  for (const variant of ['other-npc', 'wrong-input', 'duplicate', 'bad-condition', 'bad-action']) {
    const h = mountedHarness();
    const npc = h.makeNpc(variant === 'other-npc' ? 1 : h.context.NpcId.Elsie);
    const gossip = h.addGossip(npc, variant === 'wrong-input' ? h.context.InputId.Interact : undefined);
    if (variant === 'duplicate') h.addGossip(npc);
    if (variant === 'bad-condition') gossip.can_interact_callback = undefined;
    if (variant === 'bad-action') gossip.callback = undefined;
    const entries = npc.entries.slice(5);
    const before = entries.map(entry => ({ ...entry }));
    h.update();
    assert.deepEqual(entries, before, variant);
    assert.ok(npc.entries[0].__mistria_companion_mounted);
    assert.ok(npc.entries[1].__mistria_companion_mounted);
    assert.equal(h.warnings.length > 0, variant !== 'other-npc', variant);
  }
});

test('mounted Elsie Gossip retries late registration without wrapping an entry twice', () => {
  const h = mountedHarness();
  const elsie = h.makeNpc(h.context.NpcId.Elsie);
  h.update();
  const gossip = h.addGossip(elsie);
  h.update();
  const wrapped = gossip.can_interact_callback;
  h.update();
  assert.equal(gossip.can_interact_callback, wrapped);
  h.state.gossipUnlocked = true;
  assert.equal(gossip.can_interact_callback(), true);
});

test('mounted Caldarus native talk/gift/sleepTalk layout wraps only ordinary entries and preserves sleeping callbacks', () => {
  const { context, makeNpc, entry, state, actions, warnings, update } = mountedHarness();
  const caldarus = makeNpc(context.NpcId.Caldarus);
  const otherNpc = makeNpc();
  const sleepTalk = entry(caldarus, 'sleep-talk', 'misc_local/talk', context.InputId.Interact);
  // The native subclass appends this after inherited interactions. Only its
  // ari_can_talk mount veto is simulated here; other player guards have separate tests.
  sleepTalk.can_interact_callback = context.method(caldarus, () => {
    assert.equal(context.self, caldarus);
    return caldarus.can_talk() && state.sleeping && !state.mounted;
  });
  caldarus.entries.push(sleepTalk);
  const entries = [...caldarus.entries];
  const before = entries.map(entry => ({ ...entry }));
  update();
  update();
  assert.equal(warnings.length, 0, 'the exact native two-Talk layout is not ambiguous');
  assert.equal(caldarus.entries.length, entries.length);
  for (const [index, interaction] of caldarus.entries.entries()) {
    assert.equal(interaction, entries[index], 'the native list order and entry identity are preserved');
    assert.equal(interaction.callback, before[index].callback);
    assert.equal(interaction.local_key, before[index].local_key);
    assert.equal(interaction.input_id, before[index].input_id);
    if (index < 3) {
      assert.notEqual(interaction.can_interact_callback, before[index].can_interact_callback);
    } else {
      assert.deepEqual(interaction, before[index], 'all extra callbacks, including sleepTalk, remain identical');
    }
  }
  assert.equal(sleepTalk.__mistria_companion_mounted, undefined);
  for (const sleeping of [false, true, false]) {
    state.sleeping = sleeping;
    assert.equal(caldarus.entries[0].can_interact_callback(), !sleeping);
    assert.equal(caldarus.entries[1].can_interact_callback(), !sleeping);
    assert.equal(sleepTalk.can_interact_callback(), false, 'native sleeping Talk still vetoes mounted use');
    assert.equal(otherNpc.entries[0].can_interact_callback(), true, 'Caldarus sleep does not affect other villagers');
  }
  state.sleeping = true;
  state.mounted = false;
  assert.equal(sleepTalk.can_interact_callback(), true, 'sleeping conversation remains available off-mount');
  caldarus.talkAllowed = false;
  assert.equal(sleepTalk.can_interact_callback(), false, 'native sleeping Talk retains its can_talk check');
  assert.equal(actions.length, 0, 'installation and eligibility never execute conversation or gift actions');
});

test('mounted gift eligibility preserves daily flag, held item, giftability, banned tags, unlock, and Caldarus rules', () => {
  const { context, makeNpc, state, conditions, update } = mountedHarness();
  const npc = makeNpc();
  const caldarus = makeNpc(context.NpcId.Caldarus);
  update();
  const canGift = () => npc.entries[1].can_interact_callback();
  const canGiftCaldarus = () => caldarus.entries[1].can_interact_callback();
  const held = state.held;
  assert.equal(canGift(), true);
  npc.me.gift_flag = false;
  assert.equal(canGift(), false);
  npc.me.gift_flag = true;
  state.held = undefined;
  assert.equal(canGift(), false);
  state.held = held;
  held.prototype.giftable = false;
  assert.equal(canGift(), false);
  held.prototype.giftable = true;
  held.prototype.tags = list(['ordinary', 'banned']);
  assert.equal(canGift(), false);
  held.prototype.tags = list(['ordinary']);
  state.unlocked = false;
  assert.equal(canGift(), false);
  assert.equal(canGiftCaldarus(), false);
  state.unlocked = true;
  assert.equal(canGift(), true);
  assert.equal(canGiftCaldarus(), true);
  state.sleeping = true;
  assert.equal(canGiftCaldarus(), false);
  assert.equal(canGift(), true);
  state.sleeping = false;
  npc.talkAllowed = false;
  npc.questsEmpty = false;
  assert.equal(canGift(), true, 'gifting does not acquire talk-only restrictions');
  assert.equal(conditions.length, 0);
  assert.equal(held.amount, 2, 'eligibility never consumes an item');
});

test('mounted talk, gift, quest hand-ins, and Gossip are blocked by unsafe player states', () => {
  const cases = [
    ['MountJump', h => { h.state.playerState = h.context.PlayerState.MountJump; }],
    ['other player state', h => { h.state.playerState = h.context.PlayerState.Default; }],
    ['pending FSM state zero', h => { h.player.fsm.next_state = 0; }],
    ['pending FSM state', h => { h.player.fsm.next_state = {}; }],
    ['pause', h => { h.state.paused = true; }],
    ['MIST', h => { h.context.MIST.running = true; }],
    ['textbox', h => { h.state.textbox = {}; }],
    ['fire breath', h => { h.context.ARI.fire_breath_time = 1; }],
    ['missing mount', h => { h.context.ARI.mount = undefined; }],
  ];
  for (const [label, block] of cases) {
    const harness = mountedHarness();
    const npc = harness.makeNpc(harness.context.NpcId.Elsie);
    const gossip = harness.addGossip(npc);
    harness.state.gossipUnlocked = true;
    harness.update();
    assert.equal(harness.context.__MistriaCompanion_mounted_ready(), true);
    block(harness);
    assert.equal(harness.context.__MistriaCompanion_mounted_ready(), false, label);
    assert.equal(npc.entries[0].can_interact_callback(), false, `${label}: talk`);
    assert.equal(npc.entries[1].can_interact_callback(), false, `${label}: gift`);
    npc.questsEmpty = false;
    assert.equal(npc.entries[2].can_interact_callback(), false, `${label}: quest`);
    assert.equal(gossip.can_interact_callback(), false, `${label}: gossip`);
    assert.equal(harness.state.gossipQuestReads, 0);
    assert.equal(harness.conditions.length, 0);
    assert.equal(harness.state.heldReads, 0, 'guards precede held-item access');
  }
});

test('mounted installation preserves action identity and ordering, changing only talk/gift/quest eligibility', () => {
  const { context, state, makeNpc, actions, conditions, update } = mountedHarness();
  const npc = makeNpc();
  const entries = [...npc.entries];
  const before = entries.map(entry => ({ ...entry }));
  const nativeList = npc.interactions;
  update();
  update();
  assert.equal(npc.interactions, nativeList);
  assert.equal(npc.entries.length, before.length);
  assert.equal(actions.length, 0);
  assert.equal(conditions.length, 0);
  assert.equal(state.heldReads, 0);
  assert.equal(state.held.amount, 2, 'installer does not consume inventory');
  for (const [index, entry] of npc.entries.entries()) {
    assert.equal(entry, entries[index], 'native entries retain their identity and order');
    assert.equal(entry.callback, before[index].callback);
    assert.equal(entry.local_key, before[index].local_key);
    assert.equal(entry.input_id, before[index].input_id);
    if (index < 3) {
      assert.notEqual(entry.can_interact_callback, before[index].can_interact_callback);
    } else {
      assert.deepEqual(entry, before[index], 'unrelated actions and predicates remain untouched');
    }
  }
  // A single synthetic native input dispatch; not a claim about the engine's input loop.
  function dispatch(input) {
    const chosen = npc.entries.find(entry => entry.input_id === input && entry.can_interact_callback());
    return chosen?.callback();
  }
  assert.equal(dispatch(context.InputId.Interact), 'talk action');
  assert.equal(dispatch(context.InputId.Throw), 'gift action');
  assert.deepEqual(actions.map(action => action.kind), ['talk', 'gift']);
  assert.ok(actions.every(action => action.npc === npc));
  assert.equal(state.held.amount, 1, 'only the single native gift callback consumes an item');
});

test('mounted installer is idempotent for a stable list and list growth without overriding foreign callback changes', () => {
  const { makeNpc, entry, update, warnings, context } = mountedHarness();
  const npc = makeNpc();
  update();
  const wrappers = npc.entries.slice(0, 2).map(entry => entry.can_interact_callback);
  const contexts = npc.entries.slice(0, 2).map(entry => entry.__mistria_companion_mounted);
  const reads = npc.interactions.reads;
  update();
  update();
  assert.equal(npc.interactions.reads, reads, 'unchanged list/count is not rescanned');
  npc.entries.push(entry(npc, 'extra-quest', 'extra-quest', context.InputId.Interact));
  update();
  assert.equal(npc.interactions.reads, reads + npc.entries.length);
  for (const [index, wrapper] of wrappers.entries()) {
    assert.equal(npc.entries[index].can_interact_callback, wrapper);
    assert.equal(npc.entries[index].__mistria_companion_mounted, contexts[index]);
    assert.notEqual(contexts[index].original, wrapper, 'never wrap a wrapper');
  }
  const foreignCondition = () => 'foreign predicate';
  const foreignAction = () => 'foreign action';
  npc.entries[0].can_interact_callback = foreignCondition;
  npc.entries[1].callback = foreignAction;
  update();
  npc.entries.push(entry(npc, 'extra-date', 'extra-date', context.InputId.Interact));
  update();
  assert.equal(npc.entries[0].can_interact_callback, foreignCondition);
  assert.equal(npc.entries[1].callback, foreignAction);
  assert.equal(npc.entries[0].__mistria_companion_mounted, contexts[0]);
  assert.equal(warnings.length, 0);
});

test('mounted updater handles new and replaced NPCs, destroyed instances, and replacement interaction lists', () => {
  const { makeNpc, entry, npcs, context, interactionList, update, warnings } = mountedHarness();
  const first = makeNpc(1);
  update();
  const staleTalk = first.entries[0].can_interact_callback;
  const staleGift = first.entries[1].can_interact_callback;
  first.alive = false;
  first.interactions = undefined;
  npcs.push(undefined, { alive: false });
  const replacement = makeNpc(1);
  const newcomer = makeNpc(2);
  update();
  assert.equal(staleTalk(), false);
  assert.equal(staleGift(), false);
  for (const npc of [replacement, newcomer]) {
    assert.equal(npc.entries[0].__mistria_companion_mounted.npc, npc);
    assert.equal(npc.entries[0].can_interact_callback(), true);
    assert.equal(npc.entries[1].can_interact_callback(), true);
  }
  const previous = replacement.entries;
  replacement.entries = [
    entry(replacement, 'talk', 'misc_local/talk', context.InputId.Interact),
    entry(replacement, 'gift', 'misc_local/give_item', context.InputId.Throw),
    ...previous.slice(2),
  ];
  replacement.interactions = interactionList(replacement.entries);
  update();
  assert.equal(replacement.entries.length, previous.length, 'same-sized replacement list is detected');
  assert.equal(replacement.interactions.reads, replacement.entries.length);
  assert.notEqual(replacement.entries[0].can_interact_callback, previous[0].can_interact_callback);
  assert.equal(replacement.entries[0].__mistria_companion_mounted.npc, replacement);
  assert.equal(replacement.__mistria_companion_mounted.list, replacement.interactions);
  assert.equal(warnings.length, 0);
});

test('mounted disabled updater leaves native entries untouched and installs when enabled later', () => {
  const { makeNpc, runtime, update, warnings } = mountedHarness();
  const npc = makeNpc();
  const original = npc.entries.map(entry => ({ ...entry }));
  runtime.mounted_interactions_enabled = false;
  update();
  assert.deepEqual(npc.entries, original);
  assert.equal(npc.interactions.reads, 0);
  assert.equal(npc.__mistria_companion_mounted, undefined);
  runtime.mounted_interactions_enabled = true;
  update();
  assert.notEqual(npc.entries[0].can_interact_callback, original[0].can_interact_callback);
  assert.notEqual(npc.entries[1].can_interact_callback, original[1].can_interact_callback);
  assert.equal(warnings.length, 0);
});

test('mounted installer warns and preserves missing, duplicate, or wrong-input native entries', () => {
  const variants = [
    ['missing talk', (npc) => { npc.entries.splice(0, 1); }],
    ['missing gift', (npc) => { npc.entries.splice(1, 1); }],
    ['duplicate talk', (npc) => { npc.entries.push({ ...npc.entries[0] }); }],
    ['duplicate gift', (npc) => { npc.entries.push({ ...npc.entries[1] }); }],
    ['wrong talk input', (npc, h) => { npc.entries[0].input_id = h.context.InputId.Throw; }],
    ['wrong gift input', (npc, h) => { npc.entries[1].input_id = h.context.InputId.Interact; }],
    ['missing quest', (npc) => { npc.entries.splice(2, 1); }],
    ['duplicate quest', (npc) => { npc.entries.push({ ...npc.entries[2] }); }],
    ['wrong quest input', (npc, h) => { npc.entries[2].input_id = h.context.InputId.Throw; }],
    ['noncanonical Caldarus pair', (npc, h) => {
      npc.npc_id = h.context.NpcId.Caldarus;
      npc.entries.splice(2, 0, { ...npc.entries[0] });
    }],
    ['third Caldarus talk', (npc, h) => {
      npc.npc_id = h.context.NpcId.Caldarus;
      npc.entries.push({ ...npc.entries[0] }, { ...npc.entries[0] });
    }],
  ];
  for (const [label, change] of variants) {
    const harness = mountedHarness();
    const npc = harness.makeNpc();
    change(npc, harness);
    const before = npc.entries.map(entry => ({ ...entry }));
    harness.update();
    assert.ok(harness.warnings.some(args => args[0].endsWith(':mounted_entries')), label);
    for (const [index, entry] of npc.entries.entries()) {
      const isTalk = entry.local_key === 'misc_local/talk' && entry.input_id === harness.context.InputId.Interact;
      const isGift = entry.local_key === 'misc_local/give_item' && entry.input_id === harness.context.InputId.Throw;
      const isQuest = entry.local_key === 'misc_local/turn_in_quest_input' && entry.input_id === harness.context.InputId.Interact;
      const matching = npc.entries.filter(other =>
        other.local_key === entry.local_key && other.input_id === entry.input_id).length;
      if ((!isTalk && !isGift && !isQuest) || matching !== 1) {
        assert.deepEqual(entry, before[index], `${label}: ambiguous or unrelated entry is unchanged`);
      } else {
        assert.notEqual(entry.can_interact_callback, before[index].can_interact_callback,
          `${label}: unambiguous counterpart still works`);
        assert.equal(entry.callback, before[index].callback);
      }
    }
  }
});

test('mounted installer warns and leaves malformed list and callback shapes unchanged', () => {
  for (const invalid of [undefined, null, 12, [], {}, { count: 2, get() {} }, { count() { return 2; }, get: [] }]) {
    const { makeNpc, update, warnings } = mountedHarness();
    const npc = makeNpc();
    const entries = npc.entries.map(entry => ({ ...entry }));
    npc.interactions = invalid;
    update();
    assert.equal(npc.interactions, invalid);
    assert.deepEqual(npc.entries, entries);
    assert.equal(npc.__mistria_companion_mounted, undefined);
    assert.ok(warnings.some(args => args[0].endsWith(':mounted_list')));
  }
  for (const key of ['can_interact_callback', 'callback']) {
    for (const value of [undefined, null, 0, 'method', {}]) {
      for (const index of [0, 1, 2]) {
        const { makeNpc, update, warnings } = mountedHarness();
        const npc = makeNpc();
        npc.entries[index][key] = value;
        const before = { ...npc.entries[index] };
        update();
        assert.deepEqual(npc.entries[index], before);
        assert.equal(npc.entries[index].__mistria_companion_mounted, undefined);
        assert.ok(warnings.some(args => args[0].endsWith(':mounted_callback')));
        for (const other of [0, 1, 2].filter(value => value !== index)) {
          assert.ok(npc.entries[other].__mistria_companion_mounted, 'valid counterparts are not discarded');
        }
      }
    }
  }
});

test('mounted updater retries uninitialized NPCs and lists once their native interactions become available', () => {
  for (const missing of ['me', 'fsm', 'interactions']) {
    const { makeNpc, update, warnings } = mountedHarness();
    const npc = makeNpc();
    const saved = npc[missing];
    const before = npc.entries.map(entry => ({ ...entry }));
    delete npc[missing];
    update();
    update();
    assert.deepEqual(npc.entries, before);
    assert.equal(npc.__mistria_companion_mounted, undefined);
    if (missing !== 'interactions') assert.equal(warnings.length, 0, 'early initialization is not malformed data');
    npc[missing] = saved;
    update();
    assert.ok(npc.entries[0].__mistria_companion_mounted);
    assert.ok(npc.entries[1].__mistria_companion_mounted);
  }
});

function wikiHarness() {
  const runtime = { wiki_title: 'Old fish', map_wiki_nodes: [] };
  const menus = {};
  const open = [];
  const Menu = { Map: 'map', Store: 'store', Crafting: 'crafting' };
  const context = load([privateName('set_wiki_title'), privateName('resolve_wiki_title')], {
    Menu,
    ANCHOR: { open_menus: { count: () => open.length, get: i => open[i] } },
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_ready: () => true,
    __MistriaCompanion_menu: kind => menus[kind],
    __MistriaCompanion_name: prototype => prototype.name,
    __MistriaCompanion_fit_node: () => {},
    __MistriaCompanion_update_museum_label: () => {},
    MistriaCompanion_capture_npc_context: () => {},
    MistriaCompanion_capture_quest_item_context: () => {},
    MistriaCompanion_capture_museum_wing_context: () => {},
  });
  return { runtime, menus, open, resolve: context.__MistriaCompanion_resolve_wiki_title };
}

test('wiki resolution never reuses a stale or unhovered tooltip', () => {
  const { open, resolve } = wikiHarness();
  assert.equal(resolve(), '');
  const tooltip = {
    is_tooltip: true, hide_requests: 0, item: { prototype: { name: 'Butterfly' } },
    source_node: { freed: false, is_hovered: () => true },
  };
  open.push(tooltip);
  assert.equal(resolve(), 'Butterfly');
  tooltip.source_node.is_hovered = () => false;
  assert.equal(resolve(), '');
  tooltip.source_node.is_hovered = () => true;
  tooltip.hide_requests = 1;
  assert.equal(resolve(), '');
  tooltip.hide_requests = 0;
  tooltip.close_requested = true;
  assert.equal(resolve(), '');
});

test('source-less wiki tooltips must belong to the current store; crafting uses its live selection', () => {
  const { open, menus, resolve } = wikiHarness();
  const tooltip = { is_tooltip: true, hide_requests: 0, item: { prototype: { name: 'Apple' } } };
  open.push(tooltip);
  assert.equal(resolve(), '');
  menus.store = { tooltip };
  assert.equal(resolve(), 'Apple');
  menus.store.hide_requests = 1;
  assert.equal(resolve(), '');
  menus.store.hide_requests = 0;
  menus.store.tooltip = {};
  menus.crafting = { hide_requests: 0, item: { prototype: { name: 'Apple Pie' } } };
  assert.equal(resolve(), 'Apple Pie');
  menus.crafting.hide_requests = 1;
  assert.equal(resolve(), '');
});

class Node {
  constructor() { this.board = new Map(); this.enabled = true; this.alpha = 1; this.children = []; }
  board_get(key) { return this.board.get(key); }
  board_set(key, value) { this.board.set(key, value); return this; }
  set_xy(x, y) { this.x = x; this.y = y; return this; }
  set_size(width, height = width) { this.width = width; this.height = height; return this; }
  set_scale(x, y) { this.scale_x = x; this.scale_y = y; return this; }
  set_color(color) { this.color = color; return this; }
  set_z(z) { this.z = z; return this; }
  get_x() { return this.x ?? 0; }
  get_y() { return this.y ?? 0; }
  get_width() { return this.width ?? 0; }
  get_height() { return this.height ?? 0; }
  set_think_callback(callback, args) { this.think = () => callback(...args); return this; }
  set_render_callback(callback, args) {
    this.renderCallback = callback;
    this.render = (...layout) => callback(...layout, ...args);
    return this;
  }
  set_lut(sprite, index = 1) { this.lut = { sprite, index, enabled: true }; return this; }
  disable_lut() { if (this.lut) this.lut.enabled = false; return this; }
  listen_for_hovers() { return this; }
  set_sprite(sprite) { this.sprite = sprite; return this; }
  set_outline_sprite(sprite) { this.outline = sprite; return this; }
  set_text(text) { this.text = text; return this; }
  set_alpha(alpha) { this.alpha = alpha; return this; }
  enable() { this.enabled = true; return this; }
  disable() { this.enabled = false; return this; }
  get_enabled() { return this.enabled; }
  is_hovered() { return this.hovered ?? false; }
  measure() {}
}

function highlightRendererHarness(h) {
  let rootsCreated = 0;
  const freed = [];
  const markers = [];
  class HighlightNode extends Node {
    set_size(width, height) { Object.assign(this, { width, height }); return this; }
    set_color(color) { this.color = color; return this; }
    set_width(width) { this.width = width; return this; }
    set_height(height) { this.height = height; return this; }
    get_width() { return this.width; }
    get_height() { return this.height; }
    get_y() { return this.y ?? 0; }
    set_sprites_from_key(key) { this.spriteKey = key; return this; }
    set_align(x, y) { this.align = [x, y]; return this; }
    add_text_label(label) { this.label = label; return this; }
    add_hover_outline() { return this; }
    add_to_pilot(pilot) { this.pilot = pilot; return this; }
    set_tap_callback(callback, args) { this.tap = () => callback(...args); return this; }
    set_think_callback(callback, args) { this.think = () => callback(...args); return this; }
    is_unlocked() { return this.unlocked !== false; }
  }
  function reflow(text, width) {
    const capacity = Math.max(1, Math.floor(width / 4));
    return text.split('\n').flatMap(paragraph => {
      const lines = [];
      while (paragraph.length > capacity) {
        const space = paragraph.lastIndexOf(' ', capacity);
        const end = space > 0 ? space : capacity;
        lines.push(paragraph.slice(0, end));
        paragraph = paragraph.slice(end).trimStart();
      }
      lines.push(paragraph);
      return lines;
    }).join('\n');
  }
  Object.assign(h.context, {
    TextAlign: { Left: 0, Center: 1, Right: 2 },
    spr_pixel_nine_slice: 'pixel',
    make_color_rgb: (r, g, b) => [r, g, b],
    font_line_height: () => 12,
    string_width_font: text => text.length * 4,
    ANCHOR: {
      reflow,
      text_height: (text, width, font, lineHeight) => text === '' ? 0
        : reflow(text, width).split('\n').length * lineHeight,
      positional: parent => {
        rootsCreated++;
        return Object.assign(new HighlightNode(), {
          parent, x: 0, y: 0, max_alpha: 1, cache_x: 0, cache_y: 0, cache_alpha: 1,
          cache_is_dirty: false,
        });
      },
      nine_slice: (parent, z) => {
        const node = Object.assign(new HighlightNode(), { parent, z, cache_is_dirty: true });
        if (parent) parent.children.push(node);
        markers.push(node);
        return node;
      },
      free_node: root => { root.freed = true; freed.push(root); },
    },
  });
  const makeBody = text => Object.assign(new Node(), {
    text, display_text: text, width: 120, z: -10, text_align: 0,
    cache_x: 400, cache_y: 250, cache_alpha: 1, max_alpha: 1, cache_is_dirty: false,
    get_font: () => 'standard', get_line_height: () => 13,
    get_text() { return this.text; },
    get_alpha() { return this.alpha; },
    is_unlocked() { return this.unlocked !== false; },
    prevent_spillover(value) { this.disallow_spillover = value; return this; },
    disallow_spillover: true, color: 'native-text', lut_info: { enabled: false },
  });
  return { freed, markers, makeBody, get rootsCreated() { return rootsCreated; } };
}

test('gift highlight nodes sit behind native text, reuse layout, and refresh without leaving old nodes', () => {
  const h = giftTooltipHarness();
  h.npcs[2].gifts_given.add(0);
  const renderer = highlightRendererHarness(h);
  const { freed, markers } = renderer;
  const body = Object.assign(new Node(), {
    display_text: h.describe(''), width: 120, z: -10, text_align: 0,
    cache_x: 400, cache_y: 250, cache_alpha: 0.6, max_alpha: 1, cache_is_dirty: false,
    get_font: () => 'standard',
    get_line_height: () => undefined,
  });
  const update = () => h.context.__MistriaCompanion_update_gift_highlights(body, h.details());
  update();
  assert.equal(markers.length, 1);
  const marker = markers[0];
  assert.equal(marker.parent.parent, body, 'native tooltip owns and frees the overlays');
  assert.deepEqual([marker.x, marker.y, marker.width, marker.height], [67, 13, 22, 10]);
  assert.equal(marker.z, body.z + 0.5, 'background is behind text and above its parent panel');
  assert.equal(marker.alpha, 0.45);
  assert.deepEqual(marker.color, [77, 190, 206]);

  // Anchor only initializes a node's position/alpha when cache_is_dirty is true.
  function computeCache(node) {
    if (node.cache_is_dirty) {
      node.cache_x = node.x + node.parent.cache_x;
      node.cache_y = node.y + node.parent.cache_y;
      node.cache_alpha = node.alpha * node.parent.cache_alpha / node.parent.max_alpha;
      node.cache_is_dirty = false;
      for (const child of node.children) child.cache_is_dirty = true;
    }
    for (const child of node.children) computeCache(child);
  }
  computeCache(marker.parent);
  assert.deepEqual([marker.cache_x, marker.cache_y], [467, 263],
    'a highlight added after the shop tooltip is laid out must use its screen position, not (0, 0)');
  assert.equal(marker.cache_alpha, 0.27, 'inherit the tooltip fade instead of starting fully visible');
  update();
  assert.equal(renderer.rootsCreated, 1, 'unchanged hover does not allocate nodes every frame');

  h.npcs[2].gifts_given.clear();
  update();
  assert.equal(freed.length, 1);
  assert.equal(freed[0].enabled, false, 'hide old highlights immediately while native deletion is pending');
  assert.equal(markers.length, 1, 'clearing history removes the old marker without a replacement');
  h.npcs[0].gifts_given.add(0);
  body.cache_alpha = 0;
  update();
  assert.equal(markers.length, 2);
  assert.equal(markers[1].width, 22);
  computeCache(markers[1].parent);
  assert.equal(markers[1].cache_alpha, 0, 'new highlights inherit a hidden tooltip, not default alpha 1');
  body.cache_x = 460;
  body.cache_y = 280;
  body.cache_alpha = 0.6;
  markers[1].parent.cache_is_dirty = true;
  computeCache(markers[1].parent);
  assert.deepEqual([markers[1].cache_x, markers[1].cache_y], [499, 281],
    'native parent invalidation keeps highlights attached after tooltip movement');
  assert.equal(markers[1].cache_alpha, 0.27);
  body.display_text = 'Liked by: Balor\nLoved by: March,\nOlric';
  body.get_line_height = () => 16;
  h.npcs[2].gifts_given.add(0);
  update();
  assert.equal(markers.at(-1).y, 33);
  body.text_align = 1;
  update();
  assert.equal(markers.at(-1).x, 49, 'centered text uses each wrapped line width');
  body.text_align = 2;
  update();
  assert.equal(markers.at(-1).x, -21, 'right-aligned text ends at the native text origin');
});

test('highlight updates visit visible item tooltips only and preserve native text', () => {
  const h = giftTooltipHarness();
  const body = Object.assign(new Node(), { text: h.describe(), display_text: h.describe() });
  const tooltip = { is_tooltip: true, body_text: body, item: h.item };
  const open = [
    { ...tooltip, close_requested: true }, { ...tooltip, free_requested: true },
    { ...tooltip, hide_requests: 1 }, { ...tooltip, is_tooltip: false },
    { ...tooltip, item: undefined }, { ...tooltip, body_text: undefined },
    { ...tooltip, body_text: { freed: true } }, tooltip,
  ];
  const updates = [];
  h.context.ANCHOR = { open_menus: { count: () => open.length, get: index => open[index] } };
  h.context.__MistriaCompanion_update_gift_highlights = (node, details) => updates.push({ node, details });
  const before = body.text;
  h.context.MistriaCompanion_update_gift_tooltips();
  assert.equal(updates.length, 1);
  assert.equal(updates[0].node, body);
  assert.equal(updates[0].details.loved, 'March, Olric');
  assert.equal(body.text, before);
});

test('switching between normal and universal gifts removes obsolete NPC-name highlights', () => {
  const h = giftTooltipHarness();
  const renderer = highlightRendererHarness(h);
  h.npcs[2].gifts_given.add(0);
  const body = renderer.makeBody(h.describe());
  const update = () => h.context.__MistriaCompanion_update_gift_highlights(body, h.details());
  update();
  const old = body.board_get('mistria_item_details_gift_highlights').root;
  assert.equal(old.children.length, 1);
  h.context.global.__item_data.push({ recipe_key: 'cow_donut' });
  h.item.item_id = 1;
  h.item.infusion = h.Infusion.Loveable;
  body.text = h.describe();
  body.display_text = body.text;
  update();
  assert.equal(old.enabled, false);
  assert.equal(old.freed, true);
  assert.equal(body.board_get('mistria_item_details_gift_highlights').root.children.length, 0);
  h.item.item_id = 0;
  h.item.infusion = 0;
  body.text = h.describe();
  body.display_text = body.text;
  update();
  assert.equal(body.board_get('mistria_item_details_gift_highlights').root.children.length, 1);
});

function cookingHighlightHarness() {
  const h = giftTooltipHarness();
  const renderer = highlightRendererHarness(h);
  h.context.font_line_height = () => 13;
  h.context.global.__item_data.push({ recipe_key: 'second_dish' });
  h.npcs[0].prototype.loved_gifts = list([1]);
  const anotherDish = { ...h.item, item_id: 1 };
  const description = renderer.makeBody('');
  const descriptionWrites = [];
  const nativeSetText = description.set_text.bind(description);
  description.set_text = text => {
    descriptionWrites.push(text);
    description.display_text = text;
    return nativeSetText(text);
  };
  description.parent = Object.assign(new Node(), {
    width: 175, height: 39,
    get_width() { return this.width; }, get_height() { return this.height; },
  });
  const menu = {
    type: 'crafting', context: 'cooking', item: h.item, description,
    quantity: 3, hide_requests: 0, close_requested: false, free_requested: false, bottom_pilot: {},
  };
  const open = [menu];
  h.context.ANCHOR.open_menus = { count: () => open.length, get: index => open[index] };
  h.context.ANCHOR.wrap_for_local = text => text;
  const screen = { x: 480, y: 270 };
  h.context.ANCHOR.get_true_size = () => screen;
  let activePilot = menu.bottom_pilot;
  h.context.ANCHOR.get_active_pilot = () => activePilot;
  h.context.INPUT = { gp_right_stick: { y: 0 } };
  h.context.Align = { RightOut: 'right-out', TopIn: 'top-in' };
  h.context.COMMON_LUT = 1;
  h.context.CommonLutIndex = { Dark: 1 };
  h.context.__MistriaCompanion_fit_node = () => {};
  h.context.__MistriaCompanion_name = prototype => prototype.name ?? 'Selected dish';
  const popupNode = (width, height) => h.context.ANCHOR.nine_slice(undefined, -10).set_size(width, height);
  function textNode(text, parent) {
    return Object.assign(renderer.makeBody(text), {
      parent, set_max_width(width) { this.maxWidth = width; return this; },
      allow_line_breaks() { return this; },
      measure() {
        const width = this.maxWidth ?? parent.width - 8;
        this.display_text = h.context.ANCHOR.reflow(this.text, width);
        this.width = width;
        this.height = this.display_text.split('\n').length * 13;
        return { x: this.width, y: this.height };
      },
    });
  }
  h.context.ANCHOR.text = parent => textNode('', parent);
  h.context.popup_creator = () => {
    const popup = { type: 'popup', backplate: popupNode(180, 0), pilot: {}, hide_requests: 0,
      close_requested: false, free_requested: false };
    popup.add_title = text => {
      popup.title = text;
      popup.header = popupNode(popup.backplate.width - 30, 17).set_xy(0, 8);
    };
    popup.refresh_backplate_height = () => {
      popup.backplate.height = 50 + popup.header.height + popup.header.y + popup.body.height;
    };
    popup.add_description = text => {
      popup.body = popupNode(popup.backplate.width - 20, 0);
      popup.body_text = textNode(text, popup.body);
      popup.body.height = popup.body_text.measure().y + 12;
      popup.refresh_backplate_height();
    };
    popup.create_button = label => { popup.closeLabel = label; };
    popup.spawn = () => {
      open.push(popup);
      activePilot = popup.pilot;
      description.unlocked = false;
    };
    popup.close = () => {
      popup.close_requested = true;
      activePilot = menu.bottom_pilot;
      description.unlocked = true;
    };
    return popup;
  };
  h.context.create_scroller = root => ({
    new_element: height => popupNode(root.width, height),
    add_height_to_element: (node, height) => { node.height += height; },
    scroll_by_amount(amount) { this.scroll = (this.scroll ?? 0) + amount; },
  });
  function select(item, base = 'A finished dish.') {
    menu.item = item;
    description.enable();
    description.set_text(h.context.MistriaCompanion_description(base, { item }) ?? base);
  }
  const update = () => h.context.MistriaCompanion_update_gift_tooltips();
  const state = () => description.board_get('mistria_item_details_cooking');
  select(h.item);
  const show = () => h.context.MistriaCompanion_show_cooking_gifts(menu);
  return { ...h, renderer, description, descriptionWrites, menu, open, anotherDish, select, update, state, show, screen };
}

test('cooking preserves the native description and opens full highlighted gift details without ingredients', () => {
  const h = cookingHighlightHarness();
  h.npcs[2].gifts_given.add(0);
  h.npcs[0].known_gift_preferences.add(0);
  h.select(h.item);
  const text = h.description.text;
  h.update();
  const node = h.state().button;
  assert.equal(node.parent, h.description.parent);
  assert.equal(node.label, 'Gifts');
  assert.equal(node.pilot, h.menu.bottom_pilot);
  assert.deepEqual(node.align, ['right-out', 'top-in'], 'button sits outside the description instead of obscuring it');
  assert.equal(h.description.alpha, 1);
  assert.equal(h.description.text, 'A finished dish.', 'do not shorten, hide, or scale the native description');
  assert.equal(h.state().source_text, text);
  assert.equal(h.menu.quantity, 3, 'do not change cooking quantity');
  assert.equal(h.context.ARI, undefined, 'no inventory or ingredient access is required');
  assert.equal(h.npcs[0].gifts_given.size, 0);
  h.update();
  assert.equal(h.state().button, node, 'reuse the native button while the selection is unchanged');
  node.tap();
  const popup = h.menu.mistria_gift_popup;
  assert.equal(popup.item, h.item);
  assert.match(popup.body_text.text, /Liked by: Balor\nLoved by: March, Olric$/);
  assert.doesNotMatch(popup.body_text.text, /Seridia|Wheedle/);
  assert.equal(popup.closeLabel, 'misc_local/close');
  h.update();
  const highlight = popup.body_text.board_get('mistria_item_details_gift_highlights');
  assert.equal(highlight.root.children.length, 1);
  assert.equal(highlight.root.parent, popup.body_text, 'reuse native item-tooltip highlight rendering');
  assert.ok(popup.backplate.height <= h.screen.y - 16);
});

test('cooking quantity refreshes never write companion extras to the visible description, even before a mod tick', () => {
  const h = cookingHighlightHarness();
  h.runtime.recipe_cache['0'] = 'Another recipe';
  h.select(h.item);
  h.update();
  const setter = h.description.set_text;
  h.descriptionWrites.length = 0;
  for (const quantity of [4, 5, 38, 37, 999, 1]) {
    h.menu.quantity = quantity;
    const full = h.context.MistriaCompanion_description('This tea has a vegetal flavor.', { item: h.item });
    assert.match(full, /Uses: Another recipe/);
    assert.match(full, /Liked by:/, 'ordinary tooltips must still receive completion details');
    assert.equal(h.description.set_text(full), h.description);
    assert.equal(h.description.text, 'This tea has a vegetal flavor.', 'strip at assignment, not on the next tick');
    assert.equal(h.description.display_text, 'This tea has a vegetal flavor.');
    assert.equal(h.state().source_text, full);
  }
  assert.ok(h.descriptionWrites.every(text => text === 'This tea has a vegetal flavor.'));
  h.update();
  assert.equal(h.description.set_text, setter, 'never nest a second wrapper on a later tick');
  h.show();
  assert.match(h.menu.mistria_gift_popup.body_text.text, /Liked by: Balor/);
  h.menu.mistria_gift_popup.close();
  h.menu.context = 'crafting';
  h.update();
  assert.notEqual(h.description.set_text, setter, 'restore the native setter when leaving cooking');
  h.description.set_text('Unrelated station description');
  assert.equal(h.description.text, 'Unrelated station description');
});

test('cooking highlights follow live mouse/controller recipe selection, not ingredient tooltips', () => {
  const h = cookingHighlightHarness();
  h.npcs[2].gifts_given.add(0);
  h.npcs[0].gifts_given.add(1);
  h.update();
  const oldNode = h.state().button;
  // Both native mouse taps and controller selection call set_to_item with the new recipe.
  h.select(h.anotherDish);
  const ingredientBody = h.renderer.makeBody(h.context.MistriaCompanion_description('', { item: h.item }));
  h.open.push({ is_tooltip: true, body_text: ingredientBody, item: h.item });
  h.update();
  assert.equal(h.state().button, oldNode);
  assert.equal(oldNode.freed, undefined);
  assert.equal(h.description.text, 'A finished dish.');
  assert.equal(h.state().item, h.anotherDish);
  const ingredient = ingredientBody.board_get('mistria_item_details_gift_highlights');
  assert.equal(ingredient.root.children.length, 1, 'ingredient tooltip still has its own independent highlight');
  h.show();
  const popup = h.menu.mistria_gift_popup;
  assert.equal(popup.item, h.anotherDish);
  assert.match(popup.body_text.text, /Loved by: Balor$/);
  h.update();
  assert.equal(popup.body_text.board_get('mistria_item_details_gift_highlights').root.children.length, 1);
  popup.close();
  h.select(h.item);
  h.update();
  assert.equal(h.menu.item, h.item);
  h.show();
  assert.equal(h.menu.mistria_gift_popup.item, h.item);
});

test('cooking recipe highlights clear on empty selection, hidden or closed panels, and non-cooking stations', () => {
  for (const invalidate of [
    h => { h.menu.item = undefined; }, // Native reset_right_page, including locked recipes.
    h => { h.description.disable(); },
    h => { h.description.marked_for_death = true; },
    h => { h.menu.hide_requests = 1; },
    h => { h.menu.close_requested = true; },
    h => { h.menu.free_requested = true; },
    h => { h.menu.context = 'blacksmithing'; },
    h => { h.menu.context = undefined; },
    h => { h.menu.item = { ...h.item, item_id: 999 }; },
  ]) {
    const h = cookingHighlightHarness();
    h.npcs[2].gifts_given.add(0);
    h.update();
    const root = h.state().button;
    invalidate(h);
    h.update();
    assert.equal(root.enabled, false);
    const fading = h.menu.hide_requests > 0 || h.menu.close_requested || h.menu.free_requested
      || h.description.marked_for_death;
    if (fading) {
      assert.equal(h.description.text, 'A finished dish.', 'keep the original description throughout the closing fade');
      assert.equal(h.state().button, root);
    } else {
      assert.equal(h.state(), undefined, 'clear the cached signature along with the old root');
      assert.equal(root.freed, true);
      assert.equal(h.description.alpha, 1);
      assert.equal(h.description.disallow_spillover, true);
    }
    h.update();
    assert.equal(h.renderer.freed.length, fading ? 0 : 1, 'do not free the same overlay twice');
    Object.assign(h.menu, { context: 'cooking', item: h.item, hide_requests: 0,
      close_requested: false, free_requested: false });
    h.description.marked_for_death = false;
    h.description.enable();
    h.update();
    assert.equal(h.state().button.enabled, true);
    if (!fading) assert.notEqual(h.state().button, root);
  }
});

test('cooking updater ignores uninitialized or freed descriptions and unrelated recipe panels', () => {
  const h = cookingHighlightHarness();
  for (const [key, value] of [
    ['description', undefined], ['description', { freed: true }],
    ['type', 'journal'], ['context', 'woodcrafting'],
  ]) {
    const before = h.menu[key];
    h.menu[key] = value;
    h.update();
    assert.equal(h.renderer.rootsCreated, 0);
    h.menu[key] = before;
  }
  h.context.__MistriaCompanion_clear_gift_highlights(undefined);
  h.context.__MistriaCompanion_clear_gift_highlights({ freed: true });
});

test('cooking gift highlights stay item-specific and refresh after history, infusion, and localized text changes', () => {
  const h = cookingHighlightHarness();
  h.npcs[2].gifts_given.add(1);
  h.update();
  h.show();
  h.update();
  assert.equal(h.menu.mistria_gift_popup.body_text.board_get('mistria_item_details_gift_highlights').root.children.length,
    0, 'giving a different dish does not mark this recipe');
  h.menu.mistria_gift_popup.close();
  h.npcs[2].gifts_given.add(0);
  h.update();
  h.show();
  h.update();
  assert.equal(h.menu.mistria_gift_popup.body_text.board_get('mistria_item_details_gift_highlights').root.children.length, 1);
  h.menu.mistria_gift_popup.close();
  h.item.infusion = h.Infusion.Loveable;
  h.npcs[0].gifts_given.add(0);
  h.npcs[2].prototype.name = '名 前';
  h.select(h.item, 'Localized dish description.');
  h.description.display_text = 'Localized dish description.\nLoved by: Balor, March, 名\n前';
  h.update();
  h.show();
  assert.match(h.menu.mistria_gift_popup.body_text.text, /Liked by: Balor\nLoved by: March, 名 前$/);
  h.update();
  assert.equal(h.menu.mistria_gift_popup.body_text.board_get('mistria_item_details_gift_highlights').root.children.length,
    2, 'Likeable/Loveable popup retains per-item completion highlights');
  h.menu.mistria_gift_popup.close();
  assert.doesNotMatch(h.description.text, /Seridia|Wheedle/);
  const gifts = h.npcs.map(npc => Array.from(npc.gifts_given));
  h.menu.quantity = 5;
  h.select(h.item);
  h.update();
  assert.deepEqual(h.npcs.map(npc => Array.from(npc.gifts_given)), gifts,
    'refreshing the cooking preview never records gifts');
  h.context.MistriaCompanion_reset_save({});
  h.npcs[0].gifts_given.clear();
  h.npcs[2].gifts_given.clear();
  h.select(h.item);
  h.update();
  h.item.infusion = 0;
  h.select(h.item);
  h.update();
  h.show();
  h.update();
  assert.equal(h.menu.mistria_gift_popup.body_text.board_get('mistria_item_details_gift_highlights').root.children.length,
    0, 'use gift history from the current save');
});

test('farm-sized text popups add a scrollbar only when the compact content actually overflows', () => {
  const text = 'Farm\nEmpty tilled spots: 0\nReady to harvest: 0\nPlanted, not ready: 504\nUnwatered crops: 0'
    + '\n\nGreenhouse\nEmpty tilled spots: 1\nReady to harvest: 0\nPlanted, not ready: 24\nUnwatered crops: 0';
  for (const screenHeight of [270, 240, 239]) {
    const h = cookingHighlightHarness();
    h.screen.y = screenHeight;
    const popup = h.context.__MistriaCompanion_text_popup('Farm status', text);
    assert.equal(popup.body_text.text, text);
    assert.ok(popup.backplate.height <= screenHeight - 16);
    assert.equal(!!popup.mistria_text_scroller, screenHeight < 240);
    if (!popup.mistria_text_scroller) {
      assert.ok(popup.body_text.measure().y + 6 <= popup.body.height,
        'all lines fit with padding, including the exact-fit boundary');
    }
  }
});

test('compact text popups still scroll when narrow-screen wrapping overflows', () => {
  const h = cookingHighlightHarness();
  h.screen.x = 180;
  h.screen.y = 240;
  const text = 'A long localized crop status line '.repeat(80);
  const popup = h.context.__MistriaCompanion_text_popup('Farm status', text);
  assert.equal(popup.body_text.text, text);
  assert.ok(popup.mistria_text_scroller);
  assert.ok(popup.backplate.height <= h.screen.y - 16);
});

test('native cooking gift popup preserves full dish descriptions and all long gift names', () => {
  const h = cookingHighlightHarness();
  const threeLines = 'A complete dish description.\nA second descriptive line.\nA third descriptive line.';
  const longName = 'A long localized villager name '.repeat(30).trim();
  h.npcs[2].prototype.name = longName;
  h.select(h.item, threeLines);
  h.update();
  assert.equal(h.description.text, threeLines, 'leave description rendering to the game with no truncation');
  assert.equal(h.description.alpha, 1);
  h.show();
  const popup = h.menu.mistria_gift_popup;
  assert.ok(popup.body_text.text.includes(longName), 'a long gift name is not ellipsized or discarded');
  assert.ok(popup.mistria_text_scroller);
  assert.ok(popup.backplate.height <= h.screen.y - 16);
  h.context.INPUT.gp_right_stick.y = 0.5;
  h.context.MistriaCompanion_text_popup_scroll(popup);
  assert.equal(popup.mistria_text_scroller.scroll, 2);
  popup.close();
  h.context.MistriaCompanion_text_popup_scroll(popup);
  assert.equal(popup.mistria_text_scroller.scroll, 2);
});

test('universal gift suppression checks all eligible NPCs, not only met NPCs, and preserves dish description', () => {
  const h = cookingHighlightHarness();
  const universal = h.context.__MistriaCompanion_universal_gift_text;
  assert.equal(universal(h.item), '', 'all met villagers like this but an unmet villager does not');
  h.update();
  assert.match(h.context.__MistriaCompanion_cooking_gift_text(h.item, h.details()), /Liked by:|Loved by:/);
  const baseline = h.context.global.__npc_prototypes;
  h.context.global.__npc_prototypes = baseline.slice(0, -1);
  assert.equal(universal(h.item), 'Liked by: Everyone', 'mixed liked/loved counts when everybody eligible has a positive preference');
  h.select(h.item, 'Everybody likes this dish.');
  h.update();
  assert.equal(h.description.text, 'Everybody likes this dish.');
  h.show();
  assert.equal(h.menu.mistria_gift_popup.body_text.text, 'Liked by: Everyone');
  h.context.global.__npc_prototypes = baseline;
  for (const infusion of [h.Infusion.Likeable, h.Infusion.Loveable]) {
    h.item.infusion = infusion;
    assert.equal(universal(h.item), infusion === h.Infusion.Loveable ? 'Loved by: Everyone' : 'Liked by: Everyone');
  }
  h.item.item_id = 100; // Void Newt exceptions still take precedence over universal infusions.
  assert.equal(universal(h.item), '');
  h.item.prototype.giftable = false;
  assert.equal(universal(h.item), '', 'no eligible recipients is not everyone');
  h.context.global.__npc_prototypes = [];
  assert.equal(universal(h.item), '');
});

test('cooking strips only the exact companion suffix, never words from the original description', () => {
  const h = cookingHighlightHarness();
  const details = h.details();
  details.recipes = 'Soup';
  const extra = h.context.__MistriaCompanion_details_text(details);
  const strip = h.context.__MistriaCompanion_cooking_base_text;
  assert.equal(strip(`Loved by: is part of this description.\n${extra}`, details),
    'Loved by: is part of this description.');
  assert.equal(strip(extra, details), '');
  const warnings = [];
  h.context.mmapi_warn_rate_limited = (...args) => warnings.push(args);
  assert.equal(strip('Another mod rewrote this text.', details), 'Another mod rewrote this text.');
  assert.equal(warnings.length, 1);
});

test('cooking popup uses native UI only and prevents duplicate or stale activations', () => {
  const h = cookingHighlightHarness();
  h.update();
  h.show();
  const popup = h.menu.mistria_gift_popup;
  h.show();
  assert.equal(h.open.length, 2, 'do not stack another popup while the first is active');
  popup.close();
  h.menu.item = undefined;
  h.show();
  assert.equal(h.open.length, 2, 'an old callback cannot open details for a cleared recipe');
  h.menu.item = h.item;
  h.menu.hide_requests = 1;
  h.show();
  assert.equal(h.open.length, 2);
  const mistStart = source.indexOf('function MistriaCompanion_mist_marker_draw(');
  const mistEnd = source.indexOf('\nfunction MistriaCompanion_refresh_map_markers(', mistStart);
  assert.ok(mistStart >= 0 && mistEnd > mistStart);
  const outsideMist = source.slice(0, mistStart) + source.slice(mistEnd);
  assert.doesNotMatch(outsideMist, /\b(?:gpu_\w+|draw_camera_\w+|draw_text_with_color|draw_get_\w+)\s*\(/);
  assert.doesNotMatch(outsideMist, /ANCHOR\.custom\s*\(/, 'only the sprite-only Mist Spot renderer uses a custom node');
});

test('cooking popup explains when no met villagers like the selected dish and does not mark gifts given', () => {
  const h = cookingHighlightHarness();
  h.item.prototype.giftable = false;
  h.select(h.item);
  h.update();
  const before = h.npcs.map(npc => Array.from(npc.gifts_given));
  h.show();
  assert.equal(h.menu.mistria_gift_popup.body_text.text, 'No met villagers have this dish in their liked/loved lists.');
  assert.deepEqual(h.npcs.map(npc => Array.from(npc.gifts_given)), before);
  assert.equal(h.menu.quantity, 3);
});

function museumHarness(wing = 0) {
  class MuseumNode extends Node {
    constructor(parent, options = {}) {
      super();
      Object.assign(this, { parent, x: 0, y: 0, width: 16, height: 16, unlocked: true }, options);
      if (parent) parent.children.push(this);
    }
    get_enabled() { return this.enabled && (!this.parent || this.parent.get_enabled()); }
    is_unlocked() { return this.unlocked && this.get_enabled() && (!this.parent || this.parent.is_unlocked()); }
    get_size() { return { x: this.width, y: this.height }; }
    get_width() { return this.width; }
    get_height() { return this.height; }
    set_size(width, height) { Object.assign(this, { width, height }); return this; }
    set_z(z) { this.z = z; return this; }
    set_max_width(maxWidth) { this.maxWidth = maxWidth; return this; }
    set_ghost_key(key) { this.ghostKey = key; return this; }
    allow_line_breaks() { return this; }
    add_x(x) { this.x += x; return this; }
    add_y(y) { this.y += y; return this; }
    measure() {
      this.width = Math.min(this.maxWidth, this.text.length * 4);
      this.height = Math.max(1, Math.ceil(this.text.length * 4 / this.maxWidth)) * 10;
    }
  }
  const runtime = { wiki_title: '', bindings: { wiki: 'F7' } };
  const names = [
    ['Rubber Fish', 'Rusted Shield', 'Fossilized Mandrake Root', 'Porcelain Figure', 'Worn Pendant'],
    ['Carp', 'Catfish', 'Perch', 'Pike'],
    ['Daffodil', 'Lilac', 'Tulip', 'Wild Leek'],
    ['Butterfly', 'Cicada', 'Firefly', 'Ladybug'],
  ][wing];
  const prototypes = names.map((name, id) => ({ name, name_key: `items/artifacts/item_${id}/name`, icon: 100 + id }));
  const progress = names.map(() => false);
  const collection = { items: names.map((_, i) => names.length - i - 1) };
  const screen = new MuseumNode(undefined, { width: 400, height: 300 });
  const canvas = new MuseumNode(screen, { width: 400, height: 300 });
  canvas.board_set('selected_wing', wing);
  const rightPage = new MuseumNode(canvas, { width: 400, height: 300 });
  const body = new MuseumNode(rightPage, { x: 200, y: 50, width: 158, height: 177 });
  const scroller = new MuseumNode(body, { width: 140, height: 177 });
  const row = new MuseumNode(scroller, { width: 140, height: 43, hovered: true, canvas: scroller });
  row.event_callbacks = { tap: { arg_array: [collection, 'test-set'] } };
  row.pilot = {};
  new MuseumNode(row, { type: 1 });
  const sorted = collection.items.slice().sort((a, b) => names[a].localeCompare(names[b]));
  const icons = sorted.map((id, i) => new MuseumNode(row, { type: 3, sprite: prototypes[id].icon, x: 6 + i * 20, y: 18 }));
  new MuseumNode(row, { type: 3, sprite: 999, x: 120, y: 18 });
  const menu = { canvas, right_page: rightPage, right_body: body, set_pilot: row.pilot, hide_requests: 0 };
  const menus = { museum: menu };
  const warnings = [];
  const clipboard = [];
  const open = [];
  let sortedCount = 0;
  const position = node => {
    const parent = node.parent ? position(node.parent) : { x: 0, y: 0 };
    return { x: parent.x + node.x, y: parent.y + node.y };
  };
  const anchor = {
    screen_canvas: screen,
    current_hovered_node: row,
    pointControl: true,
    in_point_control() { return this.pointControl; },
    open_menus: { count: () => open.length, get: i => open[i] },
    get_screen_position: position,
    point_in_node(node, x, y) {
      const p = position(node);
      return x >= p.x && x < p.x + node.width && y >= p.y && y < p.y + node.height;
    },
    nine_slice: parent => new MuseumNode(parent),
    text: parent => new MuseumNode(parent),
    free_node: node => { node.freed = true; node.enabled = false; },
  };
  const context = load([
    ...['copy_array', 'museum_warning', 'museum_wiki_title', 'museum_slots', 'museum_target',
      'update_museum_label', 'fit_node', 'set_wiki_title', 'resolve_wiki_title'].map(privateName),
    ...['capture_museum_wing_context', 'open_wiki', 'toggle_wiki_hints', 'reset_save'].map(publicName),
  ], {
    ANCHOR: anchor,
    Menu: { Museum: 'museum', Map: 'map', Store: 'store', Crafting: 'crafting' },
    MuseumWing: { Archaeology: 0, Fish: 1, Flora: 2, Insect: 3 },
    NodeId: { Sprite: 3 },
    MUSEUM_DATA: { data: Array.from({ length: 4 }, () => ({ sets: { get: key => key === 'test-set' ? collection : undefined } })) },
    MUSEUM_PROGRESS: progress,
    ITEM_PROTOTYPES: prototypes,
    COMMON_LUT: 0,
    CommonLutIndex: { Header: 1 },
    spr_ui_tooltip_header_box: 'header-only',
    spr_ui_tooltip_box: 'complete-tooltip-box',
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_ready: () => true,
    __MistriaCompanion_menu: kind => {
      const value = menus[kind];
      return value?.close_requested || value?.free_requested ? undefined : value;
    },
    __MistriaCompanion_name: prototype => prototype.name,
    local_language: () => 'eng',
    local_get: key => names[prototypes.findIndex(prototype => prototype.name_key === key)],
    __MistriaCompanion_notify: () => {},
    MistriaCompanion_capture_npc_context: () => {},
    MistriaCompanion_capture_quest_item_context: () => {},
    mmapi_warn_rate_limited: (...args) => warnings.push(args),
    string_replace_all: (text, from, to) => text.replaceAll(from, to),
    clipboard_set_text: text => clipboard.push(text),
    List: () => {
      const values = [];
      return {
        push: value => values.push(value), count: () => values.length, get: i => values[i],
        sort_with: compare => { sortedCount++; values.sort(compare); },
      };
    },
    LiveItem: function(id) {
      this.item_id = id;
      this.prototype = prototypes[id];
      this.get_display_name = () => this.prototype.name;
      this.get_ui_icon = () => this.prototype.icon;
    },
    string_alphanumeric_comparison: (a, b) => a.localeCompare(b),
  });
  const hover = index => {
    const p = position(icons[index]);
    context.MOUSE_GUI_X = p.x + 2;
    context.MOUSE_GUI_Y = p.y + 2;
    anchor.current_hovered_node = row;
  };
  hover(0);
  return {
    context, runtime, collection, prototypes, progress, names, sorted, icons, row, canvas, screen,
    menu, menus, anchor, clipboard, warnings, open, hover, sortedCount: () => sortedCount,
    target: context.__MistriaCompanion_museum_target,
    resolve: context.__MistriaCompanion_resolve_wiki_title,
  };
}

test('museum missing slots in every wing use native sorted item identities and item wiki URLs', () => {
  for (let wing = 0; wing < 4; wing++) {
    const h = museumHarness(wing);
    for (let i = 0; i < h.icons.length; i++) {
      h.hover(i);
      const expected = h.names[h.sorted[i]];
      assert.equal(h.resolve(), expected);
      assert.equal(h.runtime.museum_label.board_get('name').text, expected);
      assert.equal(h.runtime.museum_label.sprite, 'complete-tooltip-box',
        'standalone name labels need all four borders, not the open-bottom tooltip header');
      const label = h.runtime.museum_label.board_get('name');
      assert.equal(h.runtime.museum_label.width, label.width + 8);
      assert.equal(h.runtime.museum_label.height, label.height + 8,
        'the name retains padding above and below the full border');
      assert.equal(h.target().donated, false);
      h.context.MistriaCompanion_open_wiki();
      assert.equal(h.clipboard.at(-1), `https://fieldsofmistria.wiki.gg/wiki/${expected.replaceAll(' ', '_')}`);
    }
    assert.equal(h.sortedCount(), 1, 'a stable row is sorted only once');
    assert.equal(h.canvas.children.length, 2, 'only one non-interactive overlay is added');
    assert.equal(h.warnings.length, 0);
    assert.deepEqual(h.progress, h.names.map(() => false));
  }
});

test('museum blank space retains wing fallback and changing the live item needs no tick', () => {
  for (const [wing, title] of ['Archaeology Wing', 'Fish Wing', 'Flora Wing', 'Insects Wing'].entries()) {
    const h = museumHarness(wing);
    h.resolve();
    h.context.MOUSE_GUI_Y = 55;
    assert.equal(h.resolve(), title);
    assert.equal(h.runtime.museum_label.enabled, false);
    h.hover(3);
    h.context.MistriaCompanion_open_wiki();
    assert.equal(h.clipboard[0], `https://fieldsofmistria.wiki.gg/wiki/${h.names[h.sorted[3]].replaceAll(' ', '_')}`);
    h.anchor.pointControl = false;
    assert.equal(h.target(), undefined, 'directional set selection does not target the stationary mouse');
  }
});

test('museum native tooltips take priority; donations remove only the extra missing-name label', () => {
  const h = museumHarness();
  h.resolve();
  const plate = h.runtime.museum_label;
  h.progress[h.sorted[0]] = true;
  assert.equal(h.resolve(), h.names[h.sorted[0]]);
  assert.equal(plate.enabled, false);
  h.progress[h.sorted[0]] = false;
  h.open.push({ is_tooltip: true, hide_requests: 0, source_node: h.row, item: { prototype: { name: 'Native tooltip' } } });
  assert.equal(h.resolve(), 'Native tooltip');
  assert.equal(plate.enabled, false);
  assert.equal(h.open.length, 1, 'no native menu is added or replaced');
});

test('museum hidden, locked, freed, occluded, scrolled-out and closed targets cannot retain item links', () => {
  const cases = [
    h => { h.menu.hide_requests = 1; },
    h => { h.menu.close_requested = true; },
    h => { h.menu.free_requested = true; },
    h => { h.menu.right_page.enabled = false; },
    h => { h.canvas.unlocked = false; },
    h => { h.row.freed = true; },
    h => { h.row.marked_for_death = true; },
    h => { h.row.hovered = false; },
    h => { h.icons[0].enabled = false; },
    h => { h.icons[0].freed = true; },
    h => { h.icons[0].marked_for_death = true; },
    h => { h.row.y = -25; h.hover(0); },
    h => { h.anchor.current_hovered_node = {}; },
    h => { h.menu.set_pilot = {}; },
    h => { h.context.MUSEUM_DATA.data[0].sets.get = () => undefined; },
  ];
  for (const change of cases) {
    const h = museumHarness();
    h.resolve();
    const plate = h.runtime.museum_label;
    change(h);
    assert.equal(h.target(), undefined);
    assert.notEqual(h.resolve(), h.names[h.sorted[0]]);
    assert.equal(plate.enabled, false);
  }
});

test('museum slot replacement invalidates associations, and save reset frees the overlay', () => {
  const h = museumHarness();
  h.resolve();
  const old = h.icons[0];
  const replacement = Object.assign(Object.create(Object.getPrototypeOf(old)), old, { board: new Map() });
  h.row.children[h.row.children.indexOf(old)] = replacement;
  old.freed = true;
  assert.equal(h.target().node, replacement);
  assert.equal(h.sortedCount(), 2);
  const plate = h.runtime.museum_label;
  h.context.MistriaCompanion_reset_save({});
  assert.equal(plate.freed, true);
  assert.equal(h.runtime.museum_label, undefined);
});

test('museum malformed collection metadata, item IDs, progress and sprites do not guess identities', () => {
  for (const change of [
    h => { h.row.event_callbacks = {}; },
    h => { h.collection.items = [999]; },
    h => { h.collection.items = [-1]; },
    h => { h.collection.items = [0.5]; },
    h => { h.collection.items = ['0']; },
    h => { h.collection.items = undefined; },
    h => { h.row.children = []; },
    h => { h.row.children[1].sprite = 900; },
    h => { h.context.MUSEUM_PROGRESS = []; },
    h => { h.progress[h.sorted[0]] = undefined; },
    h => { h.progress[h.sorted[0]] = 'unknown'; },
  ]) {
    const h = museumHarness();
    change(h);
    assert.equal(h.target(), undefined);
    assert.equal(h.resolve(), 'Archaeology Wing');
    assert.ok(h.warnings.length > 0);
    assert.ok(h.warnings.every(args => args[0] === 'mistria_item_details:museum_slots'));
  }
});

test('museum localized and long names refresh without reordering live slots or escaping screen bounds', () => {
  const h = museumHarness();
  h.resolve();
  h.prototypes[h.sorted[0]].name = 'A very long localized artifact name '.repeat(3);
  h.context.local_language = () => 'jpn';
  h.screen.width = 320;
  h.screen.height = 200;
  h.canvas.y = 50;
  h.hover(0);
  assert.equal(h.resolve(), 'Archaeology Wing', 'localized names must not become invalid English wiki slugs');
  const plate = h.runtime.museum_label;
  assert.equal(plate.board_get('name').text, h.prototypes[h.sorted[0]].name);
  assert.equal(h.sortedCount(), 1, 'language changes do not change the IDs of already drawn icons');
  const p = h.anchor.get_screen_position(plate);
  assert.ok(p.x >= 4 && p.y >= 4);
  assert.ok(p.x + plate.width <= h.screen.width - 4);
  assert.ok(p.y + plate.height <= h.screen.height - 4);
  h.canvas.x = -100;
  h.hover(0);
  h.resolve();
  assert.ok(h.anchor.get_screen_position(plate).x >= 4, 'same-size moving labels are reclamped');
});

test('museum wiki title lookup uses English names only and never changes the active language', () => {
  const h = museumHarness();
  h.context.local_set_language = () => assert.fail('Museum lookup must not change the game language');
  assert.equal(h.resolve(), h.names[h.sorted[0]]);
  h.context.local_language = () => 'jpn';
  assert.equal(h.resolve(), 'Archaeology Wing');
  assert.ok(h.warnings.some(args => args[0] === 'mistria_item_details:museum_wiki_language'));
  h.context.local_language = () => 'eng';
  for (const value of [undefined, '', 'MISSING', 'PLACEHOLDER', h.prototypes[h.sorted[0]].name_key]) {
    h.context.local_get = () => value;
    assert.equal(h.resolve(), 'Archaeology Wing');
  }
  assert.ok(h.warnings.some(args => args[0] === 'mistria_item_details:museum_wiki_name'));
});

test('museum wiki hints can be disabled without hiding names or changing registered bindings', () => {
  const h = museumHarness();
  h.context.__MistriaCompanion_save_preferences = () => true;
  h.runtime.wiki_hints_enabled = true;
  h.runtime.bindings.wiki = 'SHIFT+F7';
  h.context.MistriaCompanion_toggle_wiki_hints();
  h.context.MistriaCompanion_open_wiki();
  assert.equal(h.runtime.wiki_hints_enabled, false);
  assert.equal(h.runtime.museum_label.enabled, true);
  assert.equal(h.clipboard.length, 1);
  assert.equal(h.runtime.bindings.wiki, 'SHIFT+F7');
});

function settingsHarness() {
  function newPilot() {
    return {
      map: [[]], neighbors: {}, newline: false,
      add(node) {
        if (this.newline) this.map.push([]);
        this.newline = false;
        this.map.at(-1).push(node);
      },
      request_newline() { this.newline = true; },
      set_neighbor(other, direction) { this.neighbors[direction] = other; return this; },
      reset() { this.map = [[]]; this.newline = false; },
    };
  }
  class SettingsNode extends Node {
    constructor(width = 170, height = 24) {
      super();
      Object.assign(this, { width, height, unlocked: true, text: '' });
    }
    set_sprites_from_key(key) { this.style = key; return this; }
    set_align() { return this; }
    set_width(width) { this.width = width; return this; }
    set_height(height) { this.height = height; return this; }
    set_y(y) { this.y = y; return this; }
    set_max_width(width) { this.maxWidth = width; return this; }
    allow_line_breaks() { return this; }
    get_width() { return this.width; }
    get_height() { return this.height; }
    get_text() { return this.text; }
    add_text_label(label) { this.label = label; return this; }
    add_hover_outline() { return this; }
    add_to_pilot(pilot, newline = false) {
      this.pilot = pilot;
      pilot.add(this);
      if (newline) pilot.request_newline();
      return this;
    }
    set_tap_callback(callback, args) { this.tap = () => callback(...args); return this; }
    set_free_callback(callback, args) { this.onFree = () => callback(...args); return this; }
    is_unlocked() { return this.unlocked; }
    measure() {
      // Deterministic layout stand-in, not the game's font metrics.
      const columns = Math.max(1, Math.floor((this.maxWidth ?? this.width) / 6));
      this.height = this.text.split('\n').reduce((sum, line) =>
        sum + Math.max(1, Math.ceil(line.length / columns)), 0) * 10;
      return { x: this.maxWidth ?? this.width, y: this.height };
    }
  }
  function node(parent) {
    const child = new SettingsNode();
    child.parent = parent;
    parent?.children.push(child);
    return child;
  }
  function free(node) {
    node.freed = true;
    node.onFree?.();
    for (const child of node.children) free(child);
  }
  const runtime = { ...configurationDefaults };
  const screen = { x: 480, y: 270 };
  const popups = [];
  const saved = [];
  const menu = {
    journal: { right_full_body: new SettingsNode(185, 211) },
    hide_requests: 0,
    active_page: undefined,
    option_scroller: undefined,
    category_pilot: newPilot(),
    new_pilot: newPilot,
  };
  let pilot = menu.category_pilot;
  const created = [];
  const callbacks = [
    'toggle_clock', 'show_local_sightings', 'open_wiki',
    'toggle_wiki_hints', 'toggle_all_bug_markers', 'toggle_notifications', 'show_farm_status',
  ];
  const context = load([
    ...alertPreferenceFunctions,
    privateName('hotkey_actions'), privateName('keybind_names'),
    privateName('settings_keybind_row'), publicName('update_settings_keybinds'),
    ...['show_configuration', 'toggle_configuration', 'configuration_row_think',
      'configuration_button_free'].map(publicName),
  ], {
    ...Object.fromEntries(callbacks.map(name => [publicName(name), () => name])),
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_save_preferences: () => { saved.push({ ...runtime }); return true; },
    mmapi_log_warn: () => assert.fail('unexpected configuration warning'),
    __MistriaCompanion_menu: () => menu.close_requested ? undefined : menu,
    Menu: { Settings: 'settings' },
    Align: { Center: 0, Middle: 0 },
    Cardinal: { North: 'north', South: 'south', East: 'east', West: 'west' },
    COMMON_LUT: 0,
    CommonLutIndex: { Dark: 0, Header: 1 },
    ON_GAMEPAD: false,
    INPUT: { gp_right_stick: { y: 0 } },
    string_replace_all: (text, from, to) => text.split(from).join(to),
    ANCHOR: {
      text: node, nine_slice: node, positional: node, free_node: free,
      wrap_for_local: text => text,
      get_true_size: () => screen,
      get_active_pilot: () => pilot,
      set_active_pilot: value => { pilot = value; },
    },
    popup_creator: () => {
      const popup = {
        backplate: new SettingsNode(180, 0), pilot: newPilot(), new_pilot: newPilot,
        hide_requests: 0, close_requested: false, free_requested: false,
        add_title(title) {
          this.title = title;
          this.header = node(this.backplate).set_width(this.backplate.width - 30).set_xy(0, 8);
          this.header.set_text(title).measure();
          this.header.height += 4;
        },
        add_description(text) {
          this.body = node(this.backplate).set_width(this.backplate.width - 20);
          this.body_text = node(this.body).set_text(text);
        },
        create_button(label) {
          this.closeButton = node(this.backplate).add_to_pilot(this.pilot);
          this.closeButton.label = label;
        },
        refresh_backplate_height() {
          this.backplate.height = 50 + this.header.height + this.header.y + this.body.height;
        },
        spawn() {
          this.previousPilot = pilot;
          pilot = this.pilot;
          menu.option_scroller.canvas.unlocked = false;
          popups.push(this);
        },
        close() {
          this.close_requested = true;
          pilot = this.previousPilot;
          menu.option_scroller.canvas.unlocked = true;
        },
      };
      return popup;
    },
    create_scroller: parent => {
      const scroller = {
        canvas: node(parent).set_size(parent.width - 15, parent.height),
        parent, view_height: parent.height,
        rows: [], bottom: 0, scroll: 0,
        subscribe_to_pilot(pilot) { this.pilot = pilot; return this; },
        scroll_with_stick() { this.stick = true; return this; },
        new_element(height) {
          const row = node(this.canvas).set_size(this.canvas.width, height);
          row.y = this.bottom;
          this.bottom += height - 1;
          this.rows.push(row);
          return row;
        },
        add_height_to_element(row, amount) {
          row.height += amount;
          this.bottom += amount;
          for (const next of this.rows.slice(this.rows.indexOf(row) + 1)) next.y += amount;
        },
        scroll_by_amount(amount) { this.scroll += amount; },
        free() { free(this.canvas); },
      };
      created.push(scroller);
      return scroller;
    },
  });
  const actions = context.__MistriaCompanion_hotkey_actions();
  runtime.keybind_rows = Array.from(actions, action => ({
    title: action.title, bindings: [action.default_key],
  }));
  return {
    context, runtime, menu, created, actions, screen, popups, saved,
    update: context.MistriaCompanion_update_settings_keybinds,
    setPilot: value => { pilot = value; },
  };
}

test('Settings reference uses all seven registered actions and does not duplicate or replace native pages', () => {
  const { actions, runtime, menu, created, update } = settingsHarness();
  assert.deepEqual(Array.from(actions, action => action.default_key), ['F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F4']);
  assert.equal(actions[3].callback(), 'toggle_wiki_hints');
  update();
  update();
  assert.equal(created.length, 1);
  const first = menu.option_scroller;
  assert.equal(first.rows.length, 10);
  assert.equal(first.rows[0].children[0].text, 'Mistria Companion');
  assert.equal(first.rows[1].children[0].label, 'Configuration');
  assert.deepEqual(first.rows.slice(2, 9).map(row => row.children[0].text), ['F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F4']);
  assert.deepEqual(first.rows.slice(2, 9).map(row => row.children[1].text), runtime.keybind_rows.map(row => row.title));
  assert.ok(first.rows[1].y + first.rows[1].height <= 211, 'configuration stays above every shortcut');
  const configurationPilot = menu.mistria_configuration_pilot;
  assert.equal(configurationPilot.map[0].length, 1);

  // This is the native SettingsMenu category/back lifecycle.
  first.free();
  assert.equal(configurationPilot.map[0].length, 0, 'native category changes remove stale companion buttons');
  const nativeOptions = { canvas: new Node() };
  menu.option_scroller = nativeOptions;
  menu.active_page = 'controls';
  update();
  assert.equal(created.length, 1);
  assert.equal(menu.option_scroller, nativeOptions);
  menu.active_page = undefined;
  update();
  assert.equal(menu.option_scroller, nativeOptions, 'do not overwrite another owner of the blank page');
  nativeOptions.canvas.freed = true;
  update();
  assert.equal(created.length, 2);
  assert.notEqual(menu.option_scroller, first);
  assert.equal(menu.mistria_configuration_pilot, configurationPilot);
  assert.equal(configurationPilot.map[0].length, 1, 'returning to Settings does not accumulate stale pilot nodes');
  menu.close_requested = true;
  menu.option_scroller.free();
  update();
  assert.equal(created.length, 2);
});

test('Settings reference renders alternates and unbound actions with expanding, non-overlapping rows', () => {
  const { context, runtime, menu, update } = settingsHarness();
  runtime.keybind_rows[2].bindings = ['HOME', 'SHIFT+F7'];
  runtime.keybind_rows[3].bindings = [];
  runtime.keybind_rows[4].bindings = ['GAMEPAD_LEFT_SHOULDER+GAMEPAD_RIGHT_TRIGGER'];
  update();
  const rows = menu.option_scroller.rows;
  assert.equal(rows[4].children[0].text, 'HOME\nSHIFT + F7');
  assert.equal(rows[5].children[0].text, 'Not bound');
  assert.equal(rows[6].children[0].text, 'PAD LEFT SHOULDER + PAD RIGHT TRIGGER');
  assert.ok(rows[6].height > 24);
  for (const row of rows.slice(2, 9)) {
    for (const label of row.children) assert.ok(label.height + 8 <= row.height);
  }
  for (let i = 1; i < rows.length; i++) {
    assert.equal(rows[i].y, rows[i - 1].y + rows[i - 1].height - 1);
  }
  assert.equal(context.__MistriaCompanion_keybind_names(['F7']), 'F7');
});

test('Settings reference scrolls with the right stick only when its landing page has control', () => {
  const { context, menu, update, setPilot } = settingsHarness();
  update();
  context.ON_GAMEPAD = true;
  context.INPUT.gp_right_stick.y = 0.75;
  update();
  assert.equal(menu.option_scroller.scroll, 3);
  setPilot({});
  update();
  assert.equal(menu.option_scroller.scroll, 3);
  setPilot(menu.category_pilot);
  menu.hide_requests = 1;
  update();
  assert.equal(menu.option_scroller.scroll, 3);
  menu.hide_requests = 0;
  menu.option_scroller.canvas.unlocked = false;
  update();
  assert.equal(menu.option_scroller.scroll, 3);
});

test('Configuration button opens a native popup above the keybinds with saved, live On/Off switches', () => {
  const h = settingsHarness();
  h.update();
  const button = h.menu.option_scroller.rows[1].children[0];
  assert.equal(button.label, 'Configuration');
  assert.equal(h.menu.category_pilot.neighbors.east, button.pilot);
  assert.equal(button.pilot.neighbors.west, h.menu.category_pilot);
  h.setPilot(button.pilot);
  button.tap();
  const popup = h.popups[0];
  assert.equal(popup.title, 'Mistria Companion configuration');
  assert.equal(popup.closeButton.label, 'misc_local/close');
  const list = h.created[1];
  assert.equal(list.rows.length, 7);
  assert.equal(list.pilot, h.context.ANCHOR.get_active_pilot());
  assert.notEqual(list.pilot, popup.closeButton.pilot, 'the scroller never follows a button outside its canvas');
  assert.deepEqual(list.pilot.map.map(row => row.length), Array(7).fill(1),
    'switches use native vertical pilot rows rather than a single horizontal row');
  assert.equal(list.pilot.neighbors.south, popup.closeButton.pilot);
  assert.equal(popup.closeButton.pilot.neighbors.north, list.pilot);
  assert.equal(list.stick, true);
  for (const [index, [key, value]] of Object.entries(configurationDefaults).entries()) {
    const toggle = list.rows[index].children[0];
    const valueLabel = toggle.children[1];
    assert.equal(valueLabel.text, value ? 'On' : 'Off');
    toggle.tap();
    valueLabel.think();
    assert.equal(valueLabel.text, value ? 'Off' : 'On');
    assert.equal(h.saved.at(-1)[key], !value);
    h.runtime[key] = value;
    valueLabel.think();
    assert.equal(valueLabel.text, value ? 'On' : 'Off', 'hotkey changes are reflected while the popup is open');
  }
  button.tap();
  assert.equal(h.popups.length, 1, 'do not stack configuration popups');
  popup.close();
  assert.equal(h.context.ANCHOR.get_active_pilot(), button.pilot);
  button.tap();
  assert.equal(h.popups.length, 2, 'closing returns to the same Settings landing page');
  assert.equal(h.menu.active_page, undefined);
});

test('configuration layout preserves every row and keeps the viewport and failure status inside small screens', () => {
  for (const [width, height] of [[480, 270], [400, 240], [320, 200]]) {
    const h = settingsHarness();
    Object.assign(h.screen, { x: width, y: height });
    h.update();
    h.menu.option_scroller.rows[1].children[0].tap();
    const popup = h.popups[0];
    const list = h.created[1];
    assert.ok(popup.backplate.width <= width - 20);
    assert.ok(popup.backplate.height <= height - 16);
    assert.equal(list.view_height, list.parent.height, 'never resize the root after native scroller construction');
    assert.ok(list.view_height > 0);
    assert.ok(list.parent.y + list.view_height <= popup.mistria_configuration_status.y);
    assert.ok(popup.mistria_configuration_status.y + popup.mistria_configuration_status.height <= popup.body.height);
    for (const row of list.rows) {
      const toggle = row.children[0];
      const title = toggle.children[0];
      const value = toggle.children[1];
      assert.ok(title.y + title.height <= toggle.height);
      assert.ok(title.x + title.maxWidth < value.x);
      assert.ok(toggle.y + toggle.height <= row.height);
    }
    h.context.__MistriaCompanion_save_preferences = () => false;
    list.rows[0].children[0].tap();
    assert.match(popup.mistria_configuration_status.text, /Not saved.*only this session/);
  }
});

test('Mist Spot lookup reads the active index, including zero, and rejects invalid saved positions', () => {
  const spot = { location_id: 1, pos: { x: 100, y: 200 } };
  const warnings = [];
  const context = load([privateName('active_mist_spot')], {
    MIST_SIGHT_ACTIVE_INDEX: 0,
    MIST_SIGHT_LIST: { count: () => 1, get: () => spot },
    LOCATIONS: [{}, {}],
    mmapi_warn_rate_limited: (...args) => warnings.push(args),
  });
  const lookup = context.__MistriaCompanion_active_mist_spot;
  assert.equal(lookup(), spot);
  assert.equal(context.MIST_SIGHT_ACTIVE_INDEX, 0);
  context.MIST_SIGHT_ACTIVE_INDEX = undefined;
  assert.equal(lookup(), undefined);
  assert.equal(warnings.length, 0);
  for (const invalid of [-1, 1, 0.5, '0']) {
    context.MIST_SIGHT_ACTIVE_INDEX = invalid;
    assert.equal(lookup(), undefined);
  }
  assert.equal(warnings.length, 4);
  context.MIST_SIGHT_ACTIVE_INDEX = 0;
  spot.location_id = 2;
  assert.equal(lookup(), undefined);
  spot.location_id = 1;
  spot.pos = undefined;
  assert.equal(lookup(), undefined);
  context.MIST_SIGHT_LIST = undefined;
  assert.equal(lookup(), undefined);
});

test('Mist Spot rendering preserves a continuous one-artwork-pixel outline despite rounded UI positions', () => {
  const draws = [];
  const depths = [];
  let depth = 42;
  const context = load([publicName('mist_marker_draw')], {
    spr_misty_spot_main_closed_idle: 14,
    sprite_get_width: () => 48,
    sprite_get_height: () => 40,
    sprite_get_xoffset: () => 24,
    sprite_get_yoffset: () => 26,
    c_black: 0,
    gpu_get_depth: () => depth,
    gpu_set_depth: value => { depth = value; depths.push(value); },
    draw_sprite_ext: (sprite, frame, x, y, scaleX, scaleY, angle, color, alpha) => {
      draws.push({ sprite, frame, x, y, scaleX, scaleY, angle, color, alpha, depth });
    },
  });
  const marker = new Node();
  const render = alpha => context.MistriaCompanion_mist_marker_draw(37, 42, 24, 20, 0xffffff, alpha, -7, marker);
  render(0.4);
  assert.equal(draws.length, 9);
  assert.deepEqual(depths, [-6, -7, 42]);
  assert.equal(depth, 42, 'restore the renderer depth after drawing');
  const cloud = draws.at(-1);
  assert.deepEqual(cloud, {
    sprite: 14, frame: 0, x: 49, y: 55, scaleX: 0.5, scaleY: 0.5,
    angle: 0, color: 0xffffff, alpha: 0.4, depth: -7,
  });
  assert.deepEqual(draws.slice(0, -1).map(edge => [edge.x - cloud.x, edge.y - cloud.y]),
    [[-0.5, -0.5], [0, -0.5], [0.5, -0.5], [-0.5, 0], [0.5, 0], [-0.5, 0.5], [0, 0.5], [0.5, 0.5]]);
  for (const edge of draws.slice(0, -1)) {
    assert.equal(edge.color, 0);
    assert.equal(edge.depth, -6);
    assert.equal(edge.alpha, 0.4);
  }

  // A synthetic stepped silhouette, not game artwork, exercises diagonal corners and concave edges.
  const pixels = [[2, 0], [1, 1], [2, 1], [3, 1], [0, 2], [2, 2], [3, 2], [4, 2], [1, 3], [2, 3], [3, 4]];
  const opaque = new Set(pixels.map(([x, y]) => `${x},${y}`));
  const border = new Set();
  for (const draw of draws.slice(0, -1)) {
    const dx = (draw.x - cloud.x) / draw.scaleX;
    const dy = (draw.y - cloud.y) / draw.scaleY;
    for (const [x, y] of pixels) {
      const key = `${x + dx},${y + dy}`;
      if (!opaque.has(key)) border.add(key);
    }
  }
  const expected = new Set();
  for (const [x, y] of pixels) {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${x + dx},${y + dy}`;
        if (!opaque.has(key)) expected.add(key);
      }
    }
  }
  assert.deepEqual(border, expected, 'every edge neighbor is covered, with nothing beyond a one-pixel stroke');
  draws.length = 0;
  depths.length = 0;
  render(0);
  marker.disable();
  render(1);
  marker.enable();
  marker.freed = true;
  render(1);
  assert.equal(draws.length, 0, 'hidden, disabled, and freed markers never draw a stale cloud');
  assert.equal(depths.length, 0);
});

test('Mist Spots appear in unvisited map areas, link to the wiki, and follow consumption and daily changes', () => {
  const runtime = {
    ...configurationDefaults,
    all_bug_markers_enabled: false, notifications_enabled: false,
    map_menu: { selected_location_id: 1, hide_requests: 0, map: new Node().set_size(200, 150) },
    map_wiki_nodes: [], map_signature: '', dig_spot_visit_key: '', dig_spots: [],
  };
  const spots = [
    { location_id: 1, pos: { x: 100, y: 200 } },
    { location_id: 2, pos: { x: 300, y: 400 } },
  ];
  const clipboard = [];
  const routes = [];
  let queueCount = 0;
  let destroyed = 0;
  runtime.map_menu.find_hub_for = (hubs, position, queue, selected) => {
    routes.push(position);
    return position.location_id === selected ? hubs[0] : 0;
  };
  const context = load([
    privateName('active_mist_spot'), privateName('hub_index'), privateName('create_mist_marker'),
    publicName('refresh_map_markers'), publicName('mist_marker_think'), privateName('set_wiki_title'),
    privateName('resolve_wiki_title'), publicName('open_wiki'),
  ], {
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_ready: () => true,
    __MistriaCompanion_menu: kind => kind === 'map' ? runtime.map_menu : undefined,
    __MistriaCompanion_location_name: id => `Area ${id}`,
    __MistriaCompanion_dig_spot_visit_key: () => 'visit',
    __MistriaCompanion_hover_label: () => new Node().set_alpha(0),
    __MistriaCompanion_notify: () => {},
    MistriaCompanion_add_map_labels: () => {},
    MistriaCompanion_capture_npc_context: () => {},
    MistriaCompanion_capture_quest_item_context: () => {},
    MistriaCompanion_capture_museum_wing_context: () => {},
    MistriaCompanion_mist_marker_draw: () => {},
    MIST_SIGHT_ACTIVE_INDEX: 0,
    __MistriaCompanion_update_museum_label: () => {},
    MIST_SIGHT_LIST: { count: () => spots.length, get: index => spots[index] },
    CURRENT_LOCATION_ID: 0,
    CURRENT_DYN_INDEX: 77,
    LOCATIONS: [{ map_location: 0 }, { map_location: 1 }, { map_location: 2 }],
    LocationPosition: class {
      constructor(location_id, pos, dyn_index) { Object.assign(this, { location_id, pos, dyn_index }); }
    },
    Vec2: (x, y) => ({ x, y }),
    obj_bug: 'bug',
    instance_number: () => 0,
    ds_priority_create: () => ++queueCount,
    ds_priority_destroy: () => destroyed++,
    Menu: { Map: 'map', Store: 'store', Crafting: 'crafting' },
    ANCHOR: {
      sprite: parent => { const node = new Node(); parent.children.push(node); return node; },
      custom: parent => { const node = new Node(); parent.children.push(node); return node; },
      positional: parent => { const node = new Node(); parent.children.push(node); return node; },
      open_menus: { count: () => 0 },
    },
    COMMON_LUT: 0,
    spr_misty_spot_main_closed_idle: 14,
    c_black: 0,
    sprite_get_width: sprite => { assert.equal(sprite, 14); return 48; },
    sprite_get_height: sprite => { assert.equal(sprite, 14); return 40; },
    sprite_get_xoffset: sprite => { assert.equal(sprite, 14); return 24; },
    sprite_get_yoffset: sprite => { assert.equal(sprite, 14); return 26; },
    string_replace_all: (text, from, to) => text.split(from).join(to),
    clipboard_set_text: text => clipboard.push(text),
    mmapi_warn_rate_limited: () => assert.fail('Unexpected invalid Mist Spot data'),
  });
  let hubs = [{ node: new Node().set_xy(80, 60) }];
  const refresh = () => context.MistriaCompanion_refresh_map_markers(hubs);
  refresh();
  const marker = hubs[0].node.board_get('mistria_item_details_mist_marker');
  assert.equal(marker.enabled, true);
  const cloud = marker.board_get('cloud');
  assert.equal(cloud.renderCallback, context.MistriaCompanion_mist_marker_draw);
  assert.deepEqual([cloud.width, cloud.height], [24, 20], 'draw the entire cloud and outline in the same coordinate space');
  assert.deepEqual([marker.width, marker.height], [24, 20], 'provide compact map-sized hover bounds');
  assert.equal(marker.cache_is_dirty, true, 'late-created positional roots need their native cache initialized');
  assert.equal(marker.children.length, 1, 'no separately rounded sprite copies surround the cloud');
  assert.deepEqual([marker.x, marker.y], [-10, 10]);
  for (const [x, y] of [[195, 145], [0, 0], [0, 145], [195, 0]]) {
    hubs[0].node.set_xy(x, y);
    marker.think();
    assert.ok(x + marker.x >= 1 && y + marker.y >= 1);
    assert.ok(x + marker.x + marker.width <= 199);
    assert.ok(y + marker.y + marker.height <= 149);
  }
  hubs[0].node.set_xy(80, 60);
  marker.think();
  assert.deepEqual([marker.x, marker.y], [-10, 10], 'clamping does not accumulate offsets');
  assert.equal(marker.board_get('label').text, 'Mist Spot');
  assert.equal(marker.board_get('label').alpha, 0);
  assert.equal(routes[0].location_id, 1, 'routes from the spot, not the player');
  assert.equal(routes[0].dyn_index, undefined, 'does not inherit the player dungeon instance');
  assert.deepEqual(routes[0].pos, spots[0].pos);
  assert.equal(context.MIST_SIGHT_ACTIVE_INDEX, 0, 'revealing does not consume the spot');
  refresh();
  assert.equal(queueCount, 1, 'unchanged snapshots do not rebuild markers');
  runtime.mist_spot_markers_enabled = false;
  refresh();
  assert.equal(marker.enabled, false);
  assert.equal(marker.board_get('label').alpha, 0);
  assert.equal(runtime.map_wiki_nodes.length, 0, 'disabled mist markers cannot offer stale wiki links');
  runtime.mist_spot_markers_enabled = true;
  refresh();
  assert.equal(marker.enabled, true);
  assert.equal(hubs[0].node.board_get('mistria_item_details_mist_marker'), marker);
  runtime.map_signature = '';
  refresh();
  assert.equal(marker.board_get('cloud'), cloud);
  assert.equal(cloud.renderCallback, context.MistriaCompanion_mist_marker_draw, 'refreshes preserve the sprite-only renderer');
  marker.hovered = true;
  context.MistriaCompanion_open_wiki();
  assert.deepEqual(clipboard, ['https://fieldsofmistria.wiki.gg/wiki/Mist_Spot']);

  const originalRoute = runtime.map_menu.find_hub_for;
  runtime.map_menu.selected_location_id = 0;
  runtime.map_menu.find_hub_for = () => hubs[0];
  refresh();
  assert.equal(marker.enabled, false, 'do not route the mist to an exit on a different area tab');
  assert.equal(runtime.map_wiki_nodes.length, 0);
  runtime.map_menu.selected_location_id = 1;
  runtime.map_menu.find_hub_for = originalRoute;
  refresh();
  assert.equal(marker.enabled, true);

  context.MIST_SIGHT_ACTIVE_INDEX = 1;
  refresh();
  assert.equal(marker.enabled, false, 'new daily location clears the old area');
  assert.equal(runtime.map_wiki_nodes.length, 0);
  runtime.map_menu.selected_location_id = 2;
  runtime.map_signature = '';
  hubs = [{ node: new Node() }];
  refresh();
  const next = hubs[0].node.board_get('mistria_item_details_mist_marker');
  assert.equal(next.enabled, true);
  assert.equal(next.board_get('label').text, 'Mist Spot', 'the hovered label never includes a location');

  context.MIST_SIGHT_ACTIVE_INDEX = undefined;
  refresh();
  assert.equal(next.enabled, false);
  assert.equal(next.board_get('label').alpha, 0);
  assert.equal(runtime.map_wiki_nodes.length, 0);
  context.MistriaCompanion_open_wiki();
  assert.equal(clipboard.length, 1, 'consumed spot cannot supply a stale wiki link');
  assert.equal(destroyed, queueCount);

  context.__MistriaCompanion_hub_index(hubs, 7, 8, 0);
  assert.equal(routes.at(-1).location_id, 0, 'existing bug/dig calls still use the current area');
  assert.equal(routes.at(-1).dyn_index, 77);
});

test('map markers group bug species and counts while preserving native-size hover-only dig markers', () => {
  const runtime = {
    ...configurationDefaults,
    all_bug_markers_enabled: true, map_menu: { selected_location_id: 0 },
    map_wiki_nodes: [], map_signature: '', dig_spot_visit_key: 'visit',
    dig_spots: [{ x: 10, y: 10, grid_x: 1, grid_y: 1 }, { x: 12, y: 10, grid_x: 2, grid_y: 1 }],
  };
  let bugs = [{ id: 1, item_id: 0, x: 10, y: 10 }, { id: 2, item_id: 0, x: 10, y: 10 }, { id: 3, item_id: 1, x: 10, y: 10 }];
  let destroyed = 0;
  const hubs = [{ node: new Node() }];
  const context = load([privateName('name_index'), publicName('refresh_map_markers'), publicName('map_label_think')], {
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_active_mist_spot: () => undefined,
    __MistriaCompanion_dig_spot_visit_key: () => 'visit',
    __MistriaCompanion_dig_spot_active: () => true,
    __MistriaCompanion_hub_index: () => 0,
    __MistriaCompanion_name: item => item.name,
    __MistriaCompanion_hover_label: () => new Node().set_alpha(0),
    __MistriaCompanion_fit_node: () => {},
    MistriaCompanion_add_map_labels: () => {},
    CURRENT_LOCATION_ID: 0,
    LOCATIONS: [{ map_location: 0 }],
    obj_bug: 'bug',
    instance_number: () => bugs.length,
    instance_find: (_, index) => bugs[index],
    BUGS: { get: id => ({ rarity: id === 1 ? 'very_rare' : 'common' }) },
    ITEM_PROTOTYPES: [{ name: 'Ant', icon_sprite: 10 }, { name: 'Luna Moth', icon_sprite: 11 }],
    ds_priority_create: () => 1,
    ds_priority_destroy: () => destroyed++,
    ANCHOR: { sprite: parent => { const node = new Node(); parent.children.push(node); return node; } },
    COMMON_LUT: 0,
    spr_ui_item_tool_mistril_shovel: 12,
    spr_ui_item_tool_mistril_shovel_outline: 13,
  });
  const refresh = () => context.MistriaCompanion_refresh_map_markers(hubs);
  refresh();
  const bug = hubs[0].node.board_get('mistria_item_details_bug_marker');
  const dig = hubs[0].node.board_get('mistria_item_details_dig_marker');
  assert.equal(hubs[0].node.children.length, 2);
  assert.equal(bug.board_get('label').text, 'Ant x2\nLuna Moth x1');
  assert.equal(bug.sprite, 11);
  assert.notEqual(bug.lut?.enabled, true, 'full-color bug item sprites must not use the text-color palette');
  assert.equal(runtime.map_wiki_nodes[0].title, 'Bugs');
  assert.deepEqual([bug.x, bug.y, dig.x, dig.y], [-10, -10, 10, -10]);
  assert.equal(dig.outline, 13);
  assert.equal(dig.sprite, 12);
  assert.notEqual(dig.lut?.enabled, true, 'mistril shovel artwork must not use a text palette');
  assert.equal(dig.width, undefined, 'keep the native 18x18 sprite size, without resizing or scaling');
  assert.equal(dig.board_get('label').text, 'Dig spots: 2');
  assert.equal(dig.board_get('label').alpha, 0);
  dig.hovered = true;
  context.MistriaCompanion_map_label_think(dig, dig.board_get('label'), '');
  assert.equal(dig.board_get('label').alpha, 1);
  refresh();
  assert.equal(destroyed, 1, 'unchanged maps reuse their snapshot');
  runtime.bug_markers_enabled = false;
  refresh();
  assert.equal(bug.enabled, false, 'the bug switch hides very rare species as well as ordinary ones');
  assert.equal(dig.enabled, true, 'bug visibility does not affect dig markers');
  assert.equal(bug.board_get('label').alpha, 0);
  assert.equal(runtime.map_wiki_nodes.length, 0, 'disabled bugs leave no stale wiki targets');
  runtime.dig_spot_markers_enabled = false;
  refresh();
  assert.equal(dig.enabled, false);
  assert.equal(dig.board_get('label').alpha, 0);
  assert.equal(runtime.dig_spots.length, 2, 'hiding markers does not discard the scan');
  runtime.bug_markers_enabled = true;
  refresh();
  assert.equal(bug.enabled, true);
  assert.equal(dig.enabled, false);
  runtime.dig_spot_markers_enabled = true;
  refresh();
  assert.equal(dig.enabled, true);
  runtime.all_bug_markers_enabled = false;
  refresh();
  assert.equal(bug.board_get('label').text, 'Luna Moth x1');
  assert.equal(runtime.map_wiki_nodes[0].title, 'Luna Moth');
  bug.set_lut(context.COMMON_LUT);
  runtime.all_bug_markers_enabled = true;
  bugs = [{ id: 1, item_id: 0, x: 10, y: 10 }];
  refresh();
  assert.equal(hubs[0].node.board_get('mistria_item_details_bug_marker'), bug);
  assert.equal(bug.sprite, 10, 'the existing marker switches to the remaining species icon');
  assert.equal(bug.lut.enabled, false, 'a reused marker must also clear any stale silhouette palette');
  assert.equal(bug.board_get('label').text, 'Ant x1');
  assert.equal(runtime.map_wiki_nodes[0].title, 'Ant');
  bugs = [];
  dig.set_lut(context.COMMON_LUT);
  runtime.dig_spots.pop();
  refresh();
  assert.equal(dig.lut.enabled, false, 'refreshing an existing dig marker also restores its colors');
  runtime.dig_spots = [];
  refresh();
  assert.equal(bug.enabled, false);
  assert.equal(dig.enabled, false);
  assert.equal(runtime.map_wiki_nodes.length, 0);
});

test('a rejected inventory add never removes the source gift and does not claim a full backpack', () => {
  const messages = [];
  let removed = 0;
  let remainder = 1;
  let limited = false;
  const item = { partial_eq: other => other === item, clone: () => ({ copy: true }) };
  const slot = { item, count: 1, remove: () => { removed++; slot.count--; } };
  const menu = {
    left: { slot: () => slot },
    left_menu: { hand: { size: () => 1, slot: () => ({ item: undefined }) }, refresh: () => {} },
    right_menu: { refresh: () => {} },
  };
  const context = load([publicName('collect_loved_gifts')], {
    Menu: { Storage: 'storage' },
    ARI: { inventory: { can_add: () => true, add: () => remainder } },
    ANCHOR: { wrap_for_local: value => value },
    __MistriaCompanion_menu: () => menu,
    __MistriaCompanion_npc_needs_gift: () => true,
    __MistriaCompanion_gift_plan: () => ({
      eligible_count: 1, matched_count: 1, search_limited: limited,
      entries: [{ npc_id: 0, slot_index: 0, item }],
    }),
    __MistriaCompanion_notify: text => messages.push(text),
    create_notification: text => messages.push(text),
  });
  context.MistriaCompanion_collect_loved_gifts(menu);
  assert.equal(removed, 0);
  assert.equal(slot.count, 1);
  assert.match(messages.at(-1), /planned gifts/);
  assert.doesNotMatch(messages.at(-1), /backpack is full/);
  limited = true;
  context.MistriaCompanion_collect_loved_gifts(menu);
  assert.equal(removed, 0);
  assert.match(messages.at(-1), /planned gifts.*search limit/);
  limited = false;
  remainder = 0;
  context.MistriaCompanion_collect_loved_gifts(menu);
  assert.equal(removed, 1);
  assert.equal(slot.count, 0);
  assert.equal(messages.at(-1), 'Grabbed 1 loved gift.');
});

test('tooltip bounds keep a store tooltip inside the screen without erasing its text', () => {
  const plate = new Node();
  Object.assign(plate, {
    x: 230, y: 270, width: 100, height: 120,
    get_size() { return { x: this.width, y: this.height }; },
    add_x(value) { this.x += value; return this; },
    add_y(value) { this.y += value; return this; },
  });
  const context = load([privateName('fit_node')], {
    ANCHOR: {
      screen_canvas: { get_size: () => ({ x: 320, y: 360 }) },
      get_screen_position: node => ({ x: node.x, y: node.y }),
    },
  });
  context.__MistriaCompanion_fit_node(plate);
  assert.deepEqual([plate.x, plate.y], [216, 236]);
});

function divingNoticeHarness() {
  const runtime = { ...configurationDefaults, notifications_enabled: true, diving_spot_alerts_enabled: true };
  const state = { key: 'day:area:visit', traveling: false, cutscene: false, paused: false,
    ready: true, menuAvailable: true, accept: true };
  const actors = [];
  const notices = [];
  const toasts = [];
  const warnings = [];
  const feedback = [];
  let scans = 0;
  const menu = {
    hide_requests: 0, canvas: { get_enabled: () => true, get_alpha: () => 1 },
    toasts: { last: () => toasts.at(-1) },
    create_notification(text, duck) {
      notices.push({ text, duck });
      if (!state.accept) return false;
      const node = {
        alpha: 1, freed: false, timer: 240,
        set_alpha(value) { this.alpha = value; return this; },
        set_think_callback(callback, args) { this.think = () => callback(...args); return this; },
      };
      toasts.push(node);
      return true;
    },
  };
  const context = load([
    ...alertPreferenceFunctions,
    privateName('count_diving_spots'),
    ...['detect_diving_spots', 'diving_notice_think', 'reset_local_sightings',
      'reset_save', 'toggle_notifications', 'toggle_configuration'].map(publicName),
  ], {
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_local_visit_key: () => state.key,
    __MistriaCompanion_sightings_transition_active: () => state.traveling,
    __MistriaCompanion_dig_notice_blocked: () => state.cutscene,
    __MistriaCompanion_ready: () => state.ready,
    __MistriaCompanion_menu: () => state.menuAvailable ? menu : undefined,
    __MistriaCompanion_save_preferences: () => true,
    __MistriaCompanion_notify: text => feedback.push(text),
    GRID: { is_setup: true, node_counter: 1 },
    Menu: { InfoToasts: 'toasts' }, ANCHOR: { wrap_for_local: text => text },
    obj_divespot: 'diving-spot',
    game_paused: () => state.paused,
    instance_number: kind => { assert.equal(kind, 'diving-spot'); scans++; return actors.length; },
    instance_find: (_, index) => actors[index],
    instance_exists: actor => { assert.notEqual(actor, undefined); return actor.alive !== false; },
    mmapi_warn_rate_limited: (...args) => warnings.push(args),
  });
  function advance(frames = 13) {
    for (let i = 0; i < frames; i++) {
      context.MistriaCompanion_detect_diving_spots();
      for (const toast of toasts) toast.think();
    }
  }
  const spot = () => { const actor = { dive_loot: {}, visible: true }; actors.push(actor); return actor; };
  return { runtime, state, context, actors, notices, toasts, menu, warnings, feedback, advance, spot,
    scans: () => scans };
}

test('diving alerts count only active initialized spots once per visit without pausing gameplay', () => {
  const h = divingNoticeHarness();
  h.spot(); h.spot();
  h.actors.push(undefined, { alive: false }, { visible: false });
  h.advance(12);
  assert.equal(h.notices.length, 0);
  h.advance(1);
  assert.deepEqual(h.notices, [{ text: 'Diving spots: 2', duck: undefined }]);
  assert.equal(h.state.paused, false);
  h.context.GRID.node_counter++;
  h.spot();
  h.advance(100);
  assert.equal(h.notices.length, 1, 'ordinary grid changes and repeat ticks do not repeat the entry alert');
  assert.equal(h.scans(), 1, 'do not continually rescan an already reported visit');
});

test('diving alerts defer through menus and cutscenes and recount only remaining spots', () => {
  const h = divingNoticeHarness();
  const used = h.spot();
  h.spot();
  h.state.cutscene = true;
  h.advance(30);
  assert.equal(h.scans(), 0, 'cutscene-deactivated instances must not be mistaken for an empty area');
  used.alive = false; // Native dive completion destroys the collected spot.
  h.state.cutscene = false;
  h.state.paused = true;
  h.advance(30);
  assert.equal(h.notices.length, 0);
  h.state.paused = false;
  h.advance();
  assert.equal(h.notices[0].text, 'Diving spots: 1');
  h.state.cutscene = true;
  h.advance(1);
  assert.equal(h.toasts[0].alpha, 0);
  assert.equal(h.toasts[0].timer, 240, 'do not reorder or shorten the native FIFO notification lifetimes');
});

test('diving alerts honor F10 and do not replay an old visit when enabled', () => {
  const h = divingNoticeHarness();
  h.runtime.diving_spot_alerts_enabled = false;
  h.spot();
  h.advance();
  assert.equal(h.notices.length, 0);
  h.context.MistriaCompanion_toggle_notifications();
  h.advance();
  assert.equal(h.notices.length, 0);
  h.state.key = 'day:another-area:visit';
  h.advance();
  assert.equal(h.notices.length, 1);
  h.context.MistriaCompanion_toggle_notifications();
  assert.equal(h.toasts[0].alpha, 0);
  const pending = divingNoticeHarness();
  pending.spot();
  pending.advance(3);
  pending.context.MistriaCompanion_toggle_notifications();
  pending.context.MistriaCompanion_toggle_notifications();
  pending.advance(30);
  assert.equal(pending.notices.length, 0, 'toggling off cancels a deferred count permanently for the visit');
});

test('dive-spot switch works independently and disabled visible notices cannot reappear when re-enabled', () => {
  const h = divingNoticeHarness();
  h.runtime.notifications_enabled = false;
  h.spot();
  h.advance();
  assert.equal(h.notices.length, 1, 'diving alerts do not depend on the legacy summary or other categories');
  const toast = h.toasts[0];
  const popup = configurationPopupStub();
  h.context.MistriaCompanion_toggle_configuration(popup, 'diving_spot_alerts_enabled');
  assert.equal(toast.alpha, 0);
  h.context.MistriaCompanion_toggle_configuration(popup, 'diving_spot_alerts_enabled');
  toast.alpha = 1;
  h.advance(30);
  assert.equal(toast.alpha, 0, 'native animation cannot revive a cancelled visible notice');
  assert.equal(h.notices.length, 1);
  h.state.key = 'another visit';
  h.advance();
  assert.equal(h.notices.length, 2);
});

test('diving notices do not flash during departure and equal counts in new areas still display', () => {
  const h = divingNoticeHarness();
  h.spot();
  h.advance();
  const previous = h.toasts[0];
  h.context.MistriaCompanion_reset_local_sightings({});
  assert.equal(previous.alpha, 0);
  h.state.traveling = true;
  h.advance(31);
  assert.equal(h.notices.length, 1);
  assert.equal(h.runtime.diving_spot_visit, undefined);
  h.state.traveling = false;
  h.state.key = 'day:new-area:visit';
  h.advance();
  assert.deepEqual(h.notices.map(n => n.text), ['Diving spots: 1', 'Diving spots: 1']);
  h.context.MistriaCompanion_reset_save({});
  assert.equal(h.runtime.diving_spot_visit, undefined);
});

test('diving alerts skip empty areas and retry uninitialized spot or menu data explicitly', () => {
  const empty = divingNoticeHarness();
  empty.advance();
  assert.equal(empty.notices.length, 0);
  const h = divingNoticeHarness();
  const spot = h.spot();
  spot.dive_loot = undefined;
  h.advance();
  assert.equal(h.notices.length, 0);
  assert.equal(h.warnings.length, 1);
  spot.dive_loot = {};
  h.state.menuAvailable = false;
  h.advance(1);
  assert.equal(h.notices.length, 0);
  assert.equal(h.warnings.length, 2);
  h.state.menuAvailable = true;
  h.advance(1);
  assert.equal(h.notices[0].text, 'Diving spots: 1');
  const stale = divingNoticeHarness();
  const used = stale.spot();
  stale.state.cutscene = true;
  stale.advance();
  used.alive = false;
  stale.state.cutscene = false;
  stale.advance();
  assert.equal(stale.notices.length, 0, 'used spots cannot produce a stale deferred notice');
});

function digNoticeHarness() {
  const runtime = {
    ...configurationDefaults,
    dig_spot_visit_key: '', dig_spot_delay: 0, dig_spots: [], notifications_enabled: true,
    dig_spot_alerts_enabled: true,
  };
  const state = { visit: 'day:area:floor:visit', toastMenuAvailable: true, duplicate: false };
  const messages = [];
  const toasts = [];
  const warnings = [];
  const menus = {};
  const toastMenu = {
    toasts: { last: () => { assert.ok(toasts.length); return toasts.at(-1); } },
    create_notification(text, duck) {
      if (state.duplicate) return false;
      messages.push({ text, duck });
      toasts.push({
        alpha: 1, freed: false,
        set_alpha(alpha) { this.alpha = alpha; return this; },
        set_think_callback(callback, args) { this.think = () => callback(...args); return this; },
      });
      return true;
    },
  };
  const context = load([
    'menu', 'scan_dig_spots', 'dig_spot_active', 'dig_notice_blocked',
  ].map(privateName).concat(alertPreferenceFunctions, [
    'detect_dig_spots', 'show_dig_spot_notice', 'dig_notice_think', 'reset_save', 'toggle_configuration',
  ].map(publicName)), {
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_save_preferences: () => true,
    mmapi_log_warn: (...args) => warnings.push(args),
    __MistriaCompanion_dig_spot_visit_key: () => state.visit,
    __MistriaCompanion_dig_spot_location_name: () => assert.fail('dig notices must not request a location or floor label'),
    MIST: { running: false },
    PAUSE_STATUS: 0,
    PauseStatus: { CUTSCENE: 1 },
    Menu: { Textbox: 'textbox', InfoToasts: 'toasts' },
    ObjectId: { DigSite: 'dig' },
    has_flag: (value, flag) => (value & flag) !== 0,
    ANCHOR: {
      wrap_for_local: value => value,
      get_menu: kind => kind === 'toasts' ? (state.toastMenuAvailable ? toastMenu : undefined) : menus[kind],
    },
    mmapi_warn_rate_limited: (...args) => warnings.push(args),
    create_notification: () => assert.fail('scanning must not emit a notice directly'),
  });
  const grid = {
    is_setup: true, node_len: 4,
    node_object_id: ['dig', 'dig', 'dig', 'other'],
    node_top_left_x: [1, 1, 2, 3], node_top_left_y: [1, 1, 1, 1],
    try_node_index_for_cell(x, y) {
      const index = this.node_top_left_x.findIndex((value, i) => value === x && this.node_top_left_y[i] === y);
      return index < 0 ? undefined : index;
    },
  };
  context.GRID = grid;
  const detect = context.MistriaCompanion_detect_dig_spots;
  const show = context.MistriaCompanion_show_dig_spot_notice;
  const wait = count => { for (let i = 0; i < count; i++) show(); };
  const scan = () => { detect(); detect(); };
  return { context, runtime, state, grid, menus, messages, toasts, warnings, detect, show, wait, scan };
}

test('dig scans and map data continue during cutscenes, but notices wait for a clear gameplay interval', () => {
  const h = digNoticeHarness();
  h.context.MIST.running = true;
  h.scan();
  assert.equal(h.runtime.dig_spots.length, 2, 'multi-cell dig sites remain deduplicated for markers');
  assert.equal(h.runtime.dig_spot_delay, -1, 'the scan finishes even while a scene is active');
  assert.ok(h.runtime.dig_spot_notice);
  h.wait(300);
  assert.equal(h.messages.length, 0);
  h.context.MIST.running = false;
  h.context.PAUSE_STATUS = 1;
  h.wait(30);
  assert.equal(h.messages.length, 0, 'the native cutscene pause independently blocks delivery');
  h.context.PAUSE_STATUS = 0;
  h.menus.textbox = { hide_requests: 0 };
  h.wait(30);
  assert.equal(h.messages.length, 0, 'NPC dialogue also blocks delivery without a running scene');
  h.menus.textbox.close_requested = true;
  h.wait(12);
  assert.equal(h.messages.length, 0);
  h.show();
  assert.deepEqual(h.messages, [{ text: 'Dig spots: 2', duck: 180 }]);
  h.wait(100);
  assert.equal(h.messages.length, 1, 'a finished scan does not send the notice repeatedly');
});

test('muted automatic alerts still scan dig spots for map markers without queuing a notice', () => {
  const h = digNoticeHarness();
  h.runtime.dig_spot_alerts_enabled = false;
  h.scan();
  assert.equal(h.runtime.dig_spots.length, 2);
  assert.equal(h.runtime.dig_spot_notice, undefined);
  h.wait(30);
  assert.equal(h.messages.length, 0);
  h.runtime.dig_spot_alerts_enabled = true;
  h.wait(30);
  assert.equal(h.messages.length, 0, 'do not replay a past visit merely because alerts were enabled');
  h.state.visit = 'next visit';
  h.scan();
  h.wait(13);
  assert.equal(h.messages.length, 1);
});

test('dig-spot switch works independently and disabling a visible notice cannot revive it later', () => {
  const h = digNoticeHarness();
  h.runtime.notifications_enabled = false;
  h.runtime.dig_spot_markers_enabled = false;
  h.scan();
  h.wait(13);
  assert.equal(h.messages.length, 1, 'dig alerts do not depend on any map setting or the legacy summary');
  const toast = h.toasts[0];
  const popup = configurationPopupStub();
  h.context.MistriaCompanion_toggle_configuration(popup, 'dig_spot_alerts_enabled');
  assert.equal(toast.alpha, 0);
  h.context.MistriaCompanion_toggle_configuration(popup, 'dig_spot_alerts_enabled');
  toast.alpha = 1;
  toast.think();
  assert.equal(toast.alpha, 0);
  h.detect();
  h.wait(30);
  assert.equal(h.messages.length, 1, 'enabling mid-visit never replays the entry count');
  assert.equal(h.runtime.dig_spots.length, 2);
});

test('a cutscene beginning during the dig-notice delay restarts the clear interval', () => {
  const h = digNoticeHarness();
  h.scan();
  h.wait(6);
  h.context.MIST.running = true;
  h.show();
  assert.equal(h.runtime.dig_spot_notice.wait_frames, 12);
  h.context.MIST.running = false;
  h.wait(12);
  assert.equal(h.messages.length, 0);
  h.context.PAUSE_STATUS = 1;
  h.show();
  assert.equal(h.messages.length, 0, 'a scene starting on the delivery frame still blocks the notice');
  h.context.PAUSE_STATUS = 0;
  h.wait(13);
  assert.equal(h.messages.length, 1);
});

test('dig notices from a previous area, day, floor, or grid are discarded', () => {
  for (const change of [
    h => { h.state.visit = 'different area'; },
    h => { h.state.visit = 'different day'; },
    h => { h.state.visit = 'different floor'; },
    h => { h.context.GRID = { ...h.grid }; },
    h => { h.context.GRID = undefined; },
  ]) {
    const h = digNoticeHarness();
    h.context.MIST.running = true;
    h.scan();
    change(h);
    h.context.MIST.running = false;
    h.wait(30);
    assert.equal(h.runtime.dig_spot_notice, undefined);
    assert.equal(h.messages.length, 0);
  }
  const h = digNoticeHarness();
  h.scan();
  h.state.visit = 'new area';
  h.detect();
  assert.equal(h.runtime.dig_spot_notice, undefined, 'visit reset drops the prior notice before scanning');
  h.detect();
  h.wait(13);
  assert.equal(h.messages[0].text, 'Dig spots: 2');
});

test('deferred dig notices count only remaining active sites and omit an empty area', () => {
  const h = digNoticeHarness();
  h.scan();
  h.grid.node_object_id[2] = 'other';
  h.wait(13);
  assert.equal(h.messages[0].text, 'Dig spots: 1');
  const empty = digNoticeHarness();
  empty.scan();
  empty.grid.node_object_id.fill('other');
  empty.wait(13);
  assert.equal(empty.messages.length, 0);
  assert.equal(empty.runtime.dig_spot_notice, undefined);
});

test('disabling dig notices or resetting the save cancels a pending notice without losing marker scans', () => {
  const h = digNoticeHarness();
  h.scan();
  h.runtime.dig_spot_alerts_enabled = false;
  h.show();
  assert.equal(h.runtime.dig_spot_notice, undefined);
  assert.equal(h.runtime.dig_spots.length, 2);
  h.runtime.dig_spot_alerts_enabled = true;
  h.wait(30);
  assert.equal(h.messages.length, 0);
  h.state.visit = 'new visit';
  h.scan();
  assert.ok(h.runtime.dig_spot_notice);
  h.context.MistriaCompanion_reset_save({});
  assert.equal(h.runtime.dig_spot_notice, undefined);
  h.wait(30);
  assert.equal(h.messages.length, 0);
});

test('dig scans retry unready data, and delayed notification menus do not lose the pending count', () => {
  const h = digNoticeHarness();
  const ids = h.grid.node_object_id;
  h.grid.node_object_id = undefined;
  h.scan();
  assert.equal(h.runtime.dig_spot_notice, undefined);
  assert.equal(h.runtime.dig_spot_delay, 0);
  assert.equal(h.warnings.length, 1);
  h.grid.node_object_id = ids;
  h.detect();
  h.state.toastMenuAvailable = false;
  h.wait(13);
  assert.equal(h.warnings.length, 2);
  assert.ok(h.runtime.dig_spot_notice);
  h.state.toastMenuAvailable = true;
  h.show();
  assert.equal(h.messages.length, 1);
  const duplicate = digNoticeHarness();
  duplicate.state.duplicate = true;
  duplicate.scan();
  duplicate.wait(30);
  assert.equal(duplicate.runtime.dig_spot_notice, undefined, 'respect the native notification deduplication');
  assert.equal(duplicate.toasts.length, 0);
});

test('already-visible dig notices are hidden when a cutscene starts without altering other toast state', () => {
  const h = digNoticeHarness();
  h.scan();
  h.wait(13);
  const toast = h.toasts[0];
  toast.timer = 100;
  const otherToast = { alpha: 1 };
  toast.think();
  assert.equal(toast.alpha, 1);
  h.context.MIST.running = true;
  toast.think();
  assert.equal(toast.alpha, 0);
  assert.equal(toast.timer, 100, 'leave the native toast lifecycle and queue ordering untouched');
  assert.equal(otherToast.alpha, 1);
  h.context.MIST.running = false;
  toast.think();
  assert.equal(toast.alpha, 0, 'an old notice does not reappear after its scene interruption');
  toast.freed = true;
  toast.set_alpha = () => assert.fail('do not touch a freed toast');
  h.context.PAUSE_STATUS = 1;
  toast.think();
});

test('dig-notice scene checks handle absent MIST and hidden or closing dialogue menus', () => {
  const h = digNoticeHarness();
  const blocked = h.context.__MistriaCompanion_dig_notice_blocked;
  h.context.MIST = undefined;
  assert.equal(blocked(), false);
  h.menus.textbox = { hide_requests: 1 };
  assert.equal(blocked(), false);
  h.menus.textbox.hide_requests = 0;
  assert.equal(blocked(), true);
  h.menus.textbox.free_requested = true;
  assert.equal(blocked(), false);
  h.context.PAUSE_STATUS = 1 | 2 | 4;
  assert.equal(blocked(), true);
});

function statusLabelHarness() {
  const runtime = { clock_paused: true, birthday_day: '1', birthday_text: '' };
  const state = { paused: false, cutscene: false };
  const screen = { x: 480, y: 270 };
  class HudNode extends Node {
    constructor(parent, x, y, width, height, type = 'sprite') {
      super();
      Object.assign(this, { parent, x, y, width, height, type, maxWidth: 160 });
      if (parent) parent.children.push(this);
    }
    get_enabled() { return this.enabled && (!this.parent || this.parent.get_enabled()); }
    get_alpha() { return this.alpha; }
    get_width() { return this.width; }
    get_height() { return this.height; }
    set_align() { return this; }
    set_text_align() { return this; }
    set_max_width(width) { this.maxWidth = width; return this; }
    allow_line_breaks() { return this; }
    set_enabled(enabled) { this.enabled = enabled; return this; }
    set_think_callback(callback, args) { this.think = () => callback(...args); return this; }
    measure() {
      const lines = this.text.split('\n');
      this.width = Math.min(this.maxWidth, Math.max(...lines.map(line => line.length * 6)));
      this.height = lines.reduce((count, line) => count + Math.max(1, Math.ceil(line.length * 6 / this.maxWidth)), 0) * 13;
      return { x: this.width, y: this.height };
    }
  }
  const canvas = new HudNode(undefined, 0, 0, 480, 270, 'canvas');
  const root = new HudNode(canvas, 3, 6, 0, 0, 'positional');
  const mana = new HudNode(root, 0, 30, 10, 10);
  const health = new HudNode(root, 0, 0, 70, 12);
  const stamina = new HudNode(root, 0, 15, 70, 12);
  const statuses = new HudNode(root, 0, 43, 0, 0, 'positional');
  const icon = new HudNode(statuses, 0, 0, 18, 18);
  const timer = new HudNode(icon, 0, 19, 18, 6);
  const vitals = { root, mana_icon: mana, hide_requests: 0 };
  const toasts = [];
  const menus = { vitals, toasts: { toasts: { count: () => toasts.length, get: i => toasts[i] } } };
  function position(node) {
    const parent = node.parent ? position(node.parent) : { x: 0, y: 0 };
    return { x: parent.x + node.x, y: parent.y + node.y };
  }
  const context = load([
    privateName('hud_bottom'), privateName('hud_overlaps'),
    publicName('status_label_think'), publicName('update_birthday_label'),
  ], {
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_menu: id => menus[id],
    __MistriaCompanion_legendary_day_key: () => '1',
    __MistriaCompanion_dig_notice_blocked: () => state.cutscene,
    game_paused: () => state.paused,
    Menu: { Vitals: 'vitals', InfoToasts: 'toasts', InfoHud: 'info', Toolbar: 'toolbar', GlyphGuide: 'glyphs' },
    NodeId: { Sprite: 'sprite', Text: 'text', Typewriter: 'typewriter' },
    COMMON_LUT: 'lut', TextAlign: { Left: 0 }, Align: { LeftIn: 0, TopIn: 0 },
    ANCHOR: {
      text: parent => new HudNode(parent, 0, 0, 0, 0, 'text'),
      get_screen_position: position,
      get_true_size: () => screen,
    },
  });
  const update = () => context.MistriaCompanion_update_birthday_label();
  const label = () => mana.board_get('mistria_item_details_birthday_label');
  return { runtime, state, screen, root, mana, health, stamina, statuses, icon, timer, vitals, menus,
    toasts, position, context, HudNode, update, label };
}

test('clock status sits below all vitals, status-effect icons, and their duration bars', () => {
  const h = statusLabelHarness();
  h.update();
  const label = h.label();
  assert.equal(label.text, 'Clock paused');
  assert.equal(label.parent, h.root);
  assert.equal(h.position(label).y, h.position(h.timer).y + h.timer.height + 4);
  assert.equal(label.alpha, 1);
  assert.equal(label.enabled, true);
  const original = h.position(label).y;
  h.statuses.y += 10;
  label.think();
  assert.equal(h.position(label).y, original + 10, 'respond to native HUD movement even when text is unchanged');
  h.statuses.disable();
  h.update();
  assert.equal(h.position(label).y, h.position(h.mana).y + h.mana.height + 4);
  h.statuses.enable();
  h.icon.height = 30;
  h.timer.y = 31;
  h.update();
  assert.equal(h.position(label).y, h.position(h.timer).y + h.timer.height + 4);
});

test('clock/birthday status does not grow its own offset and clears when neither is needed', () => {
  const h = statusLabelHarness();
  h.runtime.birthday_text = 'Birthday: Celine';
  h.update();
  const label = h.label();
  const first = h.position(label);
  assert.equal(label.text, 'Birthday: Celine\nClock paused');
  for (let i = 0; i < 30; i++) h.update();
  assert.deepEqual(h.position(label), first, 'exclude the label itself from HUD bounds');
  h.runtime.clock_paused = false;
  h.update();
  assert.equal(label.text, 'Birthday: Celine');
  h.runtime.birthday_text = '';
  h.update();
  assert.equal(label.enabled, false);
  h.runtime.clock_paused = true;
  h.update();
  assert.equal(label.enabled, true);
  assert.equal(label.text, 'Clock paused');
  assert.equal(h.root.children.filter(node => node.type === 'text').length, 1);
});

test('clock status hides behind menus, cutscenes, and overlapping HUD elements or notifications', () => {
  const h = statusLabelHarness();
  h.update();
  const label = h.label();
  for (const flag of ['paused', 'cutscene']) {
    h.state[flag] = true;
    label.think();
    assert.equal(label.alpha, 0);
    h.state[flag] = false;
    h.update();
    assert.equal(label.alpha, 1);
  }
  const p = h.position(label);
  const toast = new h.HudNode(undefined, p.x, p.y, 170, 42);
  h.toasts.push(toast);
  h.update();
  assert.equal(label.alpha, 0);
  toast.x = -toast.width; // Notice slides fully off-screen.
  h.update();
  assert.equal(label.alpha, 1);
  const sighting = new h.HudNode(undefined, p.x, p.y, 170, 42);
  h.runtime.sightings_replay = { toast: sighting };
  h.update();
  assert.equal(label.alpha, 0, 'the independent sighting notice also protects the clock label from overlap');
  sighting.disable();
  h.update();
  assert.equal(label.alpha, 1);
  h.runtime.sightings_replay = undefined;
  for (const menu of ['info', 'toolbar', 'glyphs']) {
    const canvas = new h.HudNode(undefined, 0, 0, 480, 270, 'canvas');
    const blocker = new h.HudNode(canvas, p.x, p.y, 24, 24);
    h.menus[menu] = { canvas, hide_requests: 0 };
    h.update();
    assert.equal(label.alpha, 0, `${menu} icon must not be covered`);
    blocker.disable();
    h.update();
    assert.equal(label.alpha, 1, 'transparent canvas bounds alone must not hide the label');
    delete h.menus[menu];
  }
  h.screen.y = p.y + 5;
  h.update();
  assert.equal(label.alpha, 0, 'hide rather than clamp upward onto an icon when there is no room');
});

test('tick retries initialization, resets visit/day observations, and throttles map work', () => {
  const runtime = {};
  let ready = false;
  let day = '1';
  let scans = 0;
  let refreshes = 0;
  let mountedUpdates = 0;
  const grid = { node_counter: 1 };
  const context = load([publicName('reset_save'), publicName('tick')], {
    GRID: grid,
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_register_hotkeys: () => {},
    MistriaCompanion_update_settings_keybinds: () => {},
    MistriaCompanion_update_gift_tooltips: () => { assert.equal(ready, true); },
    MistriaCompanion_update_seed_makers: () => { assert.equal(ready, true); },
    __MistriaCompanion_update_seed_hint: () => {},
    MistriaCompanion_track_local_spawns: () => { assert.equal(ready, true); },
    MistriaCompanion_replay_local_sightings: () => { assert.equal(ready, true); },
    MistriaCompanion_update_mounted_interactions: () => {
      assert.equal(ready, true, 'mounted initialization must wait until the world is ready');
      mountedUpdates++;
    },
    __MistriaCompanion_ready: () => ready,
    local_language: () => 'en',
    __MistriaCompanion_legendary_day_key: () => day,
    __MistriaCompanion_map_hubs: () => [],
    MistriaCompanion_detect_dig_spots: () => { scans++; runtime.dig_spot_delay = -1; },
    MistriaCompanion_show_dig_spot_notice: () => { assert.equal(ready, true); },
    MistriaCompanion_detect_diving_spots: () => { assert.equal(ready, true); },
    MistriaCompanion_update_birthday_label: () => {},
    MistriaCompanion_add_map_labels: () => {},
    MistriaCompanion_refresh_map_markers: () => refreshes++,
    MistriaCompanion_add_chest_gift_button: () => {},
    __MistriaCompanion_resolve_wiki_title: () => { runtime.wiki_title = ''; },
    __MistriaCompanion_update_museum_label: () => {},
    __MistriaCompanion_show_wiki_hint: () => {},
  });
  context.MistriaCompanion_reset_save({});
  runtime.frame = 0;
  const tick = context.MistriaCompanion_tick;
  runtime.seed_repeat = { stale: true };
  tick();
  assert.equal(runtime.seed_repeat, undefined, 'unready gameplay must cancel Seed Maker holds');
  assert.equal(scans, 0);
  assert.equal(mountedUpdates, 0);
  ready = true;
  tick();
  assert.equal(scans, 1);
  assert.equal(mountedUpdates, 1);
  assert.equal(refreshes, 1);
  runtime.seen_spawns.fish = true;
  for (let i = 0; i < 11; i++) tick();
  assert.equal(mountedUpdates, 12, 'mounted NPC discovery is not throttled with map scans');
  assert.equal(scans, 1);
  assert.equal(refreshes, 1);
  assert.equal(runtime.seen_spawns.fish, true);
  tick();
  assert.equal(refreshes, 2);
  grid.node_counter++;
  tick();
  assert.equal(scans, 2);
  assert.equal(runtime.seen_spawns.fish, undefined);
  runtime.legendary_sightings.push('Yesterday');
  day = '2';
  tick();
  assert.equal(runtime.legendary_sightings.length, 0);
  assert.equal(scans, 3);
  const mountedBeforeTitle = mountedUpdates;
  ready = false;
  tick();
  assert.equal(mountedUpdates, mountedBeforeTitle, 'returning to an unready/title state skips NPC access');
});
