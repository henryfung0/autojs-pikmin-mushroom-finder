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

function zoomOut(times, floatyW) {
  times = times || 2;
  var w = device.width;
  var h = device.height;
  var cx = w / 2;
  var cy = h / 2;
  try {
    for (var i = 0; i < times; i++) {
      gestures(
        [300, [cx - 60, cy - 60], [cx - 220, cy - 220]],
        [300, [cx + 60, cy + 60], [cx + 220, cy + 220]]
      );
      sleep(300);
    }
    var msg = "Zoomed out " + times + " levels";
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
