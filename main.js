"auto";

/**
 * main.js — Entry point for AutoJS6 Pikmin Bloom automation.
 *
 * Ultra-thin dispatcher: singleton guard → combined config dialog →
 * dispatch to selected mode module.
 */

var configUi = require("./ui/config_ui");

// ── Singleton guard: kill any previous instance of this script ─────
var thisEngine = engines.myEngine();
engines.all().forEach(function(engine) {
  if (engine.id !== thisEngine.id) {
    engine.forceStop();
  }
});

// ── Show combined config dialog ────────────────────────────
var settings = configUi.showConfigDialog();
if (!settings) {
  exit();
}

// ── Dispatch ─────────────────────────────────────────
if (settings.mode === "Advanture") {
  require("./advanture/main").run(settings);
} else {
  require("./mushroom_finder/main").run(settings);
}
