"auto";

/**
 * main.js — Entry point for AutoJS6 Pikmin Bloom automation.
 *
 * Ultra-thin dispatcher: singleton guard → combined config dialog →
 * dispatch to selected mode module.
 */

var configUi = require("./ui/config_ui");
var throwFlow = require("./advanture/throw_repeated_seedling_flow");
var advFlow = require("./advanture/advanture_flow");
var floatyMod = require("./ui/floaty");

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
    var trsResult = require("./advanture/throw_repeated_seedling_main").run(settings);
  }
  if (!throwFlow.isShutdownRequested() && (settings.enableGift || settings.enableSeedling || settings.enableFruit)) {
    if (trsResult && trsResult.panel) {
      // Reuse throw repeated seedling's panel and config — skip Phase 1/2
      var panel = trsResult.panel;
      var cfg = trsResult.config;
      floatyMod.appendLog(panel, "Starting adventure flow (continuing from throw repeated seedling)");
      floatyMod.updateStatus(panel, "Scanning...");
      advFlow.runAdvantureFlow(cfg, panel);
      floatyMod.appendLog(panel, "Adventure finished");
      sleep(3000);
      floatyMod.destroy(panel);
    } else {
      require("./advanture/main").run(settings);
    }
  }
} else {
  require("./mushroom_finder/main").run(settings);
}
