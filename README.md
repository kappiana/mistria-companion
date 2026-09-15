# Mistria Companion

Mistria Companion adds item information and quality-of-life tools to Fields of Mistria while reading directly from the game's current data.

## Features

- Shows compact cooking or crafting recipe summaries for a hovered item.
- Lists met villagers' gift preferences and highlights items already given, keeping individual completion lists for Likeable/Loveable dishes and short Everyone summaries for unlisted universal treats.
- Adds a cooking-station Gifts button with full liked/loved lists and gift-history highlights for the selected dish.
- Adds a chest button that grabs one loved gift for each eligible met villager: available today, below max hearts, and not yet gifted, prioritizing birthdays and backpack space.
- Repeats Seed Maker conversions while Interact is held, using the selected stack and normal seed yields.
- Allows ordinary villager conversations, gifting, quest hand-ins, and Elsie's Gossip while riding your mount, using the normal controls.
- Copies relevant Fields of Mistria Wiki links for items, villagers, calendar birthdays, quest objectives, Museum wings, and map markers.
- Reveals names when hovering darkened collection items in all four Museum wings, with individual item wiki links.
- Shows villager names when hovering known NPC map markers.
- Displays today's birthdays and the companion's clock-pause status below the visible vitals and status-effect icons.
- Offers optional combined alerts for all bug species and legendary fish.
- Shows one combined local F6 notice for bugs and legendary fish currently present.
- Groups active bugs into one marker per map hub, with species and counts on hover and ordinary bugs shown by default.
- Optionally announces active dig spots when entering a location or mine floor and marks their general areas at the nearest map hubs.
- Optionally announces the number of diving spots when entering an area.
- Reveals the active daily Mist Spot on its area's map, even before visiting that area.
- Opens a farm-status menu with crop and empty-soil totals for the farm and greenhouse.
- Pauses natural clock progression without pausing gameplay or overriding the game's own clock stops.
- Adds a Configuration button above the mod's active keybindings on the right side of the Settings landing page.
- Autosaves to a separate reusable crash-recovery slot every five minutes of active play, with a configurable interval and On/Off switch.
- Saves to that same companion slot on demand with F11, even when timed autosave is off.

The mod uses the live item, recipe, NPC, fish, bug, calendar, and map data shipped with the installed game. It does not bundle game or wiki assets.

## Requirements

- Fields of Mistria for Windows
- [Mods of Mistria Installer (MOMI)](https://github.com/Garethp/Mods-of-Mistria-Installer) 0.15.5 or newer

## Installation

1. Download the mod ZIP from the [latest release](https://github.com/kappiana/mistria-companion/releases/latest) and extract it. Use the `MistriaCompanion-v...zip` download, not the source-code archives.
2. Copy the `MistriaCompanion` folder into the game's `mods` folder.
3. Open or restart MOMI, select **Mistria Companion**, and choose **Install**.
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

## Defaults and saved choices

You do not need to edit a file to use the mod. These defaults apply on the first
launch, or when upgrading without a saved preference:

| Setting | Default | Change it with |
| --- | --- | --- |
| Bug, legendary-fish, dig-spot, and dive-spot alerts (independent switches) | **Off** | **Configuration**, or **F10** for all four |
| Bug, dig-spot, and Mist Spot map markers (independent switches) | **On** | **Configuration** |
| Ordinary bugs on the map, alongside very rare bugs | **On** | **F9** |
| Compact `F7 Wiki` hints | **On** | **F8** |
| Timed autosave | **On, every 5 active-play minutes** | **Configuration** |

**Configuration switches and your F8, F9, and F10 choices are saved immediately and restored next time you
play.** A saved choice takes priority over the defaults, including when you load
a different save. Upgrading to v1.0.51 preserves your previous alert choice for
each alert type and keeps the existing ordinary-bug and wiki-hint preferences.

F10 only controls automatic alerts. It does **not** hide wiki hints, map markers,
birthdays, or feedback for actions you take, such as copying a wiki link.
You can still press **F6** for the current area's bug and legendary-fish notices
while automatic alerts are off.

When automatic alerts are enabled, they wait until cutscenes and NPC dialogue end.
They appear afterward only if you are still in the same area or mine-floor visit.

## Controls

| Key | Action |
| --- | --- |
| **F4** | Open farm status, including the greenhouse. |
| **F5** | Pause natural clock progression or release the companion's pause. |
| **F6** | Show current-area bug counts and active legendary fish together in one left-side notice. |
| **F7** | Copy the relevant Fields of Mistria Wiki URL while supported content is selected or hovered. |
| **F8** | Show or hide the compact `F7 Wiki` hints. |
| **F9** | Show or hide ordinary bug map markers. |
| **F10** | Turn automatic spawn, dig-spot, and diving-spot alerts on or off. |
| **F11** | Save to the reusable companion slot, even with timed autosave off. |

Paste copied wiki links into a browser with `Ctrl+V`.

Open the journal's **Settings** tab to see **Mistria Companion** on the right,
before selecting a settings category. The **Configuration** button above the
keybindings opens a menu with these **On/Off** switches:

- Show bug alerts.
- Show bugs on the map (including very rare bugs).
- Show dive spot alerts.
- Show mist spots on the map.
- Show dig spot alerts.
- Show dig spots on the map.
- Show legendary fish alerts.
- Autosave.

When **Autosave** is on, an inline **Save every X minutes** slider appears below
it, ranging from **1 to 30 real-world active-play minutes** (default **5**).
Drag its handle or click the track; with keyboard/controller navigation, select
the handle and press left/right to change by one minute. Dragging previews the
value and saves it on release; track clicks and directional changes save
immediately. No text-entry dialog opens. Turning autosave off hides the slider
without forgetting your chosen interval. Older saved intervals above 30 minutes
are reduced to 30 with a warning in the mod log.

Each switch works independently and applies immediately. Changes save automatically;
if saving fails, the menu explicitly says the changes apply only to this session.
Use the mouse, or move right from the settings categories with directional controls
to select **Configuration**. Inside the menu, move up/down to select a switch and
confirm to toggle it. Long lists scroll with the mouse wheel or controller's right
stick, and directional selection scrolls the selected option into view.
**Close** or the normal menu-back control returns to Settings.

**F10** remains a group shortcut: if any alert type is on, it turns all four off;
if all are off, it turns all four on. It does not change map switches.
**F9** still filters ordinary bugs; it does not override **Show bugs on the map**.

The keybind reference shows your registered primary and alternate bindings,
not just the defaults. That list remains read-only. Selecting Gameplay,
Graphics, Audio, Accessibility, Controls, or Exit replaces it with the game's
normal options. Long binding lists scroll with the mouse wheel or the controller's
right stick while on the Settings landing page.

### Crash-recovery autosave

Timed autosave is enabled by default and first saves after five minutes of
active gameplay. It measures real time, not the in-game clock; the companion's
clock pause does not stop it. Time spent in menus, dialogue, cutscenes, loading,
transitions, or an unfocused game window does not count. If the interval expires
during an action, saving waits for one second of normal or mounted gameplay.
Long stalls and computer-sleep gaps are not counted as active play.

Each character has one reusable companion save,
`game-<character ID>-2147483648.sav`, in the game's normal saves folder.
It uses the game's native save format and disk-writing safeguards. It does not
replace the sleep autosave or existing journal saves and does not create an
ever-growing list of saves. The native **Load Game** screen displays it with a
manual-save icon because it occupies a separate slot.

After a crash, choose **Continue**: the game loads the newest save, including
the companion save if it is the latest. Alternatively, select it by its date
and time in **Load Game**. If you made a newer journal save or slept afterward,
Continue correctly loads that newer save instead.

Normal areas preserve your saved location, including dynamic interiors.
The game's save format does not restore an active mine floor. Autosaving in
the mines or another nonpersistent area keeps your saved progress but records
home as the reload location, without moving you during play. The notification
explicitly says when reloading will return you home.

An **Autosaved** notice appears only after the mod reads back and validates
the new save's core records and timestamp. The game's checksum/tamper warning
is logged, not treated as a failed write, matching the native loader; missing
or unreadable records still fail verification. A failed or blocked save produces a warning and retries after
one more active-play minute. A pre-existing unreadable companion save is
reported rather than silently overwritten. Keep normal journal saves as well:
there is no timed backup before the first interval, and pauses or unsafe actions
can make the latest backup older than five wall-clock minutes.

The On/Off choice and interval persist between sessions. Changing either starts
a fresh interval; loading a save or returning to the title also resets the timer.
F10 controls alerts only and never turns autosave on or off.

### Quick save

Press **F11** during gameplay to request a save to the same reusable companion
slot. It works even when timed autosave is disabled and does not create a new
journal save each time. A successful quick save starts a fresh autosave interval
if timed autosave is enabled.

The save waits for one second of normal or mounted gameplay if an action is
in progress. Close menus and finish dialogue or traveling before requesting it.
Wait for **Companion saved** before quitting; the initial **Quick save requested**
notice does not mean the save has finished. Repeated presses while a request is
pending do not queue additional saves. A failed save reports an error; press the
key again to retry.

Quick saving uses the same location rules as autosave: in the mines, your progress
is saved but reloading returns you home. It does not move you out of the mines
while playing. **Continue** loads this save when it is the newest.

### Wiki links and Museum items

F7 uses what you are currently selecting or hovering; it does not copy the last
item you happened to inspect. A mixed-species bug marker links to the wiki's Bugs
page; a single-species marker links to that bug.

In the Museum's Archaeology, Fish, Flora, and Insects wings, hover a darkened item
icon to see its name in a complete bordered label. This label shows the name
only; there is no hidden description beneath it. Press **F7** over an item icon
to copy that item's wiki link,
whether or not it has been donated. Empty space on the collection page still
links to the wing. The icons remain darkened until donation; looking up an item
does not unlock it or change collection progress. **F8** hides only wiki-key
hints, not these names. Individual Museum item lookup uses the mouse; controller
navigation continues to select whole sets. Item-specific Museum wiki links
currently require the game's English language setting. Other languages still
show localized hover names, but copy the wing page rather than an incorrect
English wiki URL; the mod does not change your language setting.

### Pausing the clock

While the companion owns a clock pause, **Clock paused** appears below the visible
health, stamina, mana, and status-effect icons, alongside any birthday reminder.
The label moves with that HUD layout and hides while menus, cutscenes, or
overlapping HUD notices would obscure it. If there is no room, it stays hidden
rather than covering an icon.

Releasing the pause does not undo a cutscene or another mod's pause. Sleeping,
crafting, and other scripted time changes are not frozen. Loading a save or
returning to the title screen clears the pause and recorded sightings. Unlike
the F8/F9/F10 preferences, the clock pause does not carry over to a new session.

## Farm status

Press **F4** during gameplay to open a farm-status menu. It shows separate
**Farm** and **Greenhouse** sections:

- Empty tilled spots.
- Plants ready to harvest.
- Planted crops that are not ready to harvest.
- Unwatered crops.

The menu uses a fresh snapshot each time it opens, including the greenhouse
when you are elsewhere. It does not harvest, water, plant, or change anything.
Close the menu and reopen it to refresh the counts. Reports that fit have no
scrollbar; longer reports scroll using the same native menu controls as gift details.

Plant counts refer to crop plants on tilled soil, not how many items they will
yield. Fruit trees and wild forage on untilled ground are excluded. Wilted plants
and other objects block a spot from being counted as empty. The unwatered count
is for planted crops, not unused soil.

If you have no greenhouse, its section says so. If a built greenhouse's data
is unavailable, the mod reports that the data is not ready rather than showing
misleading zero totals.

F4 is independent of automatic notifications. The `farm_status` and
`farm_status_alternate` settings let you remap it. Existing key remaps keep their
priority if they already use F4; assign another farm-status binding in that case.

## Gifts and cooking

### Grab loved gifts from a chest

When a regular chest is open, use the gift button above its inventory to collect
up to one loved gift per met, unlocked villager who is **available today**,
**below max hearts (10)**, and **has not received a gift today**.
Saturday-market visitors are skipped on days their game schedule keeps them
away, including when the market is unavailable. Villagers in other regions
still count; they do not need to be standing near your chest.
Birthday villagers get priority; then the picker tries to cover as many other
villagers as your backpack space allows. It accounts for shared preferences,
partial stacks, and item variants.

Collecting a gift does not mark it as given. Repeated clicks can collect another
set while those villagers remain ungifted.

### Gift tooltip progress

The **Liked by** and **Loved by** lists show only villagers you have met and
unlocked. A soft teal highlight behind a name means you have given that villager
the hovered item at least once in the current save, not just today. Preferences
learned through Gossip alone do not count as gifts given.

**Likeable/Loveable dishes with individual gift preferences** keep their normal
NPC lists for completion tracking. For example, Likeable Apple Pie lists only
met villagers who normally like or love Apple Pie—not every villager who would
accept the modified dish. Names stay in their original **Liked by** or
**Loved by** group, with highlights for dishes you have already given.

**Universal treats with no individual gift preferences**, such as Cow-Shaped
Donut, keep **Liked by: Everyone** or **Loved by: Everyone** instead of a long
list. This checks the full NPC data, not just villagers you have met. An item
is labelled loved only if every eligible villager loves it; a mixture of liked
and loved reactions is labelled liked.

Highlights use the game's existing gift history, so past gifts count immediately.
That history tracks the base item, not its infusion; different infusions of the
same item share a highlight. These completion lists do not change the actual
gift reaction or the chest gift picker's infusion-aware choices. Meeting a
villager or giving a gift is reflected the next time you hover
the item. Highlights follow the tooltip's position and fade, including in shops.
No extra save data or configuration is needed.

### Cooking Gift details

Changing the cooking quantity keeps recipe-use and gift-list text out of the
main dish description, without a brief flash of those extra lines.

At a **cooking station**, select a dish and use the **Gifts** button beside its
description to open **Gift details**. The popup shows the full liked/loved lists
with the same highlights, while the dish's original description stays in its
box at its normal size. Only met, unlocked villagers appear. Use the mouse or
controller to select the button, and **Close** or the normal menu-back control
to return to cooking. Unusually long lists scroll with the mouse wheel or right
stick instead of losing names.

The popup describes the selected finished dish, not its ingredients. It does
not require owning the dish or having enough ingredients, and cooking a dish
does not count as giving it as a gift. It does not predict random infusions
that might be applied during cooking. It uses the same completion lists as item
tooltips: Likeable/Loveable dishes keep their individual preferences when they
have any, while universal treats with no individual preferences show the short
**Everyone** summary.

## Holding Interact at the Seed Maker

Select a seed-compatible crop and face a Seed Maker. Tap **Interact** to process
one item normally, or keep holding it to process more of the same selected stack.
The action guide reads **Interact (hold to repeat)** while a compatible item is
selected at the Seed Maker. It keeps the game's actual key or controller-button
icon, so the hint also works when Interact has been remapped from E.
Repeating starts after half a second and processes one item every 0.2 seconds
at the game's normal update rate. Keyboard and controller Interact bindings,
including remapped controls, work without any additional hotkey or configuration.

Release Interact, move or turn, change the selected slot or item, open a menu,
or run out of items to cancel. Leaving the Seed Maker's interaction range,
switching targets, a cutscene, or loading another area also cancels the hold.
After cancellation, release and press Interact again to start a new batch.

The game still handles each conversion, including item consumption, seed yields,
sound, animation, and dropping the seeds. The companion does not pull from other
inventory slots, bypass interaction restrictions, or repeat other machines,
conversations, or item use. Existing single-press behavior is unchanged.
The Seed Maker's separate **Inspect** action remains available and does not repeat.

## Talking, gifting, and quest hand-ins while mounted

Use the normal **Talk** or **Give item** control near a villager while riding.
Select a gift in your toolbar as usual. Ordinary conversations leave you mounted;
the game still handles the dialogue, item consumption, and friendship changes.
Normal gift restrictions still apply.

Use the normal **Interact** control at a villager with a quest ready to turn in.
The game's quest-selection and confirmation popups work while mounted, including
when more than one quest is ready for that villager. Requirements, required items,
quest progression, and rewards remain controlled by the game. Opening or
cancelling the popup does not submit the quest. A hand-in does not use up the
villager's daily gift allowance.

Elsie's **Gossip** action also works while mounted using its normal secondary
interaction control, once her introductory gossip quest is complete. Her daily
limit, cooldown dialogue, available hints, and gift discoveries remain unchanged.

This feature does not unlock dates, proposals, kissing, petting, or other special
interactions while mounted. It does not bypass incomplete quest requirements or
change automatic story triggers. Jumping, dismounting, and scripted cutscene
transitions keep their normal behavior; a quest that starts a cutscene may still
handle your mount as part of that scene.

Mounted talking, gifting, quest hand-ins, and Gossip are enabled by default.
To disable them, close the game, set `"mounted_interactions_enabled": false`
in the configuration file below, and restart. This setting does not add or
change any hotkeys.

## Remapping keys and advanced settings

**File editing is optional.** Use **Settings > Configuration**, F8, F9, or F10 to change and save the
display preferences. Edit this file only if you want different keybindings or
to change a setting manually.

After the first launch, close the game and edit:

```text
%LOCALAPPDATA%\FieldsOfMistria\mod_data\mistria_item_details\mistria_item_details.json
```

The file contains these defaults:

```json
{
  "__config_version": 1,
  "mounted_interactions_enabled": true,
  "notifications_enabled": false,
  "bug_alerts_enabled": false,
  "bug_markers_enabled": true,
  "diving_spot_alerts_enabled": false,
  "mist_spot_markers_enabled": true,
  "dig_spot_alerts_enabled": false,
  "dig_spot_markers_enabled": true,
  "legendary_fish_alerts_enabled": false,
  "autosave_enabled": true,
  "autosave_interval_minutes": 5,
  "all_bug_markers_enabled": true,
  "wiki_hints_enabled": true,
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
  "notifications": "F10",
  "notifications_alternate": "",
  "farm_status": "F4",
  "farm_status_alternate": "",
  "save": "F11",
  "save_alternate": ""
}
```

Each action accepts a primary binding and an optional alternate. MOMI supports
uppercase names such as `F7`, `HOME`, `GAMEPAD_Y`, and chords such as `SHIFT+F7`.
Use an empty string for no alternate. Invalid primary bindings fall back to their
defaults; invalid alternates are disabled. Duplicate bindings within the mod are
ignored after the first registration and logged. The wiki hint uses the registered
wiki binding. Restart the game after editing. Bindings, the mounted-interaction
setting, and all display preferences persist in this file. Configuration and the
F8/F9/F10 toggles update their preferences without changing your keybindings.
`notifications_enabled` is retained for compatibility: it supplies the initial
value for missing alert switches when upgrading, and is saved as whether any
alert type is on. Once the individual switches exist, edit those instead; this
legacy value is no longer a master switch. Existing
`dig_notifications` and `dig_notifications_alternate` bindings migrate to
`notifications` and `notifications_alternate`, so remapped F10 controls are
preserved when upgrading.

The save hotkey uses `save` and `save_alternate`. If you already assigned F11 to
another companion action, that existing binding keeps priority; assign a different
save key here and restart the game. The Settings reference displays the registered
save binding, including an alternate if configured.

## Spawn information

### Automatic bug and legendary-fish alerts

Automatic alerts for **all bug species**, legendary fish, dig spots, and diving spots are
**off by default**. Use **Configuration** to enable individual alert types, or
**F10** to enable or disable them as a group; your choices are remembered next time you play. Enabling alerts affects new
spawns and visits rather than replaying old notices.

With alerts enabled, entering an area or mine floor with bugs shows **one combined
left-side notification**, using the same layout as F6: each bug
species' current count as `Name: count`, and any active legendary fish. It includes
ordinary, rare, and very rare bugs when **Show bug alerts** is on, regardless of
your map settings. Legendary fish are included only when their alert switch is on.
Only notices inside the mines have a location heading, including the floor number.

The full summary appears automatically **only once per visit**. Press **F6** to
see the full list again.

If a **new bug species** is discovered later during that visit, including from
breaking rocks, a small update shows **only that species**, such as
`Moth: 1`. More bugs of an already seen species or catching bugs
do not trigger extra notices. A newly spotted legendary fish gets a small update
too, once per fish species and location per day.

These notices replace the separate `Very Rare Bug` and `Mine bugs:` pop-ups.
They slide in from the left and slide back out when finished, like dig-spot
notifications. They never pause gameplay, and long lists cycle through pages
inside the same notification. Discoveries made while a notice is visible are
grouped into one new-species update rather than repeating the full list. Pressing
F6 before an automatic notice appears shows the report without a duplicate afterward.

Automatic notices wait for menus, cutscenes, and dialogue to finish, but appear
**alongside other notifications**, in their own space below them, instead of
waiting for the whole notification queue to clear. Deferred reports use fresh
counts: caught or despawned bugs and fish no longer present are excluded. Empty areas do
not produce automatic notices. Leaving the
area or disabling an alert type discards its pending automatic notices.
Sighting notices wait for the actual room transition to finish, so leaving an
area does not trigger another summary for the area you are departing.

### F6: Bugs and legendary fish here

Press **F6** to show one combined notification on the **left side of the screen** for
your **current area or mine floor**, not the day's history from other locations.
F6 never opens a menu, pauses gameplay, or takes control away from you.

The notice lists each bug species currently present as `Name: count`,
plus any legendary fish still active there. Outside the mines, it starts directly
with the list, without a location heading. Inside the mines, it keeps the location
and floor-number heading.
Ordinary bugs are included even if you have hidden them on the map. If the full
list is taller than the screen allows, the same notification cycles through
pages automatically rather than creating extra pop-ups or clipping names. Pages
adjust to the space below other notifications. If the screen is temporarily too
full, the notice hides until there is room without using up its reading time.
Repeated F6 presses while the notice is visible do not create duplicates.

Caught or despawned bugs are excluded, and species with none remaining are not
listed. Inventory contents do not affect the counts. Legendary fish that were
caught or despawned are not listed.

The list is a snapshot taken when you press F6; press it again
after the notice finishes to refresh. Leaving the area discards the pending
notice. It waits while a menu or cutscene is active; an on-screen sighting
notice hides during menus or cutscenes and resumes with its remaining reading
time if you are still in the same visit.

### Bugs on the map

All active bug species are shown on the map by default, grouped at the nearest
map hubs rather than exact world positions. Press **F9** to hide ordinary species
or show them again; this choice persists. Very rare species remain included.
Turn **Show bugs on the map** off in Configuration to hide all bug markers,
including very rare species, without changing your F9 filter.
Each hub has one marker using a bug's full-color item icon; hover it for the
species and counts. A very rare species supplies the icon when the group contains
one. Turning automatic alerts off
does not change bug-map visibility.

### Dig spots and cutscenes

Active dig spots are counted once after each location or mine floor finishes
loading. **Show dig spot alerts** controls the optional count notification;
**Show dig spots on the map** independently controls the markers. F10 changes
the alert switch along with the other alert types, not scanning or map markers.
The notification shows only **Dig spots: N**, without a location or floor label.
On the map, full-color **mistril shovel** markers group nearby dig spots at map
hubs, keeping the same icon size as before. Hover a
marker to see the count. Used spots disappear from that count.

Dig-spot notices wait until cutscenes and NPC dialogue have ended. A deferred
notice is shown shortly afterward only if you are still in the same area or
mine-floor visit, using the number of spots still active. Leaving the area,
loading another save, or disabling automatic alerts discards the pending notice.
If a cutscene starts while a dig notice is visible, that notice is hidden.
Scanning and map markers are unaffected.

### Diving spots

With **Show dive spot alerts** enabled, entering an area with diving spots shows one
sliding **Diving spots: N** notification. It counts the current area's diving
spots, not dungeon-entry whirlpools, and does not reveal their loot.

The notice waits for the actual transition, menus, and cutscenes to finish,
then counts only spots still present. Empty areas do not generate a notice.
Leaving the area or disabling alerts cancels a pending notice; visible diving
notices hide when leaving, opening a menu, or starting a cutscene. As with dig
alerts, enabling F10 mid-visit does not replay an old entry count.

### Daily Mist Spot

The active daily **Mist Spot** uses the actual pink mist-cloud artwork seen in
the world, scaled down for the map with a continuous, thin black outline—not the Mist Sight skill
symbol. The marker stays inside the map image and appears only on the area tab
that contains the spot, not on neighboring-area exits.
Browse the map's area tabs to locate it; you do not need to visit its area first.
The icon marks its nearest map hub, not exact world coordinates. Hover for the
label **Mist Spot**, without a location name, or press **F7** while hovering to
copy its wiki link.
**Show mist spots on the map** in Configuration controls this marker independently
of F9, F10, and dive-spot alerts. It follows the game's active Mist Spot
state, disappears after the spot is used, and updates when the daily spot changes.
It does not unlock Mist Sight, create a spot, spend Essence, or change rewards.

## Known limitations

- The game runtime cannot open web links directly, so F7 copies links to the clipboard.
- Dig markers show approximate areas and do not reveal exact coordinates or predict what a spot contains.
- Quest Details wiki detection depends on the active objective data exposed by the game and may not recognize every objective layout.
- Long recipe lists are summarized rather than expanded in full.
- Gift selection has a search limit to avoid long delays. If the notification says that limit was reached, additional gifts may still fit in your backpack.
- Other mods can register the same hotkeys or change native menus and game data. Remap conflicting keys and test your actual mod combination.
- Mods that replace villager talk, gift, or quest hand-in eligibility can conflict with mounted interactions. Disable this feature if another mod needs to control those rules.
- Mods that replace or add Seed Maker interactions can disable hold-to-repeat; normal single-press controls remain available.

## Troubleshooting

**Crash after cooking (`no such field "text"`):** Update to v1.0.52 or newer.
The companion's cooking-description wrapper now binds the game's text setter
to the description node instead of the companion's state object. This preserves
the native description and Gifts button when the cooking menu refreshes.
Close the game, replace the old mod folder, and run MOMI's **Install** again;
replacing the files alone does not update the installed game.

**Autosave failed:** Check the companion log below and the game's free disk
space/write permissions. Other mods may veto saving. If the log reports an
unreadable companion save, close the game and back up that specific file before
moving it out of the saves folder; the next timed save can then create a fresh
companion slot. Do not remove your sleep autosave or journal saves.

Earlier v1.0.52 builds incorrectly reported **Autosave checksum validation failed**
as a fatal save error. Reinstall this updated build to allow the existing companion
slot to be checked and reused; do not delete it solely for a checksum/tamper warning.

If a toggle says **Preference not saved**, the change applies only to the current
session. Check the log below and make sure the game can write to its `mod_data`
folder.

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
