<!-- Last Modified: 2026-10-17 -->
# Dungeon pack format · version 1

A `.dungeon` file is an ordinary ZIP with a custom extension. Rename a copy to `.zip` to inspect it. It contains:

```text
manifest.json
packs/your-world.json
packs/another-world.json
```

The manifest is:

```json
{"format":"dungeon2d-bundle","version":1,"entry":"your-world","packs":["packs/your-world.json","packs/another-world.json"]}
```

All dependencies must be included, including return links. Cycles are allowed. Missing maps, duplicate IDs, unsupported versions, unsafe paths, unsafe keys and invalid numerical values are rejected. There are at most 16 packs per bundle, 32 maps per pack, 200 item definitions per pack and 500 entries in each map collection. IDs match `[a-z][a-z0-9-]{0,47}` and must not be `constructor` or `prototype`.

## A minimal standalone world

Save this as `your-world.json`, run `node scripts/pack.mjs your-world.dungeon your-world your-world.json`, and import the output from the game menu. No engine changes are needed.

```json
{
  "format": "dungeon2d-pack",
  "version": 1,
  "id": "your-world",
  "title": "Your World",
  "description": "A quiet place to begin.",
  "author": "Your name",
  "theme": "town",
  "dependencies": [],
  "startMap": "garden",
  "palette": {
    "grass": "#799668", "grassDark": "#6d885e",
    "path": "#c6c2a9", "road": "#777d7b", "water": "#7eafb3",
    "wall": "#ded5ba", "roof": "#946c58", "floor": "#b4a58b", "accent": "#d5b76e"
  },
  "player": {"gold": 25, "inventory": {"apple": 1}, "colors": ["#617f78", "#ad6b58"]},
  "items": {
    "apple": {"name": "Apple", "description": "A crisp apple.", "icon": "apple", "value": 4,
      "consumable": true, "use": {"type": "restore", "amount": 20}}
  },
  "maps": [{
    "id": "garden", "name": "The Garden", "subtitle": "A new beginning",
    "width": 800, "height": 600, "environment": "outdoor",
    "spawn": {"x": 400, "y": 400},
    "surfaces": [{"x": 250, "y": 250, "width": 300, "height": 250, "type": "path"}],
    "obstacles": [], "decorations": [{"type": "tree", "x": 150, "y": 180}],
    "objects": [
      {"id": "fruit", "kind": "pickup", "name": "Apple", "item": "apple", "x": 430, "y": 420, "actions": ["inspect", "take"]},
      {"id": "gardener", "kind": "npc", "name": "Alex", "description": "The local gardener.", "x": 370, "y": 330,
        "color": "#ad6b58", "actions": ["inspect", "talk"], "dialogue": ["Welcome to the garden.", "Help yourself to an apple!"]}
    ]
  }]
}
```

Coordinates are world pixels. Dimensions are 320–4096. Players move at 170 world pixels/second with an 11×9 collision half-size. Spawn and portal arrival coordinates require a 16-pixel map margin; the engine searches nearby for a walkable point. Rectangular solids use top-left coordinates. NPCs, pickups, signs and doors use their ground-centre coordinate. Interactions are allowed within 100 pixels of `interaction` or the object's centre. Inspection is also allowed at a distance.

## Maps and graphics

`environment` is `outdoor` (grass) or `indoor` (floor and walls). An optional `hint` supplies the location-specific HUD guidance. `surfaces` are `{x,y,width,height,type}`; built-in types are `path`, `road`, `water` and `rug`. A surface can use any palette key. Surfaces are visual; add a matching `obstacles` rectangle if water or another feature should block walking. `decorations` support `tree`, `bench` and `lamp`; these are visual and can be given corresponding obstacles when desired.

Object kinds are `building`, `npc`, `pickup`, `furniture`, `sign` and `door`. Rectangular objects with `solid: true` require `width` and `height`. Building styles include `house`, `store`, `restaurant`, `pub`, `cinema`, `casino`, `bank` and `office`; buildings use `color` for their roof. Furniture styles are `table`, `plant`, `screen`, `fountain` and `game-table`. Unknown furniture styles use a wooden table primitive. NPC `color` and player `colors` choose their sprite clothing. The renderer provides animated four-direction characters. Palettes use six-digit hexadecimal colors.

Items have `name`, `description`, integer `value` (0–10000), optional `consumable`, and either a built-in `icon` (`apple`, `key`, `coffee`, `flower`, `sandwich`, `ticket`, `book`) or a custom pixel grid. For example:

```json
{"name":"Sapphire","value":30,"description":"A tiny blue stone.","pixels":["..aa..",".abba.","abbbba",".abba.","..aa.."],"palette":{"a":"#567b9b","b":"#a9d9df"}}
```

Pixel grids are at most 32×32. Undefined characters are transparent. A pack never contains JavaScript, HTML, arbitrary URLs or executable assets. New maps, items, dialogue, pixel-grid item art and combinations of supported actions are entirely metadata-driven. New *kinds* of game mechanics or new building rendering primitives require an engine extension; pack version 1 does not expose arbitrary scripts.

## Actions and effects

| Verb | Metadata and behavior |
| --- | --- |
| `inspect` | Shows `description` (or the pickup's item description) |
| `talk` | NPC `dialogue` string array cycles independently for each player |
| `take` | `pickup` with local `item` ID; disappears for everyone |
| `enter` | Requires `portal` as described below |
| `buy`, `sell` | Requires `shop: {"apple":20,"coffee":10}`; shared stock, integer prices, sell for floor(value/2) |
| `deposit`, `withdraw` | Requires `bank:true`; transfers ten gold between pocket and player bank |
| `use` | Requires an object `effect`; supported effects below |

Inventory actions (inspect/use/drop/sell) are provided automatically. Item keys become `pack-id/item-id` internally to preserve their definitions when crossing pack boundaries. A drop retains that qualified identity. A maximum of 99 items per stack and 200 loose drops per map prevents unbounded accumulation.

An item's `use` can be:

```json
{"type":"restore","amount":20}
{"type":"message","message":"Here is a clue."}
{"type":"target","tag":"projector","message":"The film begins.","energy":30}
```

The target variant requires a nearby selected object whose `tags` include the given tag. `consumable:true` removes one item only after successful use. Objects support `restore`, `message`, or `dice` effects. Dice uses `{ "type":"dice", "cost":5, "payout":8 }`: a host-generated six-sided roll pays the configured amount on 4–6 after subtracting the stake. All currency is fictional and session-scoped.

An NPC can have a fetch quest:

```json
{"id":"lost-key","title":"A missing key","item":"key","reward":25,"text":"Find my key.","completed":"Thank you for finding it!"}
```

Put this in the NPC's `quest` property. Talking records the quest. Using the matching carried item on the NPC consumes one, marks completion and rewards gold once per player. Shared pickups remain scarce across players.

## Linked maps and packs

```json
{
  "id":"casino-door", "kind":"building", "name":"Casino",
  "x":300,"y":100,"width":180,"height":145,"solid":true,"style":"casino","color":"#8a829a",
  "interaction":{"x":390,"y":265},"actions":["inspect","enter"],
  "portal":{"pack":"golden-hour","map":"casino","spawn":{"x":480,"y":610}}
}
```

Declare `golden-hour` in the pack's `dependencies`. Omitting a portal `spawn` uses the destination map's spawn. Include a return `door` with a portal back, and declare the reverse dependency. Same-pack transitions use the current pack ID without requiring a self-dependency. Every player travels independently; inventory, gold, bank, quest state and room chat remain in the same session.

Use a new pack ID when importing an edited version of an already installed pack, and update all dependency/portal references accordingly. Export includes the full dependency closure, so a downloaded adventure can be imported into a fresh browser without any separate fetches.
