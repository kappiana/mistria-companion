function __MistriaCompanion_runtime() {
    if (global[$ "__mistria_item_details"] == undefined) {
        global.__mistria_item_details = {
            registered: false,
            bindings: undefined,
            keybind_rows: [],
            mounted_interactions_enabled: true,
            seed_repeat: undefined,
            seed_hint: undefined,
            seed_hint_visible: false,
            frame: 0,
            clock_paused: false,
            recipe_cache: {},
            wiki_title: "",
            wiki_hint_title: "",
            wiki_hints_enabled: true,
            notifications_enabled: false,
            bug_alerts_enabled: false,
            legendary_fish_alerts_enabled: false,
            diving_spot_alerts_enabled: false,
            dig_spot_alerts_enabled: false,
            bug_markers_enabled: true,
            mist_spot_markers_enabled: true,
            dig_spot_markers_enabled: true,
            museum_label: undefined,
            all_bug_markers_enabled: true,
            legendary_day: "",
            legendary_sightings: [],
            seen_spawns: {},
            local_sightings: undefined,
            sightings_replay: undefined,
            farm_status_popup: undefined,
            birthday_day: "",
            birthday_text: "",
            language: undefined,
            visit_grid: undefined,
            visit_counter: -1,
            visit_day: "",
            scan_frame: -12,
            map_menu: undefined,
            map_node: undefined,
            map_signature: "",
            map_wiki_nodes: [],
            map_labels_ready: false,
            dig_spot_visit_key: "",
            dig_spot_delay: -1,
            dig_spot_notice: undefined,
            dig_spot_toast: undefined,
            dig_spots: [],
            diving_spot_visit: undefined
        };
    }
    return global.__mistria_item_details;
}

function __MistriaCompanion_menu(_kind) {
    if (ANCHOR == undefined) return undefined;
    var _menu = ANCHOR.get_menu(_kind);
    if (_menu == undefined || _menu.close_requested || _menu.free_requested) return undefined;
    return _menu;
}

function __MistriaCompanion_ready() {
    return instance_exists(obj_ari) && ARI != undefined && CALENDAR != undefined
        && CLOCK != undefined && GRID != undefined
        && __MistriaCompanion_field(GRID, "is_setup") == true
        && __MistriaCompanion_menu(Menu.InfoToasts) != undefined;
}

function __MistriaCompanion_notify(_text, _duck) {
    var _menu = __MistriaCompanion_menu(Menu.InfoToasts);
    if (_menu == undefined) {
        mmapi_log_warn("mistria_item_details", _text + " (notification unavailable)");
        return false;
    }
    return _menu.create_notification(ANCHOR.wrap_for_local(_text), _duck);
}

function MistriaCompanion_reset_save(_ctx) {
    var _runtime = __MistriaCompanion_runtime();
    var _label = __MistriaCompanion_field(_runtime, "museum_label");
    if (_label != undefined && !_label.freed) ANCHOR.free_node(_label);
    _runtime.museum_label = undefined;
    _runtime.clock_paused = false;
    _runtime.seed_repeat = undefined;
    _runtime.seed_hint = undefined;
    _runtime.recipe_cache = {};
    _runtime.wiki_title = "";
    _runtime.wiki_hint_title = "";
    _runtime.legendary_day = "";
    _runtime.legendary_sightings = [];
    _runtime.seen_spawns = {};
    _runtime.local_sightings = undefined;
    _runtime.sightings_replay = undefined;
    _runtime.farm_status_popup = undefined;
    _runtime.birthday_day = "";
    _runtime.birthday_text = "";
    _runtime.visit_grid = undefined;
    _runtime.visit_counter = -1;
    _runtime.visit_day = "";
    _runtime.dig_spot_visit_key = "";
    _runtime.dig_spot_delay = -1;
    _runtime.dig_spot_notice = undefined;
    _runtime.dig_spot_toast = undefined;
    _runtime.dig_spots = [];
    _runtime.diving_spot_visit = undefined;
    _runtime.map_menu = undefined;
    _runtime.map_node = undefined;
    _runtime.map_signature = "";
    _runtime.map_wiki_nodes = [];
    _runtime.map_labels_ready = false;
    _runtime.scan_frame = -12;
}

function MistriaCompanion_clock_advance(_value, _ctx) {
    if (_value == undefined) return undefined;
    if (__MistriaCompanion_runtime().clock_paused) return 0;
    return undefined;
}

function __MistriaCompanion_hotkey_actions() {
    return [
        { key: "clock", title: "Pause / release clock", default_key: "F5", callback: MistriaCompanion_toggle_clock },
        { key: "sightings", title: "Bugs and rare fish here", default_key: "F6", callback: MistriaCompanion_show_local_sightings },
        { key: "wiki", title: "Copy current wiki link", default_key: "F7", callback: MistriaCompanion_open_wiki },
        { key: "wiki_hints", title: "Show / hide wiki hints", default_key: "F8", callback: MistriaCompanion_toggle_wiki_hints },
        { key: "bugs", title: "Show / hide ordinary bugs", default_key: "F9", callback: MistriaCompanion_toggle_all_bug_markers },
        { key: "notifications", title: "Toggle automatic alerts", default_key: "F10", callback: MistriaCompanion_toggle_notifications },
        { key: "farm_status", title: "Farm status", default_key: "F4", callback: MistriaCompanion_show_farm_status }
    ];
}

function __MistriaCompanion_register_hotkeys() {
    var _runtime = __MistriaCompanion_runtime();
    if (_runtime.bindings != undefined) return;

    var _config = mmapi_config_read_valid("mistria_item_details", 1);
    _runtime.mounted_interactions_enabled = __MistriaCompanion_mounted_setting(_config);
    _runtime.notifications_enabled = __MistriaCompanion_preference(_config, "notifications_enabled", false);
    var _options = __MistriaCompanion_configuration_options();
    for (var _index = 0; _index < array_length(_options); _index++) {
        var _option = _options[_index];
        _runtime[$ _option.key] = __MistriaCompanion_preference(
            _config, _option.key, _option.alert ? _runtime.notifications_enabled : true);
    }
    _runtime.notifications_enabled = __MistriaCompanion_any_alerts_enabled();
    _runtime.all_bug_markers_enabled = __MistriaCompanion_preference(_config, "all_bug_markers_enabled", true);
    _runtime.wiki_hints_enabled = __MistriaCompanion_preference(_config, "wiki_hints_enabled", true);
    var _actions = __MistriaCompanion_hotkey_actions();
    _runtime.bindings = {};
    _runtime.keybind_rows = [];
    var _registered = {};
    var _saved = {
        mounted_interactions_enabled: _runtime.mounted_interactions_enabled,
        notifications_enabled: _runtime.notifications_enabled == true,
        all_bug_markers_enabled: _runtime.all_bug_markers_enabled == true,
        wiki_hints_enabled: _runtime.wiki_hints_enabled == true
    };
    for (var _index = 0; _index < array_length(_options); _index++) {
        var _key = _options[_index].key;
        _saved[$ _key] = _runtime[$ _key] == true;
    }
    for (var _index = 0; _index < array_length(_actions); _index++) {
        var _action = _actions[_index];
        var _row = { title: _action.title, bindings: [] };
        for (var _alternate = 0; _alternate < 2; _alternate++) {
            var _key = _action.key + (_alternate == 0 ? "" : "_alternate");
            var _default = _alternate == 0 ? _action.default_key : "";
            var _name = __MistriaCompanion_field(_config, _key);
            if (_name == undefined && _action.key == "notifications") {
                _name = __MistriaCompanion_field(_config, "dig_notifications" + (_alternate == 0 ? "" : "_alternate"));
            }
            if (_name == undefined) _name = _default;
            var _binding = is_string(_name) ? mmapi_hotkey_binding_from_name(_name) : undefined;
            if (_name != "" && _binding == undefined) {
                mmapi_log_warn("mistria_item_details", "Invalid binding for " + _key
                    + "; using " + (_default == "" ? "no alternate binding" : _default) + ".");
                _name = _default;
                _binding = mmapi_hotkey_binding_from_name(_name);
            }
            if (_alternate == 0 && _binding == undefined) {
                _name = _default;
                _binding = mmapi_hotkey_binding_from_name(_name);
            }
            _saved[$ _key] = _name;
            if (_binding == undefined) continue;
            if (__MistriaCompanion_field(_registered, _name) != undefined) {
                mmapi_log_warn("mistria_item_details", "Duplicate binding " + _name
                    + " for " + _key + "; this binding was not registered.");
                continue;
            }
            _registered[$ _name] = true;
            mmapi_hotkey_register_binding(_binding, _action.callback);
            array_push(_row.bindings, _name);
            if (__MistriaCompanion_field(_runtime.bindings, _action.key) == undefined) {
                _runtime.bindings[$ _action.key] = _name;
            }
        }
        array_push(_runtime.keybind_rows, _row);
    }
    mmapi_config_write("mistria_item_details", 1, _saved);
}

function __MistriaCompanion_mounted_setting(_config) {
    return __MistriaCompanion_preference(_config, "mounted_interactions_enabled", true);
}

function __MistriaCompanion_preference(_config, _key, _default) {
    if (__MistriaCompanion_field(_config, _key) != undefined) {
        // Read the member inline: the engine can coerce bool locals to numbers.
        if (typeof(_config[$ _key]) == "bool") {
            return _config[$ _key];
        }
        mmapi_log_warn("mistria_item_details", "Invalid " + _key + "; using " + (_default ? "true" : "false") + ".");
    }
    return _default ? true : false;
}

function __MistriaCompanion_configuration_options() {
    return [
        { key: "bug_alerts_enabled", title: "Show bug alerts", alert: true },
        { key: "bug_markers_enabled", title: "Show bugs on the map", alert: false },
        { key: "diving_spot_alerts_enabled", title: "Show dive spot alerts", alert: true },
        { key: "mist_spot_markers_enabled", title: "Show mist spots on the map", alert: false },
        { key: "dig_spot_alerts_enabled", title: "Show dig spot alerts", alert: true },
        { key: "dig_spot_markers_enabled", title: "Show dig spots on the map", alert: false },
        { key: "legendary_fish_alerts_enabled", title: "Show legendary fish alerts", alert: true }
    ];
}

function __MistriaCompanion_sighting_alerts_enabled() {
    var _runtime = __MistriaCompanion_runtime();
    return _runtime.bug_alerts_enabled || _runtime.legendary_fish_alerts_enabled;
}

function __MistriaCompanion_any_alerts_enabled() {
    var _runtime = __MistriaCompanion_runtime();
    return __MistriaCompanion_sighting_alerts_enabled()
        || _runtime.diving_spot_alerts_enabled || _runtime.dig_spot_alerts_enabled;
}

function __MistriaCompanion_apply_alert_preferences(_retire_sightings=false) {
    var _runtime = __MistriaCompanion_runtime();
    _runtime.notifications_enabled = __MistriaCompanion_any_alerts_enabled();
    var _local = _runtime.local_sightings;
    if (_local != undefined) {
        if (!_runtime.bug_alerts_enabled) _local.pending_bugs = {};
        if (!_runtime.legendary_fish_alerts_enabled) _local.pending_fish = {};
        if (!__MistriaCompanion_sighting_alerts_enabled()) _local.entry_pending = false;
    }
    // An already-rendered combined notice may contain a newly disabled category.
    var _replay = _runtime.sightings_replay;
    if (_retire_sightings && _replay != undefined && _replay.automatic) {
        __MistriaCompanion_retire_sightings_notice(_replay.toast);
        _runtime.sightings_replay = undefined;
    }
    if (!_runtime.dig_spot_alerts_enabled) {
        _runtime.dig_spot_notice = undefined;
        var _toast = _runtime.dig_spot_toast;
        if (_toast != undefined && !_toast.freed) _toast.set_alpha(0);
        _runtime.dig_spot_toast = undefined;
    }
    if (!_runtime.diving_spot_alerts_enabled) {
        var _diving = _runtime.diving_spot_visit;
        if (_diving != undefined) {
            _diving.pending = false;
            if (_diving.toast != undefined && !_diving.toast.freed) _diving.toast.set_alpha(0);
            _diving.toast = undefined;
        }
    }
}

function __MistriaCompanion_save_preferences() {
    var _runtime = __MistriaCompanion_runtime();
    var _config = mmapi_config_read_valid("mistria_item_details", 1);
    if (!is_struct(_config)) {
        mmapi_log_warn("mistria_item_details", "Could not read configuration to save display preferences.");
        return false;
    }
    var _keys = ["notifications_enabled", "all_bug_markers_enabled", "wiki_hints_enabled"];
    var _options = __MistriaCompanion_configuration_options();
    for (var _index = 0; _index < array_length(_options); _index++) {
        array_push(_keys, _options[_index].key);
    }
    for (var _index = 0; _index < array_length(_keys); _index++) {
        var _key = _keys[_index];
        _config[$ _key] = _runtime[$ _key] == true;
    }
    mmapi_config_write("mistria_item_details", 1, _config);
    // MMAPI logs write failures but does not return a status.
    var _saved = mmapi_config_read_valid("mistria_item_details", 1);
    for (var _index = 0; _index < array_length(_keys); _index++) {
        var _key = _keys[_index];
        if (!is_struct(_saved) || typeof(_saved[$ _key]) != "bool"
            || _saved[$ _key] != _runtime[$ _key])
        {
            mmapi_log_warn("mistria_item_details", "Display preferences could not be saved; changes apply only to this session.");
            return false;
        }
    }
    return true;
}

function __MistriaCompanion_mounted_ready() {
    return ARI.mount != undefined
        && ARI.fire_breath_time <= 0
        && obj_ari.fsm.current_state_id() == PlayerState.MountDefault
        && obj_ari.fsm.next_state == undefined
        && !non_cutscene_pause()
        && !MIST.running
        && __MistriaCompanion_menu(Menu.Textbox) == undefined;
}

function __MistriaCompanion_mounted_condition() {
    if (!__MistriaCompanion_runtime().mounted_interactions_enabled
        || !instance_exists(obj_ari) || !obj_ari.is_mounted())
    {
        return self.original();
    }
    if (!__MistriaCompanion_mounted_ready()) return false;

    var _npc = self.npc;
    if (!instance_exists(_npc)) return false;
    if (_npc.npc_id == NpcId.Caldarus && caldarus_is_sleeping()) return false;

    // Mirror each native predicate without its mount veto.
    if (self.quest) {
        return !_npc.my_query_quests().is_empty();
    }
    if (self.gossip) {
        return QUEST_LOG.completed.contains("gossip_for_elsie");
    }
    if (!self.gift) {
        return _npc.can_talk() && _npc.my_query_quests().is_empty();
    }
    if (!_npc.me.gift_flag) return false;
    var _item = ARI.held_item();
    return _item != undefined
        && _item.prototype.giftable
        && !_item.prototype.tags.contains_any_value_from(_npc.me.prototype.banned_gift_tags)
        && npc_is_unlocked(_npc.npc_id);
}

function __MistriaCompanion_wrap_mounted_interaction(_npc, _interaction, _gift, _gossip=false, _quest=false) {
    if (__MistriaCompanion_field(_interaction, "__mistria_companion_mounted") != undefined) return;
    if (typeof(__MistriaCompanion_field(_interaction, "can_interact_callback")) != "method"
        || typeof(__MistriaCompanion_field(_interaction, "callback")) != "method")
    {
        mmapi_warn_rate_limited("mistria_item_details:mounted_callback", "mistria_item_details",
            "Mounted interactions: unsupported villager callback; leaving it unchanged.");
        return;
    }
    var _context = {
        npc: _npc,
        gift: _gift,
        gossip: _gossip,
        quest: _quest,
        original: _interaction.can_interact_callback
    };
    _interaction.__mistria_companion_mounted = _context;
    _interaction.can_interact_callback = method(_context, __MistriaCompanion_mounted_condition);
}

function __MistriaCompanion_install_mounted_npc(_npc) {
    if (__MistriaCompanion_field(_npc, "me") == undefined
        || __MistriaCompanion_field(_npc, "fsm") == undefined) return;
    var _interactions = __MistriaCompanion_field(_npc, "interactions");
    if (!is_struct(_interactions) || typeof(__MistriaCompanion_field(_interactions, "count")) != "method"
        || typeof(__MistriaCompanion_field(_interactions, "get")) != "method")
    {
        mmapi_warn_rate_limited("mistria_item_details:mounted_list", "mistria_item_details",
            "Mounted interactions: unsupported villager interaction list; leaving it unchanged.");
        return;
    }
    var _count = _interactions.count();
    var _installed = __MistriaCompanion_field(_npc, "__mistria_companion_mounted");
    if (_installed != undefined && _installed.list == _interactions && _installed.count == _count) return;

    var _talk = undefined;
    var _gift = undefined;
    var _gossip = undefined;
    var _quest = undefined;
    var _talk_count = 0;
    var _gift_count = 0;
    var _gossip_count = 0;
    var _quest_count = 0;
    var _talk_first = -1;
    var _talk_last = -1;
    for (var _index = 0; _index < _count; _index++) {
        var _interaction = _interactions.get(_index);
        if (!is_struct(_interaction)) continue;
        var _key = __MistriaCompanion_field(_interaction, "local_key");
        var _input = __MistriaCompanion_field(_interaction, "input_id");
        if (_key == "misc_local/talk" && _input == InputId.Interact) {
            if (_talk_count == 0) {
                _talk = _interaction;
                _talk_first = _index;
            }
            _talk_last = _index;
            _talk_count++;
        } else if (_key == "misc_local/give_item" && _input == InputId.Throw) {
            _gift = _interaction;
            _gift_count++;
        } else if (_key == "misc_local/turn_in_quest_input" && _input == InputId.Interact) {
            _quest = _interaction;
            _quest_count++;
        } else if (_npc.npc_id == NpcId.Elsie && _key == "misc_local/gossip"
            && _input == InputId.SecondaryInteract)
        {
            _gossip = _interaction;
            _gossip_count++;
        }
    }
    // Caldarus appends a separate sleeping-only Talk after the inherited entries.
    var _caldarus_pair = _npc.npc_id == NpcId.Caldarus && _talk_count == 2
        && _talk_first == 0 && _talk_last == _count - 1;
    if (_talk_count == 1 || _caldarus_pair) __MistriaCompanion_wrap_mounted_interaction(_npc, _talk, false);
    if (_gift_count == 1) __MistriaCompanion_wrap_mounted_interaction(_npc, _gift, true);
    if (_quest_count == 1) __MistriaCompanion_wrap_mounted_interaction(_npc, _quest, false, false, true);
    if (_gossip_count == 1) __MistriaCompanion_wrap_mounted_interaction(_npc, _gossip, false, true);
    if (_npc.npc_id == NpcId.Elsie && _gossip_count != 1) {
        mmapi_warn_rate_limited("mistria_item_details:mounted_gossip", "mistria_item_details",
            "Mounted interactions: missing or duplicate Elsie Gossip; leaving gossip unchanged.");
    }
    if ((_talk_count != 1 && !_caldarus_pair) || _gift_count != 1 || _quest_count != 1) {
        mmapi_warn_rate_limited("mistria_item_details:mounted_entries", "mistria_item_details",
            "Mounted interactions: missing or duplicate talk/gift/quest entries; ambiguous entries were left unchanged.");
    }
    _npc.__mistria_companion_mounted = { list: _interactions, count: _count };
}

function MistriaCompanion_update_mounted_interactions() {
    if (!__MistriaCompanion_runtime().mounted_interactions_enabled) return;
    for (var _index = 0; _index < instance_number(par_NPC); _index++) {
        var _npc = instance_find(par_NPC, _index);
        if (instance_exists(_npc)) __MistriaCompanion_install_mounted_npc(_npc);
    }
}

function __MistriaCompanion_seed_repeat_ready() {
    if (!instance_exists(obj_ari) || ARI == undefined || GRID == undefined
        || game_paused() || MIST.running || ARI.fire_breath_time > 0
        || ARI.held_animal_id != undefined || obj_ari.fsm.next_state != undefined)
    {
        return false;
    }
    var _state = obj_ari.fsm.current_state_id();
    return _state == PlayerState.Default || _state == PlayerState.MountDefault;
}

function __MistriaCompanion_seed_interaction_index(_list) {
    var _found = -1;
    for (var _index = 0; _index < _list.count(); _index++) {
        var _interaction = _list.get(_index);
        if (__MistriaCompanion_field(_interaction, "input_id") != InputId.Interact) continue;
        if (_found != -1
            || __MistriaCompanion_field(_interaction, "local_key") != "misc_local/interact")
        {
            return -1;
        }
        _found = _index;
    }
    return _found;
}

function __MistriaCompanion_seed_context_valid(_context) {
    var _renderer = _context.renderer;
    return instance_exists(_renderer)
        && _renderer.node == _context.node
        && _context.node.object_id == ObjectId.SeedMaker
        && _renderer.interactions == _context.list
        && _context.list.count() == _context.count
        && __MistriaCompanion_seed_interaction_index(_context.list) == _context.index
        && _context.list.get(_context.index) == _context.interaction
        && _context.interaction.callback == _context.callback
        && _context.interaction.can_interact_callback == _context.condition
        && _context.interaction.input_id == InputId.Interact
        && _renderer.attempt_interact == _context.wrapper;
}

function __MistriaCompanion_seed_repeat_valid(_repeat) {
    return __MistriaCompanion_seed_repeat_ready()
        && __MistriaCompanion_seed_context_valid(_repeat.context)
        && GRID == _repeat.grid
        && obj_ari.id == _repeat.player
        && obj_ari.x == _repeat.x && obj_ari.y == _repeat.y
        && obj_ari.cardinal == _repeat.cardinal
        && ARI.inventory == _repeat.inventory
        && ARI.held_item_index == _repeat.slot_index
        && ARI.held_item() == _repeat.item
        && _repeat.item.item_id == _repeat.item_id
        && _repeat.item.infusion == _repeat.infusion
        && _repeat.inventory.slot(_repeat.slot_index).count > 0;
}

function __MistriaCompanion_seed_action() {
    var _runtime = __MistriaCompanion_runtime();
    var _inventory = ARI.inventory;
    var _slot_index = ARI.held_item_index;
    var _slot = _inventory.slot(_slot_index);
    var _item = _slot.item;
    var _count = _slot.count;
    _runtime.seed_repeat = undefined;
    var _result = self.context.callback();
    if (_item != undefined && _slot.item == _item && _slot.count > 0
        && _slot.count == _count - 1 && _result != false
        && __MistriaCompanion_seed_repeat_ready()
        && __MistriaCompanion_seed_context_valid(self.context))
    {
        _runtime.seed_repeat = {
            context: self.context,
            grid: GRID,
            player: obj_ari.id,
            x: obj_ari.x, y: obj_ari.y, cardinal: obj_ari.cardinal,
            inventory: _inventory,
            slot_index: _slot_index,
            item: _item, item_id: _item.item_id, infusion: _item.infusion,
            last_frame: _runtime.frame,
            next_frame: _runtime.frame + self.delay
        };
    }
    return _result;
}

function __MistriaCompanion_seed_interact_held() {
    if (INPUT.input_overrides[InputId.Interact]) return false;
    if (INPUT.check(InputId.Interact)) return true;

    // Native take_press keeps Muted until the next press; read On without unmuting it.
    var _bindings = BINDINGS.bindings[InputId.Interact];
    for (var _slot = 0; _slot < array_length(_bindings); _slot++) {
        var _binding = _bindings[_slot];
        if (_binding == undefined) continue;
        var _keys;
        var _statuses;
        switch (_binding.type) {
            case BindingType.Keyboard:
                _keys = KEYBOARD_INPUTS;
                _statuses = INPUT.raw_keyboard;
                break;
            case BindingType.Mouse:
                _keys = MOUSE_BUTTONS;
                _statuses = INPUT.raw_mouse;
                break;
            case BindingType.GamepadButton:
                _keys = GAMEPAD_BUTTONS;
                _statuses = INPUT.raw_gp_buttons;
                break;
            default:
                continue;
        }
        var _index = array_index(_keys, _binding.keycode);
        if (_index != undefined && _index >= 0 && _index < array_length(_statuses)
            && has_flag(_statuses[_index], DigitalStatus.On)) return true;
    }
    return false;
}

function __MistriaCompanion_seed_attempt(_force_press=false) {
    var _held = __MistriaCompanion_seed_interact_held();
    var _callback = self.original(_force_press);
    __MistriaCompanion_record_seed_hint(self);
    var _runtime = __MistriaCompanion_runtime();
    if (_force_press || !_held || !__MistriaCompanion_seed_repeat_ready()
        || !__MistriaCompanion_seed_context_valid(self))
    {
        _runtime.seed_repeat = undefined;
        return _callback;
    }
    if (_callback != undefined) {
        _runtime.seed_repeat = undefined;
        if (_callback != self.callback) return _callback;
        return method({ context: self, delay: 30 }, __MistriaCompanion_seed_action);
    }
    var _repeat = _runtime.seed_repeat;
    if (_repeat == undefined) return undefined;
    if (_repeat.context != self || !__MistriaCompanion_seed_repeat_valid(_repeat)
        || _runtime.frame - _repeat.last_frame > 1)
    {
        _runtime.seed_repeat = undefined;
        return undefined;
    }
    if (_repeat.last_frame == _runtime.frame) return undefined;
    _repeat.last_frame = _runtime.frame;
    if (_runtime.frame < _repeat.next_frame) return undefined;
    if (self.condition() == false
        || mmapi_check_guards("input.take_press", {
            subject: self.renderer, input_id: InputId.Interact,
            local_key: self.interaction.local_key, interaction: self.interaction
        }) == false)
    {
        _runtime.seed_repeat = undefined;
        return undefined;
    }
    return method({ context: self, delay: 12 }, __MistriaCompanion_seed_action);
}

function __MistriaCompanion_install_seed_maker(_renderer) {
    if (__MistriaCompanion_field(_renderer, "__mistria_companion_seed_repeat") != undefined) return;
    var _list = __MistriaCompanion_field(_renderer, "interactions");
    if (_list == undefined) return;
    if (typeof(__MistriaCompanion_field(_list, "count")) != "method"
        || typeof(__MistriaCompanion_field(_list, "get")) != "method")
    {
        mmapi_warn_rate_limited("mistria_item_details:seed_list", "mistria_item_details",
            "Seed Maker repeat: unsupported interaction list; leaving normal controls unchanged.");
        return;
    }
    if (_list.count() == 0) return;
    // Seed Makers also have a native SecondaryInteract / Inspect entry.
    var _index = __MistriaCompanion_seed_interaction_index(_list);
    if (_index == -1) {
        mmapi_warn_rate_limited("mistria_item_details:seed_entries", "mistria_item_details",
            "Seed Maker repeat: expected one primary Interact action in "
            + string(_list.count()) + " entries; leaving normal controls unchanged.");
        return;
    }
    var _interaction = _list.get(_index);
    if (typeof(__MistriaCompanion_field(_interaction, "callback")) != "method"
        || typeof(__MistriaCompanion_field(_interaction, "can_interact_callback")) != "method"
        || typeof(__MistriaCompanion_field(_renderer, "attempt_interact")) != "method")
    {
        mmapi_warn_rate_limited("mistria_item_details:seed_callback", "mistria_item_details",
            "Seed Maker repeat: unsupported callbacks (action="
            + typeof(__MistriaCompanion_field(_interaction, "callback"))
            + ", condition=" + typeof(__MistriaCompanion_field(_interaction, "can_interact_callback"))
            + ", dispatcher=" + typeof(__MistriaCompanion_field(_renderer, "attempt_interact"))
            + "); leaving normal controls unchanged.");
        return;
    }
    var _context = {
        renderer: _renderer, node: _renderer.node, list: _list,
        interaction: _interaction, index: _index, count: _list.count(),
        callback: _interaction.callback, condition: _interaction.can_interact_callback,
        original: _renderer.attempt_interact
    };
    _context.wrapper = method(_context, __MistriaCompanion_seed_attempt);
    _renderer.__mistria_companion_seed_repeat = _context;
    _renderer.attempt_interact = _context.wrapper;
}

function MistriaCompanion_update_seed_makers() {
    var _runtime = __MistriaCompanion_runtime();
    var _repeat = _runtime.seed_repeat;
    if (_repeat != undefined && (!__MistriaCompanion_seed_repeat_valid(_repeat)
        || _runtime.frame - _repeat.last_frame > 1))
    {
        _runtime.seed_repeat = undefined;
    }
    // Only the game's chosen interactable can dispatch a repeat.
    for (var _index = 0; _index < INTERACTABLES.count(); _index++) {
        var _renderer = INTERACTABLES.get(_index);
        if (_renderer == undefined || !instance_exists(_renderer)
            || _renderer.object_index != obj_node_renderer) continue;
        var _node = __MistriaCompanion_field(_renderer, "node");
        if (__MistriaCompanion_field(_node, "object_id") == ObjectId.SeedMaker) {
            __MistriaCompanion_install_seed_maker(_renderer);
        }
    }
    __MistriaCompanion_update_seed_hint();
}

function __MistriaCompanion_seed_hint_active() {
    var _runtime = __MistriaCompanion_runtime();
    var _hint = _runtime.seed_hint;
    return _hint != undefined && _hint.frame >= _runtime.frame - 1 && _hint.frame <= _runtime.frame
        && __MistriaCompanion_seed_repeat_ready() && __MistriaCompanion_seed_context_valid(_hint.context)
        && GRID == _hint.grid && obj_ari.id == _hint.player
        && obj_ari.x == _hint.x && obj_ari.y == _hint.y && obj_ari.cardinal == _hint.cardinal;
}

function __MistriaCompanion_update_seed_hint() {
    var _runtime = __MistriaCompanion_runtime();
    var _visible = __MistriaCompanion_seed_hint_active();
    if (!_visible) _runtime.seed_hint = undefined;
    if (_runtime.seed_hint_visible == _visible) return;
    _runtime.seed_hint_visible = _visible;
    var _guide = __MistriaCompanion_menu(Menu.GlyphGuide);
    if (_guide != undefined) _guide.want_reset = true;
}

function __MistriaCompanion_record_seed_hint(_context) {
    var _runtime = __MistriaCompanion_runtime();
    var _guide = __MistriaCompanion_menu(Menu.GlyphGuide);
    var _inputs = __MistriaCompanion_field(_guide, "inputs");
    var _entry = is_array(_inputs) && InputId.Interact < array_length(_inputs)
        ? _inputs[InputId.Interact] : undefined;
    if (_entry != undefined && _entry.triggered_this_frame
        && _entry.local_key == "misc_local/interact"
        && __MistriaCompanion_seed_repeat_ready() && __MistriaCompanion_seed_context_valid(_context))
    {
        _runtime.seed_hint = {
            context: _context, frame: _runtime.frame, grid: GRID, player: obj_ari.id,
            x: obj_ari.x, y: obj_ari.y, cardinal: obj_ari.cardinal
        };
    } else {
        _runtime.seed_hint = undefined;
    }
    __MistriaCompanion_update_seed_hint();
}

function MistriaCompanion_seed_interact_label(_value, _key) {
    if (_key != "misc_local/interact" || !is_string(_value)
        || !__MistriaCompanion_seed_hint_active()) return undefined;
    return _value + " (hold to repeat)";
}

function __MistriaCompanion_keybind_names(_names) {
    if (array_length(_names) == 0) return "Not bound";
    var _text = "";
    for (var _index = 0; _index < array_length(_names); _index++) {
        if (_index > 0) _text += "\n";
        var _name = string_replace_all(_names[_index], "GAMEPAD_", "PAD ");
        _name = string_replace_all(_name, "_", " ");
        _text += string_replace_all(_name, "+", " + ");
    }
    return _text;
}

function __MistriaCompanion_settings_keybind_row(_scroller, _row) {
    var _element = _scroller.new_element(24);
    var _key_width = 44;
    var _keys = ANCHOR.text(_element)
        .set_xy(7, 4).set_lut(COMMON_LUT, CommonLutIndex.Dark)
        .set_max_width(_key_width).allow_line_breaks()
        .set_text(__MistriaCompanion_keybind_names(_row.bindings));
    var _action = ANCHOR.text(_element)
        .set_xy(7 + _key_width + 6, 4).set_lut(COMMON_LUT, CommonLutIndex.Dark)
        .set_max_width(_element.get_width() - _key_width - 20).allow_line_breaks()
        .set_text(_row.title);
    _keys.measure();
    _action.measure();
    var _height = max(24, max(_keys.get_height(), _action.get_height()) + 8);
    _scroller.add_height_to_element(_element, _height - 24);
}

function MistriaCompanion_configuration_row_think(_label, _key) {
    if (!_label.freed) {
        var _text = __MistriaCompanion_runtime()[$ _key] ? "On" : "Off";
        if (_label.get_text() != _text) _label.set_text(_text);
    }
}

function MistriaCompanion_toggle_configuration(_popup, _key) {
    if (_popup.close_requested || _popup.free_requested || _popup.hide_requests > 0) return;
    var _options = __MistriaCompanion_configuration_options();
    for (var _index = 0; _index < array_length(_options); _index++) {
        var _option = _options[_index];
        if (_option.key != _key) continue;
        var _runtime = __MistriaCompanion_runtime();
        _runtime[$ _key] = !_runtime[$ _key];
        if (_option.alert) {
            __MistriaCompanion_apply_alert_preferences(!_runtime[$ _key]
                && (_key == "bug_alerts_enabled" || _key == "legendary_fish_alerts_enabled"));
        } else {
            _runtime.map_signature = "";
            _runtime.scan_frame = -12;
        }
        var _saved = __MistriaCompanion_save_preferences();
        _popup.mistria_configuration_status.set_text(
            _saved ? "Changes saved automatically." : "Not saved. Changes apply only this session.");
        return;
    }
    mmapi_log_warn("mistria_item_details", "Unknown configuration option: " + string(_key));
}

function MistriaCompanion_show_configuration(_menu) {
    if (_menu.close_requested || _menu.free_requested || _menu.hide_requests > 0
        || _menu.active_page != undefined || _menu.option_scroller == undefined
        || _menu.option_scroller.canvas.freed || !_menu.option_scroller.canvas.is_unlocked()) return;
    var _existing = __MistriaCompanion_field(_menu, "mistria_configuration_popup");
    if (_existing != undefined && !_existing.close_requested && !_existing.free_requested) return;
    var _screen = ANCHOR.get_true_size();
    var _popup = popup_creator(undefined, undefined);
    _popup.backplate.set_width(min(300, _screen.x - 20));
    _popup.add_title(ANCHOR.wrap_for_local("Mistria Companion configuration"));
    _popup.add_description(ANCHOR.wrap_for_local(""));
    _popup.create_button("misc_local/close");
    _popup.body_text.disable();
    ANCHOR.free_node(_popup.body_text);
    var _status = ANCHOR.text(_popup.body)
        .set_xy(7, 0).set_max_width(_popup.body.get_width() - 14)
        .allow_line_breaks().set_lut(COMMON_LUT, CommonLutIndex.Dark)
        .set_text("Not saved. Changes apply only this session.");
    _status.measure();
    var _status_height = _status.get_height() + 8;
    _status.set_text("Changes saved automatically.");
    _popup.mistria_configuration_status = _status;
    var _height = max(32, _screen.y - 16 - 50 - _popup.header.get_height() - _popup.header.get_y());
    var _root = ANCHOR.positional(_popup.body)
        .set_xy(4, 4).set_size(_popup.body.get_width() - 8, _height - _status_height - 8);
    var _scroller = create_scroller(_root);
    var _pilot = _popup.new_pilot()
        .set_neighbor(_popup.pilot, Cardinal.North).set_neighbor(_popup.pilot, Cardinal.South);
    _popup.pilot.set_neighbor(_pilot, Cardinal.North).set_neighbor(_pilot, Cardinal.South);
    _scroller.subscribe_to_pilot(_pilot).scroll_with_stick();
    var _options = __MistriaCompanion_configuration_options();
    for (var _index = 0; _index < array_length(_options); _index++) {
        var _option = _options[_index];
        var _element = _scroller.new_element(28);
        var _button = ANCHOR.nine_slice(_element)
            .set_sprites_from_key("spr_ui_button").set_xy(3, 2)
            .set_size(_element.get_width() - 6, 24)
            .add_hover_outline().add_to_pilot(_pilot, true)
            .set_tap_callback(MistriaCompanion_toggle_configuration, [_popup, _option.key]);
        var _label = ANCHOR.text(_button).set_xy(5, 5)
            .set_max_width(_button.get_width() - 42).allow_line_breaks()
            .set_lut(COMMON_LUT, CommonLutIndex.Dark).set_text(_option.title);
        _label.measure();
        var _row_height = max(28, _label.get_height() + 14);
        _scroller.add_height_to_element(_element, _row_height - 28);
        _button.set_height(_row_height - 4);
        var _value = ANCHOR.text(_button).set_xy(_button.get_width() - 30, 5)
            .set_lut(COMMON_LUT, CommonLutIndex.Dark);
        _value.set_think_callback(MistriaCompanion_configuration_row_think, [_value, _option.key]);
        MistriaCompanion_configuration_row_think(_value, _option.key);
    }
    _status.set_y(_root.get_height() + 8);
    _popup.body.set_height(_root.get_height() + _status_height + 8);
    _popup.refresh_backplate_height();
    _menu.mistria_configuration_popup = _popup;
    _popup.spawn();
    ANCHOR.set_active_pilot(_pilot);
}

function MistriaCompanion_configuration_button_free(_pilot) {
    _pilot.reset();
}

function MistriaCompanion_update_settings_keybinds() {
    var _menu = __MistriaCompanion_menu(Menu.Settings);
    if (_menu == undefined || _menu.hide_requests > 0 || _menu.active_page != undefined) return;
    var _journal = __MistriaCompanion_field(_menu, "journal");
    var _parent = __MistriaCompanion_field(_journal, "right_full_body");
    if (_parent == undefined || _parent.freed) return;

    var _scroller = _menu.option_scroller;
    if (_scroller != undefined && !_scroller.canvas.freed) {
        if (_scroller.canvas.board_get("mistria_item_details_keybinds") == true
            && ON_GAMEPAD && ANCHOR.get_active_pilot() == _menu.category_pilot
            && _scroller.canvas.is_unlocked() && INPUT.gp_right_stick.y != 0)
        {
            _scroller.scroll_by_amount(INPUT.gp_right_stick.y * 4);
        }
        return;
    }

    // Native category selection frees option_scroller before showing its own options.
    _scroller = create_scroller(_parent);
    _scroller.canvas.board_set("mistria_item_details_keybinds", true);
    _menu.option_scroller = _scroller;
    var _pilot = __MistriaCompanion_field(_menu, "mistria_configuration_pilot");
    if (_pilot == undefined) {
        _pilot = _menu.new_pilot().set_neighbor(_menu.category_pilot, Cardinal.West);
        _menu.mistria_configuration_pilot = _pilot;
        _menu.category_pilot.set_neighbor(_pilot, Cardinal.East);
    }
    _scroller.subscribe_to_pilot(_pilot).scroll_with_stick();
    var _header = _scroller.new_element(24).set_sprites_from_key("spr_ui_generic_box_category");
    ANCHOR.text(_header)
        .set_text("Mistria Companion")
        .set_align(Align.Center, Align.Middle)
        .set_lut(COMMON_LUT, CommonLutIndex.Header);

    var _configuration = _scroller.new_element(28);
    ANCHOR.nine_slice(_configuration).set_sprites_from_key("spr_ui_button")
        .set_xy(4, 3).set_size(_configuration.get_width() - 8, 22)
        .add_text_label(ANCHOR.wrap_for_local("Configuration"), COMMON_LUT, CommonLutIndex.Dark)
        .add_hover_outline().add_to_pilot(_pilot)
        .set_free_callback(MistriaCompanion_configuration_button_free, [_pilot])
        .set_tap_callback(MistriaCompanion_show_configuration, [_menu]);

    var _rows = __MistriaCompanion_runtime().keybind_rows;
    for (var _index = 0; _index < array_length(_rows); _index++) {
        __MistriaCompanion_settings_keybind_row(_scroller, _rows[_index]);
    }
    var _footer = _scroller.new_element(24);
    var _note = ANCHOR.text(_footer)
        .set_xy(7, 4).set_lut(COMMON_LUT, CommonLutIndex.Dark)
        .set_max_width(_footer.get_width() - 14).allow_line_breaks()
        .set_text("Wiki links work with hints off.");
    _note.measure();
    _scroller.add_height_to_element(_footer, max(0, _note.get_height() + 8 - 24));
}

function __MistriaCompanion_field(_value, _field) {
    if (_value == undefined) return undefined;
    if (is_array(_value) || is_string(_value)) return undefined;
    if (!is_struct(_value) && !instance_exists(_value)) return undefined;
    return _value[$ _field];
}

function __MistriaCompanion_as_array(_value) {
    if (is_array(_value)) return _value;
    if (is_struct(_value)) {
        var _buffer = __MistriaCompanion_field(_value, "__buffer");
        var _count = __MistriaCompanion_field(_value, "__count");
        if (is_array(_buffer) && is_real(_count)) {
            var _result = [];
            for (var _index = 0; _index < min(_count, array_length(_buffer)); _index++) {
                array_push(_result, _buffer[_index]);
            }
            return _result;
        }
    }
    return [];
}

function __MistriaCompanion_name(_item_data) {
    if (_item_data == undefined) return "Unknown";
    var _name_key = __MistriaCompanion_field(_item_data, "name_key");
    if (_name_key != undefined) {
        var _name = local_get(_name_key);
        if (is_string(_name)) return _name;
    }
    var _recipe_key = __MistriaCompanion_field(_item_data, "recipe_key");
    if (_recipe_key != undefined) {
        return string_replace(_recipe_key, "_", " ");
    }
    return "Unknown";
}

function __MistriaCompanion_npc_name(_npc_data, _fallback) {
    var _name = __MistriaCompanion_field(_npc_data, "name");
    if (is_string(_name)) {
        var _localized_name = local_get(_name);
        if (is_string(_localized_name) && _localized_name != _name) return _localized_name;

        var _name_parts = string_split(_name, "/");
        if (array_length(_name_parts) >= 2) {
            var _internal_name = _name_parts[array_length(_name_parts) - 2];
            return string_upper(string_char_at(_internal_name, 1))
                + string_copy(_internal_name, 2, string_length(_internal_name));
        }
        return _name;
    }
    var _name_key = __MistriaCompanion_field(_npc_data, "name_key");
    if (_name_key != undefined) {
        var _localized_name = local_get(_name_key);
        if (is_string(_localized_name)) return _localized_name;
    }
    return string_replace(_fallback, "_", " ");
}

function __MistriaCompanion_component_matches(_component, _item_id, _item_key) {
    if (!is_struct(_component)) return false;
    var _component_item_id = __MistriaCompanion_field(_component, "item_id");
    if (_component_item_id != undefined && _component_item_id == _item_id) return true;

    var _ingredient = __MistriaCompanion_field(_component, "item");
    if (_ingredient == undefined) return false;
    if (_ingredient == _item_id || _ingredient == _item_key) return true;
    if (is_struct(_ingredient)) {
        return __MistriaCompanion_component_matches(_ingredient, _item_id, _item_key);
    }
    return false;
}

function __MistriaCompanion_recipe_uses_item(_recipe_data, _item_id, _item_key) {
    if (!is_struct(_recipe_data)) return false;

    var _components = __MistriaCompanion_field(_recipe_data, "recipe");
    if (_components == undefined) return false;
    var _nested_components = __MistriaCompanion_field(_components, "components");
    if (_nested_components != undefined) {
        _components = _nested_components;
    }
    _components = __MistriaCompanion_as_array(_components);
    for (var _index = 0; _index < array_length(_components); _index++) {
        if (__MistriaCompanion_component_matches(_components[_index], _item_id, _item_key)) {
            return true;
        }
    }
    return false;
}

function __MistriaCompanion_join(_names) {
    var _result = "";
    for (var _index = 0; _index < array_length(_names); _index++) {
        if (_index > 0) _result += ", ";
        _result += _names[_index];
    }
    return _result;
}

function __MistriaCompanion_has_name(_names, _name) {
    for (var _index = 0; _index < array_length(_names); _index++) {
        if (_names[_index] == _name) return true;
    }
    return false;
}

function __MistriaCompanion_name_index(_names, _name) {
    for (var _index = 0; _index < array_length(_names); _index++) {
        if (_names[_index] == _name) return _index;
    }
    return -1;
}

function __MistriaCompanion_recipe_summary(_recipes) {
    var _count = array_length(_recipes);
    if (_count == 0) return "";
    if (_count == 1) return _recipes[0];
    if (string_length(_recipes[0]) > 20) return string(_count) + " recipes";
    return _recipes[0] + " (+" + string(_count - 1) + ")";
}

function __MistriaCompanion_location_name(_location_id) {
    var _key = location_id_to_string(_location_id);
    var _words = string_split(_key, "_");
    var _result = "";
    for (var _index = 0; _index < array_length(_words); _index++) {
        if (_index > 0) _result += " ";
        var _word = _words[_index];
        _result += string_upper(string_char_at(_word, 1))
            + string_copy(_word, 2, string_length(_word));
    }
    return _result;
}

function __MistriaCompanion_dig_spot_visit_key() {
    var _key = __MistriaCompanion_legendary_day_key() + ":"
        + string(CURRENT_LOCATION_ID) + ":"
        + string(CURRENT_DYN_INDEX) + ":"
        + string(room()) + ":"
        + string(__MistriaCompanion_field(GRID, "node_counter"));
    if (DUNGEON_RUNNER != undefined) {
        var _level = DUNGEON_RUNNER.current_level();
        _key += ":" + string(DUNGEON_RUNNER.current_floor)
            + ":" + string(__MistriaCompanion_field(_level, "impl"));
    }
    return _key;
}

function __MistriaCompanion_scan_dig_spots() {
    var _spots = [];
    if (GRID == undefined) return _spots;

    var _node_len = __MistriaCompanion_field(GRID, "node_len");
    var _object_ids = __MistriaCompanion_field(GRID, "node_object_id");
    var _top_left_x = __MistriaCompanion_field(GRID, "node_top_left_x");
    var _top_left_y = __MistriaCompanion_field(GRID, "node_top_left_y");
    if (_node_len == undefined
        || !is_array(_object_ids)
        || !is_array(_top_left_x)
        || !is_array(_top_left_y))
    {
        return undefined;
    }

    var _scan_length = min(_node_len, array_length(_object_ids));
    _scan_length = min(_scan_length, array_length(_top_left_x));
    _scan_length = min(_scan_length, array_length(_top_left_y));
    for (var _index = 0; _index < _scan_length; _index++) {
        if (_object_ids[_index] != ObjectId.DigSite) continue;

        var _x = _top_left_x[_index];
        var _y = _top_left_y[_index];
        if (_x == undefined || _y == undefined) continue;
        var _parent_index = GRID.try_node_index_for_cell(_x, _y);
        if (_parent_index == undefined || _index != _parent_index) continue;

        array_push(_spots, {
            grid_x: _x,
            grid_y: _y,
            x: (_x * 8) + 8,
            y: (_y * 8) + 8
        });
    }
    return _spots;
}

function __MistriaCompanion_dig_spot_active(_spot) {
    if (GRID == undefined) return false;
    var _index = GRID.try_node_index_for_cell(_spot.grid_x, _spot.grid_y);
    return _index != undefined && GRID.node_object_id[_index] == ObjectId.DigSite;
}

function __MistriaCompanion_dig_spot_location_name() {
    var _name = __MistriaCompanion_location_name(CURRENT_LOCATION_ID);
    if (DUNGEON_RUNNER != undefined) {
        _name += " Floor " + string(DUNGEON_RUNNER.current_floor + 1);
    }
    return _name;
}

function __MistriaCompanion_dig_notice_blocked() {
    if (MIST != undefined && MIST.running) return true;
    if (has_flag(PAUSE_STATUS, PauseStatus.CUTSCENE)) return true;
    var _textbox = __MistriaCompanion_menu(Menu.Textbox);
    return _textbox != undefined && _textbox.hide_requests == 0;
}

function MistriaCompanion_dig_notice_think(_node) {
    var _runtime = __MistriaCompanion_runtime();
    if (!_node.freed && (!_runtime.dig_spot_alerts_enabled || _runtime.dig_spot_toast != _node
        || __MistriaCompanion_dig_notice_blocked())) _node.set_alpha(0);
}

function MistriaCompanion_show_dig_spot_notice() {
    var _runtime = __MistriaCompanion_runtime();
    var _notice = _runtime.dig_spot_notice;
    if (_notice == undefined) return;
    if (!_runtime.dig_spot_alerts_enabled || GRID == undefined
        || GRID != _notice.grid || __MistriaCompanion_dig_spot_visit_key() != _notice.visit_key)
    {
        _runtime.dig_spot_notice = undefined;
        return;
    }
    if (__MistriaCompanion_dig_notice_blocked() || __MistriaCompanion_field(GRID, "is_setup") != true) {
        _notice.wait_frames = 12;
        return;
    }
    // A short clear interval avoids notices between scene setup and dialogue.
    if (_notice.wait_frames > 0) {
        _notice.wait_frames--;
        return;
    }
    var _count = 0;
    for (var _index = 0; _index < array_length(_runtime.dig_spots); _index++) {
        if (__MistriaCompanion_dig_spot_active(_runtime.dig_spots[_index])) _count++;
    }
    if (_count == 0) {
        _runtime.dig_spot_notice = undefined;
        return;
    }
    var _menu = __MistriaCompanion_menu(Menu.InfoToasts);
    if (_menu == undefined) {
        mmapi_warn_rate_limited("mistria_item_details:dig_notice_menu", "mistria_item_details",
            "Waiting for the notification menu to show the dig-spot count.");
        return;
    }
    var _shown = _menu.create_notification(ANCHOR.wrap_for_local(
        "Dig spots: " + string(_count)), 60 * 3);
    if (_shown) {
        var _node = _menu.toasts.last();
        _runtime.dig_spot_toast = _node;
        _node.set_think_callback(MistriaCompanion_dig_notice_think, [_node]);
    }
    _runtime.dig_spot_notice = undefined;
}

function MistriaCompanion_detect_dig_spots() {
    var _runtime = __MistriaCompanion_runtime();
    if (GRID == undefined) {
        _runtime.dig_spot_visit_key = "";
        _runtime.dig_spot_delay = -1;
        _runtime.dig_spot_notice = undefined;
        _runtime.dig_spots = [];
        return;
    }

    var _visit_key = __MistriaCompanion_dig_spot_visit_key();
    if (_runtime.dig_spot_visit_key != _visit_key) {
        _runtime.dig_spot_visit_key = _visit_key;
        _runtime.dig_spot_delay = 0;
        _runtime.dig_spot_notice = undefined;
        _runtime.dig_spots = [];
        return;
    }

    if (__MistriaCompanion_field(GRID, "is_setup") != true) return;
    if (_runtime.dig_spot_delay > 0) {
        _runtime.dig_spot_delay--;
        return;
    }
    if (_runtime.dig_spot_delay != 0) return;
    var _spots = __MistriaCompanion_scan_dig_spots();
    if (_spots == undefined) {
        mmapi_warn_rate_limited("mistria_item_details:dig_ready", "mistria_item_details",
            "Waiting for dig-site grid data.");
        return;
    }
    _runtime.dig_spots = _spots;
    _runtime.dig_spot_delay = -1;
    var _count = array_length(_runtime.dig_spots);
    if (_count == 0 || !_runtime.dig_spot_alerts_enabled) return;

    _runtime.dig_spot_notice = { grid: GRID, visit_key: _visit_key, wait_frames: 12 };
}

function __MistriaCompanion_count_diving_spots() {
    var _count = 0;
    var _length = instance_number(obj_divespot);
    for (var _index = 0; _index < _length; _index++) {
        var _spot = instance_find(obj_divespot, _index);
        if (_spot == undefined || !instance_exists(_spot)
            || __MistriaCompanion_field(_spot, "visible") == false) continue;
        if (__MistriaCompanion_field(_spot, "dive_loot") == undefined) {
            mmapi_warn_rate_limited("mistria_item_details:diving_ready", "mistria_item_details",
                "Waiting for diving-spot data before showing the area count.");
            return undefined;
        }
        _count++;
    }
    return _count;
}

function MistriaCompanion_diving_notice_think(_node, _visit) {
    if (_node.freed) return;
    var _runtime = __MistriaCompanion_runtime();
    if (!__MistriaCompanion_ready() || !_runtime.diving_spot_alerts_enabled
        || _runtime.diving_spot_visit != _visit || _visit.toast != _node || GRID != _visit.grid
        || __MistriaCompanion_local_visit_key() != _visit.key
        || __MistriaCompanion_sightings_transition_active() || game_paused()
        || __MistriaCompanion_dig_notice_blocked())
    {
        // Leave the native queue and its FIFO lifecycle untouched.
        _node.set_alpha(0);
    }
}

function MistriaCompanion_detect_diving_spots() {
    var _runtime = __MistriaCompanion_runtime();
    if (GRID == undefined || __MistriaCompanion_sightings_transition_active()) {
        _runtime.diving_spot_visit = undefined;
        return;
    }
    if (__MistriaCompanion_field(GRID, "is_setup") != true) return;
    var _key = __MistriaCompanion_local_visit_key();
    var _visit = _runtime.diving_spot_visit;
    if (_visit == undefined || _visit.grid != GRID || _visit.key != _key) {
        _visit = {
            grid: GRID, key: _key, pending: _runtime.diving_spot_alerts_enabled,
            wait_frames: 12, toast: undefined
        };
        _runtime.diving_spot_visit = _visit;
    }
    if (!_runtime.diving_spot_alerts_enabled) _visit.pending = false;
    if (!_visit.pending) return;
    if (game_paused() || __MistriaCompanion_dig_notice_blocked()) {
        _visit.wait_frames = 12;
        return;
    }
    if (_visit.wait_frames > 0) {
        _visit.wait_frames--;
        return;
    }
    var _menu = __MistriaCompanion_menu(Menu.InfoToasts);
    if (_menu == undefined) {
        mmapi_warn_rate_limited("mistria_item_details:diving_menu", "mistria_item_details",
            "Waiting for the notification menu to show the diving-spot count.");
        return;
    }
    if (_menu.hide_requests > 0 || !_menu.canvas.get_enabled() || _menu.canvas.get_alpha() <= 0) return;
    var _count = __MistriaCompanion_count_diving_spots();
    if (_count == undefined) return;
    _visit.pending = false;
    if (_count == 0) return;
    // Visit state handles duplicates; equal counts in different areas must not suppress each other.
    if (_menu.create_notification(ANCHOR.wrap_for_local("Diving spots: " + string(_count)), undefined)) {
        _visit.toast = _menu.toasts.last();
        _visit.toast.set_think_callback(MistriaCompanion_diving_notice_think, [_visit.toast, _visit]);
    }
}

function __MistriaCompanion_legendary_day_key() {
    return string(total_days());
}

function __MistriaCompanion_track_legendary(_kind, _item_id) {
    var _runtime = __MistriaCompanion_runtime();
    var _day = __MistriaCompanion_legendary_day_key();
    if (_runtime.legendary_day != _day) {
        _runtime.legendary_day = _day;
        _runtime.legendary_sightings = [];
        _runtime.seen_spawns = {};
    }

    var _seen_key = _kind + ":" + string(_item_id);
    if (__MistriaCompanion_field(_runtime.seen_spawns, _seen_key) == true) return false;
    var _item_data = global[$ "__item_data"];
    if (!is_array(_item_data) || _item_id < 0 || _item_id >= array_length(_item_data)) return false;
    _runtime.seen_spawns[$ _seen_key] = true;

    var _location = __MistriaCompanion_location_name(CURRENT_LOCATION_ID);
    var _name = __MistriaCompanion_name(_item_data[_item_id]);
    var _entry = _kind + ": " + _name + " - " + _location;
    if (__MistriaCompanion_has_name(_runtime.legendary_sightings, _entry)) return false;

    array_push(_runtime.legendary_sightings, _entry);
    return true;
}

function __MistriaCompanion_visit_legendary_fish(_fish, _callback) {
    var _prototype = __MistriaCompanion_field(_fish, "prototype");
    if (_prototype == undefined || _prototype.legendary != true) return;
    _callback(_prototype.item);
}

function __MistriaCompanion_each_live_bug(_callback) {
    for (var _index = 0; _index < instance_number(obj_bug); _index++) {
        var _bug = instance_find(obj_bug, _index);
        if (_bug == undefined || !instance_exists(_bug) || _bug.item_id == undefined) continue;
        var _bug_data = BUGS.get(_bug.item_id);
        if (_bug_data != undefined) _callback(_bug.item_id, _bug_data);
    }
}

function __MistriaCompanion_each_live_legendary_fish(_callback) {
    for (var _index = 0; _index < instance_number(obj_fishy); _index++) {
        var _fish = instance_find(obj_fishy, _index);
        if (_fish == undefined || !instance_exists(_fish)) continue;
        if (_fish.fish_loot != undefined) {
            __MistriaCompanion_visit_legendary_fish(_fish.fish_loot, _callback);
        }
    }

    for (var _index = 0; _index < instance_number(obj_fish_school); _index++) {
        var _school = instance_find(obj_fish_school, _index);
        if (_school == undefined || !instance_exists(_school)) continue;
        if (_school.fish_in_school == undefined) continue;
        for (var _fish_index = 0; _fish_index < _school.fish_in_school.count(); _fish_index++) {
            __MistriaCompanion_visit_legendary_fish(_school.fish_in_school.get(_fish_index), _callback);
        }
    }
}

function __MistriaCompanion_sightings_transition_active() {
    // Both room-transition hooks run before the fade-out and actual room swap.
    return TAXI != undefined && TAXI.is_traveling();
}

function __MistriaCompanion_retire_sightings_notice(_node) {
    if (_node == undefined || _node.freed || _node.marked_for_death) return;
    _node.set_alpha(0).disable();
    ANCHOR.free_node(_node);
}

function MistriaCompanion_reset_local_sightings(_ctx) {
    var _runtime = __MistriaCompanion_runtime();
    var _diving = _runtime.diving_spot_visit;
    if (_diving != undefined && _diving.toast != undefined && !_diving.toast.freed) _diving.toast.set_alpha(0);
    _runtime.diving_spot_visit = undefined;
    var _replay = _runtime.sightings_replay;
    if (_replay != undefined) __MistriaCompanion_retire_sightings_notice(_replay.toast);
    _runtime.local_sightings = undefined;
    _runtime.sightings_replay = undefined;
}

function __MistriaCompanion_local_visit_key() {
    var _key = __MistriaCompanion_legendary_day_key() + ":" + string(CURRENT_LOCATION_ID)
        + ":" + string(CURRENT_DYN_INDEX) + ":" + string(room());
    if (DUNGEON_RUNNER != undefined) {
        _key += ":" + string(DUNGEON_RUNNER.current_floor)
            + ":" + string(__MistriaCompanion_field(DUNGEON_RUNNER.current_level(), "impl"));
    }
    return _key;
}

function __MistriaCompanion_add_local_species(_species, _item_id, _active, _caught) {
    var _items = global[$ "__item_data"];
    if (!is_array(_items) || _item_id == undefined || _item_id < 0 || _item_id >= array_length(_items)) {
        mmapi_warn_rate_limited("mistria_item_details:sighting_item", "mistria_item_details",
            "An unrecognized sighting item could not be included in the local report.");
        return;
    }
    var _key = string(_item_id);
    var _entry = __MistriaCompanion_field(_species, _key);
    if (_entry == undefined) {
        _entry = { item_id: _item_id, active: 0, caught: 0 };
        _species[$ _key] = _entry;
    }
    _entry.active += _active;
    _entry.caught += _caught;
}

function __MistriaCompanion_update_local_sightings() {
    if (__MistriaCompanion_sightings_transition_active()) return undefined;
    var _catches = __MistriaCompanion_field(GAME_STATS, "bugs_caught");
    if (GRID == undefined || __MistriaCompanion_field(GRID, "is_setup") != true
        || BUGS == undefined || !is_array(_catches) || !is_array(global[$ "__item_data"])) return undefined;
    var _runtime = __MistriaCompanion_runtime();
    var _key = __MistriaCompanion_local_visit_key();
    var _local = _runtime.local_sightings;
    if (_local == undefined || _local.grid != GRID || _local.key != _key
        || _local.stats != GAME_STATS || _local.catch_index > array_length(_catches))
    {
        _local = { grid: GRID, key: _key, stats: GAME_STATS,
            catch_index: array_length(_catches), caught: {},
            seen_bugs: {}, pending_bugs: {}, pending_fish: {}, notice_wait: 12, entry_pending: true };
        _runtime.local_sightings = _local;
    }
    // The native net action appends this log only for catches, not purchases or despawns.
    for (var _index = _local.catch_index; _index < array_length(_catches); _index++) {
        var _record = _catches[_index];
        var _name = __MistriaCompanion_field(_record, "bug");
        var _item_id = is_string(_name) ? try_string_to_item_id(_name) : undefined;
        if (_item_id == undefined || BUGS.get(_item_id) == undefined) {
            mmapi_warn_rate_limited("mistria_item_details:sighting_catch", "mistria_item_details",
                "An unrecognized bug catch could not be included in the local report.");
            continue;
        }
        __MistriaCompanion_add_local_species(_local.caught, _item_id, 0, 1);
    }
    _local.catch_index = array_length(_catches);
    return _local;
}

function __MistriaCompanion_collect_local_bug(_item_id, _data) {
    __MistriaCompanion_add_local_species(self.bugs, _item_id, 1, 0);
}

function __MistriaCompanion_collect_local_fish(_item_id) {
    __MistriaCompanion_add_local_species(self.fish, _item_id, 1, 0);
}

function __MistriaCompanion_local_species_rows(_species) {
    var _keys = struct_get_names(_species);
    var _rows = [];
    for (var _index = 0; _index < array_length(_keys); _index++) {
        array_push(_rows, _species[$ _keys[_index]]);
    }
    array_sort(_rows, function(_left, _right) { return _left.item_id - _right.item_id; });
    return _rows;
}

function __MistriaCompanion_live_sightings() {
    var _report = { bugs: {}, fish: {} };
    __MistriaCompanion_each_live_bug(method(_report, __MistriaCompanion_collect_local_bug));
    __MistriaCompanion_each_live_legendary_fish(method(_report, __MistriaCompanion_collect_local_fish));
    return _report;
}

function MistriaCompanion_track_local_spawns() {
    var _local = __MistriaCompanion_update_local_sightings();
    if (_local == undefined || FISH == undefined) return;
    var _runtime = __MistriaCompanion_runtime();
    var _live = __MistriaCompanion_live_sightings();
    if (!__MistriaCompanion_sighting_alerts_enabled()) _local.entry_pending = false;
    var _bugs = __MistriaCompanion_local_species_rows(_live.bugs);
    var _fish = __MistriaCompanion_local_species_rows(_live.fish);
    var _pending_bugs = {};
    var _pending_fish = {};
    for (var _index = 0; _index < array_length(_bugs); _index++) {
        var _key = string(_bugs[_index].item_id);
        var _new = __MistriaCompanion_field(_local.seen_bugs, _key) != true;
        _local.seen_bugs[$ _key] = true;
        if (_runtime.bug_alerts_enabled
            && (_new || __MistriaCompanion_field(_local.pending_bugs, _key) == true))
        {
            _pending_bugs[$ _key] = true;
            if (_new) _local.notice_wait = 12;
        }
    }
    for (var _index = 0; _index < array_length(_fish); _index++) {
        var _item_id = _fish[_index].item_id;
        var _key = string(_item_id);
        var _new = __MistriaCompanion_track_legendary("Legendary Fish", _item_id);
        if (_runtime.legendary_fish_alerts_enabled
            && (_new || __MistriaCompanion_field(_local.pending_fish, _key) == true))
        {
            _pending_fish[$ _key] = true;
            if (_new) _local.notice_wait = 12;
        }
    }
    _local.pending_bugs = _pending_bugs;
    _local.pending_fish = _pending_fish;
}

function __MistriaCompanion_local_sightings_report(_pending=undefined, _automatic=false) {
    var _local = __MistriaCompanion_update_local_sightings();
    if (_local == undefined || FISH == undefined) return undefined;
    var _report = __MistriaCompanion_live_sightings();
    var _bugs = __MistriaCompanion_local_species_rows(_report.bugs);
    var _fish = __MistriaCompanion_local_species_rows(_report.fish);
    var _items = global[$ "__item_data"];
    var _text = "";
    if (_pending == undefined && DUNGEON_RUNNER != undefined) {
        _text = __MistriaCompanion_dig_spot_location_name();
    }
    var _included = 0;
    for (var _index = 0; _index < array_length(_bugs); _index++) {
        if (_automatic && !__MistriaCompanion_runtime().bug_alerts_enabled) break;
        var _entry = _bugs[_index];
        if (_pending != undefined
            && __MistriaCompanion_field(_pending.bugs, string(_entry.item_id)) != true) continue;
        if (_text != "") _text += "\n";
        _text += __MistriaCompanion_name(_items[_entry.item_id]) + ": "
            + string(_entry.active);
        _included++;
    }
    for (var _index = 0; _index < array_length(_fish); _index++) {
        if (_automatic && !__MistriaCompanion_runtime().legendary_fish_alerts_enabled) break;
        var _entry = _fish[_index];
        if (_pending != undefined
            && __MistriaCompanion_field(_pending.fish, string(_entry.item_id)) != true) continue;
        if (_text != "") _text += "\n";
        _text += "Legendary fish - " + __MistriaCompanion_name(_items[_entry.item_id])
            + ": " + string(_entry.active) + " active";
        _included++;
    }
    if (_included == 0) {
        if (_pending != undefined || _automatic) return "";
        if (_text != "") _text += "\n";
        _text += "No bugs here. No legendary fish active here.";
    }
    return _text;
}

function MistriaCompanion_show_local_sightings() {
    if (!__MistriaCompanion_ready()) {
        __MistriaCompanion_notify("Sightings are available during gameplay.", 60);
        return;
    }
    var _runtime = __MistriaCompanion_runtime();
    if (_runtime.sightings_replay != undefined) return;
    MistriaCompanion_track_local_spawns();
    var _text = __MistriaCompanion_local_sightings_report();
    if (_text == undefined) {
        __MistriaCompanion_notify("Sightings are not ready yet. Try again after the area loads.", 60 * 3);
        return;
    }
    var _local = _runtime.local_sightings;
    _local.pending_bugs = {};
    _local.pending_fish = {};
    _local.entry_pending = false;
    _runtime.sightings_replay = {
        grid: GRID, visit_key: _local.key, local: _local, automatic: false, text: _text, toast: undefined
    };
    MistriaCompanion_replay_local_sightings();
}

function __MistriaCompanion_size_sightings_notice(_node, _menu) {
    var _top = _menu.base_y;
    for (var _index = 0; _index < _menu.toasts.count(); _index++) {
        var _other = _menu.toasts.get(_index);
        if (_other.freed || !_other.get_enabled() || _other.get_alpha() <= 0) continue;
        _top = max(_top, _other.get_y() + _other.get_height() + 4);
    }
    var _text = _node.board_get("text");
    var _max_height = ANCHOR.get_true_size().y - _top - 8;
    var _line_height = _text.get_line_height();
    if (_line_height == undefined) _line_height = font_line_height(_text.get_font());
    if (_max_height < max(26, _line_height + 12)) return false;
    _node.set_y(_top);
    var _lines_per_page = max(1, floor((_max_height - 12) / _line_height));
    var _pages = _node.board_get("mistria_sightings_pages");
    var _end = min(array_length(_pages.lines), _pages.start + _lines_per_page);
    if (_end != _pages.end) {
        var _page = "";
        for (var _index = _pages.start; _index < _end; _index++) {
            if (_index > _pages.start) _page += "\n";
            _page += _pages.lines[_index];
        }
        _text.set_text(_page);
        _node.set_height(max(26, _text.measure().y + 12));
        _pages.end = _end;
        _pages.wait = max(240, min(600, (_end - _pages.start) * 30));
        _node.board_set("timer", _pages.wait);
    }
    return true;
}

function __MistriaCompanion_create_sightings_notice(_contents, _menu) {
    var _node = ANCHOR.nine_slice(_menu.canvas)
        .set_sprite(spr_ui_hud_quest_toast_box).set_xy(0, _menu.base_y).set_alpha(0);
    _node.cache_is_dirty = true;
    ANCHOR.sprite(_node).set_sprite(spr_ui_hud_quest_toast_icon)
        .set_xy(5, 0).set_align(Align.LeftIn, Align.Middle);
    var _text_x = 9 + sprite_get_width(spr_ui_hud_quest_toast_icon);
    var _text = ANCHOR.text(_node).set_xy(_text_x, 6)
        .set_max_width(180 - _text_x - 10).set_lut(COMMON_LUT)
        .allow_line_breaks().set_text(_contents);
    var _size = _text.measure();
    _node.set_width(min(180, _text_x + _size.x + 10));
    _node.set_x(-_node.get_width());
    _node.board_set("text", _text);
    _node.board_set("mistria_sightings_menu", _menu);
    _node.board_set("mistria_sightings_pages", {
        lines: string_split(_text.display_text, "\n"), start: 0, end: 0, wait: 0
    });
    _node.board_set("mistria_sightings_motion", { phase: "in", frame: 0 });
    if (__MistriaCompanion_size_sightings_notice(_node, _menu)) _node.set_alpha(1);
    return _node;
}

function MistriaCompanion_sightings_notice_think(_node, _local, _automatic) {
    if (_node.freed || _node.marked_for_death) return;
    var _runtime = __MistriaCompanion_runtime();
    var _menu = __MistriaCompanion_menu(Menu.InfoToasts);
    if (!__MistriaCompanion_ready() || _runtime.local_sightings != _local || GRID != _local.grid
        || __MistriaCompanion_local_visit_key() != _local.key
        || _menu != _node.board_get("mistria_sightings_menu")
        || __MistriaCompanion_sightings_transition_active()
        || (_automatic && !__MistriaCompanion_sighting_alerts_enabled()))
    {
        __MistriaCompanion_retire_sightings_notice(_node);
        return;
    }
    if (game_paused() || __MistriaCompanion_dig_notice_blocked() || _menu.hide_requests > 0
        || !_menu.canvas.get_enabled() || _menu.canvas.get_alpha() <= 0
        || !__MistriaCompanion_size_sightings_notice(_node, _menu))
    {
        _node.set_alpha(0);
        return;
    }
    _node.set_alpha(1);
    var _motion = _node.board_get("mistria_sightings_motion");
    if (_motion.phase != "read") {
        // Match the native notification's 30-frame QuartOut slide in both directions.
        _motion.frame++;
        var _remaining = 1 - min(1, _motion.frame / 30);
        var _curve = _remaining * _remaining * _remaining * _remaining;
        _node.set_x(-_node.get_width() * (_motion.phase == "in" ? _curve : 1 - _curve));
        if (_motion.frame >= 30) {
            if (_motion.phase == "out") {
                __MistriaCompanion_retire_sightings_notice(_node);
            } else {
                _motion.phase = "read";
                _node.set_x(0);
            }
        }
        return;
    }
    var _pages = _node.board_get("mistria_sightings_pages");
    _pages.wait--;
    _node.board_set("timer", _pages.wait);
    if (_pages.wait <= 0) {
        if (_pages.end < array_length(_pages.lines)) {
            _pages.start = _pages.end;
            _pages.end = 0;
        } else {
            _motion.phase = "out";
            _motion.frame = 0;
        }
    }
}

function MistriaCompanion_replay_local_sightings() {
    if (__MistriaCompanion_sightings_transition_active()) return;
    var _runtime = __MistriaCompanion_runtime();
    var _replay = _runtime.sightings_replay;
    if (_replay == undefined) {
        var _local = _runtime.local_sightings;
        if (_local == undefined || !__MistriaCompanion_sighting_alerts_enabled() || GRID != _local.grid
            || __MistriaCompanion_local_visit_key() != _local.key
            || (!_local.entry_pending && array_length(struct_get_names(_local.pending_bugs)) == 0
                && array_length(struct_get_names(_local.pending_fish)) == 0)) return;
        if (game_paused() || __MistriaCompanion_dig_notice_blocked()) {
            _local.notice_wait = 12;
            return;
        }
        if (_local.notice_wait > 0) {
            _local.notice_wait--;
            return;
        }
        if (array_length(struct_get_names(_local.pending_bugs)) == 0
            && array_length(struct_get_names(_local.pending_fish)) == 0)
        {
            _local.entry_pending = false;
            return;
        }
        var _menu = __MistriaCompanion_menu(Menu.InfoToasts);
        if (_menu == undefined || _menu.hide_requests > 0 || !_menu.canvas.get_enabled()
            || _menu.canvas.get_alpha() <= 0) return;
        var _pending = undefined;
        if (!_local.entry_pending) _pending = { bugs: _local.pending_bugs, fish: _local.pending_fish };
        var _text = __MistriaCompanion_local_sightings_report(_pending, true);
        if (_text == undefined) {
            mmapi_warn_rate_limited("mistria_item_details:auto_sightings", "mistria_item_details",
                "Waiting for local sighting data to show the automatic bug and fish notice.");
            return;
        }
        _local.pending_bugs = {};
        _local.pending_fish = {};
        _local.entry_pending = false;
        if (_text == "") return;
        _replay = {
            grid: GRID, visit_key: _local.key, local: _local, automatic: true, text: _text, toast: undefined
        };
        _runtime.sightings_replay = _replay;
    }
    if (GRID != _replay.grid || __MistriaCompanion_local_visit_key() != _replay.visit_key
        || _runtime.local_sightings != _replay.local
        || (_replay.automatic && !__MistriaCompanion_sighting_alerts_enabled()))
    {
        __MistriaCompanion_retire_sightings_notice(_replay.toast);
        _runtime.sightings_replay = undefined;
        return;
    }
    if (_replay.toast != undefined) {
        if (_replay.toast.freed || _replay.toast.marked_for_death) {
            _runtime.sightings_replay = undefined;
        }
        return;
    }
    if (game_paused() || __MistriaCompanion_dig_notice_blocked()) return;
    var _menu = __MistriaCompanion_menu(Menu.InfoToasts);
    if (_menu == undefined || _menu.hide_requests > 0 || !_menu.canvas.get_enabled()
        || _menu.canvas.get_alpha() <= 0) return;
    // Own only this UI node, not the game's FIFO notification queue or its lifetimes.
    _replay.toast = __MistriaCompanion_create_sightings_notice(_replay.text, _menu);
    _replay.toast.set_think_callback(MistriaCompanion_sightings_notice_think,
        [_replay.toast, _replay.local, _replay.automatic]);
}

function __MistriaCompanion_farm_status_unavailable(_reason) {
    mmapi_warn_rate_limited("mistria_item_details:farm_status", "mistria_item_details",
        "Farm status unavailable: " + _reason);
    return undefined;
}

function __MistriaCompanion_farm_status_counts() {
    return { empty: 0, ready: 0, growing: 0, unwatered: 0 };
}

function __MistriaCompanion_scan_farm_grid(_grid, _find_greenhouses) {
    var _dims = __MistriaCompanion_field(_grid, "dims");
    var _width = __MistriaCompanion_field(_dims, "x");
    var _height = __MistriaCompanion_field(_dims, "y");
    var _length = __MistriaCompanion_field(_grid, "node_len");
    if (!is_real(_width) || !is_real(_height) || _width < 1 || _height < 1
        || _width != floor(_width) || _height != floor(_height) || _length != _width * _height
        || typeof(__MistriaCompanion_field(_grid, "node_index_for_cell")) != "method")
    {
        return __MistriaCompanion_farm_status_unavailable("a farm or greenhouse grid has not loaded.");
    }
    var _arrays = ["node_parent", "node_object_id", "node_terrain_ground_kind", "node_terrain_is_watered"];
    for (var _index = 0; _index < array_length(_arrays); _index++) {
        var _array = __MistriaCompanion_field(_grid, _arrays[_index]);
        if (!is_array(_array) || array_length(_array) < _length) {
            return __MistriaCompanion_farm_status_unavailable("a grid's crop or terrain data is incomplete.");
        }
    }
    var _counts = __MistriaCompanion_farm_status_counts();
    var _greenhouses = [];
    var _seen = {};
    for (var _index = 0; _index < _length; _index++) {
        var _node = _grid.node_parent[_index];
        if (_node == undefined) {
            if (_grid.node_object_id[_index] != undefined) {
                return __MistriaCompanion_farm_status_unavailable("an occupied grid cell has no object data.");
            }
            continue;
        }
        var _x = __MistriaCompanion_field(_node, "top_left_x");
        var _y = __MistriaCompanion_field(_node, "top_left_y");
        var _prototype = __MistriaCompanion_field(_node, "prototype");
        if (!is_real(_x) || !is_real(_y) || _x < 0 || _y < 0 || _x >= _width || _y >= _height
            || _x != floor(_x) || _y != floor(_y) || _prototype == undefined)
        {
            return __MistriaCompanion_farm_status_unavailable("an object's grid position or prototype is unavailable.");
        }
        var _root = _grid.node_index_for_cell(_x, _y);
        var _key = string(_root);
        if (__MistriaCompanion_field(_seen, _key) == true) continue;
        _seen[$ _key] = true;
        if (_find_greenhouses
            && __MistriaCompanion_field(_prototype, "player_building_kind") == PlayerBuildingKind.Greenhouse)
        {
            var _dyn_index = __MistriaCompanion_field(_node, "dyn_index");
            if (!is_real(_dyn_index) || _dyn_index < 0 || _dyn_index != floor(_dyn_index)) {
                return __MistriaCompanion_farm_status_unavailable("a greenhouse has no valid interior index.");
            }
            array_push(_greenhouses, _dyn_index);
        }
        if (_prototype.category_id != ObjectCategory.Crop
            || _grid.node_terrain_ground_kind[_root] != GroundKind.Soil) continue;
        if (_grid.node_terrain_is_watered[_root] == undefined) {
            return __MistriaCompanion_farm_status_unavailable("a planted crop's watering state is unavailable.");
        }
        if (can_interact(_node)) _counts.ready++;
        else _counts.growing++;
        if (!_grid.node_terrain_is_watered[_root]) _counts.unwatered++;
    }
    // A plantable plot is 2x2 native grid cells; occupied or partially tilled plots are not empty.
    for (var _y = 0; _y + 1 < _height; _y += 2) {
        for (var _x = 0; _x + 1 < _width; _x += 2) {
            var _empty = true;
            for (var _dy = 0; _dy < 2; _dy++) {
                for (var _dx = 0; _dx < 2; _dx++) {
                    var _index = _grid.node_index_for_cell(_x + _dx, _y + _dy);
                    if (_grid.node_terrain_ground_kind[_index] != GroundKind.Soil
                        || _grid.node_object_id[_index] != undefined || _grid.node_parent[_index] != undefined)
                    {
                        _empty = false;
                    }
                }
            }
            if (_empty) _counts.empty++;
        }
    }
    return { counts: _counts, greenhouses: _greenhouses };
}

function __MistriaCompanion_farm_status_add(_total, _counts) {
    _total.empty += _counts.empty;
    _total.ready += _counts.ready;
    _total.growing += _counts.growing;
    _total.unwatered += _counts.unwatered;
}

function __MistriaCompanion_farm_status_snapshot() {
    if (!is_array(GRIDS) || LocationId.Farm >= array_length(GRIDS)) {
        return __MistriaCompanion_farm_status_unavailable("the farm grid registry is not ready.");
    }
    var _farm = __MistriaCompanion_scan_farm_grid(GRIDS[LocationId.Farm], true);
    if (_farm == undefined) return undefined;
    var _report = {
        farm: _farm.counts, greenhouse: __MistriaCompanion_farm_status_counts(),
        total: __MistriaCompanion_farm_status_counts(), greenhouse_count: 0
    };
    var _seen = {};
    for (var _index = 0; _index < array_length(_farm.greenhouses); _index++) {
        var _dyn_index = _farm.greenhouses[_index];
        var _key = string(_dyn_index);
        if (__MistriaCompanion_field(_seen, _key) == true) continue;
        _seen[$ _key] = true;
        if (DYNAMIC_GRIDS == undefined
            || typeof(__MistriaCompanion_field(DYNAMIC_GRIDS, "count")) != "method"
            || typeof(__MistriaCompanion_field(DYNAMIC_GRIDS, "get")) != "method"
            || _dyn_index >= DYNAMIC_GRIDS.count())
        {
            return __MistriaCompanion_farm_status_unavailable("a built greenhouse's interior is not loaded.");
        }
        var _greenhouse = __MistriaCompanion_scan_farm_grid(DYNAMIC_GRIDS.get(_dyn_index), false);
        if (_greenhouse == undefined) return undefined;
        __MistriaCompanion_farm_status_add(_report.greenhouse, _greenhouse.counts);
        _report.greenhouse_count++;
    }
    __MistriaCompanion_farm_status_add(_report.total, _report.farm);
    __MistriaCompanion_farm_status_add(_report.total, _report.greenhouse);
    return _report;
}

function __MistriaCompanion_farm_status_section(_title, _counts) {
    return _title + "\nEmpty tilled spots: " + string(_counts.empty)
        + "\nReady to harvest: " + string(_counts.ready)
        + "\nPlanted, not ready: " + string(_counts.growing)
        + "\nUnwatered crops: " + string(_counts.unwatered);
}

function MistriaCompanion_show_farm_status() {
    var _runtime = __MistriaCompanion_runtime();
    var _existing = _runtime.farm_status_popup;
    if (_existing != undefined && !_existing.close_requested && !_existing.free_requested) return;
    if (!__MistriaCompanion_ready()) {
        __MistriaCompanion_notify("Farm status is available during gameplay.", 60 * 2);
        return;
    }
    if (game_paused() || __MistriaCompanion_dig_notice_blocked()
        || __MistriaCompanion_sightings_transition_active())
    {
        __MistriaCompanion_notify("Close menus or dialogue and finish traveling before opening farm status.", 60 * 3);
        return;
    }
    var _report = __MistriaCompanion_farm_status_snapshot();
    if (_report == undefined) {
        __MistriaCompanion_notify("Farm status data is not ready. Try again after the game finishes loading.", 60 * 3);
        return;
    }
    var _text = __MistriaCompanion_farm_status_section("Farm", _report.farm)
        + "\n\n" + __MistriaCompanion_farm_status_section("Greenhouse", _report.greenhouse);
    if (_report.greenhouse_count == 0) _text += "\nNo greenhouse built.";
    var _popup = __MistriaCompanion_text_popup("Farm status", _text);
    _runtime.farm_status_popup = _popup;
    _popup.spawn();
}

function MistriaCompanion_toggle_clock() {
    if (!__MistriaCompanion_ready()) {
        __MistriaCompanion_notify("Clock controls are available during gameplay.", 60);
        return;
    }
    var _runtime = __MistriaCompanion_runtime();
    _runtime.clock_paused = !_runtime.clock_paused;
    __MistriaCompanion_notify(
        _runtime.clock_paused ? "Clock paused." : "Clock pause released.", 60 * 2);
}

function MistriaCompanion_open_wiki() {
    var _title = __MistriaCompanion_resolve_wiki_title();
    if (_title == "") {
        __MistriaCompanion_notify("Select an item, villager or supported map marker first.", 60);
        return;
    }
    _title = string_replace_all(_title, "%", "%25");
    _title = string_replace_all(_title, "#", "%23");
    _title = string_replace_all(_title, "?", "%3F");
    clipboard_set_text("https://fieldsofmistria.wiki.gg/wiki/" + string_replace_all(_title, " ", "_"));
    __MistriaCompanion_notify("Wiki link copied to clipboard.", 60 * 3);
}

function MistriaCompanion_toggle_wiki_hints() {
    var _runtime = __MistriaCompanion_runtime();
    _runtime.wiki_hints_enabled = !_runtime.wiki_hints_enabled;
    _runtime.wiki_hint_title = "";
    var _saved = __MistriaCompanion_save_preferences();
    __MistriaCompanion_notify(
        (_runtime.wiki_hints_enabled ? "Wiki hints enabled." : "Wiki hints disabled.")
            + (_saved ? "" : " Preference not saved."), 60);
}

function MistriaCompanion_toggle_all_bug_markers() {
    var _runtime = __MistriaCompanion_runtime();
    _runtime.all_bug_markers_enabled = !_runtime.all_bug_markers_enabled;
    _runtime.scan_frame = -12;
    var _saved = __MistriaCompanion_save_preferences();
    __MistriaCompanion_notify(
        (_runtime.all_bug_markers_enabled
            ? (_runtime.bug_markers_enabled ? "Ordinary bug map markers enabled."
                : "Ordinary bugs enabled; bug map display is off.")
            : "Ordinary bug map markers disabled.")
            + (_saved ? "" : " Preference not saved."), 60 * 2);
}

function MistriaCompanion_toggle_notifications() {
    var _runtime = __MistriaCompanion_runtime();
    var _enabled = !__MistriaCompanion_any_alerts_enabled();
    var _options = __MistriaCompanion_configuration_options();
    for (var _index = 0; _index < array_length(_options); _index++) {
        if (_options[_index].alert) _runtime[$ _options[_index].key] = _enabled == true;
    }
    __MistriaCompanion_apply_alert_preferences(!_enabled);
    var _saved = __MistriaCompanion_save_preferences();
    __MistriaCompanion_notify(
        (_runtime.notifications_enabled ? "Automatic alerts enabled." : "Automatic alerts disabled.")
            + (_saved ? "" : " Preference not saved."), 60 * 2);
}

function __MistriaCompanion_show_wiki_hint() {
    var _runtime = __MistriaCompanion_runtime();
    if (!_runtime.wiki_hints_enabled || _runtime.wiki_title == ""
        || _runtime.wiki_hint_title == _runtime.wiki_title)
    {
        return;
    }
    var _key = __MistriaCompanion_field(_runtime.bindings, "wiki");
    var _toasts_menu = __MistriaCompanion_menu(Menu.InfoToasts);
    if (_key == undefined || _toasts_menu == undefined || !_toasts_menu.toasts.is_empty()) return;
    if (!_toasts_menu.create_notification(ANCHOR.wrap_for_local(_key + " Wiki"), 60)) return;
    if (_toasts_menu.toasts.is_empty()) return;
    var _hint = _toasts_menu.toasts.last();
    var _y_chain = _hint.board_get("y_chain");
    if (_y_chain != undefined) CHAINS.cancel_chain(_y_chain);
    _hint.board_set("y_chain", undefined);
    _hint.set_y(4);
    _runtime.wiki_hint_title = _runtime.wiki_title;
}

function __MistriaCompanion_set_wiki_title(_title) {
    if (is_string(_title) && _title != "") __MistriaCompanion_runtime().wiki_title = _title;
}

function __MistriaCompanion_resolve_wiki_title() {
    var _runtime = __MistriaCompanion_runtime();
    _runtime.wiki_title = "";
    __MistriaCompanion_update_museum_label(undefined);
    if (!__MistriaCompanion_ready()) return "";

    for (var _index = ANCHOR.open_menus.count() - 1; _index >= 0; _index--) {
        var _menu = ANCHOR.open_menus.get(_index);
        if (_menu.close_requested || _menu.free_requested || _menu.hide_requests > 0) continue;
        if (__MistriaCompanion_field(_menu, "is_tooltip") != true) continue;
        __MistriaCompanion_fit_node(__MistriaCompanion_field(_menu, "backplate"));
        var _source = __MistriaCompanion_field(_menu, "source_node");
        if (_source != undefined && (_source.freed || !_source.is_hovered())) continue;
        var _store = __MistriaCompanion_menu(Menu.Store);
        if (_source == undefined
            && (_store == undefined || _store.hide_requests > 0 || _store.tooltip != _menu)) continue;
        var _item = __MistriaCompanion_field(_menu, "item");
        if (_item == undefined) continue;
        __MistriaCompanion_set_wiki_title(__MistriaCompanion_name(_item.prototype));
        return _runtime.wiki_title;
    }

    var _map = __MistriaCompanion_menu(Menu.Map);
    if (_map != undefined && _map.hide_requests == 0 && _map == _runtime.map_menu) {
        for (var _index = 0; _index < array_length(_runtime.map_wiki_nodes); _index++) {
            var _entry = _runtime.map_wiki_nodes[_index];
            if (!_entry.node.freed && _entry.node.get_enabled() && _entry.node.is_hovered()) {
                __MistriaCompanion_set_wiki_title(_entry.title);
                return _runtime.wiki_title;
            }
        }
    }
    var _crafting = __MistriaCompanion_menu(Menu.Crafting);
    if (_crafting != undefined && _crafting.hide_requests == 0 && _crafting.item != undefined) {
        __MistriaCompanion_set_wiki_title(__MistriaCompanion_name(_crafting.item.prototype));
        return _runtime.wiki_title;
    }
    MistriaCompanion_capture_npc_context();
    if (_runtime.wiki_title != "") return _runtime.wiki_title;
    MistriaCompanion_capture_quest_item_context();
    if (_runtime.wiki_title != "") return _runtime.wiki_title;
    MistriaCompanion_capture_museum_wing_context();
    return _runtime.wiki_title;
}

function __MistriaCompanion_fit_node(_plate) {
    if (_plate == undefined || _plate.freed) return;
    var _size = _plate.get_size();
    var _screen = ANCHOR.screen_canvas.get_size();
    var _signature = string(_size.x) + ":" + string(_size.y)
        + ":" + string(_screen.x) + ":" + string(_screen.y);
    if (_plate.board_get("mistria_item_details_bounds") == _signature) return;
    var _position = ANCHOR.get_screen_position(_plate);
    var _x = max(4, min(_position.x, _screen.x - _size.x - 4));
    var _y = max(4, min(_position.y, _screen.y - _size.y - 4));
    _plate.add_x(_x - _position.x).add_y(_y - _position.y);
    _plate.board_set("mistria_item_details_bounds", _signature);
}

function __MistriaCompanion_set_npc_wiki_title(_npc_id) {
    var _prototypes = __MistriaCompanion_as_array(global[$ "__npc_prototypes"]);
    if (_npc_id < 0 || _npc_id >= array_length(_prototypes)) return;

    var _name = __MistriaCompanion_npc_name(_prototypes[_npc_id], "");
    if (_name != "") {
        __MistriaCompanion_set_wiki_title(_name);
    }
}

function MistriaCompanion_capture_npc_context() {
    var _relationships = __MistriaCompanion_menu(Menu.Relationships);
    if (_relationships != undefined && _relationships.hide_requests == 0
        && _relationships.npc_id_current != undefined) {
        __MistriaCompanion_set_npc_wiki_title(_relationships.npc_id_current);
        return;
    }

    var _calendar = __MistriaCompanion_menu(Menu.Calendar);
    if (_calendar == undefined || _calendar.hide_requests > 0 || _calendar.grid_area == undefined) return;

    var _day_index = 0;
    for (var _index = 0; _index < array_length(_calendar.grid_area.children); _index++) {
        var _tile = _calendar.grid_area.children[_index];
        if (_tile.get_width() != 40 || _tile.get_height() != 40) continue;
        if (_tile.is_hovered()) {
            var _prototypes = __MistriaCompanion_as_array(global[$ "__npc_prototypes"]);
            var _season = get_seasons(_calendar.time);
            for (var _npc_id = 0; _npc_id < array_length(_prototypes); _npc_id++) {
                var _prototype = _prototypes[_npc_id];
                if (_prototype.birthday.season == _season && _prototype.birthday.day == _day_index + 1) {
                    __MistriaCompanion_set_npc_wiki_title(_npc_id);
                    return;
                }
            }
            return;
        }
        _day_index++;
    }
}

function __MistriaCompanion_hud_bottom(_node, _exclude) {
    if (_node == undefined || _node == _exclude || _node.freed || _node.marked_for_death
        || !_node.get_enabled() || _node.get_alpha() <= 0) return 0;
    var _position = ANCHOR.get_screen_position(_node);
    var _bottom = _position.y + _node.get_height();
    for (var _index = 0; _index < array_length(_node.children); _index++) {
        _bottom = max(_bottom, __MistriaCompanion_hud_bottom(_node.children[_index], _exclude));
    }
    return _bottom;
}

function __MistriaCompanion_hud_overlaps(_node, _x, _y, _width, _height) {
    if (_node == undefined || _node.freed || _node.marked_for_death
        || !_node.get_enabled() || _node.get_alpha() <= 0) return false;
    if (_node.type == NodeId.Sprite || _node.type == NodeId.Text || _node.type == NodeId.Typewriter) {
        var _position = ANCHOR.get_screen_position(_node);
        if (_x < _position.x + _node.get_width() && _x + _width > _position.x
            && _y < _position.y + _node.get_height() && _y + _height > _position.y) return true;
    }
    for (var _index = 0; _index < array_length(_node.children); _index++) {
        if (__MistriaCompanion_hud_overlaps(_node.children[_index], _x, _y, _width, _height)) return true;
    }
    return false;
}

function MistriaCompanion_status_label_think(_label, _vitals) {
    if (_label.freed || _vitals.root.freed) return;
    if (game_paused() || __MistriaCompanion_dig_notice_blocked() || _vitals.hide_requests > 0
        || _vitals.close_requested || _vitals.free_requested || !_vitals.root.get_enabled())
    {
        _label.set_alpha(0);
        return;
    }
    var _root_position = ANCHOR.get_screen_position(_vitals.root);
    var _screen = ANCHOR.get_true_size();
    var _y = __MistriaCompanion_hud_bottom(_vitals.root, _label) + 4;
    _label.set_max_width(min(160, max(1, _screen.x - _root_position.x - 4)));
    _label.set_xy(0, _y - _root_position.y);
    var _size = _label.measure();
    var _visible = _y + _size.y <= _screen.y - 4;
    var _hud_menus = [Menu.InfoHud, Menu.Toolbar, Menu.GlyphGuide];
    for (var _index = 0; _index < array_length(_hud_menus); _index++) {
        var _hud = __MistriaCompanion_menu(_hud_menus[_index]);
        if (_hud != undefined && _hud.hide_requests == 0
            && __MistriaCompanion_hud_overlaps(_hud.canvas, _root_position.x, _y, _size.x, _size.y)) {
            _visible = false;
            break;
        }
    }
    var _notices = [];
    var _toasts = __MistriaCompanion_menu(Menu.InfoToasts);
    if (_toasts != undefined) {
        for (var _index = 0; _index < _toasts.toasts.count(); _index++) {
            array_push(_notices, _toasts.toasts.get(_index));
        }
    }
    var _replay = __MistriaCompanion_runtime().sightings_replay;
    if (_replay != undefined && _replay.toast != undefined) array_push(_notices, _replay.toast);
    for (var _index = 0; _index < array_length(_notices); _index++) {
        var _toast = _notices[_index];
        if (_toast.freed || !_toast.get_enabled() || _toast.get_alpha() <= 0) continue;
        var _position = ANCHOR.get_screen_position(_toast);
        if (_root_position.x < _position.x + _toast.get_width()
            && _root_position.x + _size.x > _position.x
            && _y < _position.y + _toast.get_height() && _y + _size.y > _position.y)
        {
            _visible = false;
            break;
        }
    }
    _label.set_alpha(_visible ? 1 : 0);
}

function MistriaCompanion_update_birthday_label() {
    var _vitals = __MistriaCompanion_menu(Menu.Vitals);
    if (_vitals == undefined || _vitals.mana_icon == undefined || _vitals.root == undefined) return;

    var _label = _vitals.mana_icon.board_get("mistria_item_details_birthday_label");
    if (_label == undefined) {
        _label = ANCHOR.text(_vitals.root)
            .set_align(Align.LeftIn, Align.TopIn)
            .set_xy(0, 0)
            .set_lut(COMMON_LUT)
            .set_text_align(TextAlign.Left)
            .set_max_width(160)
            .allow_line_breaks()
            .disable();
        _label.set_think_callback(MistriaCompanion_status_label_think, [_label, _vitals]);
        _vitals.mana_icon.board_set("mistria_item_details_birthday_label", _label);
    }

    var _runtime = __MistriaCompanion_runtime();
    var _day = __MistriaCompanion_legendary_day_key();
    if (_runtime.birthday_day != _day) {
        var _names = [];
        var _prototypes = __MistriaCompanion_as_array(global[$ "__npc_prototypes"]);
        for (var _npc_id = 0; _npc_id < array_length(_prototypes); _npc_id++) {
            var _birthday = __MistriaCompanion_field(_prototypes[_npc_id], "birthday");
            if (_birthday == undefined
                || _birthday.season != CALENDAR.season()
                || _birthday.day != CALENDAR.day() + 1)
            {
                continue;
            }

            var _name = __MistriaCompanion_npc_name(_prototypes[_npc_id], "");
            if (_name != "" && !__MistriaCompanion_has_name(_names, _name)) {
                array_push(_names, _name);
            }
        }
        _runtime.birthday_text = array_length(_names) == 0
            ? "" : "Birthday: " + __MistriaCompanion_join(_names);
        _runtime.birthday_day = _day;
    }

    var _text = _runtime.birthday_text;
    if (_runtime.clock_paused) {
        if (_text != "") _text += "\n";
        _text += "Clock paused";
    }
    if (_label.board_get("mistria_item_details_text") != _text) {
        _label.board_set("mistria_item_details_text", _text);
        _label.set_text(_text).set_enabled(_text != "");
    }
    if (_text != "") MistriaCompanion_status_label_think(_label, _vitals);
}

function MistriaCompanion_capture_quest_item_context() {
    var _quest_log = __MistriaCompanion_menu(Menu.QuestLog);
    if (_quest_log == undefined || _quest_log.hide_requests > 0 || _quest_log.right_scroller == undefined
        || _quest_log.active_quest == undefined)
    {
        return;
    }

    var _item_data = global[$ "__item_data"];
    if (!is_array(_item_data)) return;

    var _quest = QUESTS.get_unwrap(_quest_log.active_quest);
    var _active_quest = QUEST_LOG.active.get(_quest_log.active_quest);
    if (_quest_log.context == QuestLogContext.Journal && _active_quest == undefined) return;
    var _blackboard = _active_quest == undefined ? undefined : _active_quest.blackboard;
    if (_quest.tasks.is_empty()
        || !ANCHOR.point_in_node(_quest_log.right_scroller.canvas, MOUSE_GUI_X, MOUSE_GUI_Y))
    {
        return;
    }

    var _task_index = _quest_log.context == QuestLogContext.Journal
        ? min(_active_quest.current_stage, _quest.tasks.count() - 1)
        : 0;
    var _listings = gather_listings_from_requirements(
        _quest.tasks.get(_task_index).requirements,
        _blackboard
    );
    var _objective_item = undefined;
    for (var _listing_index = 0; _listing_index < _listings.count(); _listing_index++) {
        var _item = __MistriaCompanion_field(_listings.get(_listing_index), "item");
        if (_item == undefined) continue;
        if (_objective_item != undefined) return;
        _objective_item = _item;
    }

    if (_objective_item == undefined) return;
    var _item_id = _objective_item.item_id;
    if (_item_id >= 0 && _item_id < array_length(_item_data)) {
        __MistriaCompanion_set_wiki_title(
            __MistriaCompanion_name(_item_data[_item_id])
        );
    }
}

function __MistriaCompanion_museum_warning() {
    mmapi_warn_rate_limited("mistria_item_details:museum_slots", "mistria_item_details",
        "Museum item lookup: unsupported collection slots; leaving the native menu unchanged.");
}

function __MistriaCompanion_museum_wiki_title(_prototype) {
    if (local_language() != "eng") {
        mmapi_warn_rate_limited("mistria_item_details:museum_wiki_language", "mistria_item_details",
            "Museum wiki lookup: English item titles are unavailable in this language; using the wing page.");
        return "";
    }
    var _key = __MistriaCompanion_field(_prototype, "name_key");
    if (is_string(_key) && _key != "") {
        var _title = local_get(_key);
        if (is_string(_title) && _title != "" && _title != _key
            && _title != "MISSING" && _title != "PLACEHOLDER")
        {
            return _title;
        }
    }
    mmapi_warn_rate_limited("mistria_item_details:museum_wiki_name", "mistria_item_details",
        "Museum wiki lookup: item name unavailable; using the wing page.");
    return "";
}

function __MistriaCompanion_museum_slots(_row, _set) {
    var _ids = __MistriaCompanion_field(_set, "items");
    var _children = __MistriaCompanion_field(_row, "children");
    if (!is_array(_ids) || !is_array(_children) || !is_array(ITEM_PROTOTYPES)) {
        __MistriaCompanion_museum_warning();
        return [];
    }
    var _cached = _row.board_get("mistria_item_details_museum_slots");
    if (_cached != undefined && array_length(_cached.items) == array_length(_ids)
        && array_length(_cached.children) == array_length(_children))
    {
        var _matches = true;
        for (var _index = 0; _index < array_length(_ids); _index++) {
            if (_cached.items[_index] != _ids[_index]) _matches = false;
        }
        for (var _index = 0; _index < array_length(_children); _index++) {
            if (_cached.children[_index] != _children[_index]) _matches = false;
        }
        if (_matches) return _cached.slots;
    }

    var _items = List();
    for (var _index = 0; _index < array_length(_ids); _index++) {
        var _id = _ids[_index];
        if (!is_real(_id) || _id != floor(_id) || _id < 0
            || _id >= array_length(ITEM_PROTOTYPES) || !is_struct(ITEM_PROTOTYPES[_id]))
        {
            __MistriaCompanion_museum_warning();
            return [];
        }
        _items.push(new LiveItem(_id));
    }
    // MuseumMenu draws collection icons in this localized order, not set.items order.
    _items.sort_with(function(_left, _right) {
        return string_alphanumeric_comparison(_left.get_display_name(), _right.get_display_name());
    });

    var _icons = [];
    for (var _index = 0; _index < array_length(_children); _index++) {
        if (__MistriaCompanion_field(_children[_index], "type") == NodeId.Sprite) {
            array_push(_icons, _children[_index]);
        }
    }
    // The final sprite is the native collection progress indicator.
    if (array_length(_icons) != _items.count() + 1) {
        __MistriaCompanion_museum_warning();
        return [];
    }
    var _slots = [];
    for (var _index = 0; _index < _items.count(); _index++) {
        var _item = _items.get(_index);
        var _node = _icons[_index];
        if (_node.freed || _node.sprite != _item.get_ui_icon()) {
            __MistriaCompanion_museum_warning();
            return [];
        }
        array_push(_slots, { node: _node, item: _item });
    }
    _row.board_set("mistria_item_details_museum_slots", {
        items: __MistriaCompanion_copy_array(_ids),
        children: __MistriaCompanion_copy_array(_children),
        slots: _slots
    });
    return _slots;
}

function __MistriaCompanion_museum_target() {
    var _menu = __MistriaCompanion_menu(Menu.Museum);
    if (_menu == undefined || _menu.hide_requests > 0 || !ANCHOR.in_point_control()
        || !_menu.canvas.is_unlocked() || !_menu.right_page.get_enabled())
    {
        return undefined;
    }
    var _row = ANCHOR.current_hovered_node;
    if (_row == undefined || _row.freed || _row.marked_for_death
        || _row.pilot != _menu.set_pilot || !_row.is_unlocked() || !_row.is_hovered()
        || !ANCHOR.point_in_node(_row, MOUSE_GUI_X, MOUSE_GUI_Y)
        || !ANCHOR.point_in_node(_row.canvas, MOUSE_GUI_X, MOUSE_GUI_Y))
    {
        return undefined;
    }
    var _tap = __MistriaCompanion_field(__MistriaCompanion_field(_row, "event_callbacks"), "tap");
    var _args = __MistriaCompanion_field(_tap, "arg_array");
    var _wings = __MistriaCompanion_field(MUSEUM_DATA, "data");
    var _wing = _menu.canvas.board_get("selected_wing");
    if (!is_array(_args) || array_length(_args) < 2 || !is_array(_wings)
        || !is_real(_wing) || _wing != floor(_wing) || _wing < 0 || _wing >= array_length(_wings))
    {
        __MistriaCompanion_museum_warning();
        return undefined;
    }
    var _sets = __MistriaCompanion_field(_wings[_wing], "sets");
    if (typeof(__MistriaCompanion_field(_sets, "get")) != "method"
        || _sets.get(_args[1]) != _args[0])
    {
        __MistriaCompanion_museum_warning();
        return undefined;
    }
    var _slots = __MistriaCompanion_museum_slots(_row, _args[0]);
    for (var _index = 0; _index < array_length(_slots); _index++) {
        var _slot = _slots[_index];
        var _node = _slot.node;
        if (_node.freed || _node.marked_for_death || !_node.is_unlocked()
            || !ANCHOR.point_in_node(_node, MOUSE_GUI_X, MOUSE_GUI_Y)) continue;
        var _id = _slot.item.item_id;
        if (_node.sprite != _slot.item.get_ui_icon() || !is_array(MUSEUM_PROGRESS)
            || _id >= array_length(MUSEUM_PROGRESS)
            || (MUSEUM_PROGRESS[_id] != true && MUSEUM_PROGRESS[_id] != false))
        {
            __MistriaCompanion_museum_warning();
            return undefined;
        }
        return { node: _node, item: _slot.item, donated: MUSEUM_PROGRESS[_id] };
    }
    return undefined;
}

function __MistriaCompanion_update_museum_label(_target) {
    var _runtime = __MistriaCompanion_runtime();
    var _menu = __MistriaCompanion_menu(Menu.Museum);
    var _plate = __MistriaCompanion_field(_runtime, "museum_label");
    if (_plate != undefined && (_plate.freed || _menu == undefined || _plate.parent != _menu.canvas)) {
        if (!_plate.freed) ANCHOR.free_node(_plate);
        _runtime.museum_label = undefined;
        _plate = undefined;
    }
    if (_target == undefined || _target.donated || _menu == undefined || _menu.hide_requests > 0) {
        if (_plate != undefined) _plate.disable();
        return;
    }
    var _name = _target.item.get_display_name();
    if (!is_string(_name) || _name == "" || _name == "MISSING" || _name == "PLACEHOLDER"
        || _name == _target.item.prototype.name_key)
    {
        __MistriaCompanion_museum_warning();
        if (_plate != undefined) _plate.disable();
        return;
    }
    if (_plate == undefined) {
        // Keep the name outside the scroller's clipped canvas, without taking input.
        _plate = ANCHOR.nine_slice(_menu.canvas)
            .set_sprite(spr_ui_tooltip_box).set_z(-100);
        var _text = ANCHOR.text(_plate)
            .set_xy(4, 4).set_lut(COMMON_LUT, CommonLutIndex.Header)
            .allow_line_breaks();
        _plate.board_set("name", _text);
        _runtime.museum_label = _plate;
    }
    var _screen = ANCHOR.screen_canvas.get_size();
    var _text = _plate.board_get("name");
    _text.set_ghost_key(_target.item.prototype.name_key)
        .set_max_width(min(172, _screen.x - 16)).set_text(_name);
    _text.measure();
    _plate.set_size(_text.get_width() + 8, _text.get_height() + 8);
    var _position = ANCHOR.get_screen_position(_target.node);
    var _origin = ANCHOR.get_screen_position(_menu.canvas);
    _plate.set_xy(_position.x - _origin.x,
        _position.y - _origin.y + _target.node.get_height() + 3).enable();
    _plate.board_set("mistria_item_details_bounds", undefined);
    __MistriaCompanion_fit_node(_plate);
}

function MistriaCompanion_capture_museum_wing_context() {
    var _museum = __MistriaCompanion_menu(Menu.Museum);
    if (_museum == undefined || _museum.hide_requests > 0) return;

    var _target = __MistriaCompanion_museum_target();
    __MistriaCompanion_update_museum_label(_target);
    if (_target != undefined) {
        var _item_title = __MistriaCompanion_museum_wiki_title(_target.item.prototype);
        if (_item_title != "") {
            __MistriaCompanion_set_wiki_title(_item_title);
            return;
        }
    }
    var _title = "";
    switch (_museum.canvas.board_get("selected_wing")) {
        case MuseumWing.Archaeology: _title = "Archaeology Wing"; break;
        case MuseumWing.Fish: _title = "Fish Wing"; break;
        case MuseumWing.Flora: _title = "Flora Wing"; break;
        case MuseumWing.Insect: _title = "Insects Wing"; break;
    }

    if (_title != "" && _museum.right_page.get_enabled() && _museum.canvas.is_unlocked()
        && ANCHOR.point_in_node(_museum.right_body, MOUSE_GUI_X, MOUSE_GUI_Y))
    {
        __MistriaCompanion_set_wiki_title(_title);
    }
}

function MistriaCompanion_map_label_think(_marker, _label, _name) {
    var _hovered = _marker.is_hovered();
    _label.set_alpha(_hovered ? 1 : 0);
    if (_hovered) {
        _label.measure();
        __MistriaCompanion_fit_node(_label);
    }
}

function MistriaCompanion_add_map_labels() {
    var _map_menu = __MistriaCompanion_menu(Menu.Map);
    if (_map_menu == undefined || _map_menu.selected_location_id == undefined) return;

    var _hubs = global[$ "__map_hubs"];
    if (!is_array(_hubs)) return;
    if (_map_menu.selected_location_id < 0
        || _map_menu.selected_location_id >= array_length(_hubs))
    {
        return;
    }
    var _location_hubs = _hubs[_map_menu.selected_location_id];
    if (!is_array(_location_hubs)) return;

    var _runtime = __MistriaCompanion_runtime();
    if (_runtime.map_labels_ready) return;
    var _npc_by_icon = {};
    var _prototypes = __MistriaCompanion_as_array(global[$ "__npc_prototypes"]);
    for (var _npc_id = 0; _npc_id < array_length(_prototypes); _npc_id++) {
        if (!is_array(NPCS) || _npc_id >= array_length(NPCS)) continue;
        if (!npc_is_unlocked(_npc_id) || !NPCS[_npc_id].has_met()) continue;

        var _icon = get_small_npc_icon(_npc_id);
        _npc_by_icon[$ string(_icon)] = __MistriaCompanion_npc_name(_prototypes[_npc_id], "");
    }
    for (var _hub_index = 0; _hub_index < array_length(_location_hubs); _hub_index++) {
        var _hub_node = _location_hubs[_hub_index].node;
        if (_hub_node == undefined || _hub_node.freed) continue;

        for (var _child_index = 0; _child_index < array_length(_hub_node.children); _child_index++) {
            var _marker = _hub_node.children[_child_index];
            var _name = __MistriaCompanion_field(_npc_by_icon,
                string(__MistriaCompanion_field(_marker, "sprite")));
            if (_name == undefined) continue;
            var _label = _marker.board_get("mistria_item_details_name_label");
            if (_label == undefined) {
                _marker.listen_for_hovers();
                _label = __MistriaCompanion_hover_label(_marker);
                _marker.board_set("mistria_item_details_name_label", _label);
            }
            _label.set_text(_name);
            array_push(_runtime.map_wiki_nodes, { node: _marker, title: _name });
        }
    }
    _runtime.map_labels_ready = true;
}

function __MistriaCompanion_hover_label(_marker) {
    var _label = ANCHOR.text(_marker)
        .set_lut(COMMON_LUT)
        .set_align(Align.Center, Align.BottomOut)
        .set_y(-1)
        .set_max_width(160)
        .allow_line_breaks()
        .set_alpha(0);
    _label.set_think_callback(MistriaCompanion_map_label_think, [_marker, _label, ""]);
    return _label;
}

function __MistriaCompanion_map_hubs() {
    var _runtime = __MistriaCompanion_runtime();
    var _map_menu = __MistriaCompanion_menu(Menu.Map);
    if (_map_menu == undefined) {
        _runtime.map_menu = undefined;
        _runtime.map_node = undefined;
        _runtime.map_wiki_nodes = [];
        return undefined;
    }
    var _hubs = global[$ "__map_hubs"];
    if (_map_menu.selected_location_id == undefined || !is_array(_hubs)
        || _map_menu.selected_location_id < 0
        || _map_menu.selected_location_id >= array_length(_hubs))
    {
        return undefined;
    }
    var _location_hubs = _hubs[_map_menu.selected_location_id];
    if (!is_array(_location_hubs) || array_length(_location_hubs) == 0) return undefined;
    var _node = _location_hubs[0].node;
    if (_runtime.map_menu != _map_menu || _runtime.map_node != _node) {
        _runtime.map_menu = _map_menu;
        _runtime.map_node = _node;
        _runtime.map_wiki_nodes = [];
        _runtime.map_labels_ready = false;
        _runtime.map_signature = "";
        _runtime.scan_frame = -12;
    }
    return _location_hubs;
}

function __MistriaCompanion_hub_index(_hubs, _x, _y, _queue, _location_id=undefined, _dyn_index=undefined) {
    var _map = __MistriaCompanion_runtime().map_menu;
    if (_location_id == undefined) {
        _location_id = CURRENT_LOCATION_ID;
        _dyn_index = CURRENT_DYN_INDEX;
    }
    var _hub = _map.find_hub_for(_hubs,
        new LocationPosition(_location_id, Vec2(_x, _y), _dyn_index),
        _queue, _map.selected_location_id);
    if (_hub == 0) return -1;
    for (var _index = 0; _index < array_length(_hubs); _index++) {
        if (_hubs[_index] == _hub) return _index;
    }
    return -1;
}

function __MistriaCompanion_active_mist_spot() {
    var _index = MIST_SIGHT_ACTIVE_INDEX;
    if (_index == undefined || MIST_SIGHT_LIST == undefined || !is_array(LOCATIONS)) return undefined;
    if (!is_real(_index) || _index < 0 || _index != floor(_index) || _index >= MIST_SIGHT_LIST.count()) {
        mmapi_warn_rate_limited("mistria_item_details:mist_index", "mistria_item_details",
            "Cannot map the active Mist Spot: invalid location-list index.");
        return undefined;
    }
    var _spot = MIST_SIGHT_LIST.get(_index);
    var _location_id = __MistriaCompanion_field(_spot, "location_id");
    var _pos = __MistriaCompanion_field(_spot, "pos");
    if (!is_real(_location_id) || _location_id < 0 || _location_id != floor(_location_id)
        || _location_id >= array_length(LOCATIONS) || LOCATIONS[_location_id] == undefined
        || !is_real(__MistriaCompanion_field(_pos, "x"))
        || !is_real(__MistriaCompanion_field(_pos, "y")))
    {
        mmapi_warn_rate_limited("mistria_item_details:mist_position", "mistria_item_details",
            "Cannot map the active Mist Spot: invalid location or position.");
        return undefined;
    }
    return _spot;
}

function MistriaCompanion_mist_marker_think(_marker, _hub, _map) {
    if (_marker.freed || _hub.freed) return;
    if (_map == undefined || _map.freed) {
        _marker.set_alpha(0);
        return;
    }
    if (_map.get_width() < _marker.get_width() + 2 || _map.get_height() < _marker.get_height() + 2) {
        _marker.set_alpha(0);
        return;
    }
    var _x = max(1, min(_hub.get_x() - 10, _map.get_width() - _marker.get_width() - 1));
    var _y = max(1, min(_hub.get_y() + 10, _map.get_height() - _marker.get_height() - 1));
    _marker.set_xy(_x - _hub.get_x(), _y - _hub.get_y()).set_alpha(1);
}

function MistriaCompanion_mist_marker_draw(_x, _y, _width, _height, _color, _alpha, _z, _marker) {
    if (_marker.freed || !_marker.get_enabled() || _alpha <= 0) return;
    var _sprite = spr_misty_spot_main_closed_idle;
    var _scale_x = _width / sprite_get_width(_sprite);
    var _scale_y = _height / sprite_get_height(_sprite);
    _x += sprite_get_xoffset(_sprite) * _scale_x;
    _y += sprite_get_yoffset(_sprite) * _scale_y;
    var _depth = gpu_get_depth();
    gpu_set_depth(_z + 1);
    // Anchor rounds node positions; apply the one-artwork-pixel stroke at draw time instead.
    var _offsets = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];
    for (var _index = 0; _index < array_length(_offsets); _index++) {
        draw_sprite_ext(_sprite, 0,
            _x + _offsets[_index][0] * _scale_x, _y + _offsets[_index][1] * _scale_y,
            _scale_x, _scale_y, 0, c_black, _alpha);
    }
    gpu_set_depth(_z);
    draw_sprite_ext(_sprite, 0, _x, _y, _scale_x, _scale_y, 0, _color, _alpha);
    gpu_set_depth(_depth);
}

function __MistriaCompanion_create_mist_marker(_parent, _map) {
    var _sprite = spr_misty_spot_main_closed_idle;
    var _scale = 0.5;
    var _marker = ANCHOR.positional(_parent).set_xy(-10, 10)
        .set_size(sprite_get_width(_sprite) * _scale, sprite_get_height(_sprite) * _scale)
        .listen_for_hovers();
    _marker.cache_is_dirty = true;
    var _cloud = ANCHOR.custom(_marker).set_size(_marker.get_width(), _marker.get_height())
        .set_render_callback(MistriaCompanion_mist_marker_draw, [_marker]);
    _marker.board_set("cloud", _cloud);
    _marker.board_set("label", __MistriaCompanion_hover_label(_marker));
    _marker.set_think_callback(MistriaCompanion_mist_marker_think, [_marker, _parent, _map]);
    MistriaCompanion_mist_marker_think(_marker, _parent, _map);
    return _marker;
}

function MistriaCompanion_refresh_map_markers(_hubs) {
    var _runtime = __MistriaCompanion_runtime();
    var _bugs = [];
    var _spots = [];
    var _mist = _runtime.mist_spot_markers_enabled ? __MistriaCompanion_active_mist_spot() : undefined;
    if (_mist != undefined
        && LOCATIONS[_mist.location_id].map_location != _runtime.map_menu.selected_location_id) _mist = undefined;
    var _signature = string(_runtime.all_bug_markers_enabled) + ":"
        + string(_runtime.bug_markers_enabled) + ":" + string(_runtime.dig_spot_markers_enabled)
        + ":" + string(_runtime.mist_spot_markers_enabled) + ":";
    var _location_matches = LOCATIONS[CURRENT_LOCATION_ID].map_location
        == _runtime.map_menu.selected_location_id;
    for (var _bug_index = 0; _bug_index < instance_number(obj_bug); _bug_index++) {
        if (!_runtime.bug_markers_enabled || !_location_matches || BUGS == undefined) break;
        var _bug = instance_find(obj_bug, _bug_index);
        if (_bug.item_id == undefined || _bug.item_id < 0
            || _bug.item_id >= array_length(ITEM_PROTOTYPES)) continue;
        var _bug_data = BUGS.get(_bug.item_id);
        if (_bug_data == undefined) continue;
        var _rare = _bug_data.rarity == "very_rare";
        if (!_rare && !_runtime.all_bug_markers_enabled) continue;
        array_push(_bugs, { item: _bug.item_id, x: _bug.x, y: _bug.y, rare: _rare });
        _signature += string(_bug.id) + ":" + string(_bug.item_id)
            + ":" + string(_bug.x) + ":" + string(_bug.y) + ";";
    }
    if (_runtime.dig_spot_markers_enabled && _location_matches
        && _runtime.dig_spot_visit_key == __MistriaCompanion_dig_spot_visit_key()) {
        for (var _index = 0; _index < array_length(_runtime.dig_spots); _index++) {
            var _spot = _runtime.dig_spots[_index];
            if (__MistriaCompanion_dig_spot_active(_spot)) {
                array_push(_spots, _spot);
                _signature += "d:" + string(_spot.grid_x) + ":" + string(_spot.grid_y) + ";";
            }
        }
    }
    if (_mist != undefined) {
        _signature += "m:" + string(_mist.location_id)
            + ":" + string(_mist.pos.x) + ":" + string(_mist.pos.y) + ";";
    }
    if (_signature == _runtime.map_signature) return;
    var _groups = [];
    for (var _index = 0; _index < array_length(_hubs); _index++) {
        array_push(_groups, { species: [], counts: [], icon_item: -1, rare: false, digs: 0, mist: false });
    }
    var _queue = ds_priority_create();
    try {
        for (var _index = 0; _index < array_length(_bugs); _index++) {
            var _bug = _bugs[_index];
            var _hub_index = __MistriaCompanion_hub_index(_hubs, _bug.x, _bug.y, _queue);
            if (_hub_index < 0) continue;
            var _group = _groups[_hub_index];
            var _name = __MistriaCompanion_name(ITEM_PROTOTYPES[_bug.item]);
            var _species_index = __MistriaCompanion_name_index(_group.species, _name);
            if (_species_index < 0) {
                array_push(_group.species, _name);
                array_push(_group.counts, 1);
            } else {
                _group.counts[_species_index]++;
            }
            if (_group.icon_item < 0 || (_bug.rare && !_group.rare)) {
                _group.icon_item = _bug.item;
            }
            _group.rare = _group.rare || _bug.rare;
        }
        for (var _index = 0; _index < array_length(_spots); _index++) {
            var _spot = _spots[_index];
            var _hub_index = __MistriaCompanion_hub_index(_hubs, _spot.x, _spot.y, _queue);
            if (_hub_index >= 0) _groups[_hub_index].digs++;
        }
        if (_mist != undefined) {
            var _hub_index = __MistriaCompanion_hub_index(
                _hubs, _mist.pos.x, _mist.pos.y, _queue, _mist.location_id);
            if (_hub_index >= 0) _groups[_hub_index].mist = true;
        }
    } catch (_error) {
        ds_priority_destroy(_queue);
        throw _error;
    }
    ds_priority_destroy(_queue);

    _runtime.map_wiki_nodes = [];
    _runtime.map_labels_ready = false;
    MistriaCompanion_add_map_labels();
    for (var _index = 0; _index < array_length(_hubs); _index++) {
        var _hub = _hubs[_index];
        if (_hub.node == undefined || _hub.node.freed) continue;
        var _group = _groups[_index];
        var _bug_marker = _hub.node.board_get("mistria_item_details_bug_marker");
        if (_group.icon_item >= 0) {
            if (_bug_marker == undefined) {
                _bug_marker = ANCHOR.sprite(_hub.node).set_xy(-10, -10)
                    .listen_for_hovers();
                _bug_marker.board_set("label", __MistriaCompanion_hover_label(_bug_marker));
                _hub.node.board_set("mistria_item_details_bug_marker", _bug_marker);
            }
            var _text = "";
            for (var _species = 0; _species < array_length(_group.species); _species++) {
                if (_text != "") _text += "\n";
                _text += _group.species[_species] + " x" + string(_group.counts[_species]);
            }
            _bug_marker.set_sprite(ITEM_PROTOTYPES[_group.icon_item].icon_sprite).disable_lut().enable();
            _bug_marker.board_get("label").set_text(_text);
            array_push(_runtime.map_wiki_nodes, {
                node: _bug_marker,
                title: array_length(_group.species) == 1 ? _group.species[0] : "Bugs"
            });
        } else if (_bug_marker != undefined) {
            _bug_marker.disable();
            _bug_marker.board_get("label").set_alpha(0);
        }

        var _dig_marker = _hub.node.board_get("mistria_item_details_dig_marker");
        if (_group.digs > 0) {
            if (_dig_marker == undefined) {
                _dig_marker = ANCHOR.sprite(_hub.node)
                    .set_xy(10, -10).listen_for_hovers();
                _dig_marker.board_set("label", __MistriaCompanion_hover_label(_dig_marker));
                _hub.node.board_set("mistria_item_details_dig_marker", _dig_marker);
            }
            _dig_marker.board_get("label").set_text(
                _group.digs == 1 ? "Dig spot" : "Dig spots: " + string(_group.digs));
            _dig_marker.set_sprite(spr_ui_item_tool_mistril_shovel)
                .set_outline_sprite(spr_ui_item_tool_mistril_shovel_outline).disable_lut().enable();
        } else if (_dig_marker != undefined) {
            _dig_marker.disable();
            _dig_marker.board_get("label").set_alpha(0);
        }

        var _mist_marker = _hub.node.board_get("mistria_item_details_mist_marker");
        if (_group.mist) {
            if (_mist_marker == undefined) {
                _mist_marker = __MistriaCompanion_create_mist_marker(_hub.node, _runtime.map_menu.map);
                _hub.node.board_set("mistria_item_details_mist_marker", _mist_marker);
            }
            _mist_marker.board_get("label").set_text("Mist Spot");
            _mist_marker.enable();
            array_push(_runtime.map_wiki_nodes, { node: _mist_marker, title: "Mist Spot" });
        } else if (_mist_marker != undefined) {
            _mist_marker.disable();
            _mist_marker.board_get("label").set_alpha(0);
        }
    }
    _runtime.map_signature = _signature;
}

function __MistriaCompanion_npc_is_known(_npc_id) {
    if (!is_array(NPCS) || _npc_id < 0 || _npc_id >= array_length(NPCS)) return false;

    var _npc = NPCS[_npc_id];
    if (_npc == undefined) return false;
    return npc_is_unlocked(_npc_id) && _npc.has_met();
}

function __MistriaCompanion_npc_needs_gift(_npc_id) {
    if (!__MistriaCompanion_npc_is_known(_npc_id) || !NPCS[_npc_id].gift_flag) return false;
    var _npc = NPCS[_npc_id];
    var _location = __MistriaCompanion_field(__MistriaCompanion_field(_npc, "location_position"), "location_id");
    if (!is_array(LOCATIONS) || !is_real(_location) || _location < 0
        || _location != floor(_location) || _location >= array_length(LOCATIONS)
        || typeof(__MistriaCompanion_field(_npc, "heart_level")) != "method")
    {
        mmapi_warn_rate_limited("mistria_item_details:gift_recipient", "mistria_item_details",
            "Skipping a gift recipient whose availability or relationship data is not ready.");
        return false;
    }
    // Daily schedules keep absent NPCs in Aldaria; ordinary NPCs are simulated across all other regions.
    if (_location == LocationId.Aldaria) return false;
    var _hearts = _npc.heart_level();
    if (!is_real(_hearts) || _hearts < 0 || _hearts != floor(_hearts)) {
        mmapi_warn_rate_limited("mistria_item_details:gift_hearts", "mistria_item_details",
            "Skipping a gift recipient with an invalid heart level.");
        return false;
    }
    // Native Npc.add_heart_points stops accepting friendship points at ten hearts.
    return _hearts < 10;
}

function __MistriaCompanion_is_loved_gift(_item, _npc_id) {
    return __MistriaCompanion_npc_needs_gift(_npc_id)
        && __MistriaCompanion_gift_desire(_item, _npc_id) == Desire.Loved;
}

function __MistriaCompanion_gift_desire(_item, _npc_id) {
    if (_item == undefined) return undefined;
    var _npcs = global[$ "__npc_prototypes"];
    if (!is_array(_npcs) || _npc_id < 0 || _npc_id >= array_length(_npcs)) return undefined;
    return __MistriaCompanion_gift_desire_for_npc(_item, _npcs[_npc_id], _npc_id);
}

function __MistriaCompanion_gift_desire_for_npc(_item, _npc, _npc_id, _include_infusion=true) {
    if (_item == undefined || _npc == undefined) return undefined;
    var _prototype = _item.prototype;
    if (_prototype == undefined || _prototype.giftable != true) return undefined;
    if (_prototype.tags.contains_any_value_from(_npc.banned_gift_tags)) {
        return undefined;
    }

    if (_item.item_id == ItemId.VoidNewt) {
        return _npc_id == NpcId.Juniper ? Desire.Loved : Desire.Disliked;
    }
    if (_item.item_id == ItemId.VoidCake) {
        return _npc_id == NpcId.Eiland ? Desire.Loved : Desire.Disliked;
    }
    if ((_include_infusion && _item.infusion == Infusion.Loveable) || _npc.loved_gifts.contains(_item.item_id)) {
        return Desire.Loved;
    }
    if ((_include_infusion && _item.infusion == Infusion.Likeable) || _npc.liked_gifts.contains(_item.item_id)) {
        return Desire.Liked;
    }
    return Desire.Neutral;
}

function __MistriaCompanion_gift_npcs() {
    var _result = [];
    if (!is_array(NPCS)) return _result;

    // Keep birthdays first while preserving the game's stable NPC order.
    for (var _birthday_pass = 0; _birthday_pass < 2; _birthday_pass++) {
        for (var _npc_id = 0; _npc_id < array_length(NPCS); _npc_id++) {
            if (!__MistriaCompanion_npc_needs_gift(_npc_id)) continue;

            var _is_birthday = NPCS[_npc_id].is_birthday();
            if (_is_birthday != (_birthday_pass == 0)) continue;
            array_push(_result, _npc_id);
        }
    }
    return _result;
}

function __MistriaCompanion_existing_room(_inventory, _item) {
    var _room = 0;
    for (var _index = 0; _index < _inventory.size(); _index++) {
        var _slot = _inventory.slot(_index);
        if (_slot.count <= 0 || _slot.item == undefined) continue;
        if (_slot.item.partial_eq(_item)) {
            _room += _slot.room_for_item(_item);
        }
    }
    return _room;
}

function __MistriaCompanion_gift_units(_inventory, _npc_ids) {
    var _result = [];
    var _npc_count = array_length(_npc_ids);
    var _stacks = [];
    for (var _slot_index = 0; _slot_index < _inventory.size(); _slot_index++) {
        var _slot = _inventory.slot(_slot_index);
        if (_slot.count <= 0 || _slot.item == undefined) continue;
        var _compatible = array_create(_npc_count, false);
        var _loved_count = 0;
        for (var _npc_index = 0; _npc_index < _npc_count; _npc_index++) {
            _compatible[_npc_index] = __MistriaCompanion_is_loved_gift(_slot.item, _npc_ids[_npc_index]);
            if (_compatible[_npc_index]) _loved_count++;
        }
        if (_loved_count == 0) continue;
        array_push(_stacks, {
            slot_index: _slot_index,
            item: _slot.item,
            npcs: _compatible,
            count: min(_slot.count, _loved_count),
            existing: __MistriaCompanion_existing_room(ARI.inventory, _slot.item) > 0
        });
    }
    array_sort(_stacks, __MistriaCompanion_gift_stack_order);
    for (var _index = 0; _index < array_length(_stacks); _index++) {
        var _stack = _stacks[_index];
        for (var _unit_index = 0; _unit_index < _stack.count; _unit_index++) {
            array_push(_result, {
                slot_index: _stack.slot_index,
                item: _stack.item,
                npcs: _stack.npcs
            });
        }
    }
    return _result;
}

function __MistriaCompanion_gift_stack_order(_left, _right) {
    if (_left.existing != _right.existing) return _left.existing ? -1 : 1;
    if (_left.count != _right.count) return _right.count - _left.count;
    return _left.slot_index - _right.slot_index;
}

function __MistriaCompanion_match_gift(
    _npc_index,
    _npc_ids,
    _units,
    _unit_owners,
    _seen_units
) {
    for (var _unit_index = 0; _unit_index < array_length(_units); _unit_index++) {
        if (_seen_units[_unit_index]) continue;
        if (!_units[_unit_index].npcs[_npc_index]) continue;

        _seen_units[_unit_index] = true;
        var _owner = _unit_owners[_unit_index];
        if (_owner == -1
            || __MistriaCompanion_match_gift(
                _owner,
                _npc_ids,
                _units,
                _unit_owners,
                _seen_units
            ))
        {
            _unit_owners[_unit_index] = _npc_index;
            return true;
        }
    }
    return false;
}

function __MistriaCompanion_gift_groups(_units) {
    var _groups = [];
    for (var _unit_index = 0; _unit_index < array_length(_units); _unit_index++) {
        var _unit = _units[_unit_index];
        var _group = undefined;
        for (var _group_index = 0; _group_index < array_length(_groups); _group_index++) {
            if (_groups[_group_index].item.partial_eq(_unit.item)) {
                _group = _groups[_group_index];
                break;
            }
        }

        if (_group == undefined) {
            var _room = ARI.inventory.room_for_item(_unit.item);
            if (_room <= 0) continue;

            _group = {
                item: _unit.item,
                npcs: _unit.npcs,
                units: [],
                capacity: 0,
                room: _room,
                used: 0,
                existing_room: min(
                    _room,
                    __MistriaCompanion_existing_room(ARI.inventory, _unit.item)
                )
            };
            array_push(_groups, _group);
        }

        if (_group.capacity < _group.room) {
            array_push(_group.units, _unit);
            _group.capacity++;
        }
    }
    return _groups;
}

function __MistriaCompanion_gift_slot_cost(_group, _count) {
    var _needs_slots = max(0, _count - _group.existing_room);
    return ceil(_needs_slots / _group.item.prototype.max_stack);
}

function __MistriaCompanion_copy_array(_source) {
    var _copy = array_create(array_length(_source), -1);
    for (var _index = 0; _index < array_length(_source); _index++) {
        _copy[_index] = _source[_index];
    }
    return _copy;
}

function __MistriaCompanion_gift_assignment_is_better(_state, _count, _birthdays) {
    if (_birthdays != _state.best_birthdays) return _birthdays > _state.best_birthdays;
    if (_count > _state.best_count) return true;
    if (_count < _state.best_count) return false;

    // With birthday and total coverage tied, use stable game order.
    for (var _index = 0; _index < array_length(_state.assignment); _index++) {
        var _current_has_gift = _state.assignment[_index] != -1;
        var _best_has_gift = _state.best_assignment[_index] != -1;
        if (_current_has_gift != _best_has_gift) return _current_has_gift;
    }
    return false;
}

function __MistriaCompanion_gift_priority_upper_can_beat(
    _state,
    _npc_index,
    _count
) {
    // Fixed choices form the prefix. Optimistically give every still-needed
    // gift to the earliest remaining NPC; if even that vector cannot outrank
    // the best assignment, no equal-count completion of this branch can.
    var _needed = _state.best_count - _count;
    for (var _index = 0; _index < array_length(_state.assignment); _index++) {
        var _optimistic_has_gift;
        if (_index < _npc_index) {
            _optimistic_has_gift = _state.assignment[_index] != -1;
        } else {
            _optimistic_has_gift = _needed > 0;
            if (_optimistic_has_gift) _needed--;
        }

        var _best_has_gift = _state.best_assignment[_index] != -1;
        if (_optimistic_has_gift != _best_has_gift) {
            return _optimistic_has_gift;
        }
    }
    return false;
}

function __MistriaCompanion_gift_capacity_upper(
    _state,
    _npc_index,
    _count,
    _slots_used
) {
    var _group_count = array_length(_state.groups);
    var _extra_slots = array_create(_group_count, 0);
    var _additional_units = 0;

    // Count capacity already paid for by existing partial stacks or slots that
    // earlier assignments opened. This deliberately ignores NPC compatibility,
    // making it an admissible upper bound rather than a second matching pass.
    for (var _group_index = 0; _group_index < _group_count; _group_index++) {
        var _group = _state.groups[_group_index];
        var _paid_slots = __MistriaCompanion_gift_slot_cost(
            _group,
            _group.used
        );
        var _paid_capacity = min(
            _group.capacity,
            _group.existing_room
                + _paid_slots * _group.item.prototype.max_stack
        );
        _additional_units += max(0, _paid_capacity - _group.used);
    }

    // Spend each remaining empty slot where it could add the most units. A
    // group's marginal capacity never increases, so taking the largest next
    // marginal produces the optimistic maximum across all groups.
    var _slots_left = _state.free_slots - _slots_used;
    for (var _slot = 0; _slot < _slots_left; _slot++) {
        var _best_group = -1;
        var _best_gain = 0;
        for (var _group_index = 0; _group_index < _group_count; _group_index++) {
            var _group = _state.groups[_group_index];
            var _paid_slots = __MistriaCompanion_gift_slot_cost(
                _group,
                _group.used
            ) + _extra_slots[_group_index];
            var _before = min(
                _group.capacity,
                _group.existing_room
                    + _paid_slots * _group.item.prototype.max_stack
            );
            var _after = min(
                _group.capacity,
                _group.existing_room
                    + (_paid_slots + 1) * _group.item.prototype.max_stack
            );
            var _gain = _after - _before;
            if (_gain > _best_gain) {
                _best_gain = _gain;
                _best_group = _group_index;
            }
        }

        if (_best_group == -1) break;
        _extra_slots[_best_group]++;
        _additional_units += _best_gain;
    }

    var _npcs_left = array_length(_state.npc_ids) - _npc_index;
    return _count + min(_npcs_left, _additional_units);
}

function __MistriaCompanion_search_gift_assignment(
    _state,
    _npc_index,
    _count,
    _slots_used,
    _birthdays
) {
    if (_state.search_nodes >= _state.search_node_limit) {
        _state.search_limited = true;
        return;
    }
    _state.search_nodes++;

    if (__MistriaCompanion_gift_assignment_is_better(_state, _count, _birthdays)) {
        _state.best_count = _count;
        _state.best_birthdays = _birthdays;
        _state.best_assignment = __MistriaCompanion_copy_array(_state.assignment);
    }
    if (!__MistriaCompanion_gift_branch_can_improve(
        _state, _npc_index, _count, _slots_used, _birthdays)) return;
    if (_npc_index >= array_length(_state.npc_ids)) return;

    var _candidates = _state.candidates[_npc_index];
    for (var _index = 0; _index < array_length(_candidates); _index++) {
        var _group_index = _candidates[_index];
        var _group = _state.groups[_group_index];
        if (_group.used >= _group.capacity) continue;

        var _old_cost = __MistriaCompanion_gift_slot_cost(_group, _group.used);
        var _new_cost = __MistriaCompanion_gift_slot_cost(_group, _group.used + 1);
        var _new_slots_used = _slots_used + _new_cost - _old_cost;
        if (_new_slots_used > _state.free_slots) continue;

        _group.used++;
        _state.assignment[_npc_index] = _group_index;
        __MistriaCompanion_search_gift_assignment(
            _state,
            _npc_index + 1,
            _count + 1,
            _new_slots_used,
            _birthdays + (_npc_index < _state.birthday_count ? 1 : 0)
        );
        _state.assignment[_npc_index] = -1;
        _group.used--;

        if (!__MistriaCompanion_gift_branch_can_improve(
            _state, _npc_index, _count, _slots_used, _birthdays)) return;
    }

    __MistriaCompanion_search_gift_assignment(
        _state,
        _npc_index + 1,
        _count,
        _slots_used,
        _birthdays
    );
}

function __MistriaCompanion_gift_branch_can_improve(
    _state, _npc_index, _count, _slots_used, _birthdays
) {
    var _upper = __MistriaCompanion_gift_capacity_upper(
        _state, _npc_index, _count, _slots_used);
    var _birthday_upper = _birthdays + min(
        max(0, _state.birthday_count - _npc_index), _upper - _count);
    if (_birthday_upper != _state.best_birthdays) return _birthday_upper > _state.best_birthdays;
    if (_upper != _state.best_count) return _upper > _state.best_count;
    return __MistriaCompanion_gift_priority_upper_can_beat(_state, _npc_index, _count);
}

function __MistriaCompanion_gift_plan(_chest_inventory) {
    var _npc_ids = __MistriaCompanion_gift_npcs();
    var _npc_count = array_length(_npc_ids);
    var _units = __MistriaCompanion_gift_units(_chest_inventory, _npc_ids);
    var _unit_count = array_length(_units);
    var _unit_owners = array_create(_unit_count, -1);

    for (var _npc_index = 0; _npc_index < _npc_count; _npc_index++) {
        __MistriaCompanion_match_gift(
            _npc_index,
            _npc_ids,
            _units,
            _unit_owners,
            array_create(_unit_count, false)
        );
    }

    var _matched_count = 0;
    for (var _unit_index = 0; _unit_index < _unit_count; _unit_index++) {
        var _owner = _unit_owners[_unit_index];
        if (_owner == -1) continue;
        _matched_count++;
    }

    var _groups = __MistriaCompanion_gift_groups(_units);
    var _candidates = array_create(_npc_count, undefined);
    for (var _npc_index = 0; _npc_index < _npc_count; _npc_index++) {
        _candidates[_npc_index] = [];
        for (var _group_index = 0; _group_index < array_length(_groups); _group_index++) {
            if (_groups[_group_index].npcs[_npc_index]) {
                array_push(_candidates[_npc_index], _group_index);
            }
        }
    }

    var _free_slots = 0;
    for (var _slot_index = 0; _slot_index < ARI.inventory.size(); _slot_index++) {
        var _slot = ARI.inventory.slot(_slot_index);
        if (_slot.count == 0 && _slot.item == undefined) _free_slots++;
    }

    var _birthday_count = 0;
    for (var _index = 0; _index < _npc_count; _index++) {
        if (NPCS[_npc_ids[_index]].is_birthday()) _birthday_count++;
    }
    var _state = {
        npc_ids: _npc_ids,
        groups: _groups,
        candidates: _candidates,
        free_slots: _free_slots,
        birthday_count: _birthday_count,
        best_birthdays: 0,
        assignment: array_create(_npc_count, -1),
        best_assignment: array_create(_npc_count, -1),
        best_count: 0,
        // Exact search is fast for ordinary chest contents, but fixed-charge
        // backpack slots make adversarial preference sets combinatorial. Keep
        // the click bounded and retain the best birthday-first plan found.
        search_nodes: 0,
        search_limited: false,
        search_node_limit: 2048
    };
    __MistriaCompanion_search_gift_assignment(_state, 0, 0, 0, 0);

    var _used_by_group = array_create(array_length(_groups), 0);
    var _plan = [];
    for (var _npc_index = 0; _npc_index < _npc_count; _npc_index++) {
        var _group_index = _state.best_assignment[_npc_index];
        if (_group_index == -1) continue;

        var _group = _groups[_group_index];
        var _unit = _group.units[_used_by_group[_group_index]];
        _used_by_group[_group_index]++;
        array_push(_plan, {
            npc_id: _npc_ids[_npc_index],
            slot_index: _unit.slot_index,
            item: _unit.item
        });
    }

    return {
        eligible_count: _npc_count,
        matched_count: _matched_count,
        capacity_count: _state.best_count,
        search_limited: _state.search_limited,
        entries: _plan
    };
}

function MistriaCompanion_collect_loved_gifts(_menu) {
    if (__MistriaCompanion_menu(Menu.Storage) != _menu) return;

    var _left_menu = __MistriaCompanion_field(_menu, "left_menu");
    var _right_menu = __MistriaCompanion_field(_menu, "right_menu");
    if (_left_menu == undefined || _right_menu == undefined) return;

    var _hand = __MistriaCompanion_field(_left_menu, "hand");
    if (_hand == undefined || _hand.size() == 0) return;
    if (_hand.slot(0).item != undefined) {
        create_notification(
            ANCHOR.wrap_for_local("Put down the held item before grabbing gifts."),
            60 * 3
        );
        return;
    }

    var _chest_inventory = __MistriaCompanion_field(_menu, "left");
    if (_chest_inventory == undefined) return;

    var _gift_plan = __MistriaCompanion_gift_plan(_chest_inventory);
    if (_gift_plan.eligible_count == 0) {
        create_notification(
            ANCHOR.wrap_for_local("No eligible gift recipients today: villagers may be unavailable, at max hearts, or already gifted."),
            60 * 3
        );
        return;
    }
    if (_gift_plan.matched_count == 0) {
        create_notification(
            ANCHOR.wrap_for_local("This chest has no loved gifts for eligible villagers."),
            60 * 3
        );
        return;
    }

    var _moved = 0;
    for (var _index = 0; _index < array_length(_gift_plan.entries); _index++) {
        var _entry = _gift_plan.entries[_index];
        if (!__MistriaCompanion_npc_needs_gift(_entry.npc_id)) continue;
        var _slot = _chest_inventory.slot(_entry.slot_index);
        if (_slot.count <= 0 || _slot.item == undefined) continue;
        if (!_slot.item.partial_eq(_entry.item)) continue;
        if (!ARI.inventory.can_add(_slot.item, 1)) continue;
        if (ARI.inventory.add(_slot.item.clone(), 1) != 0) continue;

        _slot.remove(1);
        _moved++;
    }

    _left_menu.refresh();
    _right_menu.refresh();

    var _message = "Grabbed " + string(_moved) + " loved gift" + (_moved == 1 ? "" : "s") + ".";
    if (_moved < array_length(_gift_plan.entries)) {
        _message += " Some planned gifts are no longer needed or could not be moved.";
    } else if (_moved == 0 && !_gift_plan.search_limited) {
        _message = "No loved gifts fit in your backpack.";
    } else if (_moved < _gift_plan.matched_count && !_gift_plan.search_limited) {
        _message += " Selected birthdays first within the available space.";
    }
    if (_gift_plan.search_limited) {
        _message += " Selection search limit reached; more gifts may fit.";
    }
    __MistriaCompanion_notify(_message, 60 * 3);
}

function MistriaCompanion_chest_gift_button_think(_button, _label) {
    MistriaCompanion_map_label_think(_button, _label, "");
}

function MistriaCompanion_add_chest_gift_button() {
    var _menu = __MistriaCompanion_menu(Menu.Storage);
    if (_menu == undefined) return;

    var _node = __MistriaCompanion_field(_menu, "node");
    var _left = __MistriaCompanion_field(_menu, "left");
    var _right = __MistriaCompanion_field(_menu, "right");
    var _left_box = __MistriaCompanion_field(_menu, "left_box");
    var _left_menu = __MistriaCompanion_field(_menu, "left_menu");
    var _left_banner = __MistriaCompanion_field(_menu, "left_banner");
    if (_node == undefined || _left == undefined || _right != ARI.inventory
        || _left_box == undefined || _left_menu == undefined || _left_banner == undefined)
    {
        return;
    }
    if (__MistriaCompanion_field(_menu, "recipe") != undefined) return;
    if (__MistriaCompanion_field(_node, "inventory") != _left) return;
    var _object_id = __MistriaCompanion_field(_node, "object_id");
    if (_object_id == ObjectId.AutoFeeder || _object_id == ObjectId.TurnInBox) return;

    var _prototype = __MistriaCompanion_field(_node, "prototype");
    var _chest = __MistriaCompanion_field(_prototype, "interaction_chest");
    if (_chest == undefined || __MistriaCompanion_field(_chest, "shipping_bin") == true) {
        return;
    }

    var _canvas = __MistriaCompanion_field(_menu, "canvas");
    if (_canvas == undefined
        || _canvas.board_get("mistria_item_details_gift_button") != undefined)
    {
        return;
    }

    var _button = ANCHOR.sprite(_left_box)
        .set_align(Align.RightIn, Align.TopOut)
        .set_xy(-2, 0)
        .set_size(22)
        .set_sprites_from_key("spr_ui_button")
        .set_tap_sound("SoundEffects/UI/UIExtraPositiveClick")
        .add_hover_outline()
        .add_to_pilot(_left_menu.pilot)
        .set_tap_callback(MistriaCompanion_collect_loved_gifts, [_menu]);

    ANCHOR.sprite(_button)
        .set_sprite(spr_ui_journal_relationship_gift_icon)
        .set_align(Align.Center, Align.Middle);

    var _label = ANCHOR.text(_button)
        .set_text("Grab loved gifts")
        .set_lut(COMMON_LUT)
        .set_text_align(TextAlign.Center)
        .set_align(Align.Center, Align.TopOut)
        .set_y(-2)
        .set_alpha(0);
    _label.set_think_callback(
        MistriaCompanion_chest_gift_button_think,
        [_button, _label]
    );

    _canvas.board_set("mistria_item_details_gift_button", _button);
}

function __MistriaCompanion_for_item(_item) {
    var _item_id = _item.item_id;
    var _item_data = global[$ "__item_data"];
    if (!is_array(_item_data) || _item_id < 0 || _item_id >= array_length(_item_data)) return undefined;

    var _listed_only = _item.infusion == Infusion.Likeable || _item.infusion == Infusion.Loveable;
    var _universal = __MistriaCompanion_universal_gift_text(_item);
    if (_universal != "" && (!_listed_only || !__MistriaCompanion_has_listed_gift(_item))) {
        return { recipes: "", liked: "", loved: "", gift_sections: [], universal: _universal };
    }

    var _target = _item_data[_item_id];
    var _item_key = __MistriaCompanion_field(_target, "recipe_key");
    if (_item_key == undefined) _item_key = "";
    var _runtime = __MistriaCompanion_runtime();
    var _recipe_summary = __MistriaCompanion_field(_runtime.recipe_cache, string(_item_id));
    if (_recipe_summary == undefined) {
        var _recipes = [];
        for (var _recipe_id = 0; _recipe_id < array_length(_item_data); _recipe_id++) {
            if (__MistriaCompanion_recipe_uses_item(_item_data[_recipe_id], _item_id, _item_key)) {
                var _recipe_name = __MistriaCompanion_name(_item_data[_recipe_id]);
                if (!__MistriaCompanion_has_name(_recipes, _recipe_name)) {
                    array_push(_recipes, _recipe_name);
                }
            }
        }
        _recipe_summary = __MistriaCompanion_recipe_summary(_recipes);
        _runtime.recipe_cache[$ string(_item_id)] = _recipe_summary;
    }

    var _liked = [];
    var _loved = [];
    var _liked_npcs = [];
    var _loved_npcs = [];
    var _npc_data = __MistriaCompanion_as_array(global[$ "__npc_prototypes"]);
    if (array_length(_npc_data) > 0) {
        var _count = array_length(_npc_data);
        for (var _npc_id = 0; _npc_id < _count; _npc_id++) {
            if (!__MistriaCompanion_npc_is_known(_npc_id)) continue;
            var _npc = _npc_data[_npc_id];
            // Completion lists reflect the NPC's base preference, not an infusion's universal reaction.
            var _desire = __MistriaCompanion_gift_desire_for_npc(_item, _npc, _npc_id, !_listed_only);
            if (_desire != Desire.Loved && _desire != Desire.Liked) continue;
            var _name = __MistriaCompanion_npc_name(_npc, "Unknown");
            var _entry = {
                name: _name,
                given: NPCS[_npc_id].gifts_given.contains(_item_id)
            };
            if (_desire == Desire.Loved) {
                array_push(_loved, _name);
                array_push(_loved_npcs, _entry);
            } else if (_desire == Desire.Liked) {
                array_push(_liked, _name);
                array_push(_liked_npcs, _entry);
            }
        }
    }

    return {
        recipes: _recipe_summary,
        liked: __MistriaCompanion_join(_liked),
        loved: __MistriaCompanion_join(_loved),
        universal: "",
        gift_sections: [
            { label: "Liked by: ", npcs: _liked_npcs },
            { label: "Loved by: ", npcs: _loved_npcs }
        ]
    };
}

function __MistriaCompanion_details_text(_details) {
    var _universal = __MistriaCompanion_field(_details, "universal");
    if (is_string(_universal) && _universal != "") return _universal;
    var _result = "";
    if (_details.recipes != "") {
        if (_result != "") _result += "\n";
        _result += "Uses: " + _details.recipes;
    }
    if (_details.liked != "") {
        if (_result != "") _result += "\n";
        _result += "Liked by: " + _details.liked;
    }
    if (_details.loved != "") {
        if (_result != "") _result += "\n";
        _result += "Loved by: " + _details.loved;
    }
    return _result;
}

function MistriaCompanion_description(_value, _ctx) {
    if (_value == undefined || _ctx == undefined) return undefined;
    var _item = __MistriaCompanion_field(_ctx, "item");
    var _item_id = __MistriaCompanion_field(_item, "item_id");
    if (_item_id == undefined) return undefined;

    var _details = __MistriaCompanion_for_item(_item);
    if (_details == undefined) return undefined;
    var _extra = __MistriaCompanion_details_text(_details);
    if (_extra == "") return undefined;
    return _value + (_value == "" ? "" : "\n") + _extra;
}

function __MistriaCompanion_compact_gift_text(_text) {
    _text = string_replace_all(_text, " ", "");
    _text = string_replace_all(_text, "\n", "");
    _text = string_replace_all(_text, "\r", "");
    return string_replace_all(_text, "\t", "");
}

function __MistriaCompanion_gift_highlight_runs(_display_text, _details) {
    var _suffix = "";
    var _ranges = [];
    for (var _section_index = 0; _section_index < array_length(_details.gift_sections); _section_index++) {
        var _section = _details.gift_sections[_section_index];
        if (array_length(_section.npcs) == 0) continue;
        _suffix += __MistriaCompanion_compact_gift_text(_section.label);
        for (var _index = 0; _index < array_length(_section.npcs); _index++) {
            if (_index > 0) _suffix += ",";
            var _entry = _section.npcs[_index];
            var _name = __MistriaCompanion_compact_gift_text(_entry.name);
            if (_entry.given && _name != "") {
                array_push(_ranges, { start: string_length(_suffix), length: string_length(_name) });
            }
            _suffix += _name;
        }
    }
    if (array_length(_ranges) == 0) return [];

    // Reflow can replace spaces or split a localized name across lines.
    // Match only our complete gift suffix, never names in the item description.
    var _compact = __MistriaCompanion_compact_gift_text(_display_text);
    var _offset = string_length(_compact) - string_length(_suffix);
    if (_offset < 0 || string_copy(_compact, _offset + 1, string_length(_suffix)) != _suffix) return [];

    var _lines = string_split(_display_text, "\n");
    var _positions = [];
    for (var _line_index = 0; _line_index < array_length(_lines); _line_index++) {
        var _line = _lines[_line_index];
        for (var _column = 1; _column <= string_length(_line); _column++) {
            var _char = string_char_at(_line, _column);
            if (_char == " " || _char == "\r" || _char == "\t") continue;
            array_push(_positions, { line: _line_index, column: _column });
        }
    }
    var _runs = [];
    for (var _index = 0; _index < array_length(_ranges); _index++) {
        var _range = _ranges[_index];
        var _start = _positions[_offset + _range.start];
        var _end = _positions[_offset + _range.start + _range.length - 1];
        for (var _line_index = _start.line; _line_index <= _end.line; _line_index++) {
            var _line = _lines[_line_index];
            var _first = _line_index == _start.line ? _start.column : 1;
            var _last = _line_index == _end.line ? _end.column : string_length(_line);
            array_push(_runs, {
                line: _line_index,
                line_text: _line,
                prefix: string_copy(_line, 1, _first - 1),
                text: string_copy(_line, _first, _last - _first + 1)
            });
        }
    }
    return _runs;
}

function __MistriaCompanion_clear_gift_highlights(_body) {
    if (_body == undefined || _body.freed) return;
    var _state = _body.board_get("mistria_item_details_gift_highlights");
    if (_state == undefined) return;
    if (!_state.root.freed) {
        _state.root.disable();
        ANCHOR.free_node(_state.root);
    }
    _body.board_set("mistria_item_details_gift_highlights", undefined);
}

function __MistriaCompanion_has_listed_gift(_item) {
    var _npcs = __MistriaCompanion_as_array(global[$ "__npc_prototypes"]);
    for (var _index = 0; _index < array_length(_npcs); _index++) {
        var _npc = _npcs[_index];
        if (_npc == undefined) continue;
        if (_npc.loved_gifts.contains(_item.item_id) || _npc.liked_gifts.contains(_item.item_id)) return true;
    }
    return false;
}

function __MistriaCompanion_universal_gift_text(_item) {
    var _npcs = __MistriaCompanion_as_array(global[$ "__npc_prototypes"]);
    var _eligible = 0;
    var _summary = "Loved by: Everyone";
    for (var _index = 0; _index < array_length(_npcs); _index++) {
        if (_npcs[_index] == undefined) continue;
        var _desire = __MistriaCompanion_gift_desire_for_npc(_item, _npcs[_index], _index);
        if (_desire == undefined) continue;
        if (_desire != Desire.Liked && _desire != Desire.Loved) return "";
        if (_desire == Desire.Liked) _summary = "Liked by: Everyone";
        _eligible++;
    }
    return _eligible > 0 ? _summary : "";
}

function __MistriaCompanion_cooking_base_text(_text, _details, _warn=true) {
    var _extra = __MistriaCompanion_details_text(_details);
    if (_extra == "") return _text;
    if (_text == _extra) return "";
    var _suffix = "\n" + _extra;
    var _length = string_length(_text) - string_length(_suffix);
    if (_length >= 0 && string_copy(_text, _length + 1, string_length(_suffix)) == _suffix) {
        return string_copy(_text, 1, _length);
    }
    if (_warn) {
        mmapi_warn_rate_limited("mistria_item_details:cooking_description", "mistria_item_details",
            "Cooking description changed outside the companion; preserving it as the description preview.");
    }
    return _text;
}

function __MistriaCompanion_cooking_gift_text(_item, _details) {
    if (_details.universal != "") return _details.universal;
    var _gifts = __MistriaCompanion_details_text({ recipes: "", liked: _details.liked, loved: _details.loved });
    if (_gifts == "") return "No met villagers have this dish in their liked/loved lists.";
    return "Highlighted names have already received this dish.\n\n" + _gifts;
}

function MistriaCompanion_text_popup_scroll(_popup) {
    if (_popup.close_requested || _popup.free_requested || _popup.hide_requests > 0) return;
    if (ANCHOR.get_active_pilot() == _popup.pilot && INPUT.gp_right_stick.y != 0) {
        _popup.mistria_text_scroller.scroll_by_amount(INPUT.gp_right_stick.y * 4);
    }
}

function __MistriaCompanion_text_popup(_title, _text) {
    var _screen = ANCHOR.get_true_size();
    var _popup = popup_creator(undefined, undefined);
    _popup.backplate.set_width(min(300, _screen.x - 20));
    _popup.add_title(ANCHOR.wrap_for_local(_title));
    _popup.add_description(ANCHOR.wrap_for_local(_text));
    _popup.create_button("misc_local/close");
    if (_popup.backplate.get_height() > _screen.y - 16) {
        var _contents = _popup.body_text.get_text();
        var _height = max(26, _screen.y - 16 - 50 - _popup.header.get_height() - _popup.header.get_y());
        _popup.body_text.disable();
        ANCHOR.free_node(_popup.body_text);
        _popup.body.set_height(_height);
        _popup.body_text = ANCHOR.text(_popup.body)
            .set_xy(4, 3).set_max_width(_popup.body.get_width() - 8)
            .allow_line_breaks().set_lut(COMMON_LUT).set_text(_contents);
        var _text_height = _popup.body_text.measure().y + 6;
        if (_text_height <= _height) {
            _popup.body.set_height(_text_height);
        } else {
            _popup.body_text.disable();
            ANCHOR.free_node(_popup.body_text);
            var _root = ANCHOR.positional(_popup.body)
                .set_xy(4, 4).set_size(_popup.body.get_width() - 8, _height - 8);
            var _scroller = create_scroller(_root);
            _popup.mistria_text_scroller = _scroller;
            var _element = _scroller.new_element(16);
            _popup.body_text = ANCHOR.text(_element)
                .set_xy(3, 1).set_max_width(_root.get_width() - 12)
                .allow_line_breaks().set_lut(COMMON_LUT).set_text(_contents);
            _scroller.add_height_to_element(_element, max(0, _popup.body_text.measure().y + 2 - 16));
            _root.set_think_callback(MistriaCompanion_text_popup_scroll, [_popup]);
        }
        _popup.refresh_backplate_height();
    }
    return _popup;
}

function MistriaCompanion_show_cooking_gifts(_menu) {
    if (_menu.close_requested || _menu.free_requested || _menu.hide_requests > 0
        || _menu.context != RecipeContext.Cooking || _menu.item == undefined
        || !_menu.description.get_enabled() || !_menu.description.is_unlocked()) return;
    var _existing = __MistriaCompanion_field(_menu, "mistria_gift_popup");
    if (_existing != undefined && !_existing.close_requested && !_existing.free_requested) return;
    var _item = _menu.item;
    var _details = __MistriaCompanion_for_item(_item);
    if (_details == undefined) return;
    var _popup = __MistriaCompanion_text_popup(
        __MistriaCompanion_name(_item.prototype) + " - Gift details",
        __MistriaCompanion_cooking_gift_text(_item, _details));
    _popup.item = _item;
    _popup.mistria_cooking_gift_popup = true;
    _menu.mistria_gift_popup = _popup;
    _popup.spawn();
}

function __MistriaCompanion_clear_cooking_details(_body, _restore=true) {
    if (_body == undefined || _body.freed) return;
    var _state = _body.board_get("mistria_item_details_cooking");
    if (_state == undefined) return;
    if (!_state.button.freed) {
        _state.button.disable();
        if (!_restore) return;
        ANCHOR.free_node(_state.button);
    }
    if (_body.set_text == _state.wrapper) _body.set_text = _state.original_set_text;
    if (_body.get_text() == _state.base_text) {
        _body.set_text(_state.source_text);
    }
    _body.board_set("mistria_item_details_cooking", undefined);
}

function __MistriaCompanion_cooking_description_set(_text) {
    if (!is_string(_text) || self.menu.context != RecipeContext.Cooking || self.menu.description != self.body
        || self.menu.close_requested || self.menu.free_requested)
    {
        return self.original_set_text(_text);
    }
    self.source_text = _text;
    var _details = self.menu.item == undefined ? undefined : __MistriaCompanion_for_item(self.menu.item);
    self.base_text = _details == undefined ? _text : __MistriaCompanion_cooking_base_text(_text, _details, false);
    self.item = self.menu.item;
    return self.original_set_text(self.base_text);
}

function __MistriaCompanion_update_cooking_details(_menu, _details) {
    var _body = _menu.description;
    __MistriaCompanion_clear_gift_highlights(_body);
    var _state = _body.board_get("mistria_item_details_cooking");
    if (_state == undefined) {
        if (typeof(__MistriaCompanion_field(_body, "set_text")) != "method") {
            mmapi_warn_rate_limited("mistria_item_details:cooking_setter", "mistria_item_details",
                "Cooking description updates are unavailable; leaving the native description unchanged.");
            return;
        }
        _state = {
            source_text: undefined, base_text: undefined, item: undefined,
            menu: _menu, body: _body, original_set_text: _body.set_text
        };
        _state.wrapper = method(_state, __MistriaCompanion_cooking_description_set);
        _body.set_text = _state.wrapper;
        _state.button = ANCHOR.nine_slice(_body.parent)
            .set_sprites_from_key("spr_ui_button")
            .set_size(40, 18).set_align(Align.RightOut, Align.TopIn).set_xy(4, 0)
            .add_text_label(ANCHOR.wrap_for_local("Gifts"), COMMON_LUT, CommonLutIndex.Dark)
            .add_hover_outline().add_to_pilot(_menu.bottom_pilot)
            .set_tap_callback(MistriaCompanion_show_cooking_gifts, [_menu]);
        _body.board_set("mistria_item_details_cooking", _state);
    }
    var _text = _body.get_text();
    if (_state.item != _menu.item || _text != _state.base_text) {
        _body.set_text(_text);
    }
    _state.item = _menu.item;
    _state.button.enable();
    __MistriaCompanion_fit_node(_state.button);
}

function __MistriaCompanion_update_gift_highlights(_body, _details) {
    _body.measure();
    var _font = _body.get_font();
    var _line_height = _body.get_line_height();
    if (_line_height == undefined) _line_height = font_line_height(_font);
    var _signature = _body.display_text + ":" + string(_font) + ":" + string(_line_height)
        + ":" + string(_body.text_align) + ":" + string(_body.width) + ":" + string(_body.z);
    for (var _section_index = 0; _section_index < array_length(_details.gift_sections); _section_index++) {
        var _section = _details.gift_sections[_section_index];
        _signature += ":" + _section.label;
        for (var _index = 0; _index < array_length(_section.npcs); _index++) {
            var _entry = _section.npcs[_index];
            _signature += ":" + _entry.name + ":" + string(_entry.given);
        }
    }
    var _state = _body.board_get("mistria_item_details_gift_highlights");
    if (_state != undefined && _state.signature == _signature) return;
    __MistriaCompanion_clear_gift_highlights(_body);

    var _root = ANCHOR.positional(_body);
    // Late-added positional nodes otherwise keep the default screen origin and alpha.
    _root.cache_is_dirty = true;
    _body.board_set("mistria_item_details_gift_highlights", { signature: _signature, root: _root });
    var _runs = __MistriaCompanion_gift_highlight_runs(_body.display_text, _details);
    for (var _index = 0; _index < array_length(_runs); _index++) {
        var _run = _runs[_index];
        var _x = string_width_font(_run.prefix, _font);
        if (_body.text_align == TextAlign.Center) {
            _x += (_body.width - string_width_font(_run.line_text, _font)) / 2;
        } else if (_body.text_align == TextAlign.Right) {
            _x -= string_width_font(_run.line_text, _font);
        }
        ANCHOR.nine_slice(_root, _body.z + 0.5)
            .set_sprite(spr_pixel_nine_slice)
            .set_xy(_x - 1, _run.line * _line_height + 1)
            .set_size(string_width_font(_run.text, _font) + 2, max(1, font_line_height(_font) - 2))
            .set_color(make_color_rgb(77, 190, 206))
            .set_alpha(0.45);
    }
}

function MistriaCompanion_update_gift_tooltips() {
    for (var _index = 0; _index < ANCHOR.open_menus.count(); _index++) {
        var _menu = ANCHOR.open_menus.get(_index);
        var _body;
        var _gift_popup = __MistriaCompanion_field(_menu, "mistria_cooking_gift_popup") == true;
        if (__MistriaCompanion_field(_menu, "is_tooltip") == true || _gift_popup) {
            _body = __MistriaCompanion_field(_menu, "body_text");
        } else if (__MistriaCompanion_field(_menu, "type") == Menu.Crafting) {
            _body = __MistriaCompanion_field(_menu, "description");
            if (__MistriaCompanion_field(_menu, "context") != RecipeContext.Cooking) {
                __MistriaCompanion_clear_gift_highlights(_body);
                __MistriaCompanion_clear_cooking_details(_body);
                continue;
            }
        } else {
            continue;
        }
        if (_body == undefined || _body.freed) continue;
        var _item = __MistriaCompanion_field(_menu, "item");
        if (_menu.close_requested || _menu.free_requested || _menu.hide_requests > 0
            || _body.marked_for_death || !_body.get_enabled() || _item == undefined)
        {
            __MistriaCompanion_clear_gift_highlights(_body);
            __MistriaCompanion_clear_cooking_details(_body,
                !_menu.close_requested && !_menu.free_requested && _menu.hide_requests <= 0
                && !_body.marked_for_death);
            continue;
        }
        var _details = __MistriaCompanion_for_item(_item);
        if (_details != undefined) {
            if (__MistriaCompanion_field(_menu, "is_tooltip") == true || _gift_popup) {
                __MistriaCompanion_update_gift_highlights(_body, _details);
            } else {
                __MistriaCompanion_update_cooking_details(_menu, _details);
            }
        } else {
            __MistriaCompanion_clear_gift_highlights(_body);
            __MistriaCompanion_clear_cooking_details(_body);
        }
    }
}

function MistriaCompanion_floor_built(_ctx) {
    __MistriaCompanion_runtime().visit_grid = undefined;
    MistriaCompanion_reset_local_sightings(_ctx);
}

function MistriaCompanion_tick() {
    var _runtime = __MistriaCompanion_runtime();
    _runtime.frame++;
    __MistriaCompanion_register_hotkeys();
    MistriaCompanion_update_settings_keybinds();
    if (!__MistriaCompanion_ready()) {
        _runtime.seed_repeat = undefined;
        _runtime.seed_hint = undefined;
        __MistriaCompanion_update_seed_hint();
        _runtime.wiki_title = "";
        _runtime.wiki_hint_title = "";
        __MistriaCompanion_update_museum_label(undefined);
        return;
    }
    MistriaCompanion_update_mounted_interactions();
    MistriaCompanion_update_seed_makers();
    MistriaCompanion_track_local_spawns();
    MistriaCompanion_replay_local_sightings();
    var _language = local_language();
    if (_runtime.language != _language) {
        _runtime.language = _language;
        _runtime.recipe_cache = {};
        _runtime.birthday_day = "";
        _runtime.map_signature = "";
        _runtime.map_labels_ready = false;
        _runtime.wiki_hint_title = "";
    }
    MistriaCompanion_update_gift_tooltips();
    var _day = __MistriaCompanion_legendary_day_key();
    if (_runtime.legendary_day != _day) {
        _runtime.legendary_day = _day;
        _runtime.legendary_sightings = [];
        _runtime.seen_spawns = {};
    }
    var _counter = __MistriaCompanion_field(GRID, "node_counter");
    if (_runtime.visit_grid != GRID || _runtime.visit_counter != _counter || _runtime.visit_day != _day) {
        _runtime.visit_grid = GRID;
        _runtime.visit_counter = _counter;
        _runtime.visit_day = _day;
        _runtime.seen_spawns = {};
        _runtime.dig_spot_visit_key = "";
        _runtime.dig_spot_delay = 0;
        _runtime.dig_spot_notice = undefined;
        _runtime.dig_spots = [];
        _runtime.map_signature = "";
        _runtime.scan_frame = -12;
    }
    if (_runtime.dig_spot_delay >= 0) MistriaCompanion_detect_dig_spots();
    MistriaCompanion_show_dig_spot_notice();
    MistriaCompanion_detect_diving_spots();
    MistriaCompanion_update_birthday_label();

    var _hubs = __MistriaCompanion_map_hubs();
    if (_runtime.frame - _runtime.scan_frame >= 12) {
        _runtime.scan_frame = _runtime.frame;
        if (_hubs != undefined) {
            MistriaCompanion_add_map_labels();
            MistriaCompanion_refresh_map_markers(_hubs);
        }
        MistriaCompanion_add_chest_gift_button();
    }
    var _previous_title = _runtime.wiki_title;
    __MistriaCompanion_resolve_wiki_title();
    if (_runtime.wiki_title != _previous_title) _runtime.wiki_hint_title = "";
    __MistriaCompanion_show_wiki_hint();
}

function MistriaCompanion_register() {
    var _runtime = __MistriaCompanion_runtime();
    if (_runtime.registered) return;
    _runtime.registered = true;
    mmapi_filter("item.display_description", MistriaCompanion_description);
    mmapi_filter("local.get", MistriaCompanion_seed_interact_label);
    mmapi_filter("clock.time_advance", MistriaCompanion_clock_advance);
    mmapi_on("save.game_loaded", MistriaCompanion_reset_save);
    mmapi_on("game.title_entered", MistriaCompanion_reset_save);
    mmapi_on("dungeon.floor_built", MistriaCompanion_floor_built);
    mmapi_on("game.room_transition_pre", MistriaCompanion_reset_local_sightings);
    mmapi_on("game.room_transition_post", MistriaCompanion_reset_local_sightings);
    mmapi_register(MistriaCompanion_tick);
}

mmapi_mod_declare("mistria_item_details", "1.0.51");
MistriaCompanion_register();
