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
- `introduced`, `unlockLevel`, `priceSheldonLicenses`, and `specialPoints` come
  from the Inkipedia table.

## Sources

The file records its sources in `sources[]`. It was verified against Inkipedia's
reported Splatoon 3 version and weapon-kit count on 2026-06-09.
