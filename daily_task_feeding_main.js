/**
 * daily_task_feeding_main.js — Daily Task + Feeding #3 Pipeline
 *
 * Implements Pikmin Daily Task mode focusing on the Feeding Function #3:
 *   1. App is already auto-launched by the headless script
 *   2. Wait for app to be in foreground
 *   3. Dismiss any popup / overlay (using common/ templates)
 *   4. Run Collect Feeding function (collect_feeding.js)
 *   5. Run Feed Pikmin function (feed_pikmin.js) with feeding settings
 *
 * Both functions belong to Feeding Function #3 — the user must NOT do just one.
 * Order: collect_feeding runs first, then feed_pikmin (matches the setting dialog order).
 *
 * Called by main-ac-feeding.js and second-ac-feeding.js headless scripts.
 */

"auto";

var config    = require("./ui/config");
var matcher   = require("./lib/matcher");
var floatyMod = require("./ui/floaty");
var collectFeeding = require("./daily_task/advanture/collect_feeding");
var feedPikmin = require("./daily_task/feeding/feed_pikmin");

/**
 * Dismiss any popup / overlay on screen using common/ templates.
 * Looks for close/back buttons and taps them to dismiss overlays.
 */
function dismissOverlays(panel) {
  floatyMod.appendLog(panel, "Checking for popup overlays to dismiss...");

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
 * Apply feeding settings from the headless script's settings object into config.feeding.
 * This ensures the feed_pikmin function uses the correct maxFlower for the active account.
 */
function applyFeedingSettings(settings) {
  if (typeof settings.maxFlowerMain === "number") {
    config.feeding.maxFlowerMain = settings.maxFlowerMain;
  }
  if (typeof settings.maxFlowerSecond === "number") {
    config.feeding.maxFlowerSecond = settings.maxFlowerSecond;
  }
  if (typeof settings.flowerX === "number") config.feeding.flowerX = settings.flowerX;
  if (typeof settings.flowerY === "number") config.feeding.flowerY = settings.flowerY;
  if (typeof settings.nectarX === "number") config.feeding.nectarX = settings.nectarX;
  if (typeof settings.nectarY === "number") config.feeding.nectarY = settings.nectarY;
  if (typeof settings.pikminAccount === "number") {
    config.account.pikminAccount = settings.pikminAccount;
  }
}

/**
 * Run the feeding function #3:
 *   1. Collect feeding items (must run first)
 *   2. Feed Pikmin (with OCR flower count check vs maxFlower threshold)
 *
 * Both are part of Feeding Function #3 — neither should be skipped when the user
 * says "feeding function #3". This matches the Pikmin Daily Task setting dialog
 * where both checkboxes live under the same "3. Feeding" group.
 */
function runFeedingFunction3(settings, panel) {
  floatyMod.appendLog(panel, "=== Starting Feeding Function #3 ===");
  floatyMod.updateStatus(panel, "Feeding...");

  floatyMod.appendLog(panel, "Feeding settings: collect=" + settings.enableCollectFeeding +
    ", feed=" + settings.enableFeedPikmin +
    ", account=" + (settings.pikminAccount === 1 ? "Main AC" : "Second AC"));

  // ── Step 1: Collect Feeding items (runs FIRST) ────────────────────────
  if (settings.enableCollectFeeding !== false) {
    floatyMod.appendLog(panel, "[1/2] Collect Feeding items...");
    floatyMod.updateStatus(panel, "Collect feeding...");
    try {
      collectFeeding.runCollectFeeding(config, panel);
      floatyMod.appendLog(panel, "Collect Feeding completed");
    } catch (e) {
      console.error("Collect feeding threw: " + e);
      floatyMod.appendLog(panel, "Collect feeding error: " + e);
    }
  } else {
    floatyMod.appendLog(panel, "[1/2] Collect Feeding SKIPPED (enableCollectFeeding=false)");
  }

  // ── Step 2: Feed Pikmin (runs SECOND) ────────────────────────────────
  if (settings.enableFeedPikmin) {
    floatyMod.appendLog(panel, "[2/2] Feed Pikmin...");
    floatyMod.updateStatus(panel, "Feed Pikmin...");
    try {
      feedPikmin.feedPikmin(config, panel);
      floatyMod.appendLog(panel, "Feed Pikmin completed");
    } catch (e) {
      console.error("Feed Pikmin threw: " + e);
      floatyMod.appendLog(panel, "Feed Pikmin error: " + e);
    }
  } else {
    floatyMod.appendLog(panel, "[2/2] Feed Pikmin SKIPPED (enableFeedPikmin=false)");
  }

  floatyMod.appendLog(panel, "=== Feeding Function #3 Complete ===");
}

/**
 * Main entry point for the Daily Task + Feeding #3 pipeline.
 *
 * @param {Object} settings - Settings object from the headless script
 * @param {Object} panel - Floaty panel for logging
 */
function run(settings, panel) {

  floatyMod.appendLog(panel, "=== Daily Task + Feeding #3 Pipeline ===");
  floatyMod.appendLog(panel, "Account: " + (settings.pikminAccount === 1 ? "Main AC" : "Second AC"));
  floatyMod.appendLog(panel, "Mode: " + settings.mode);
  floatyMod.appendLog(panel, "Feeding Function #3 enabled: collect=" + settings.enableCollectFeeding +
    ", feed=" + settings.enableFeedPikmin);

  // ── Apply feeding settings from the headless script into config ─────────
  applyFeedingSettings(settings);

  // ── Phase 1: App should already be auto-launched, wait for it ───────
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

  // ── Phase 3: Run Feeding Function #3 (collect + feed pikmin) ─────────
  floatyMod.updateStatus(panel, "Feeding...");
  runFeedingFunction3(settings, panel);

  // ── Phase 4: Cleanup ─────────────────────────────────────────────────
  floatyMod.appendLog(panel, "=== Daily Task + Feeding #3 Complete ===");
  floatyMod.updateStatus(panel, "Done");
  sleep(3000);
  floatyMod.destroy(panel);

  // ── Phase 5: Lock the screen before exit ─────────────────────────────
  console.info("Locking screen after Feeding Function #3 complete");
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
    { name: "press top-left corner (physical power button area)", fn: function() {
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