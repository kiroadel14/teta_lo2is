You are working inside the existing "Teta Lo2is" repository. You already have full access to the project. Follow the architecture described in `PROJECT_KNOWLEDGE_BASE.md` as the single source of truth. This task is a **visual quality upgrade only** for the river/water scene used in Levels 1 and 4 (`movementMode: 'free'`). Do not change gameplay, physics, collision, fuel, coins, quiz logic, or the perspective math (`perspX`, `VP_X`, `HORIZON_Y`) — those are correct and load-bearing across all levels. This is a rendering/art-layer pass only.

## Objective

Close the visual gap between the current flat-vector river scene and a target photorealistic reference image by implementing the roadmap below, in order, from highest to lowest visual impact. Implement one step at a time, verify it renders correctly and doesn't regress performance before moving to the next.

## Constraints

- Pure SVG/vector approach only — do **not** introduce a WebGL/Canvas rendering pipeline or shaders for this pass. Every item below is achievable with gradients, layered animated SVG paths, and lightweight particle-style elements consistent with how the rest of the game is already built.
- Reuse existing components/techniques wherever the project already has them (called out explicitly below) instead of building new ones from scratch.
- Keep all per-frame animation values in refs, not React state, consistent with the existing performance pattern in `RaceScreen.tsx`.
- Test on a mid-tier mobile viewport after each step; do not let cumulative visual layers degrade frame rate.
- Do not touch Levels 2, 3, 5, 6, the fuel system, the quiz system, or the coin system.

## Implementation order

### Step 1 — Water depth/color gradient + horizon brightening
Replace the flat solid-color water fill on the river trapezoid with a multi-stop gradient: deeper navy blue at the center/foreground, lighter turquoise toward the bank edges, and progressively paler/whiter toward the horizon (fresnel-style grazing-angle brightening). Implement as a single SVG `linearGradient`/`radialGradient` applied to the existing water shape — do not change the shape's geometry, only its fill.

### Step 2 — Shoreline foam + wet-sand blending
Add a foam-edge strip along both banks where sand meets water (reuse the `placeholder_foam_edge` asset already specified in `ASSET_REQUIREMENTS.md` from the earlier river redesign — check whether it already exists and is wired in; if not, add it now). Add a thin darker "wet sand" gradient band immediately above the foam line so the transition from dry sand → wet sand → foam → water reads smoothly, replacing the current hard diagonal edge.

### Step 3 — Reuse the horizon atmospheric mist overlay in river mode
The project's documented SVG layer stack already includes a "horizon atmospheric mist overlay" layer used in lane mode. Extend/reuse this exact layer for the river/free-mode scene so the water-to-mountain horizon line softens into haze instead of a hard edge.

### Step 4 — Boat wake particle trail
Confirm whether the wake-particle system specified in the earlier Flippy Race river redesign (`placeholder_wake_particle`) is actually implemented and rendering behind the player and enemy boats in Levels 1 and 4. If it exists but isn't wired in, wire it in now. If it was never built, implement a lightweight particle trail (small fading foam shapes emitted behind the hull while moving) using the same ref-driven per-frame update pattern as other game elements.

### Step 5 — Sky gradient + mountain distance desaturation
Replace the flat sky fill with a vertical gradient (lighter near the horizon, deeper blue toward the top). Recolor the farther mountain layer to a lighter, cooler, less saturated tone than the nearer layer to simulate atmospheric distance falloff — adjust existing fill colors/opacity only, no new geometry required.

### Step 6 — Reuse the existing volumetric cloud component in river mode
The project already has a richer "volumetric multi-ellipse cloud" component used in lane mode. Replace the simplified flat-ellipse clouds currently used in river mode with this existing component instead of building a new one.

### Step 7 — Animated layered wave overlays
Add 3–4 semi-transparent wavy `<path>` overlays on top of the water gradient, each scrolling vertically toward the viewer at a different speed (parallax), reusing the same continuous-offset scroll-animation technique already used for the lane-marking dashes in lane mode, adapted to curved wave shapes instead of straight dashes. Randomize each wave path's amplitude/phase slightly at level load so the loop doesn't look mechanically identical every cycle.

### Step 8 — Water sparkle/specular highlight particles
Add a small number of soft, slowly fading radial-gradient "sparkle" shapes scattered across the water surface (a couple of brighter, tighter ones near the implied sun direction for specular highlights, several softer/larger ones for general reflection sparkle). Keep the count low and animation simple to protect performance.

### Step 9 — Reuse the existing snow-cap technique on mountains
The project already has a documented snow-cap technique for its default mountain layer. Apply the same technique to the river-mode mountains for peak highlights. Add a third, farther background mountain layer only if frame rate testing after steps 1–8 shows headroom.

### Step 10 — Beach prop shadows and placement variation
Add a soft, low-opacity ellipse drop shadow beneath each beach prop (palm trees, umbrellas, huts). Introduce slight randomized scale/position variation at placement time instead of a fixed grid layout, so props read as naturally scattered rather than pasted on.

### Step 11 (optional polish) — Ambient ripple particles
If time/performance budget allows after the above, add small expanding-ring shapes with fade-out opacity, spawned occasionally near the player boat or decorative wildlife elements, for extra ambient realism.

## Do not implement in this pass

Do not build a WebGL/Canvas water shader, true reflections, refraction, or normal-mapped lighting. These were evaluated and intentionally deferred as a higher-risk, higher-effort optional Phase 2 — flag it back to me if you believe it's needed after completing steps 1–11, but do not build it unprompted.

## Verification after each step

- Confirm the change renders correctly on both Level 1 and Level 4.
- Confirm no gameplay, collision, fuel, coin, or quiz behavior changed.
- Confirm frame rate holds up on a mid-tier mobile viewport before moving to the next step.
- Confirm Levels 2, 3, 5, 6 are unaffected.

## Final report

After completing the roadmap, report which steps were implemented, which (if any) were skipped or simplified and why, and whether any performance tradeoffs were made.
