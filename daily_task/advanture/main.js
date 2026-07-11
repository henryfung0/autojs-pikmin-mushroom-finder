/**
 * advanture/main.js — Pipeline orchestrator
 *
 * Orchestrates the adventure automation pipeline:
 *   Phase 1 — Setup          : Load templates, create panel
 *   Phase 2 — Enter Adventure: Navigate from main page into adventure UI
 *   Phase 3 — Scan           : Scroll and detect items, start adventures
 *   Phase 4 — Cleanup        : Show status, destroy panel
 *
 * Called by root main.js after the config dialog completes.
 */

"auto";

var config      = require("../../ui/config");
var matcher     = require("../../lib/matcher");
var floatyMod   = require("../../ui/floaty");
var advFlow     = require("./advanture_flow");
var advState    = require("./advanture_state");
var pikminIcon  = require("../../lib/pikmin_icon");

function cleanupAndExit(panel, statusText, toastMsg) {
  if (panel) {
    floatyMod.updateStatus(panel, statusText);
    floatyMod.appendLog(panel, statusText);
    floatyMod.showDuringScan(panel, true);
    sleep(2000);
    floatyMod.destroy(panel);
  }
  if (toastMsg) {
    toast(toastMsg);
  }
  exit();
}

function run(settings, panel) {

  // ── Merge UI dialog settings into config ──────────────────────────────
  if (settings) {
    if (settings.threshold !== undefined) {
      config.detection.threshold = settings.threshold;
    }
    if (settings.settleDelay !== undefined) {
      config.scan.settleDelay = settings.settleDelay;
    }
    if (settings.enableGift !== undefined) {
      config.advanture.enableGift = settings.enableGift;
    }
    if (settings.enableSeedling !== undefined) {
      config.advanture.enableSeedling = settings.enableSeedling;
    }
    if (settings.enableFruit !== undefined) {
      config.advanture.enableFruit = settings.enableFruit;
    }
    if (settings.enableCollectFeeding !== undefined) {
      config.advanture.enableCollectFeeding = settings.enableCollectFeeding;
    }
    if (settings.maxEmptyLoops !== undefined) {
      config.advanture.maxEmptyLoops = settings.maxEmptyLoops;
    }
    if (settings.pikminAccount !== undefined) {
      config.account.pikminAccount = settings.pikminAccount;
    }
    console.info("Adventure settings merged — threshold=" + config.detection.threshold +
      ", settleDelay=" + config.scan.settleDelay +
      ", collect gift=" + config.advanture.enableGift +
      " seedling=" + config.advanture.enableSeedling +
      " fruit=" + config.advanture.enableFruit +
      ", maxEmptyLoops=" + config.advanture.maxEmptyLoops +
      ", account=" + config.account.pikminAccount);
  }

  // ===================================================================
  // Phase 1 — Setup
  // ===================================================================

  var templateDir = config.detection.templateDir;
  console.info("Loading templates from '" + templateDir + "' ...");

  var allTemplates = matcher.loadAllTemplates(templateDir, {
    excludeDirs: []
  });

  if (allTemplates.length === 0) {
    var errMsg = "No templates found at " + templateDir + ". Place .png files and restart.";
    toast(errMsg);
    console.error(errMsg);
    exit();
  }

  console.info("Loaded " + allTemplates.length + " template(s)");

  var panel = floatyMod.createControlPanel(function() {
    floatyMod.destroy(panel);
    exit();
  });
  floatyMod.appendLog(panel, "Adventure mode started");

  // ===================================================================
  // Phase 2 — Launch / Navigate
  // ===================================================================

  floatyMod.updateStatus(panel, "Ready");

  var pikminAccount = config.account.pikminAccount || 1;
  var accountsToRun = pikminAccount === 3 ? [1, 2] : [pikminAccount];
  
  for (var accIdx = 0; accIdx < accountsToRun.length; accIdx++) {
    var currentAccount = accountsToRun[accIdx];
    
    if (accIdx > 0) {
      floatyMod.appendLog(panel, "=== Starting account " + currentAccount + " ===");
    }
    
    if (settings && settings.autoLaunch) {
      floatyMod.updateStatus(panel, "Launching Pikmin Bloom...");
      floatyMod.appendLog(panel, "Launching " + config.app.packageName + "...");
      app.launchPackage(config.app.packageName);
      sleep(5000);

      pikminIcon.detectAndClickIcon(config.detection.templateDir, currentAccount, panel);
      sleep(2000);
      
      floatyMod.appendLog(panel, "App in foreground (account " + currentAccount + ")");
    } else {
      floatyMod.updateStatus(panel, "Open the game manually...");
      floatyMod.appendLog(panel, "Auto-launch disabled. Open game manually.");
      sleep(5000);
      floatyMod.appendLog(panel, "Proceeding to adventure scan...");
    }

    // ===================================================================
    // Phase 3 — Adventure Flow
    // ===================================================================

    floatyMod.updateStatus(panel, "Scanning...");
    floatyMod.appendLog(panel, "Starting adventure scan flow (account " + currentAccount + ")");

    advFlow.runAdvantureFlow(config, panel);

    // ===================================================================
    // Phase 3b — Collect Feeding (after adventure)
    // ===================================================================

    if (config.advanture.enableCollectFeeding !== false) {
      floatyMod.appendLog(panel, "Starting collect feeding...");
      var collectFeeding = require("./collect_feeding");
      collectFeeding.runCollectFeeding(config, panel);
    }

    if (accIdx < accountsToRun.length - 1) {
      floatyMod.appendLog(panel, "Account " + currentAccount + " done, preparing next account...");
      sleep(2000);
      app.launchPackage(config.app.packageName);
      sleep(3000);
    }
  }

  // ===================================================================
  // Phase 4 — Cleanup
  // ===================================================================

  floatyMod.appendLog(panel, "Returning to main page...");
  var navTemplates = matcher.loadAllTemplates(templateDir + "navigation", { excludeDirs: [] });
  var commonTemplates = matcher.loadAllTemplates(templateDir + "common", { excludeDirs: [] });
  var allNavTemplates = navTemplates.concat(commonTemplates);
  advState.isOnMainPage(allNavTemplates, {
    threshold: 0.7,
    timeout: 30000,
    floaty: panel,
    dismissTemplates: commonTemplates
  });
  sleep(1000);

  floatyMod.appendLog(panel, "Adventure finished");
  sleep(2000);
  floatyMod.destroy(panel);
}

module.exports = {
  run: run
};
