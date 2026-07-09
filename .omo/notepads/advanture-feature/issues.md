
## 2026-07-04 Initial Implementation Notes

### Known Items
- `isOnMainPage()` and `isOnAdvanturePage()` are STUB functions — user will provide exact checking logic later
- `isOnMainPage` currently looks for "advanture page" or "store" in nav templates, but the flow passes `templates.nav` from `templates/advanture/navigation/` (not general nav) — needs proper logic when user provides it
- `advanture_flow.js` has unused `var scroll = require("../lib/gestures")` import — harmless
- `advanture_flow.js` also imports `matcher` at top but doesn't use it — unused import
- The flow clicks "Go.jpg" after clicking "Auto.jpg" — verify this is the intended behavior (it could be confirmation-only or a button to enter the adventure)

### Files Created
1. `advanture/advanture_state.js` — isOnMainPage, isOnAdvanturePage stubs + _showTap, _matchOne helpers
2. `advanture/advanture_flow.js` — Full flow: enter adventure → scroll → detect items (gift>plant>fruit) → start → auto → go → repeat
3. `advanture/main.js` — Entry point (follows mushroom_finder/main.js pattern)
