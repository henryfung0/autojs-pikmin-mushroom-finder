"auto";

/**
 * main.js — Entry point for the AutoJS6 Pikmin Bloom Mushroom Finder.
 *
 * Ultra-thin dispatcher: singleton guard → config dialog →
 * dispatch to mushroom_finder/main.js.
 */

var configUi = require("./ui/config_ui");

// ── Singleton guard: kill any previous instance of this script ─────
var thisEngine = engines.myEngine();
engines.all().forEach(function(engine) {
  if (engine.id !== thisEngine.id) {
    engine.forceStop();
  }
});

// ── Show config dialog, then dispatch ────────────────────────────
var settings = configUi.showConfigDialog();
if (settings) {
  require("./mushroom_finder/main").run(settings);
}
