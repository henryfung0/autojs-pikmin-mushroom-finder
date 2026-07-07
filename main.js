"auto";

/**
 * main.js — Entry point for AutoJS6 Pikmin Bloom automation.
 *
 * Ultra-thin dispatcher: singleton guard → combined config dialog →
 * dispatch to selected mode module.
 */

var configUi = require("./ui/config_ui");
var throwFlow = require("./advanture/throw_repeated_seedling_flow");

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
} else if (settings.mode === "Pikmin Daily Task") {
  // Run throw repeated seedling first, then adventure
  if (settings.throwRepeatedSeedlingEnabled !== false) {
    require("./advanture/throw_repeated_seedling_main").run(settings);
  }
  if (!throwFlow.isShutdownRequested() && (settings.enableGift || settings.enableSeedling || settings.enableFruit)) {
    require("./advanture/main").run(settings);
  }
} else {
  require("./mushroom_finder/main").run(settings);
}
