# Product Specifications

## Overview
- SatOrbitViz visualizes two satellites (“A” and “B”), their orbits, day/night on Earth, and closest approaches over a configurable time window (default ±3 days).
- Supports profiles that pre-load satellites, anchor time, and TLE sets; profile anchor drives timeline/search ranges.

## Data & TLEs
- Satellites come from the catalog loader; TLEs can be fetched, refreshed, or pasted. Multiple epochs per satellite can be selected; active TLE chosen by proximity to anchor time unless manually picked.
- Profile TLEs are seeded from `src/lib/profiles.json`; preferred epochs can be reset via profile load.

## Time Management
- Anchor time defines search/timeline center. “Now” sets anchor to current time (disabled when a profile is active). “Anchor” jumps back to anchor if moved.
- Playback controls: play/pause with speed presets; fine steps ±5m/±1m/±10s; range slider over the anchor window.

## Closest Approaches
- Conjunction search spans anchor ±3d using all available TLE epochs with epoch-switching along the scan. Results sortable by distance or date; selecting an approach jumps simulation time.
- Distance/relative velocity and Earth-relation metadata are computed at each approach.

## Visualizations
- Main globe view: Earth with day/night contrast, grid (optional), dashed terminator, anti-solar marker, satellites with orbits, and optional overlays (LoS A→B; Sun line at B). Bottom-right panel toggles these layers; panel is collapsible and height-matched to the bottom timeline.
- Relative A→B view: Camera is north-up (camera up projected from Earth +Z) with an “N ↑” indicator. Satellite B is rendered as a 30×4.1 m rectangle oriented long-axis along velocity, normal toward the Sun projection. FoV presets shown in arcminutes (0.5′, 3′, 20′, 120′), auto-fit with optional lock; FoV span shown in arcminutes/meters. Optional overlays: LoS (cyan), Sun line from B (dashed yellow), orbit track (single segment centered on current point), velocity arrow.
- Earth in subview renders only when inside FoV. Sun line uses B→Sun direction.

## Timelines & Panels
- Main timeline (sidebar): anchor-centered slider with Anchor/Now buttons, playback, speed cycle, and fine stepping controls.
- Bottom distance timeline: plots A–B separation over anchor ±3d; axes with ticks/labels; shows current point/value; clickable to set time; collapsible. Leaves gutter so it does not overlap the view-toggle panel.
- Relative panel is collapsible; reopen buttons provided for both bottom timeline and view toggles.

## Files of Interest
- `src/App.tsx`: state, profile loading, timelines, panel layout.
- `src/components/Controls/TimelineSlider.tsx`: main time controls.
- `src/components/Controls/DistanceTimeline.tsx`: distance plot.
- `src/components/Panels/RelativeViewPanel.tsx`: A→B subview, FoV, overlays, north-up camera.
- `src/lib/conjunctions.ts`: approach search and distance sampling.
- `src/lib/orbit.ts`: propagation helpers and orbit sampling. 
