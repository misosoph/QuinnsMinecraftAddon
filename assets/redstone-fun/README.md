# Redstone Fun inventory icons

`inventory-icons-source.png` was generated with the built-in imagegen tool from
Mojang's four diamond armor inventory icons. The four square crops were resized
to 32x32 with nearest-neighbor sampling and saved under
`resource_packs/quinns_redstone_fun_rp/textures/items/`.

Reference icons:
https://github.com/Mojang/bedrock-samples/tree/main/resource_pack/textures/items

Prompt:

> Use case: precise-object-edit. Create a production pixel-art inventory icon
> atlas from the four attached Minecraft diamond armor reference icons. Change
> only the cyan/teal armor palette to red/redstone crimson, preserving each icon's
> silhouette and pixel shading. Atlas has exactly four equal square tiles in one
> horizontal row, transparent background, NO gutters, NO text. Tile 1 helmet,
> tile 2 chestplate, tile 3 leggings, tile 4 boots. Center each icon with equal
> margins within each tile. Pixel art only, crisp pixel boundaries, no smoothing,
> no new decorations. These are inventory icons for a Minecraft Bedrock add-on
> called Redstone Fun. Keep simple vanilla armor silhouettes. Output wide 4:1
> image with each tile square.

The generated atlas is 2172x724; each production icon uses a centered 543x543
crop from its corresponding quarter. The worn armor instead reuses vanilla
diamond geometry and textures with the native render-controller color tint.
