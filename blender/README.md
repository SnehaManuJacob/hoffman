# Blender sources for the web models

`kiln/assets/village.glb` (the drying-problem section, `views/problem.js`) is built
and baked from the tile works file, so it shares the opening shot's materials,
sun, sky, palms and tile-roofed houses. Run headless, on copies:

```
B=/Applications/Blender.app/Contents/MacOS/Blender
cp ../../kundapur_tile_factort.blend src.blend
$B -b src.blend --python build_village.py -- "$PWD/village.blend"
$B -b village.blend --python bake_village.py -- "$PWD/out" all 1.0 256 export
cp out/village.glb ../kiln/assets/village.glb
```

`bake_village.py` is the factory bake pipeline (colour pass x light pass,
saved through AgX, exported unlit), adapted for the village: groups are joined
before baking, UV layers are unified, the dryer is hidden while everything else
bakes, and the ground keeps its own village-dense UVs. A quick test bake:
`... bake_village.py -- "$PWD/test" all 0.25 32 export` (about 30 seconds).

The village also holds **the Drying Cycle** ("the Tiled Row", Stage 8): four
bays under four small hipped tile roofs, chimney pots, the return duct along
the ridges and a brick husk furnace, beside the grower's house where the box
dryer stands. It is baked as its own pieces (`Web_cycle`, `Web_croof`,
`Web_cdoor0`–`3`), each with the box dryer hidden and vice versa, so the page
can raise it, settle its roofs and open a door, and show it only in Stage 8.
