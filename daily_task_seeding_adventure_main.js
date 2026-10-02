/**
 * daily_task_seeding_adventure_main.js — Pikmin Daily Task Seeding + Adventure Pipeline
 *
 * Implements Pikmin Daily Task mode focusing on:
 *   1. SEEDLING (Group #1 in settings dialog)
 *      - Collect seedlings
 *      - Farm seedlings
 *      - Throw repeated seedlings
 *   2. ADVENTURE (Group #2 in settings dialog)
 *      - Gift
 *      - Seedling
 *      - Fruit
 *
 * This does NOT do mushroom finding. It runs the actual seedling and adventure
 * pipelines already present in the codebase.
 *
 * Settings used:
 *   enableCollect       (1. Seedling)
 *   enableFarm          (1. Seedling)
 *   enableThrowRepeated (1. Seedling)
 *   enableGift          (2. Adventure)
 *   enableSeedling      (2. Adventure)
 *   enableFruit         (2. Adventure)
 *   pikminAccount       (1 = Main AC, 2 = Second AC)
 *   maxEmptyLoops
 *   threshold
 *   settleDelay
 *
 * Called by main-ac-seeding-adventure.js and second-ac-seeding-adventure.js.
 */

"auto";

var config        = require("./ui/config");
var floatyMod     = require("./ui/floaty");
var pikminIcon    = require("./lib/pikmin_icon");
var throwSeedlingMain = require("./daily_task/seedlings/throw_repeated_seedling_main");
var throwFlow          = require("./daily_task/seedlings/throw_repeated_seedling_flow");
var advFlow            = require("./daily_task/advanture/advanture_flow");
var advMain            = require("./daily_task/advanture/main");

/**
 * Dismiss any popup / overlay on screen using common/ templates.
 */
function dismissOverlays(panel) {
  floatyMod.appendLog(panel, "Checking for popup overlays to dismiss...");

  var matcher = require("./lib/matcher");
  var commonDir = files.join(config.detection.templateDir, "common");
  var commonTpls = matcher.loadAllTemplates(commonDir, { excludeDirs: [] });

  if (commonTpls.length === 0) {
    floatyMod.appendLog(panel, "No common templates found, skipping dismiss");
    return;
  }

  floatyMod.appendLog(panel, "Scanning " + commonTpls.length + " common templates...");

  var maxDismissRounds = 5;
  var dismissed = 0;

  for (var round = 0; round < maxDismissRounds; round++) {
    var img = null;
    try {
      img = captureScreen();
      if (!img) {
        sleep(1000);
        continue;
      }

      var found = false;
      for (var i = 0; i < commonTpls.length && !found; i++) {
        var tpl = commonTpls[i];
        try {
          var result = images.findImage(img, tpl.image, {
            threshold: 0.7,
            region: [0, 0, img.getWidth(), img.getHeight()]
          });
          if (result) {
            var tapX, tapY;
            if (tpl.name.toLowerCase().indexOf("click middle") !== -1) {
              tapX = Math.round(device.width / 2);
              tapY = Math.round(device.height / 2);
            } else {
              tapX = result.x + Math.round(tpl.w / 2);
              tapY = result.y + Math.round(tpl.h / 2);
            }

            floatyMod.appendLog(panel, "Dismiss \"" + tpl.name + "\" at (" + tapX + "," + tapY + ")");
            press(tapX, tapY, 1000);
            sleep(1500);
            dismissed++;
            found = true;
          }
        } catch (e) {
          // template error, continue
        }
      }

      if (!found) {
        // No overlay found, we can proceed
        break;
      }
    } finally {
      if (img) img.recycle();
    }
    sleep(500);
  }

  // Recycle templates
  for (var r = 0; r < commonTpls.length; r++) {
    try { commonTpls[r].image.recycle(); } catch(e) {}
  }

  floatyMod.appendLog(panel, "Dismissed " + dismissed + " overlay(s)");
}

/**
 * Run the Pikmin Daily Task Seeding + Adventure pipeline.
 * This calls the existing throw_repeated_seedling_main and advanture/main modules
 * with the same wiring as the original main.js "Pikmin Daily Task" mode.
 */
function runSeedingAndAdventure(settings, panel) {
  floatyMod.appendLog(panel, "=== Seeding + Adventure Pipeline ===");
  floatyMod.appendLog(panel, "Account: " + (settings.pikminAccount === 1 ? "Main AC" : "Second AC"));
  floatyMod.appendLog(panel, "[1/2] Seedling — collect=" + settings.enableCollect +
    ", farm=" + settings.enableFarm +
    ", throw=" + settings.enableThrowRepeated);
  floatyMod.appendLog(panel, "[2/2] Adventure — gift=" + settings.enableGift +
    ", seedling=" + settings.enableSeedling +
    ", fruit=" + settings.enableFruit);

  // ── Step 1: Seedling (collect + farm + throw repeated) ─────────────────
  var trsResult = null;
  if (settings.enableCollect || settings.enableFarm || settings.enableThrowRepeated) {
    floatyMod.updateStatus(panel, "Seedling...");
    floatyMod.appendLog(panel, "[1/2] Running seedling pipeline (collect/farm/throw)...");
    try {
      trsResult = throwSeedlingMain.run(settings, panel);
      floatyMod.appendLog(panel, "[1/2] Seedling pipeline completed");
    } catch (e) {
      console.error("Seedling pipeline threw: " + e);
      floatyMod.appendLog(panel, "[1/2] Seedling pipeline error: " + e);
    }
  } else {
    floatyMod.appendLog(panel, "[1/2] Seedling SKIPPED (all flags disabled)");
  }

  // ── Step 2: Adventure (gift + seedling + fruit) ─────────────────────────
  if (!throwFlow.isShutdownRequested() &&
      (settings.enableGift || settings.enableSeedling || settings.enableFruit)) {
    floatyMod.updateStatus(panel, "Adventure...");
    floatyMod.appendLog(panel, "[2/2] Running adventure pipeline (gift/seedling/fruit)...");

    // Update config.advanture settings based on dialog (from main.js logic)
    if (settings.enableGift !== undefined) config.advanture.enableGift = settings.enableGift;
    if (settings.enableSeedling !== undefined) config.advanture.enableSeedling = settings.enableSeedling;
    if (settings.enableFruit !== undefined) config.advanture.enableFruit = settings.enableFruit;

    try {
      if (trsResult && trsResult.panel) {
        // Continue from throw repeated seedling (panel reused)
        floatyMod.appendLog(panel, "Continuing adventure flow from seedling pipeline...");
        floatyMod.updateStatus(panel, "Scanning...");
        advFlow.runAdvantureFlow(config, panel);
      } else {
        // Fresh start
        advMain.run(settings, panel);
      }
      floatyMod.appendLog(panel, "[2/2] Adventure pipeline completed");
    } catch (e) {
      console.error("Adventure pipeline threw: " + e);
      floatyMod.appendLog(panel, "[2/2] Adventure pipeline error: " + e);
    }
  } else {
    floatyMod.appendLog(panel, "[2/2] Adventure SKIPPED (all flags disabled or shutdown requested)");
  }

  floatyMod.appendLog(panel, "=== Seeding + Adventure Pipeline Complete ===");
}

/**
 * Main entry point for the Seeding + Adventure pipeline.
 */
function run(settings, panel) {

  floatyMod.appendLog(panel, "=== Daily Task — Seeding + Adventure ===");
  floatyMod.appendLog(panel, "Account: " + (settings.pikminAccount === 1 ? "Main AC" : "Second AC"));
  floatyMod.appendLog(panel, "Seeding: collect=" + settings.enableCollect +
    ", farm=" + settings.enableFarm +
    ", throw=" + settings.enableThrowRepeated);
  floatyMod.appendLog(panel, "Adventure: gift=" + settings.enableGift +
    ", seedling=" + settings.enableSeedling +
    ", fruit=" + settings.enableFruit);

  // ── Phase 1: App should already be auto-launched, wait for it ─────────
  if (settings.autoLaunch) {
    floatyMod.updateStatus(panel, "Waiting for app...");
    floatyMod.appendLog(panel, "App already launched, verifying...");

    sleep(2000);

    var pkg = currentPackage();
    if (pkg === "com.android.systemui") {
      floatyMod.appendLog(panel, "System UI in foreground — tapping to dismiss overlay...");
      var cx = Math.round(device.width / 2);
      var cy = Math.round(device.height / 2);
      press(cx, cy, 800);
      sleep(1500);
      var botCy = Math.round(device.height * 0.85);
      press(cx, botCy, 800);
      sleep(2000);
    }

    floatyMod.appendLog(panel, "App is in foreground");
  } else {
    floatyMod.updateStatus(panel, "Open the game manually...");
    floatyMod.appendLog(panel, "Auto-launch disabled. Open game manually.");
    sleep(5000);
  }

  // ── Phase 2: Dismiss any popup overlays ──────────────────────────────
  floatyMod.updateStatus(panel, "Preparing...");
  dismissOverlays(panel);

  // ── Phase 3: Run seeding + adventure pipeline ────────────────────────
  floatyMod.updateStatus(panel, "Seeding & Adventure...");
  runSeedingAndAdventure(settings, panel);

  // ── Phase 4: Cleanup ─────────────────────────────────────────────────
  floatyMod.appendLog(panel, "=== Daily Task — Seeding + Adventure Complete ===");
  floatyMod.updateStatus(panel, "Done");
  sleep(3000);
  floatyMod.destroy(panel);

  // ── Phase 5: Lock the screen before exit ─────────────────────────────
  console.info("Locking screen after Seeding + Adventure complete");
  lockScreenAndExit();
}

function lockScreenAndExit() {
  console.info("Locking screen before exit...");
  if (typeof device.isScreenOn === "function" && !device.isScreenOn()) {
    console.info("Screen already off");
    sleep(500);
    exit();
    return;
  }

  var methods = [
    { name: "shell keyevent 26", fn: function() { shell("input keyevent 26"); } },
    { name: "shell keyevent KEYCODE_POWER", fn: function() { shell("input keyevent KEYCODE_POWER"); } },
    { name: "shell input keyevent --longpress 26", fn: function() { shell("input keyevent --longpress 26"); } },
    { name: "press power button coordinate", fn: function() {
      var w = device.width;
      var h = device.height;
      var px = Math.round(w * 0.02);
      var py = Math.round(h * 0.02);
      press(px, py, 100);
    } },
    { name: "KeyCode.KEYCODE_POWER via Shell", fn: function() {
      if (typeof KeyCode !== "undefined") {
        shell("input keyevent " + KeyCode.KEYCODE_POWER);
      } else {
        shell("input keyevent 26");
      }
    } }
  ];

  var locked = false;
  for (var i = 0; i < methods.length; i++) {
    try {
      console.info("Trying lock method: " + methods[i].name);
      methods[i].fn();
      sleep(2500);
      if (typeof device.isScreenOn === "function" && !device.isScreenOn()) {
        console.info("Screen locked via " + methods[i].name);
        locked = true;
        break;
      } else {
        console.warn("Method " + methods[i].name + " did not turn screen off");
      }
    } catch (e) {
      console.warn("Method " + methods[i].name + " failed: " + e);
    }
  }

  if (!locked && typeof device.isScreenOn === "function" && device.isScreenOn()) {
    console.warn("All lock methods failed — screen still on");
  }
  sleep(500);
  exit();
}

module.exports = {
  run: run
};