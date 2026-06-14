/**
 * mushroom_finder/03_handle_mushroom.js — Handle found mushroom (Phase 3 — result handler)
 *
 * Called by main.js when the scan loop detects a match.
 * Taps the mushroom center and delegates to waitForAndClickLarge.
 */

"auto";

var floatyMod = require("../ui/floaty");

function handleMushroomFound(panel, match, navTemplates, navigatorMod) {
  floatyMod.updateStatus(panel, "Large Mushroom Found!");
  floatyMod.appendLog(panel, "Found \"" + match.templateName + "\" at (" +
    match.x + "," + match.y + ")");
  floatyMod.showDuringScan(panel, true);

  var tapX = match.x + Math.round(match.width / 2);
  var tapY = match.y + Math.round(match.height / 2);
  floatyMod.appendLog(panel, "Clicking mushroom at (" + tapX + "," + tapY + ")");
  press(tapX, tapY, 1000);
  sleep(2000);
  navigatorMod.waitForAndClickLarge(navTemplates, panel);
}

module.exports = {
  handleMushroomFound: handleMushroomFound
};
