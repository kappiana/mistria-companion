# Mistria Companion

Mistria Companion adds item information and quality-of-life tools to Fields of Mistria while reading directly from the game's current data.

## Features

- Shows compact cooking or crafting recipe summaries for a hovered item.
- Lists villagers who like or love the actual hovered item, including its infusion and special-item gift rules.
- Adds a chest button that grabs one loved gift for each met villager who has not received a gift that day, prioritizing birthdays and available backpack space.
- Allows ordinary villager conversations and gifting while riding your mount, using the normal controls.
- Copies relevant Fields of Mistria Wiki links for items, villagers, calendar birthdays, quest objectives, Museum wings, and map markers.
- Shows villager names when hovering known NPC map markers.
- Displays today's birthdays below the mana meter.
- Announces legendary fish and very rare bug spawns.
- Groups active bugs into one marker per map hub, with species and counts on hover and ordinary bugs available on demand.
- Announces active dig spots when entering a location or mine floor and marks their general areas at the nearest map hubs.
- Reveals the active daily Mist Spot on its area's map, even before visiting that area.
- Lists bugs initially spawned on each newly entered mine floor.
- Pauses natural clock progression without pausing gameplay or overriding the game's own clock stops.
- Lists the mod's active keybindings on the otherwise-empty right side of the Settings landing page.

The mod uses the live item, recipe, NPC, fish, bug, calendar, and map data shipped with the installed game. It does not bundle game or wiki assets.

## Requirements

- Fields of Mistria for Windows
- [Mods of Mistria Installer (MOMI)](https://github.com/Garethp/Mods-of-Mistria-Installer) 0.15.5 or newer

## Installation

1. Download the release ZIP and extract it.
2. Copy the `MistriaCompanion` folder into the game's `mods` folder.
3. Start MOMI, select **Mistria Companion**, and choose **Install**.
4. Launch Fields of Mistria.

The installed layout should be:

```text
Fields of Mistria\
  mods\
    MistriaCompanion\
      manifest.json
      gml\
        MistriaCompanion.gml
```

Do not copy a DLL or add an extra folder level. MOMI detects the mod only when `manifest.json` is directly inside the mod folder.

If upgrading from Mistria Item Details, remove the old `MistriaItemDetails` folder before installing Mistria Companion. The internal mod ID remains unchanged for compatibility.

For an existing Mistria Companion installation, close the game and replace the old
`MistriaCompanion` mod folder instead of merging files. Then run MOMI's **Install**
again. Do not keep two copies of either mod selected. Back up saves before testing
a new mod version; the companion itself does not write custom data into your saves.

## Controls

| Key | Action |
| --- | --- |
| **F5** | Pause natural clock progression or release the companion's pause. |
| **F6** | Replay legendary fish and very rare bug sightings from the current day. |
| **F7** | Copy the relevant Fields of Mistria Wiki URL while supported content is selected or hovered. |
| **F8** | Toggle the compact `F7 Wiki` hints for the current session. |
| **F9** | Toggle ordinary bug map markers for the current session. |
| **F10** | Toggle dig-spot notifications for the current session. |

Paste copied wiki links into a browser with `Ctrl+V`.

Open the journal's **Settings** tab to see a **Mistria Companion** keybind reference
on the right, before selecting a settings category. It shows your registered
primary and alternate bindings, not just the defaults. The list is read-only:
you do not need to edit any files to use the default controls. Selecting Gameplay,
Graphics, Audio, Accessibility, Controls, or Exit replaces it with the game's
normal options. Long binding lists scroll with the mouse wheel or the controller's
right stick while on the Settings landing page.

F7 resolves the current visible context when pressed; it does not copy the last
item you happened to inspect. A mixed-species bug marker links to the wiki's Bugs
page; a single-species marker links to that bug.

While the companion owns a clock pause, **Clock paused** appears below the mana
meter. Releasing it does not undo a cutscene or another mod's pause. Sleeping,
crafting, and other scripted time changes are not frozen. Loading a save or
returning to the title screen clears the pause and recorded sightings. F8, F9,
and F10 toggle states last until the game is closed; their startup defaults are
wiki hints on, ordinary bug markers off, and dig notifications on.

When a regular chest is open, use the gift button above its inventory to collect
up to one loved gift per eligible villager from that chest. Its selection
objective is birthday coverage first, then total villager coverage, then stable
villager order. A birthday gift can take priority even if fewer total gifts fit.
The picker accounts for overlapping preferences, partial stacks, and item
variants. It does not mark a villager as gifted until the gift is actually given.
Repeated clicks can collect another set while those villagers remain ungifted.

### Talking and gifting while mounted

Use the normal **Talk** or **Give item** control near a villager while riding.
Select a gift in your toolbar as usual. Ordinary conversations leave you mounted;
the game still handles the dialogue, item consumption, and friendship changes.
Normal gift restrictions still apply.

This feature does not unlock quest turn-ins, dates, proposals, kissing, petting,
or other special interactions while mounted. A villager waiting for a quest
turn-in may still require you to dismount before talking. Jumping, dismounting,
and scripted cutscene transitions keep their normal behavior.

Mounted talking and gifting are enabled by default. To disable both, close the
game, set `"mounted_interactions_enabled": false` in the configuration file below,
and restart. This setting does not add or change any hotkeys.

### Remapping keys

After the first launch, close the game and edit:

```text
%LOCALAPPDATA%\FieldsOfMistria\mod_data\mistria_item_details\mistria_item_details.json
```

The file contains these defaults:

```json
{
  "__config_version": 1,
  "mounted_interactions_enabled": true,
  "clock": "F5",
  "clock_alternate": "",
  "sightings": "F6",
  "sightings_alternate": "",
  "wiki": "F7",
  "wiki_alternate": "",
  "wiki_hints": "F8",
  "wiki_hints_alternate": "",
  "bugs": "F9",
  "bugs_alternate": "",
  "dig_notifications": "F10",
  "dig_notifications_alternate": ""
}
```

Each action accepts a primary binding and an optional alternate. MOMI supports
uppercase names such as `F7`, `HOME`, `GAMEPAD_Y`, and chords such as `SHIFT+F7`.
Use an empty string for no alternate. Invalid primary bindings fall back to their
defaults; invalid alternates are disabled. Duplicate bindings within the mod are
ignored after the first registration and logged. The wiki hint uses the registered
wiki binding. Restart the game after editing. Bindings and the mounted-interaction
setting persist in this file, but the session toggle states do not.

## Spawn information

Legendary fish and very rare bugs are announced only after they actually spawn in a map you visit. Sightings are deduplicated by species and location for the current day. Active very rare bugs are always included at their nearest map hub rather than their exact world position. Press **F9** to also include every other active bug in the current area for the rest of the session. Each hub has one bug marker; hover it for the species and counts. A very rare species supplies the icon when the group contains one.

Active dig spots are counted once after each location or mine floor finishes loading. Press **F10** to disable or re-enable the count notification for the current session; this does not disable scanning or map markers. Opening the corresponding map groups the spots at their nearest map hubs with a native-size outlined shovel marker, offset to the opposite side from the bug marker. The count appears only on hover. Used dig spots disappear from the map count.

The active daily **Mist Spot** is shown with the native **Mist Sight** skill icon.
Browse the map's area tabs to locate it; you do not need to visit its area first.
The icon marks its nearest map hub, not exact world coordinates. Hover for the
spot's location name, or press **F7** while hovering to copy its wiki link.
This marker is independent of F9 and F10. It follows the game's active Mist Spot
state, disappears after the spot is used, and updates when the daily spot changes.
It does not unlock Mist Sight, create a spot, spend Essence, or change rewards.

On entering a newly generated mine floor, a compact `Mine bugs:` notification lists the bugs initially present. Duplicate species include a count.

## Known limitations

- The game runtime cannot open web links directly, so F7 copies links to the clipboard.
- Dig markers show approximate areas and do not reveal exact coordinates or predict what a spot contains.
- Quest Details wiki detection depends on the active objective data exposed by the game and may not recognize every objective layout.
- Mine bug summaries include only bugs present when the floor finishes loading; bugs revealed later from rocks or other interactions are not included.
- Long recipe lists are summarized rather than expanded in full.
- Gift selection has a search limit to avoid long delays. If the notification says that limit was reached, additional gifts may still fit in your backpack.
- Other mods can register the same hotkeys or change native menus and game data. Remap conflicting keys and test your actual mod combination.
- Mods that replace villager talk or gift eligibility can conflict with mounted interactions. Disable this feature if another mod needs to control those rules.

## Troubleshooting

Keybinding and companion warnings are logged at:

```text
%LOCALAPPDATA%\FieldsOfMistria\mod_data\mistria_item_details\logs\mistria_item_details.log
```

Framework errors may also appear in
`%LOCALAPPDATA%\FieldsOfMistria\mod_data\mmapi\logs\mmapi.log`.
For installation failures, retain MOMI's error output and include the game,
MOMI, and mod versions when reporting the problem.

## License

Mistria Companion is available under the [MIT License](LICENSE).
