# Learnings — Adventure Feature

## Project Patterns
- All modules use `"auto";` directive at top
- Module pattern: `module.exports = { ... }`
- Templates loaded via `images.read()` and `files.listDir()` with extension filtering
- Template matching via `images.findImage()` with threshold and region
- Floaty panel for logging: `floatyMod.appendLog(panel, msg)`
- Click feedback: `_showTap(x, y)` then `press(x, y, 1000)`
- `_matchOne(screenImage, tpl, threshold)` pattern from 01_navigate_to_map.js
- Volume key interrupt for graceful/force stop
- Images recycled in try/finally blocks

## Template Structure
- `templates/advanture/navigation/` — navigation UI elements (Advanture.jpg, Start advanture.jpg, Auto.jpg, Go.jpg, Cancel.jpg)
- `templates/advanture/fruit/` — fruit images (Apple.jpg, Lemmon.jpg)
- `templates/advanture/gift/` — gift images (Gift.jpg)
- `templates/advanture/plant/` — plant images (Plant.jpg)
- General navigation: `templates/navigation/Advanture page.jpg`
