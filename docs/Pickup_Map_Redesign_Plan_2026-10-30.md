# Pickup map redesign plan

Status: proposed design, not implemented. Scope: `apps/frontend/src/modules/map/MapPage.jsx` and its map styles. Preserve the existing campus palette, shared stationary header, bottom navigation, Leaflet/OpenStreetMap attribution and explicit location consent.

## Goal

Help a member find an available pickup, compare it with other locations and open the listing without losing their place on the map. Keep the interface concise: controls should name actions; show explanations only for errors or an unfamiliar location state.

## Current implementation findings

- Heading, location buttons, radius controls, notices, map and listing list are stacked. At phone widths, members must scroll between the map and results.
- Every changed post response rebuilds Leaflet and fits all markers. The location overlay also fits bounds when posts change. Background refresh can discard a member's pan/zoom.
- Selecting a pin or list row shows address and quantity, but offers no direct listing/claim entry point.
- Radius changes affect nearby results only after location is granted; the control is still presented before that condition is met.
- All located results follow response order, rather than distance when location is available. Address-only listings are counted but cannot be browsed here.
- The map uses a Manila starting view when there are no coordinates. This is a fallback, not a verified campus location.

## Proposed layout

### Desktop

- One compact heading: Pickup map, result count and Refresh.
- Two columns: a result pane around 340 px wide and a flexible map using the remaining width. Keep both visible beneath the shared header.
- Result pane: search, category filters, optional distance radius and compact listing rows. Each row shows food name, available portions, pickup deadline and address; distance appears only with granted location.
- Map controls: Use my location and Show all. Keep zoom and attribution unobstructed. Show location/accuracy details on demand rather than as a permanent paragraph.
- A selected listing is highlighted in both views. A concise map popup exposes View listing; the listing detail retains the existing claim rules.

### Phone

- Compact toolbar followed by Map/List tabs. Both views retain the same selected listing, search and filters.
- Default to Map. A selected pickup appears in a short detail panel with View listing and Close; it must fit above the bottom dock.
- List is an accessible alternative to map gestures. Do not force dragging a bottom sheet to reach results.
- Keep the camera-style simplicity requested elsewhere: familiar icons with accessible names, short visible action labels and no permanent how-to blocks.

## Interaction and data rules

1. Create Leaflet once per page mount; add/update/remove markers by ID. Preserve pan, zoom and selection on refresh. Only explicit Show all, location and selection actions move the viewport.
2. Use the same availability/category/search filters for pins and list. Expired, cancelled and depleted listings must disappear from actionable results. Clear a vanished selection with a short status message.
3. Use exact coordinates already stored on listings. Do not invent addresses/campus centers. If no points exist, show an honest empty state and the list alternative.
4. Sort by straight-line distance when location exists; otherwise use a stable deadline/ID order. Label distance accurately; do not claim walking directions or travel time.
5. Radius is enabled only with a valid device location. Denial/timeout leaves ordinary map browsing usable. Keep coordinates in page memory; this feature does not publish a journey or start background tracking.
6. Address-only listings remain reachable in List with Map unavailable. Sample data stays visibly marked and cannot become a real claim.
7. Return from listing details to the same map view and selection. Follow normal service authorization; no special map claim endpoint is needed.

## Accessibility and themes

- At least 44 px control targets, visible keyboard focus, named icon buttons and announced result/loading/error states.
- Keyboard selection from the list updates the map; selection must not steal focus after every poll.
- Map/List tabs support arrow keys. Do not convey selected/out-of-radius state by color alone.
- Verify 390 px phone and 1280 px desktop layouts in light and dark themes. Keep OpenStreetMap attribution, zoom and bottom navigation visible without overlaps.
- Respect reduced motion and avoid forced panning during background updates.

## Delivery sequence

1. Extract and test shared filtering/order helpers; implement persistent map/marker lifecycle first.
2. Add synchronized selection and View listing using the existing listing details/claim flow.
3. Build desktop split layout and phone Map/List views, retaining address-only access.
4. Add concise location/error/empty states, theme and keyboard behavior.
5. Run filter/expiry/selection tests, tile failure and denied/offline checks; verify actual phone GPS separately. Rebuild release artifacts after acceptance.

## Acceptance

- A background post update does not reset a manually panned map.
- Pin count and list count agree for every filter; list pagination, if introduced, never limits the map silently.
- A member can open a pickup from either view, claim through existing rules and return without losing context.
- No-location, denied, inaccurate, offline, no-results, address-only and removed-selection states have usable alternatives.
- No header, popup, control or selected panel overlaps the bottom dock at tested widths.

No new provider, directions API, clustering library, live journey sharing or schema migration is required by this redesign. Measure result volume before adding clustering. This document does not redesign the page yet.
