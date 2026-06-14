"auto";

var floatyMod = require("./floaty");

function scrollLeft(y, swipeDuration, floatyW, label) {
  var startX = Math.round(device.width * 0.2);
  var endX   = Math.round(device.width * 0.8);
  var msg    = "←" + (label ? " " + label : "");
  console.info("scroll: " + msg);
  if (floatyW) {
    floatyMod.appendLog(floatyW, msg);
  }
  swipe(startX, y, endX, y, swipeDuration);
}

function scrollRight(y, swipeDuration, floatyW, label) {
  var startX = Math.round(device.width * 0.8);
  var endX   = Math.round(device.width * 0.2);
  var msg    = "→" + (label ? " " + label : "");
  console.info("scroll: " + msg);
  if (floatyW) {
    floatyMod.appendLog(floatyW, msg);
  }
  swipe(startX, y, endX, y, swipeDuration);
}

function zoomOut(duration, floatyW) {
  var cx = Math.round(device.width / 2);
  var cy = Math.round(device.height / 2);
  try {
    press(cx, cy, 50);
    sleep(20);
    swipe(cx, cy, cx, Math.round(device.height * 0.25), 800);
    var msg = "Zoom out: tap + scroll-up";
    console.info("scroll: " + msg);
    if (floatyW) {
      floatyMod.appendLog(floatyW, msg);
    }
  } catch (e) {
    var msg = "Zoom out failed: " + e;
    console.warn("scroll: " + msg);
    if (floatyW) {
      floatyMod.appendLog(floatyW, msg);
    }
  }
}

module.exports = {
  scrollLeft:  scrollLeft,
  scrollRight: scrollRight,
  zoomOut:     zoomOut,
};
