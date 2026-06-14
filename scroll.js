/**
 * scroll.js
 *
 * Reusable scroll/swipe functions for the Pikmin Bloom mushroom finder.
 * Each function performs a single swipe gesture at the given Y coordinate
 * and logs the direction to the floaty panel.
 *
 * Exports:
 *   scrollLeft(y, swipeDuration[, floatyW][, label])
 *   scrollRight(y, swipeDuration[, floatyW][, label])
 */

"auto";

var floatyMod = require("./floaty");

/**
 * Perform a single swipe that scrolls the map LEFT.
 *
 * Note: In Pikmin Bloom, dragging left-to-right moves the map leftward,
 * so the finger starts at 20% width and ends at 80% width.
 *
 * @param {number} y             - Y coordinate (pixels) for the swipe line.
 * @param {number} swipeDuration - Duration of the swipe gesture (ms).
 * @param {Object} [floatyW]     - Floaty window for panel logging (optional).
 * @param {string} [label]       - Optional label appended to the log line.
 */
function scrollLeft(y, swipeDuration, floatyW, label) {
  // In Pikmin Bloom, dragging left-to-right scrolls the map leftward.
  var startX = Math.round(device.width * 0.2);
  var endX   = Math.round(device.width * 0.8);
  var msg    = "←" + (label ? " " + label : "");
  console.info("scroll: " + msg);
  if (floatyW) {
    floatyMod.appendLog(floatyW, msg);
  }
  swipe(startX, y, endX, y, swipeDuration);
}

/**
 * Perform a single swipe that scrolls the map RIGHT (finger moves right to left).
 *
 * @param {number} y             - Y coordinate (pixels) for the swipe line.
 * @param {number} swipeDuration - Duration of the swipe gesture (ms).
 * @param {Object} [floatyW]     - Floaty window for panel logging (optional).
 * @param {string} [label]       - Optional label appended to the log line.
 */
function scrollRight(y, swipeDuration, floatyW, label) {
  // In Pikmin Bloom, dragging right-to-left scrolls the map rightward.
  var startX = Math.round(device.width * 0.8);
  var endX   = Math.round(device.width * 0.2);
  var msg    = "→" + (label ? " " + label : "");
  console.info("scroll: " + msg);
  if (floatyW) {
    floatyMod.appendLog(floatyW, msg);
  }
  swipe(startX, y, endX, y, swipeDuration);
}

module.exports = {
  scrollLeft:  scrollLeft,
  scrollRight: scrollRight,
};
