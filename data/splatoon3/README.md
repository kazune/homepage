# Splatoon 3 Data

`weapons.json` contains Splatoon 3 weapon kits for small static apps in this
repository.

`weapon-class-order.json` contains the default in-game weapon class order for
weapon list displays. The `reelgun` data class is placed with shooters because
Nozzlenoses are treated as part of the shooter family in-game.

## Shape

- `weapons[]` is one entry per weapon kit, not one entry per base main weapon.
- `id` is the stable stat.ink key and is suitable for localStorage progress keys.
- `number` follows the in-game / Inkipedia weapon ID order.
- `name`, `class`, `sub`, and `special` include Japanese and English names.
- `introduced`, `unlockLevel`, `priceSheldonLicenses`, and `specialPoints` use
  the Inkipedia table and Nintendo's update notes.

## Sources

The file records its sources and their uses in `sources[]` and its verification
date in `verifiedAt`. Sources include stat.ink's weapon information, Inkipedia,
and Nintendo's update notes.

PETシューター レプリカ shares the スプラシューターコラボ kit. Like the other
replicas, it has `unlockLevel: 1` and no Sheldon License price; obtaining it
requires a completed Splatoon Raiders main-story save on the same console and
user, then collecting it from the lobby terminal.
