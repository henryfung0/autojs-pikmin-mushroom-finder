/**
 * advanture/seedlings_flow.js — Throw Repeated Seedling scanning flow
 *
 * Flow:
 *   1. Ensure on main page (isOnMainPage)
 *   2. Navigate to seedling page — click "seedling page clicker" templates repeatedly
 *      until "seedling page checker" is visible on screen (DO NOT click it)
 *   3. On seedling page — scan for throw items (templates/seedlings/throw/)
 *   4. If throw item found → click it → scroll up to 10 times to find flow.jpg
 *      - If flow.jpg found → click it → click confirm.jpg → return to seedling page
 *      - If flow.jpg NOT found after 10 scrolls → back to seedling page, retry
 *   5. After flow.jpg + confirm.jpg → return to seedling page via common dismiss buttons
 *   6. If no throw item found → scroll down a bit → check again
 *   7. After max empty loops → back to main page, standby
 *
 * collectSeedlings() and farmSeedlings() now live in separate files
 * and are called from seedlings_main.js instead.
 *
 * Exports:
 *   runThrowRepeatedSeedlingFlow(config, panel)  → void
 */

"auto";

var seedlingUtils = require("./seedling_utils");
var floatyMod     = require("../../ui/floaty");
var advConfig     = require("../../ui/config");
var advState      = require("../advanture/advanture_state");

// ---------------------------------------------------------------------------
// Navigate to Seedling Page 1 — delegates to shared seedling_utils logic
// Clicks "Seedling page.jpg" entry button, confirms with "to seedling page.jpg"
// ---------------------------------------------------------------------------

function navigateToSeedlingPage(templates, panel) {
  return seedlingUtils.ensureOnSeedlingPage1(templates, panel);
}

// ---------------------------------------------------------------------------
// Find throw item on screen (any template in throw/ folder)
// ---------------------------------------------------------------------------

function findThrowItem(screenImage, throwTemplates, config) {
  var threshold = (config && config.detection && config.detection.threshold) || 0.7;
  var navBarHeight = (advConfig.ui && advConfig.ui.navBarHeight) || Math.round(device.height * 0.07);
  var safeHeight = screenImage.getHeight() - navBarHeight;
  var safeRegion = [0, 0, screenImage.getWidth(), safeHeight];

  for (var i = 0; i < throwTemplates.length; i++) {
    var match = seedlingUtils._matchOne(screenImage, throwTemplates[i], threshold, safeRegion);
    if (match) {
      match.name = throwTemplates[i].name;
      return match;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Click flow.jpg button
// ---------------------------------------------------------------------------

function clickFlowButton(templates, panel) {
  var threshold = 0.7;
  var img = null;
  for (var i = 0; i < templates.flow.length; i++) {
    var flowName = templates.flow[i].name.toLowerCase();
    if (flowName.indexOf("flow") !== -1) {
      img = captureScreen();
      if (!img) return false;
      var m = seedlingUtils._matchOne(img, templates.flow[i], threshold);
      if (m) {
        seedlingUtils._tapAt(m, "Click flow.jpg", panel);
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Click confirm.jpg button
// ---------------------------------------------------------------------------

function clickConfirmButton(templates, panel) {
  var threshold = 0.7;
  var img = null;
  for (var i = 0; i < templates.confirm.length; i++) {
    var confirmName = templates.confirm[i].name.toLowerCase();
    if (confirmName.indexOf("confirm") !== -1) {
      img = captureScreen();
      if (!img) return false;
      var m = seedlingUtils._matchOne(img, templates.confirm[i], threshold);
      if (m) {
        seedlingUtils._tapAt(m, "Click confirm.jpg", panel);
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------

/**
 * Run the seedlings scanning flow.
 *
 * @param {Object} config - Configuration object.
 * @param {Object} panel  - Floaty window for logging.
 */
function runThrowRepeatedSeedlingFlow(config, panel) {
  var templateDir = (config && config.detection && config.detection.templateDir) || "./templates/";

  floatyMod.appendLog(panel, "Loading seedlings templates...");
  var templates = seedlingUtils.loadThrowRepeatedSeedlingTemplates(templateDir);

  var mainNavTemplates = templates.mainNav.concat(templates.common);
  var commonTemplates = templates.common;

  floatyMod.appendLog(panel, "Templates — clicker:" + templates.seedlingPageClicker.length +
    " checker:" + templates.seedlingPageChecker.length +
    " throwItems:" + templates.throwItems.length +
    " flow:" + templates.flow.length +
    " collect:" + templates.collect.length +
    " common:" + commonTemplates.length);

  if (templates.throwItems.length === 0) {
    floatyMod.appendLog(panel, "Error: no throw item templates found");
    return;
  }

  var settleDelay = (config && config.scan && config.scan.settleDelay) || 2000;
  var maxEmptyLoops = 10;

  // Step 1: Ensure on main page
  floatyMod.appendLog(panel, "Ensuring on main page...");
  advState.isOnMainPage(mainNavTemplates, {
    threshold: 0.7,
    timeout: 30000,
    floaty: panel,
    dismissTemplates: commonTemplates
  });
  sleep(1000);

  // Step 2: Navigate to seedling page 1
  floatyMod.appendLog(panel, "Navigating to seedling page 1...");
  if (!navigateToSeedlingPage(templates, panel)) {
    floatyMod.appendLog(panel, "Could not reach seedling page 1 — exiting");
    return;
  }
  sleep(1000);

  // Step 2.5: Navigate to seedling page 2 (throw operations need page 2)
  floatyMod.appendLog(panel, "Navigating to seedling page 2...");
  if (!seedlingUtils.ensureOnSeedlingPage2(templates, panel)) {
    floatyMod.appendLog(panel, "Could not reach seedling page 2 — exiting");
    return;
  }
  sleep(1000);

  // Step 3: Main loop — scan for throw items
  var loopCount = 0;
  var emptyLoopCount = 0;

  while (!seedlingUtils.isShutdownRequested()) {
    loopCount++;

    var screenImage = null;
    var captureAttempts = 0;
    while (captureAttempts < 3 && !screenImage) {
      captureAttempts++;
      try {
        screenImage = captureScreen();
      } catch (e) {
        screenImage = null;
      }
      if (!screenImage && captureAttempts < 3) {
        try {
          images.requestScreenCapture(false);
        } catch (e) { }
        sleep(2000);
      }
    }

    if (!screenImage) {
      floatyMod.appendLog(panel, "Capture failed, retrying...");
      sleep(1000);
      continue;
    }

    try {
      var match = findThrowItem(screenImage, templates.throwItems, config);

      if (match) {
        emptyLoopCount = 0;
        floatyMod.updateStatus(panel, "THROW ITEM Found!");
        floatyMod.appendLog(panel, "Found throw item: " + match.name);

        // Click the throw item
        seedlingUtils._tapAt(match, "Tap throw item: " + match.name, panel);
        sleep(2000);

        // Scroll and look for flow.jpg — up to 10 times
        var scrollDuration = (config && config.scan && config.scan.swipeDuration) || 600;
        var flowFound = false;
        var scrollCount = 0;
        var maxScrolls = 10;

        while (scrollCount < maxScrolls && !flowFound && !seedlingUtils.isShutdownRequested()) {
          floatyMod.appendLog(panel, "Scrolling to find flow.jpg (" + (scrollCount + 1) + "/" + maxScrolls + ")...");
          swipe(
            Math.round(device.width * 0.5),
            Math.round(device.height * 0.8),
            Math.round(device.width * 0.5),
            Math.round(device.height * 0.47),
            scrollDuration
          );
          sleep(settleDelay);

          flowFound = clickFlowButton(templates, panel);
          scrollCount++;
        }

        if (!flowFound) {
          // Could not find flow.jpg after max scrolls — go back to seedling page
          floatyMod.appendLog(panel, "flow.jpg not found after " + maxScrolls + " scrolls — back to seedling page");
          seedlingUtils.returnToSeedlingPage(templates, panel);
          sleep(1000);
          continue;
        }

        // flow.jpg found — click it
        floatyMod.appendLog(panel, "flow.jpg clicked");
        sleep(2000);

        // Click confirm.jpg
        floatyMod.appendLog(panel, "Looking for confirm.jpg...");
        var confirmClicked = clickConfirmButton(templates, panel);
        if (confirmClicked) {
          floatyMod.appendLog(panel, "confirm.jpg clicked");
          sleep(2000);
        }

        // Return to seedling page via common dismiss buttons
        floatyMod.appendLog(panel, "Returning to seedling page...");
        seedlingUtils.returnToSeedlingPage(templates, panel);
        sleep(1000);

        // Verify we are actually back on seedling page
        floatyMod.appendLog(panel, "Verifying seedling page...");
        var backVerified = false;
        var backAttempts = 0;
        while (backAttempts < 10 && !backVerified && !seedlingUtils.isShutdownRequested()) {
          var verifyImg = captureScreen();
          if (!verifyImg) { sleep(500); backAttempts++; continue; }
          try {
            for (var vi = 0; vi < templates.seedlingPageChecker.length; vi++) {
              var vcName = templates.seedlingPageChecker[vi].name.toLowerCase();
              if (vcName.indexOf("seedling page checker") !== -1) {
                var vchk = seedlingUtils._matchOne(verifyImg, templates.seedlingPageChecker[vi], 0.7);
                if (vchk) {
                  backVerified = true;
                  floatyMod.appendLog(panel, "Seedling page verified");
                  break;
                }
              }
            }
            if (!backVerified) {
              floatyMod.appendLog(panel, "Not on seedling page — tapping common...");
              // Try non-close/back first
              var tapped = false;
              for (var tj = 0; tj < templates.common.length && !tapped; tj++) {
                var tn = templates.common[tj].name.toLowerCase();
                if (tn.indexOf("close") !== -1 || tn.indexOf("back") !== -1) continue;
                var tm = seedlingUtils._matchOne(verifyImg, templates.common[tj], 0.7);
                if (tm) {
                  seedlingUtils._tapAt(tm, "Verify tap common: " + templates.common[tj].name, panel);
                  sleep(1500);
                  tapped = true;
                }
              }
              // Fallback close/back
              if (!tapped) {
                for (var tj = 0; tj < templates.common.length && !tapped; tj++) {
                  var tn = templates.common[tj].name.toLowerCase();
                  if (tn.indexOf("close") === -1 && tn.indexOf("back") === -1) continue;
                  var tm = seedlingUtils._matchOne(verifyImg, templates.common[tj], 0.7);
                  if (tm) {
                    seedlingUtils._tapAt(tm, "Verify tap dismiss: " + templates.common[tj].name, panel);
                    sleep(1500);
                    tapped = true;
                  }
                }
              }
              if (!tapped) sleep(1000);
              backAttempts++;
            }
          } finally {
            verifyImg.recycle();
          }
        }

      } else {
        // No throw item found — scroll down and check again
        floatyMod.appendLog(panel, "No throw item found — scrolling...");
        var scrollDuration = (config && config.scan && config.scan.swipeDuration) || 600;
        swipe(
          Math.round(device.width * 0.5),
          Math.round(device.height * 0.8),
          Math.round(device.width * 0.5),
          Math.round(device.height * 0.47),
          scrollDuration
        );
        sleep(settleDelay);

        emptyLoopCount++;
        floatyMod.appendLog(panel, "Empty loop #" + loopCount + " (emptyLoops=" + emptyLoopCount + ")");

        if (emptyLoopCount >= maxEmptyLoops) {
          floatyMod.appendLog(panel, "Max empty loops reached — back to main page, standby");
          advState.isOnMainPage(mainNavTemplates, {
            threshold: 0.7,
            timeout: 30000,
            floaty: panel,
            dismissTemplates: commonTemplates
          });
          break;
        }
      }
    } finally {
      screenImage.recycle();
    }

    sleep(500);
  }

  floatyMod.updateStatus(panel, "Stopped");
  floatyMod.appendLog(panel, "Throw repeated seedling flow stopped");
}

module.exports = {
  runThrowRepeatedSeedlingFlow: runThrowRepeatedSeedlingFlow,
  navigateToSeedlingPage: navigateToSeedlingPage,
  isShutdownRequested: function() { return seedlingUtils.isShutdownRequested(); }
};
