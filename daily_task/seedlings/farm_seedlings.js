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

  // Step 1: Ensure on seedling page 1
  if (!seedlingUtils.ensureOnSeedlingPage1(templates, panel)) {
    floatyMod.appendLog(panel, "farmSeedlings: could not reach seedling page 1, skipping");
    return false;
  }

  floatyMod.appendLog(panel, "Farm seedlings: on seedling page 1, checking empty space");

  // Step 2: Look for "Empty space.jpg"
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
    floatyMod.appendLog(panel, "Farm seedlings: no empty space");
    return false;
  }

  floatyMod.appendLog(panel, "Farm seedlings: empty space found");
  seedlingUtils._tapAt(emptyMatch, "Farm seedlings: click Empty space.jpg", panel);
  sleep(2000);

  // Step 3: Click special.jpg
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
    floatyMod.appendLog(panel, "Farm seedlings: special.jpg not found, returning to page 1");
    seedlingUtils.ensureOnSeedlingPage1(templates, panel);
    return false;
  }

  // Step 4: Click "Special seedlings.jpg"
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
    floatyMod.appendLog(panel, "Farm seedlings: Special seedlings.jpg not found, returning to page 1");
    seedlingUtils.ensureOnSeedlingPage1(templates, panel);
    return false;
  }

  // Step 5: Click "Confirm seedlings.jpg"
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
            sleep(2000);
            break;
          }
        }
      }
    } finally {
      if (img) img.recycle();
    }
  }

  if (confirmClicked) {
    floatyMod.appendLog(panel, "Farm seedlings: farmed!");
  } else {
    floatyMod.appendLog(panel, "Farm seedlings: Confirm seedlings.jpg not found, returning to page 1");
    seedlingUtils.ensureOnSeedlingPage1(templates, panel);
  }

  return confirmClicked;
}

module.exports = {
  farmSeedlings: farmSeedlings
};
