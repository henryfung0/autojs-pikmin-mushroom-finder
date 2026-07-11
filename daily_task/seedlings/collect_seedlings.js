/**
 * advanture/collect_seedlings.js — Auto-collect seedlings from seedling page 1
 *
 * Collects seedlings by finding "Collect seedlings.jpg", tap-holding + pulling up,
 * tapping middle until confirm.jpg appears, and clicking confirm.
 *
 * Dependencies:
 *   - seedling_utils.js (same dir): _matchOne, _tapAt, isShutdownRequested, ensureOnSeedlingPage1
 */

"auto";

var seedlingUtils = require("./seedling_utils");
var floatyMod     = require("../../ui/floaty");

/**
 * Collect seedlings from seedling page 1.
 *
 * @param {Object} templates - Template object from loadThrowRepeatedSeedlingTemplates()
 * @param {Object} panel - Floaty window for logging
 * @returns {boolean} true if collection succeeded
 */
function collectSeedlings(templates, panel) {
  var threshold = 0.7;
  var totalCollected = 0;

  for (var round = 0; round < 2; round++) {
    if (seedlingUtils.isShutdownRequested()) break;

    if (!seedlingUtils.ensureOnSeedlingPage1(templates, panel)) {
      floatyMod.appendLog(panel, "collectSeedlings: could not reach seedling page 1, skipping");
      return totalCollected > 0;
    }

    floatyMod.appendLog(panel, "Collect seedlings: round " + (round + 1) + "/2 on page 1");

    var img = null;
    var collectMatch = null;
    var collectAttempts = 0;
    while (collectAttempts < 5 && !collectMatch && !seedlingUtils.isShutdownRequested()) {
      img = captureScreen();
      if (!img) { sleep(500); collectAttempts++; continue; }
      try {
        for (var i = 0; i < templates.collect.length; i++) {
          var cn = templates.collect[i].name.toLowerCase();
          if (cn.indexOf("collect seedlings") !== -1) {
            var m = seedlingUtils._matchOne(img, templates.collect[i], threshold);
            if (m) {
              collectMatch = m;
              break;
            }
          }
        }
        if (!collectMatch) {
          sleep(1000);
          collectAttempts++;
        }
      } finally {
        if (img) img.recycle();
      }
    }

    if (!collectMatch) {
      floatyMod.appendLog(panel, "Collect seedlings: nothing to collect on round " + (round + 1));
      break;
    }

    var tapX = collectMatch.x + Math.round(collectMatch.w / 2);
    var tapY = collectMatch.y + Math.round(collectMatch.h / 2);
    floatyMod.appendLog(panel, "Collect seedlings: tap-hold at (" + tapX + "," + tapY + ") and pull up");
    floatyMod.withPanelHidden(panel, function() {
      press(tapX, tapY, 1500);
      sleep(300);
      swipe(
        Math.round(device.width * 0.5),
        tapY,
        Math.round(device.width * 0.5),
        Math.round(device.height * 0.2),
        800
      );
    });
    sleep(2000);

    var confirmClicked = false;
    var middleTapAttempts = 0;
    while (middleTapAttempts < 20 && !confirmClicked && !seedlingUtils.isShutdownRequested()) {
      floatyMod.appendLog(panel, "Collect seedlings: tapping middle of screen...");
      var midX = Math.round(device.width * 0.5);
      var midY = Math.round(device.height * 0.5);
      floatyMod.withPanelHidden(panel, function() {
        press(midX, midY, 500);
      });
      sleep(1500);

      img = captureScreen();
      if (!img) { middleTapAttempts++; continue; }
      try {
        for (var i = 0; i < templates.collect.length; i++) {
          var cn = templates.collect[i].name.toLowerCase();
          if (cn === "confirm.jpg") {
            var m = seedlingUtils._matchOne(img, templates.collect[i], threshold);
            if (m) {
              seedlingUtils._tapAt(m, "Collect seedlings: click confirm.jpg", panel);
              confirmClicked = true;
              totalCollected++;
              sleep(2000);
              break;
            }
          }
        }
        if (!confirmClicked) middleTapAttempts++;
      } finally {
        if (img) img.recycle();
      }
    }

    if (!confirmClicked) {
      floatyMod.appendLog(panel, "Collect seedlings: confirm not found, stopping");
      break;
    }

    floatyMod.appendLog(panel, "Collect seedlings: round " + (round + 1) + " done");
    sleep(1000);
  }

  floatyMod.appendLog(panel, "Collect seedlings: total collected " + totalCollected);
  return totalCollected > 0;
}

module.exports = {
  collectSeedlings: collectSeedlings
};
