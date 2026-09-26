# Roadmap

Ideas and planned modes for The Dutch Highway Guesser. Items at the top are next.

## Route modes (built on 2026-09-26 as the Route planner mode; kept here for follow-ups)

- **Pick start and end on the map.** The player taps a start point and an end point on the map, then names (or drags) the highways they would use to drive between them, in order. Scored on the correct set and sequence of roads.
- **Type start and end in a box.** Same idea, but the start and end are typed as place names (city, exit or interchange). Needs a small gazetteer of places with coordinates, which can come from the same OpenStreetMap pipeline in `scripts/build-data.py`.
- Both variants need a routing step over the road graph so the game knows the "expected" route. The road geometry already has shared endpoints, so a graph can be built from `roads.json` at build time.

## Other ideas

- Learn mode extras: per-card statistics screen, an optional retention slider, and exporting or importing progress.

- Exit mode variant: name the exit instead of locating it.
- Route planner: directed graph (one-way carriageways) and a time-based cost model.
- Multiplayer or "challenge a friend" via a shared seed in the URL.
- Streak tracking for the daily challenge.
- Optional satellite or tile basemap toggle as an easier assist mode.
- Sound effects and haptics on correct or wrong answers.
