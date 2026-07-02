# ASSET_REQUIREMENTS.md
### New/placeholder assets needed for Level 1 & Level 4 Flippy Race–style redesign

All placeholders should be named exactly as listed so the implementation can wire them up now and an artist can drop in final art later without code changes. Transparent PNGs unless noted; SVG is acceptable and preferred for anything currently built as vector (banks, foam, decorations) to keep file size and performance in line with the current project.

---

## Player & Enemy Sprites

| Asset Name | Purpose | Level | Size | Transparency | Style | Status |
|---|---|---|---|---|---|---|
| `placeholder_player_boat_level1.svg` | Player vehicle sprite, river mode | 1 | 120×160px viewBox | Yes | Flat-shaded low-poly blue speedboat | ✅ Created in `public/images/river/` |
| `placeholder_player_boat_level4.svg` | Player vehicle sprite (Ark-themed skin) | 4 | 120×160px viewBox | Yes | Noah's Ark motif (wood-plank barge + dove) | ✅ Created in `public/images/river/` |
| `placeholder_enemy_boat_1.svg` | Rival boat sprite | 1, 4 | 110×150px viewBox | Yes | Red speedboat | ✅ Created in `public/images/river/` |
| `placeholder_enemy_boat_2.svg` | Rival boat sprite | 1, 4 | 110×150px viewBox | Yes | Orange speedboat | ✅ Created in `public/images/river/` |
| `placeholder_enemy_boat_3.svg` | Rival boat sprite | 1, 4 | 110×150px viewBox | Yes | Purple speedboat | ✅ Created in `public/images/river/` |
| `placeholder_wake_particle.svg` | Foam wake trail behind boats | 1, 4 | N/A (inline SVG) | Yes | Rendered as inline `<ellipse>` elements directly in RaceScreen SVG | ✅ Inline — no file needed |

---

## River & Bank Environment

| Asset Name | Purpose | Level | Implementation | Status |
|---|---|---|---|---|
| Sandy canyon banks (left + right) | Warm sand gradient polygons on both sides of the river | 1, 4 | **Inline SVG** — `sandBank` linearGradient + background rect; two SVG polygons using `roadLeftX`/`roadRightX` perspective functions | ✅ Inline |
| Water surface | Blue gradient fill replacing tarmac | 1, 4 | **Inline SVG** — `riverWater` linearGradient filling the road trapezoid polygon | ✅ Inline |
| Foam bank edges | White foam blobs along both bank edges | 1, 4 | **Inline SVG** — small `<ellipse>` clusters at each depth `t` step along both banks | ✅ Inline |
| Water ripple lines | Subtle horizontal ellipses across river | 1, 4 | **Inline SVG** — 5 animated `<ellipse>` strokes, driven by `scrollOffset` | ✅ Inline |
| Palm trees | Riverbank decoration | 1 | **Inline SVG** — trunk rect + frond ellipses rendered via `BANK_DECORATIONS` data array | ✅ Inline |
| Beach huts | Riverbank decoration | 1, 4 | **Inline SVG** — walls rect + triangular roof + door, rendered inline | ✅ Inline |
| Sun umbrellas | Riverbank decoration | 1 | **Inline SVG** — pole + striped canopy ellipses, rendered inline | ✅ Inline |
| Rocky cliff banks | Noah's Ark level bank style | 4 | **Inline SVG** — polygon cliff shapes, conditional on `level.id === 'level_4'` | ✅ Inline |
| Storm clouds overlay | Sky mood element for Level 4 | 4 | **Inline SVG** — dense dark ellipse clusters conditional on `isNoahLevel` | ✅ Inline |
| Ark silhouette | Background decoration, Level 4 story tie-in | 4 | **Inline SVG** — simple rect + polygon Ark shape at horizon depth | ✅ Inline |
| `placeholder_bridge.png` | Occasional overhead obstacle/decoration | 1, 4 | Not implemented in this version | ⏳ Future |
| `placeholder_rock_large.png` | Optional in-water obstacle | 1, 4 | Not implemented in this version | ⏳ Future |

---

## Asset Path Convention

Boat sprite SVG files are served from:
```
/teta_lo2is/images/river/placeholder_*.svg
```

This matches the GitHub Pages `base: "/teta_lo2is/"` path in `vite.config.ts`. The files physically live at:
```
public/images/river/placeholder_*.svg
```

All boat sprites are routed through `ImageWithFallback.tsx` in `RaceScreen.tsx`, so a missing or broken file degrades gracefully to a gray placeholder box instead of breaking the scene.

---

## Notes for artists dropping in final art

1. Replace any `placeholder_*.svg` / `placeholder_*.png` with the final file at the **same path** — no code changes required.
2. All boat sprites should be portrait-oriented (taller than wide) and transparent-background to work with the perspective shadow/scaling system.
3. Inline SVG decorations (banks, palms, huts, etc.) are defined in `RaceScreen.tsx` in the `BANK_DECORATIONS` data array and surrounding JSX — edit those directly for fine-tuned visual polish.
4. Wake particles are pure SVG `<ellipse>` elements — no asset file needed or used.

---

## Flappy Mode Assets (Levels 3 & 6)

| Asset Name | Purpose | Level | Size | Transparency | Style | Status |
|---|---|---|---|---|---|---|
| `placeholder_player_airplane.svg` | Player vehicle sprite, flappy mode | 3, 6 | 80×80px | Yes | Small airplane, side view | ⏳ Needed |
| `placeholder_pipe_top.svg` | Top pipe obstacle | 3, 6 | 100×400px | Yes | Green pipe, stretches vertically | ⏳ Needed |
| `placeholder_pipe_bottom.svg` | Bottom pipe obstacle | 3, 6 | 100×400px | Yes | Green pipe, stretches vertically | ⏳ Needed |
| `placeholder_sky_background.svg` | Flat sky backdrop (optional if using gradient) | 3, 6 | Screen size | No | Flat sky | ⏳ Needed |
| `placeholder_city_skyline_silhouette.svg` | Distant flat skyline parallax layer | 3, 6 | Tileable | Yes | Silhouette city | ⏳ Needed |
| `placeholder_cloud_band.svg` | Mid-distance cloud strip parallax layer | 3, 6 | Tileable | Yes | Clouds | ⏳ Needed |
| `placeholder_ground_strip.svg` | Scrolling green/dirt ground strip | 3, 6 | Tileable | No | Ground | ⏳ Needed |