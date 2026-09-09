function __MistriaCompanion_runtime() {
    if (global[$ "__mistria_item_details"] == undefined) {
        global.__mistria_item_details = {
            registered: false,
            bindings: undefined,
            keybind_rows: [],
            mounted_interactions_enabled: true,
            frame: 0,
            clock_paused: false,
            cache: {},
            recipe_cache: {},
            wiki_title: "",
            wiki_hint_title: "",
            wiki_hints_enabled: true,
            all_bug_markers_enabled: false,
            legendary_day: "",
            legendary_sightings: [],
            seen_spawns: {},
            replay_frame: -180,
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
            mine_bug_floor: "",
            mine_bug_delay: -1,
            dig_spot_notifications_enabled: true,
            dig_spot_visit_key: "",
            dig_spot_delay: -1,
            dig_spots: []
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
    _runtime.clock_paused = false;
    _runtime.cache = {};
    _runtime.recipe_cache = {};
    _runtime.wiki_title = "";
    _runtime.wiki_hint_title = "";
    _runtime.legendary_day = "";
    _runtime.legendary_sightings = [];
    _runtime.seen_spawns = {};
    _runtime.replay_frame = -180;
    _runtime.birthday_day = "";
    _runtime.birthday_text = "";
    _runtime.visit_grid = undefined;
    _runtime.visit_counter = -1;
    _runtime.visit_day = "";
    _runtime.mine_bug_floor = "";
    _runtime.mine_bug_delay = -1;
    _runtime.dig_spot_visit_key = "";
    _runtime.dig_spot_delay = -1;
    _runtime.dig_spots = [];
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
        { key: "sightings", title: "Replay rare sightings", default_key: "F6", callback: MistriaCompanion_show_legendary_sightings },
        { key: "wiki", title: "Copy current wiki link", default_key: "F7", callback: MistriaCompanion_open_wiki },
        { key: "wiki_hints", title: "Show / hide wiki hints", default_key: "F8", callback: MistriaCompanion_toggle_wiki_hints },
        { key: "bugs", title: "Show / hide ordinary bugs", default_key: "F9", callback: MistriaCompanion_toggle_all_bug_markers },
        { key: "dig_notifications", title: "Show / hide dig notices", default_key: "F10", callback: MistriaCompanion_toggle_dig_spot_notifications }
    ];
}

function __MistriaCompanion_register_hotkeys() {
    var _runtime = __MistriaCompanion_runtime();
    if (_runtime.bindings != undefined) return;

    var _config = mmapi_config_read_valid("mistria_item_details", 1);
    _runtime.mounted_interactions_enabled = __MistriaCompanion_mounted_setting(_config);
    var _actions = __MistriaCompanion_hotkey_actions();
    _runtime.bindings = {};
    _runtime.keybind_rows = [];
    var _registered = {};
    var _saved = { mounted_interactions_enabled: _runtime.mounted_interactions_enabled };
    for (var _index = 0; _index < array_length(_actions); _index++) {
        var _action = _actions[_index];
        var _row = { title: _action.title, bindings: [] };
        for (var _alternate = 0; _alternate < 2; _alternate++) {
            var _key = _action.key + (_alternate == 0 ? "" : "_alternate");
            var _default = _alternate == 0 ? _action.default_key : "";
            var _name = __MistriaCompanion_field(_config, _key);
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
    if (__MistriaCompanion_field(_config, "mounted_interactions_enabled") != undefined) {
        // Read the member inline: the engine can coerce bool locals to numbers.
        if (typeof(_config.mounted_interactions_enabled) == "bool") {
            return _config.mounted_interactions_enabled;
        }
        mmapi_log_warn("mistria_item_details", "Invalid mounted_interactions_enabled; using true.");
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

    // Mirror only the native talk/gift predicates, without ari_can_talk's mount veto.
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

function __MistriaCompanion_wrap_mounted_interaction(_npc, _interaction, _gift) {
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
    var _talk_count = 0;
    var _gift_count = 0;
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
        }
    }
    // Caldarus appends a separate sleeping-only Talk after the inherited entries.
    var _caldarus_pair = _npc.npc_id == NpcId.Caldarus && _talk_count == 2
        && _talk_first == 0 && _talk_last == _count - 1;
    if (_talk_count == 1 || _caldarus_pair) __MistriaCompanion_wrap_mounted_interaction(_npc, _talk, false);
    if (_gift_count == 1) __MistriaCompanion_wrap_mounted_interaction(_npc, _gift, true);
    if ((_talk_count != 1 && !_caldarus_pair) || _gift_count != 1) {
        mmapi_warn_rate_limited("mistria_item_details:mounted_entries", "mistria_item_details",
            "Mounted interactions: missing or duplicate talk/gift entries; ambiguous entries were left unchanged.");
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
    var _header = _scroller.new_element(24).set_sprites_from_key("spr_ui_generic_box_category");
    ANCHOR.text(_header)
        .set_text("Mistria Companion")
        .set_align(Align.Center, Align.Middle)
        .set_lut(COMMON_LUT, CommonLutIndex.Header);

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

function MistriaCompanion_detect_dig_spots() {
    var _runtime = __MistriaCompanion_runtime();
    if (GRID == undefined) {
        _runtime.dig_spot_visit_key = "";
        _runtime.dig_spot_delay = -1;
        _runtime.dig_spots = [];
        return;
    }

    var _visit_key = __MistriaCompanion_dig_spot_visit_key();
    if (_runtime.dig_spot_visit_key != _visit_key) {
        _runtime.dig_spot_visit_key = _visit_key;
        _runtime.dig_spot_delay = 0;
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
    if (_count == 0 || !_runtime.dig_spot_notifications_enabled) return;

    create_notification(
        ANCHOR.wrap_for_local(
            "Dig spots: " + string(_count) + " - "
                + __MistriaCompanion_dig_spot_location_name()
        ),
        60 * 3
    );
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
    if (__MistriaCompanion_field(_runtime.seen_spawns, _seen_key) == true) return;
    var _item_data = global[$ "__item_data"];
    if (!is_array(_item_data) || _item_id < 0 || _item_id >= array_length(_item_data)) return;
    _runtime.seen_spawns[$ _seen_key] = true;

    var _location = __MistriaCompanion_location_name(CURRENT_LOCATION_ID);
    var _name = __MistriaCompanion_name(_item_data[_item_id]);
    var _entry = _kind + ": " + _name + " - " + _location;
    if (__MistriaCompanion_has_name(_runtime.legendary_sightings, _entry)) return;

    array_push(_runtime.legendary_sightings, _entry);
    __MistriaCompanion_notify(_entry, 60 * 4);
}

function __MistriaCompanion_track_legendary_fish(_fish) {
    var _prototype = __MistriaCompanion_field(_fish, "prototype");
    if (_prototype == undefined || _prototype.legendary != true) return;
    __MistriaCompanion_track_legendary("Legendary Fish", _prototype.item);
}

function MistriaCompanion_track_legendary_spawns() {
    if (BUGS == undefined || FISH == undefined) return;

    for (var _index = 0; _index < instance_number(obj_bug); _index++) {
        var _bug = instance_find(obj_bug, _index);
        if (_bug.item_id == undefined) continue;
        var _bug_data = BUGS.get(_bug.item_id);
        if (_bug_data != undefined && _bug_data.rarity == "very_rare") {
            __MistriaCompanion_track_legendary("Very Rare Bug", _bug.item_id);
        }
    }

    for (var _index = 0; _index < instance_number(obj_fishy); _index++) {
        var _fish = instance_find(obj_fishy, _index);
        if (_fish.fish_loot != undefined) {
            __MistriaCompanion_track_legendary_fish(_fish.fish_loot);
        }
    }

    for (var _index = 0; _index < instance_number(obj_fish_school); _index++) {
        var _school = instance_find(obj_fish_school, _index);
        if (_school.fish_in_school == undefined) continue;
        for (var _fish_index = 0; _fish_index < _school.fish_in_school.count(); _fish_index++) {
            __MistriaCompanion_track_legendary_fish(_school.fish_in_school.get(_fish_index));
        }
    }
}

function MistriaCompanion_show_mine_bug_spawns() {
    var _runtime = __MistriaCompanion_runtime();
    if (DUNGEON_RUNNER == undefined) {
        _runtime.mine_bug_floor = "";
        _runtime.mine_bug_delay = -1;
        return;
    }

    var _level = DUNGEON_RUNNER.current_level();
    if (_level == undefined || __MistriaCompanion_field(GRID, "is_setup") != true) return;
    var _floor_key = string(DUNGEON_RUNNER.current_floor) + ":"
        + string(room()) + ":" + string(_level.impl);
    if (_runtime.mine_bug_floor != _floor_key) {
        _runtime.mine_bug_floor = _floor_key;
        _runtime.mine_bug_delay = 0;
        return;
    }

    if (_runtime.mine_bug_delay > 0) {
        _runtime.mine_bug_delay--;
        return;
    }
    if (_runtime.mine_bug_delay != 0) return;
    var _item_data = global[$ "__item_data"];
    if (BUGS == undefined || !is_array(_item_data)) return;
    _runtime.mine_bug_delay = -1;

    var _names = [];
    var _counts = [];
    for (var _index = 0; _index < instance_number(obj_bug); _index++) {
        var _bug = instance_find(obj_bug, _index);
        var _item_id = __MistriaCompanion_field(_bug, "item_id");
        if (_item_id == undefined || _item_id < 0 || _item_id >= array_length(_item_data)) continue;

        var _name = __MistriaCompanion_name(_item_data[_item_id]);
        var _name_index = __MistriaCompanion_name_index(_names, _name);
        if (_name_index == -1) {
            array_push(_names, _name);
            array_push(_counts, 1);
        } else {
            _counts[_name_index]++;
        }
    }

    if (array_length(_names) == 0) return;

    var _summary = "";
    for (var _index = 0; _index < array_length(_names); _index++) {
        if (_index > 0) _summary += ", ";
        _summary += _names[_index];
        if (_counts[_index] > 1) _summary += " x" + string(_counts[_index]);
    }

    create_notification(
        ANCHOR.wrap_for_local("Mine bugs: " + _summary),
        60 * 3
    );
}

function MistriaCompanion_show_legendary_sightings() {
    if (!__MistriaCompanion_ready()) {
        __MistriaCompanion_notify("Sightings are available during gameplay.", 60);
        return;
    }
    var _runtime = __MistriaCompanion_runtime();
    if (_runtime.frame - _runtime.replay_frame < 180) return;
    _runtime.replay_frame = _runtime.frame;
    if (_runtime.legendary_day != __MistriaCompanion_legendary_day_key()
        || array_length(_runtime.legendary_sightings) == 0)
    {
        __MistriaCompanion_notify("No legendary fish or very rare bugs seen today.", 60 * 3);
        return;
    }

    for (var _index = 0; _index < array_length(_runtime.legendary_sightings); _index++) {
        __MistriaCompanion_notify(_runtime.legendary_sightings[_index], 60 * 4);
    }
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
    __MistriaCompanion_notify(
        _runtime.wiki_hints_enabled ? "Wiki hints enabled." : "Wiki hints disabled.", 60);
}

function MistriaCompanion_toggle_all_bug_markers() {
    var _runtime = __MistriaCompanion_runtime();
    _runtime.all_bug_markers_enabled = !_runtime.all_bug_markers_enabled;
    _runtime.scan_frame = -12;
    __MistriaCompanion_notify(
        _runtime.all_bug_markers_enabled
            ? "Ordinary bug map markers enabled."
            : "Ordinary bug map markers disabled.", 60 * 2);
}

function MistriaCompanion_toggle_dig_spot_notifications() {
    var _runtime = __MistriaCompanion_runtime();
    _runtime.dig_spot_notifications_enabled = !_runtime.dig_spot_notifications_enabled;
    __MistriaCompanion_notify(
        _runtime.dig_spot_notifications_enabled
            ? "Dig spot notifications enabled."
            : "Dig spot notifications disabled.", 60 * 2);
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

function MistriaCompanion_update_birthday_label() {
    var _vitals = __MistriaCompanion_menu(Menu.Vitals);
    if (_vitals == undefined || _vitals.mana_icon == undefined) return;

    var _label = _vitals.mana_icon.board_get("mistria_item_details_birthday_label");
    if (_label == undefined) {
        _label = ANCHOR.text(_vitals.mana_icon)
            .set_align(Align.LeftIn, Align.BottomOut)
            .set_xy(0, 3)
            .set_lut(COMMON_LUT)
            .set_text_align(TextAlign.Left)
            .set_max_width(160)
            .allow_line_breaks()
            .disable();
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
    if (_label.board_get("mistria_item_details_text") == _text) return;
    _label.board_set("mistria_item_details_text", _text);
    _label.set_text(_text).set_enabled(_text != "");
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

function MistriaCompanion_capture_museum_wing_context() {
    var _museum = __MistriaCompanion_menu(Menu.Museum);
    if (_museum == undefined || _museum.hide_requests > 0) return;

    var _title = "";
    switch _museum.canvas.board_get("selected_wing") {
        case MuseumWing.Archaeology: _title = "Archaeology Wing"; break;
        case MuseumWing.Fish: _title = "Fish Wing"; break;
        case MuseumWing.Flora: _title = "Flora Wing"; break;
        case MuseumWing.Insect: _title = "Insects Wing"; break;
    }

    if (_title != ""
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

function MistriaCompanion_refresh_map_markers(_hubs) {
    var _runtime = __MistriaCompanion_runtime();
    var _bugs = [];
    var _spots = [];
    var _mist = __MistriaCompanion_active_mist_spot();
    var _signature = string(_runtime.all_bug_markers_enabled) + ":";
    var _location_matches = LOCATIONS[CURRENT_LOCATION_ID].map_location
        == _runtime.map_menu.selected_location_id;
    for (var _bug_index = 0; _bug_index < instance_number(obj_bug); _bug_index++) {
        if (!_location_matches || BUGS == undefined) break;
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
    if (_location_matches && _runtime.dig_spot_visit_key == __MistriaCompanion_dig_spot_visit_key()) {
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
                    .set_lut(COMMON_LUT).listen_for_hovers();
                _bug_marker.board_set("label", __MistriaCompanion_hover_label(_bug_marker));
                _hub.node.board_set("mistria_item_details_bug_marker", _bug_marker);
            }
            var _text = "";
            for (var _species = 0; _species < array_length(_group.species); _species++) {
                if (_text != "") _text += "\n";
                _text += _group.species[_species] + " x" + string(_group.counts[_species]);
            }
            _bug_marker.set_sprite(ITEM_PROTOTYPES[_group.icon_item].icon_sprite).enable();
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
                    .set_sprite(spr_ui_item_tool_rusty_shovel)
                    .set_outline_sprite(spr_ui_item_tool_rusty_shovel_outline)
                    .set_xy(10, -10).set_lut(COMMON_LUT).listen_for_hovers();
                _dig_marker.board_set("label", __MistriaCompanion_hover_label(_dig_marker));
                _hub.node.board_set("mistria_item_details_dig_marker", _dig_marker);
            }
            _dig_marker.board_get("label").set_text(
                _group.digs == 1 ? "Dig spot" : "Dig spots: " + string(_group.digs));
            _dig_marker.enable();
        } else if (_dig_marker != undefined) {
            _dig_marker.disable();
            _dig_marker.board_get("label").set_alpha(0);
        }

        var _mist_marker = _hub.node.board_get("mistria_item_details_mist_marker");
        if (_group.mist) {
            if (_mist_marker == undefined) {
                _mist_marker = ANCHOR.sprite(_hub.node)
                    .set_sprite(spr_ui_skills_archaeology_icon_mist_sight)
                    .set_xy(-10, 10).set_lut(COMMON_LUT).listen_for_hovers();
                _mist_marker.board_set("label", __MistriaCompanion_hover_label(_mist_marker));
                _hub.node.board_set("mistria_item_details_mist_marker", _mist_marker);
            }
            _mist_marker.board_get("label").set_text(
                "Mist Spot\n" + __MistriaCompanion_location_name(_mist.location_id));
            _mist_marker.enable();
            array_push(_runtime.map_wiki_nodes, { node: _mist_marker, title: "Mist Spot" });
        } else if (_mist_marker != undefined) {
            _mist_marker.disable();
            _mist_marker.board_get("label").set_alpha(0);
        }
    }
    _runtime.map_signature = _signature;
}

function __MistriaCompanion_npc_needs_gift(_npc_id) {
    if (!is_array(NPCS) || _npc_id < 0 || _npc_id >= array_length(NPCS)) return false;

    var _npc = NPCS[_npc_id];
    if (_npc == undefined) return false;
    return npc_is_unlocked(_npc_id) && _npc.has_met() && _npc.gift_flag;
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

function __MistriaCompanion_gift_desire_for_npc(_item, _npc, _npc_id) {
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
    if (_item.infusion == Infusion.Loveable || _npc.loved_gifts.contains(_item.item_id)) {
        return Desire.Loved;
    }
    if (_item.infusion == Infusion.Likeable || _npc.liked_gifts.contains(_item.item_id)) {
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
            ANCHOR.wrap_for_local("Every met villager has already received a gift today."),
            60 * 3
        );
        return;
    }
    if (_gift_plan.matched_count == 0) {
        create_notification(
            ANCHOR.wrap_for_local("This chest has no loved gifts for ungifted villagers."),
            60 * 3
        );
        return;
    }

    var _moved = 0;
    for (var _index = 0; _index < array_length(_gift_plan.entries); _index++) {
        var _entry = _gift_plan.entries[_index];
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
        _message += " Some planned transfers no longer fit or the chest changed.";
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
    var _npc_data = __MistriaCompanion_as_array(global[$ "__npc_prototypes"]);
    if (array_length(_npc_data) > 0) {
        var _count = array_length(_npc_data);
        for (var _npc_id = 0; _npc_id < _count; _npc_id++) {
            var _npc = _npc_data[_npc_id];
            var _name = __MistriaCompanion_npc_name(_npc, "Unknown");
            var _desire = __MistriaCompanion_gift_desire_for_npc(_item, _npc, _npc_id);
            if (_desire == Desire.Loved) {
                array_push(_loved, _name);
            } else if (_desire == Desire.Liked) {
                array_push(_liked, _name);
            }
        }
    }

    return {
        recipes: _recipe_summary,
        liked: __MistriaCompanion_join(_liked),
        loved: __MistriaCompanion_join(_loved)
    };
}

function MistriaCompanion_description(_value, _ctx) {
    if (_value == undefined || _ctx == undefined) return undefined;
    var _item = __MistriaCompanion_field(_ctx, "item");
    var _item_id = __MistriaCompanion_field(_item, "item_id");
    if (_item_id == undefined) return undefined;

    var _cache_key = string(_item_id) + ":" + string(_item.infusion);
    var _runtime = __MistriaCompanion_runtime();
    var _details = __MistriaCompanion_field(_runtime.cache, _cache_key);
    if (_details == undefined) {
        _details = __MistriaCompanion_for_item(_item);
        _runtime.cache[$ _cache_key] = _details;
    }

    if (_details == undefined) return undefined;
    if (_details.recipes == "" && _details.liked == "" && _details.loved == "") return undefined;

    var _result = _value;
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

function MistriaCompanion_floor_built(_ctx) {
    __MistriaCompanion_runtime().visit_grid = undefined;
}

function MistriaCompanion_tick() {
    var _runtime = __MistriaCompanion_runtime();
    _runtime.frame++;
    __MistriaCompanion_register_hotkeys();
    MistriaCompanion_update_settings_keybinds();
    if (!__MistriaCompanion_ready()) {
        _runtime.wiki_title = "";
        _runtime.wiki_hint_title = "";
        return;
    }
    MistriaCompanion_update_mounted_interactions();
    var _language = local_language();
    if (_runtime.language != _language) {
        _runtime.language = _language;
        _runtime.cache = {};
        _runtime.recipe_cache = {};
        _runtime.birthday_day = "";
        _runtime.map_signature = "";
        _runtime.map_labels_ready = false;
        _runtime.wiki_hint_title = "";
    }
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
        _runtime.dig_spots = [];
        _runtime.mine_bug_floor = "";
        _runtime.mine_bug_delay = 0;
        _runtime.map_signature = "";
        _runtime.scan_frame = -12;
    }
    if (_runtime.dig_spot_delay >= 0) MistriaCompanion_detect_dig_spots();
    if (_runtime.mine_bug_delay >= 0) MistriaCompanion_show_mine_bug_spawns();
    MistriaCompanion_track_legendary_spawns();
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
    mmapi_filter("clock.time_advance", MistriaCompanion_clock_advance);
    mmapi_on("save.game_loaded", MistriaCompanion_reset_save);
    mmapi_on("game.title_entered", MistriaCompanion_reset_save);
    mmapi_on("dungeon.floor_built", MistriaCompanion_floor_built);
    mmapi_register(MistriaCompanion_tick);
}

mmapi_mod_declare("mistria_item_details", "1.0.39");
MistriaCompanion_register();
