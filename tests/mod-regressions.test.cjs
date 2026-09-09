const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const source = readFileSync(join(__dirname, '..', 'MistriaCompanion', 'gml', 'MistriaCompanion.gml'), 'utf8');
const privateName = name => `__MistriaCompanion_${name}`;
const publicName = name => `MistriaCompanion_${name}`;

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

const hotkeyCallbacks = [
  'toggle_clock', 'show_legendary_sightings', 'open_wiki',
  'toggle_wiki_hints', 'toggle_all_bug_markers', 'toggle_dig_spot_notifications',
];

function mountedConfigHarness(config) {
  const reads = [];
  const writes = [];
  const registrations = [];
  const warnings = [];
  const context = load([
    privateName('runtime'), privateName('mounted_setting'),
    privateName('hotkey_actions'), privateName('register_hotkeys'), publicName('reset_save'),
  ], {
    global: {},
    ...Object.fromEntries(hotkeyCallbacks.map(name => [publicName(name), () => name])),
    mmapi_config_read_valid: (...args) => { reads.push(args); return config; },
    mmapi_config_write: (...args) => writes.push(args),
    mmapi_log_warn: (...args) => warnings.push(args),
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
    assert.deepEqual(registrations.map(row => row.binding.name), ['F5', 'F6', 'F7', 'F8', 'F9', 'F10']);
    assert.equal(warnings.length, 0);
    context.MistriaCompanion_reset_save({});
    register();
    assert.equal(runtime.mounted_interactions_enabled, expected, 'save reset preserves the configured preference');
    assert.equal(reads.length, 1);
    assert.equal(writes.length, 1);
    assert.equal(registrations.length, 6);
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
    dig_notifications: 'DELETE', dig_notifications_alternate: '',
  };
  const before = { ...config };
  const { context, runtime, register, reads, writes, registrations, warnings } = mountedConfigHarness(config);
  register();
  register();
  assert.deepEqual(config, before, 'registration does not mutate the loaded config');
  assert.deepEqual({ ...writes[0][2] }, before);
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
      talkResult: false, giftResult: false,
      me: { gift_flag: true, prototype: { banned_gift_tags: list(['banned']) } },
      fsm: {},
    };
    npc.can_talk = () => npc.talkAllowed;
    npc.my_query_quests = () => ({ is_empty: () => npc.questsEmpty });
    npc.entries = [
      entry(npc, 'talk', 'misc_local/talk', context.InputId.Interact),
      entry(npc, 'gift', 'misc_local/give_item', context.InputId.Throw),
      entry(npc, 'quest', 'quest', context.InputId.Interact),
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
    if (index < 2) {
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

test('mounted talk, gift, and Elsie Gossip are blocked by jump, pending FSM change, pause, MIST, textbox, fire breath, or no mount', () => {
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
    assert.equal(gossip.can_interact_callback(), false, `${label}: gossip`);
    assert.equal(harness.state.gossipQuestReads, 0);
    assert.equal(harness.conditions.length, 0);
    assert.equal(harness.state.heldReads, 0, 'guards precede held-item access');
  }
});

test('mounted installation preserves native action identity, ordering, input keys, and unrelated quest/date/proposal callbacks', () => {
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
    if (index < 2) {
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
      const matching = npc.entries.filter(other =>
        other.local_key === entry.local_key && other.input_id === entry.input_id).length;
      if ((!isTalk && !isGift) || matching !== 1) {
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
      for (const index of [0, 1]) {
        const { makeNpc, update, warnings } = mountedHarness();
        const npc = makeNpc();
        npc.entries[index][key] = value;
        const before = { ...npc.entries[index] };
        update();
        assert.deepEqual(npc.entries[index], before);
        assert.equal(npc.entries[index].__mistria_companion_mounted, undefined);
        assert.ok(warnings.some(args => args[0].endsWith(':mounted_callback')));
        assert.ok(npc.entries[1 - index].__mistria_companion_mounted, 'valid counterpart is not discarded');
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
  set_lut() { return this; }
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
    spr_ui_tooltip_header_box: 1,
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
  class SettingsNode extends Node {
    constructor(width = 170, height = 24) {
      super();
      Object.assign(this, { width, height, unlocked: true });
    }
    set_sprites_from_key(key) { this.style = key; return this; }
    set_align() { return this; }
    set_max_width(width) { this.maxWidth = width; return this; }
    allow_line_breaks() { return this; }
    get_width() { return this.width; }
    get_height() { return this.height; }
    is_unlocked() { return this.unlocked; }
    measure() {
      // Deterministic layout stand-in, not the game's font metrics.
      const columns = Math.max(1, Math.floor((this.maxWidth ?? this.width) / 6));
      this.height = this.text.split('\n').reduce((sum, line) =>
        sum + Math.max(1, Math.ceil(line.length / columns)), 0) * 10;
    }
  }
  const runtime = {};
  const menu = {
    journal: { right_full_body: new SettingsNode(185, 211) },
    hide_requests: 0,
    active_page: undefined,
    option_scroller: undefined,
    category_pilot: {},
  };
  let pilot = menu.category_pilot;
  const created = [];
  const callbacks = [
    'toggle_clock', 'show_legendary_sightings', 'open_wiki',
    'toggle_wiki_hints', 'toggle_all_bug_markers', 'toggle_dig_spot_notifications',
  ];
  const context = load([
    privateName('hotkey_actions'), privateName('keybind_names'),
    privateName('settings_keybind_row'), publicName('update_settings_keybinds'),
  ], {
    ...Object.fromEntries(callbacks.map(name => [publicName(name), () => name])),
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_menu: () => menu.close_requested ? undefined : menu,
    Menu: { Settings: 'settings' },
    Align: { Center: 0, Middle: 0 },
    COMMON_LUT: 0,
    CommonLutIndex: { Dark: 0, Header: 1 },
    ON_GAMEPAD: false,
    INPUT: { gp_right_stick: { y: 0 } },
    string_replace_all: (text, from, to) => text.split(from).join(to),
    ANCHOR: {
      text: parent => { const node = new SettingsNode(); parent.children.push(node); return node; },
      get_active_pilot: () => pilot,
    },
    create_scroller: () => {
      const scroller = {
        canvas: new SettingsNode(170, 211),
        rows: [], bottom: 0, scroll: 0,
        new_element(height) {
          const row = new SettingsNode(170, height);
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
        free() { this.canvas.freed = true; },
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
    context, runtime, menu, created, actions,
    update: context.MistriaCompanion_update_settings_keybinds,
    setPilot: value => { pilot = value; },
  };
}

test('Settings reference uses the six registered actions and does not duplicate or replace native pages', () => {
  const { actions, runtime, menu, created, update } = settingsHarness();
  assert.deepEqual(Array.from(actions, action => action.default_key), ['F5', 'F6', 'F7', 'F8', 'F9', 'F10']);
  assert.equal(actions[3].callback(), 'toggle_wiki_hints');
  update();
  update();
  assert.equal(created.length, 1);
  const first = menu.option_scroller;
  assert.equal(first.rows.length, 8);
  assert.equal(first.rows[0].children[0].text, 'Mistria Companion');
  assert.deepEqual(first.rows.slice(1, 7).map(row => row.children[0].text), ['F5', 'F6', 'F7', 'F8', 'F9', 'F10']);
  assert.deepEqual(first.rows.slice(1, 7).map(row => row.children[1].text), runtime.keybind_rows.map(row => row.title));
  assert.ok(first.rows[6].y + first.rows[6].height <= 211, 'default shortcuts fit in the page in the layout fixture');

  // This is the native SettingsMenu category/back lifecycle.
  first.free();
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
  assert.equal(rows[3].children[0].text, 'HOME\nSHIFT + F7');
  assert.equal(rows[4].children[0].text, 'Not bound');
  assert.equal(rows[5].children[0].text, 'PAD LEFT SHOULDER + PAD RIGHT TRIGGER');
  assert.ok(rows[5].height > 24);
  for (const row of rows.slice(1, 7)) {
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

test('Mist Spots appear in unvisited map areas, link to the wiki, and follow consumption and daily changes', () => {
  const runtime = {
    all_bug_markers_enabled: false, dig_spot_notifications_enabled: false,
    map_menu: { selected_location_id: 1, hide_requests: 0 },
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
    privateName('active_mist_spot'), privateName('hub_index'),
    publicName('refresh_map_markers'), privateName('set_wiki_title'),
    privateName('resolve_wiki_title'), publicName('open_wiki'),
  ], {
    __MistriaCompanion_runtime: () => runtime,
    __MistriaCompanion_ready: () => true,
    __MistriaCompanion_menu: kind => kind === 'map' ? runtime.map_menu : undefined,
    __MistriaCompanion_location_name: id => `Area ${id}`,
    __MistriaCompanion_hover_label: () => new Node().set_alpha(0),
    __MistriaCompanion_notify: () => {},
    MistriaCompanion_add_map_labels: () => {},
    MistriaCompanion_capture_npc_context: () => {},
    MistriaCompanion_capture_quest_item_context: () => {},
    MistriaCompanion_capture_museum_wing_context: () => {},
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
      open_menus: { count: () => 0 },
    },
    COMMON_LUT: 0,
    spr_ui_skills_archaeology_icon_mist_sight: 14,
    string_replace_all: (text, from, to) => text.split(from).join(to),
    clipboard_set_text: text => clipboard.push(text),
    mmapi_warn_rate_limited: () => assert.fail('Unexpected invalid Mist Spot data'),
  });
  let hubs = [{ node: new Node() }];
  const refresh = () => context.MistriaCompanion_refresh_map_markers(hubs);
  refresh();
  const marker = hubs[0].node.board_get('mistria_item_details_mist_marker');
  assert.equal(marker.enabled, true);
  assert.equal(marker.sprite, 14);
  assert.deepEqual([marker.x, marker.y], [-10, 10]);
  assert.equal(marker.board_get('label').text, 'Mist Spot\nArea 1');
  assert.equal(marker.board_get('label').alpha, 0);
  assert.equal(routes[0].location_id, 1, 'routes from the spot, not the player');
  assert.equal(routes[0].dyn_index, undefined, 'does not inherit the player dungeon instance');
  assert.deepEqual(routes[0].pos, spots[0].pos);
  assert.equal(context.MIST_SIGHT_ACTIVE_INDEX, 0, 'revealing does not consume the spot');
  refresh();
  assert.equal(queueCount, 1, 'unchanged snapshots do not rebuild markers');
  marker.hovered = true;
  context.MistriaCompanion_open_wiki();
  assert.deepEqual(clipboard, ['https://fieldsofmistria.wiki.gg/wiki/Mist_Spot']);

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
  assert.equal(next.board_get('label').text, 'Mist Spot\nArea 2');

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
    spr_ui_item_tool_rusty_shovel: 12,
    spr_ui_item_tool_rusty_shovel_outline: 13,
  });
  const refresh = () => context.MistriaCompanion_refresh_map_markers(hubs);
  refresh();
  const bug = hubs[0].node.board_get('mistria_item_details_bug_marker');
  const dig = hubs[0].node.board_get('mistria_item_details_dig_marker');
  assert.equal(hubs[0].node.children.length, 2);
  assert.equal(bug.board_get('label').text, 'Ant x2\nLuna Moth x1');
  assert.equal(bug.sprite, 11);
  assert.equal(runtime.map_wiki_nodes[0].title, 'Bugs');
  assert.deepEqual([bug.x, bug.y, dig.x, dig.y], [-10, -10, 10, -10]);
  assert.equal(dig.outline, 13);
  assert.equal(dig.board_get('label').text, 'Dig spots: 2');
  assert.equal(dig.board_get('label').alpha, 0);
  dig.hovered = true;
  context.MistriaCompanion_map_label_think(dig, dig.board_get('label'), '');
  assert.equal(dig.board_get('label').alpha, 1);
  refresh();
  assert.equal(destroyed, 1, 'unchanged maps reuse their snapshot');
  runtime.all_bug_markers_enabled = false;
  refresh();
  assert.equal(bug.board_get('label').text, 'Luna Moth x1');
  assert.equal(runtime.map_wiki_nodes[0].title, 'Luna Moth');
  bugs = [];
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
  assert.match(messages.at(-1), /planned transfers/);
  assert.doesNotMatch(messages.at(-1), /backpack is full/);
  limited = true;
  context.MistriaCompanion_collect_loved_gifts(menu);
  assert.equal(removed, 0);
  assert.match(messages.at(-1), /planned transfers.*search limit/);
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
    MistriaCompanion_update_mounted_interactions: () => {
      assert.equal(ready, true, 'mounted initialization must wait until the world is ready');
      mountedUpdates++;
    },
    __MistriaCompanion_ready: () => ready,
    local_language: () => 'en',
    __MistriaCompanion_legendary_day_key: () => day,
    __MistriaCompanion_map_hubs: () => [],
    MistriaCompanion_detect_dig_spots: () => { scans++; runtime.dig_spot_delay = -1; },
    MistriaCompanion_show_mine_bug_spawns: () => { runtime.mine_bug_delay = -1; },
    MistriaCompanion_track_legendary_spawns: () => {},
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
  tick();
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
