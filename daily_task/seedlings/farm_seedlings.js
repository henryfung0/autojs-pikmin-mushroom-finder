"auto";

/**
 * advanture/farm_seedlings.js — Auto-farm seedlings from seedling page 1
 *
 * Farms seedlings by finding "Empty space.jpg", clicking through
 * special → Special seedlings → Confirm seedlings sequence.
 *
 * Dependencies:
 *   - seedling_utils.js (shared helpers in same directory)
 *   - ui/floaty.js (floating log panel)
 *
 * Exports:
 *   farmSeedlings(config, panel) → boolean
 */

var seedlingUtils = require("./seedling_utils");
var floatyMod = require("../../ui/floaty");

/**
 * Farm seedlings from seedling page 1.
 *
 * @param {Object} templates - Template object from loadThrowRepeatedSeedlingTemplates()
 * @param {Object} panel - Floaty window for logging
 * @returns {boolean} true if farming succeeded
 */
function farmSeedlings(templates, panel) {
  var threshold = 0.7;
  var totalFarmed = 0;

  for (var round = 0; round < 2; round++) {
    if (seedlingUtils.isShutdownRequested()) break;

    if (!seedlingUtils.ensureOnSeedlingPage1(templates, panel)) {
      floatyMod.appendLog(panel, "farmSeedlings: could not reach seedling page 1, skipping");
      return totalFarmed > 0;
    }

    floatyMod.appendLog(panel, "Farm seedlings: round " + (round + 1) + "/2 on page 1");

    var img = null;
    var emptyMatch = null;
    var farmAttempts = 0;
    while (farmAttempts < 5 && !emptyMatch && !seedlingUtils.isShutdownRequested()) {
      img = captureScreen();
      if (!img) { sleep(500); farmAttempts++; continue; }
      try {
        for (var i = 0; i < templates.collect.length; i++) {
          var cn = templates.collect[i].name.toLowerCase();
          if (cn.indexOf("empty space") !== -1) {
            var m = seedlingUtils._matchOne(img, templates.collect[i], threshold);
            if (m) {
              emptyMatch = m;
              break;
            }
          }
        }
        if (!emptyMatch) {
          sleep(1000);
          farmAttempts++;
        }
      } finally {
        if (img) img.recycle();
      }
    }

    if (!emptyMatch) {
      floatyMod.appendLog(panel, "Farm seedlings: no empty space on round " + (round + 1));
      break;
    }

    floatyMod.appendLog(panel, "Farm seedlings: empty space found");
    seedlingUtils._tapAt(emptyMatch, "Farm seedlings: click Empty space.jpg", panel);
    sleep(2000);

    var specialClicked = false;
    img = captureScreen();
    if (img) {
      try {
        for (var i = 0; i < templates.collect.length; i++) {
          var cn = templates.collect[i].name.toLowerCase();
          if (cn === "special.jpg") {
            var m = seedlingUtils._matchOne(img, templates.collect[i], threshold);
            if (m) {
              seedlingUtils._tapAt(m, "Farm seedlings: click special.jpg", panel);
              specialClicked = true;
              sleep(2000);
              break;
            }
          }
        }
      } finally {
        if (img) img.recycle();
      }
    }

    if (!specialClicked) {
      floatyMod.appendLog(panel, "Farm seedlings: special.jpg not found, stopping");
      break;
    }

    var specialSeedlingsClicked = false;
    img = captureScreen();
    if (img) {
      try {
        for (var i = 0; i < templates.collect.length; i++) {
          var cn = templates.collect[i].name.toLowerCase();
          if (cn.indexOf("special seedlings") !== -1) {
            var m = seedlingUtils._matchOne(img, templates.collect[i], threshold);
            if (m) {
              seedlingUtils._tapAt(m, "Farm seedlings: click Special seedlings.jpg", panel);
              specialSeedlingsClicked = true;
              sleep(2000);
              break;
            }
          }
        }
      } finally {
        if (img) img.recycle();
      }
    }

    if (!specialSeedlingsClicked) {
      floatyMod.appendLog(panel, "Farm seedlings: Special seedlings.jpg not found, stopping");
      break;
    }

    var confirmClicked = false;
    img = captureScreen();
    if (img) {
      try {
        for (var i = 0; i < templates.collect.length; i++) {
          var cn = templates.collect[i].name.toLowerCase();
          if (cn.indexOf("confirm seedlings") !== -1) {
            var m = seedlingUtils._matchOne(img, templates.collect[i], threshold);
            if (m) {
              seedlingUtils._tapAt(m, "Farm seedlings: click Confirm seedlings.jpg", panel);
              confirmClicked = true;
              totalFarmed++;
              sleep(2000);
              break;
            }
          }
        }
      } finally {
        if (img) img.recycle();
      }
    }

    if (!confirmClicked) {
      floatyMod.appendLog(panel, "Farm seedlings: Confirm seedlings.jpg not found, stopping");
      break;
    }

    floatyMod.appendLog(panel, "Farm seedlings: round " + (round + 1) + " done");
    sleep(1000);
  }

  floatyMod.appendLog(panel, "Farm seedlings: total farmed " + totalFarmed);
  return totalFarmed > 0;
}

module.exports = {
  farmSeedlings: farmSeedlings
};
