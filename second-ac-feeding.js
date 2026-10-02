"auto";

// Unlock phone screen and handle starting page before game operations
require("./unlock");

// Ensure phone is unlocked BEFORE launching the app
// This runs the full unlock sequence immediately when script starts
var panel = require("./ui/floaty").createControlPanel(function() {
  require("./ui/floaty").destroy(panel);
  exit();
});
require("./unlock").ensureUnlockedBeforeLaunch(panel);

// Stop all other engines, only keep this one running
var thisEngine = engines.myEngine();
engines.all().forEach(function(engine) {
  if (engine.id !== thisEngine.id) {
    engine.forceStop();
  }
});

// Configuration for Second Account (Account 2) - Pikmin Daily Task + Feeding #3
var config        = require("./ui/config");
var configUi      = require("./ui/config_ui");
var floatyMod     = require("./ui/floaty");
var pikminIcon    = require("./lib/pikmin_icon");
var settingsStore = require("./ui/settings_store");

// Load previously saved settings (OCR positions, etc.) so this headless script
// uses the user's tuned values instead of hardcoded defaults.
var saved = settingsStore.load();

var settings = {
  mode: "Daily Task & Feeding #3",  // Daily task mode, NOT Mushroom Finder
  threshold: config.detection.threshold,
  settleDelay: config.scan.settleDelay,
  maxEmptyScrolls: config.scan.maxEmptyScrolls,
  detectLargeColor: config.detection.detectLargeColor,
  detectLargeElement: config.detection.detectLargeElement,
  largeColorThreshold: config.detection.largeColorThreshold,
  largeElementThreshold: config.detection.largeElementThreshold,
  autoLaunch: true,
  pikminAccount: 2,  // Second AC
  // Feeding function #3 settings
  enableCollectFeeding: true,
  enableFeedPikmin: true,
  maxFlowerMain: typeof saved.maxFlowerMain === "number" ? saved.maxFlowerMain : 1200,
  maxFlowerSecond: typeof saved.maxFlowerSecond === "number" ? saved.maxFlowerSecond : 1200,
  // OCR positions — read from settings store (tuned via config dialog)
  flowerX: typeof saved.flowerX === "number" ? saved.flowerX : config.feeding.flowerX,
  flowerY: typeof saved.flowerY === "number" ? saved.flowerY : config.feeding.flowerY,
  nectarX: typeof saved.nectarX === "number" ? saved.nectarX : config.feeding.nectarX,
  nectarY: typeof saved.nectarY === "number" ? saved.nectarY : config.feeding.nectarY
};

toast("Pikmin Bloom — Second AC Headless Mode (Daily Task & Feeding #3)");
console.info("Headless mode — Second AC Daily Task & Feeding #3, threshold=" + settings.threshold +
  ", settleDelay=" + settings.settleDelay +
  ", maxEmptyScrolls=" + settings.maxEmptyScrolls +
  ", autoLaunch=" + settings.autoLaunch +
  ", pikminAccount=" + settings.pikminAccount +
  ", enableCollectFeeding=" + settings.enableCollectFeeding +
  ", enableFeedPikmin=" + settings.enableFeedPikmin +
  ", OCR: flowerX=" + settings.flowerX + " flowerY=" + settings.flowerY +
  ", nectarX=" + settings.nectarX + " nectarY=" + settings.nectarY);

var captureGranted = false;
try {
  captureGranted = images.requestScreenCapture(false);
} catch (e) {
  console.warn("requestScreenCapture threw: " + e);
}
if (!captureGranted) {
  toast("Screen capture permission denied. Grant permission and restart.");
  exit();
}

var panel = floatyMod.createControlPanel(function() {
  floatyMod.destroy(panel);
  exit();
});

floatyMod.appendLog(panel, "Headless mode starting...");
floatyMod.appendLog(panel, "OCR positions: flower=(" + settings.flowerX + "," + settings.flowerY + ") nectar=(" + settings.nectarX + "," + settings.nectarY + ")");

// Launch Pikmin Bloom (Second AC) and detect the icon
pikminIcon.launchAndDetectIcon(
  config.app.packageName,
  config.detection.templateDir,
  settings.pikminAccount,
  panel
);

// Run the Daily Task & Feeding #3 pipeline
// This directly implements the daily task navigation and feeding functions
// without using the mushroom finder pipeline
try {
  require("./daily_task_feeding_main").run(settings, panel);
} catch (e) {
  console.error("Pipeline threw: " + e);
  floatyMod.appendLog(panel, "Pipeline error: " + e);
}

// Safety net: lock screen on exit (also called inside the pipeline on normal completion)
if (typeof device.isScreenOn === "function" && device.isScreenOn()) {
  try {
    shell("input keyevent 26");
    sleep(2500);
    if (typeof device.isScreenOn === "function" && device.isScreenOn()) {
      shell("input keyevent KEYCODE_POWER");
      sleep(2500);
    }
    console.info("Screen locked after pipeline exit");
  } catch (lockErr) {
    console.warn("Screen lock failed: " + lockErr);
  }
}

sleep(500);
exit();