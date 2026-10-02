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

// Configuration for Main Account (Account 1) - Seeding + Adventure mode
var config        = require("./ui/config");
var floatyMod    = require("./ui/floaty");
var pikminIcon   = require("./lib/pikmin_icon");
var settingsStore = require("./ui/settings_store");

// Load previously saved settings so the headless script uses the user's tuned values.
var saved = settingsStore.load();

var settings = {
  mode: "Daily Task — Seeding + Adventure",  // NOT mushroom finder
  threshold: config.detection.threshold,
  settleDelay: config.scan.settleDelay,
  maxEmptyScrolls: config.scan.maxEmptyScrolls,
  detectLargeColor: config.detection.detectLargeColor,
  detectLargeElement: config.detection.detectLargeElement,
  largeColorThreshold: config.detection.largeColorThreshold,
  largeElementThreshold: config.detection.largeElementThreshold,
  autoLaunch: true,
  pikminAccount: 1,  // Main AC
  // 1. Seedling group (settings dialog)
  enableCollect: true,
  enableFarm: true,
  enableThrowRepeated: true,
  // 2. Adventure group (settings dialog)
  enableGift: true,
  enableSeedling: true,
  enableFruit: true,
  // Shared
  maxEmptyLoops: typeof saved.maxEmptyLoops === "number" ? saved.maxEmptyLoops : 10
};

toast("Pikmin Bloom — Main AC Headless Mode (Seeding + Adventure)");
console.info("Headless mode — Main AC Seeding+Adventure, threshold=" + settings.threshold +
  ", settleDelay=" + settings.settleDelay +
  ", maxEmptyScrolls=" + settings.maxEmptyScrolls +
  ", autoLaunch=" + settings.autoLaunch +
  ", pikminAccount=" + settings.pikminAccount +
  ", seedling: collect=" + settings.enableCollect +
  " farm=" + settings.enableFarm +
  " throw=" + settings.enableThrowRepeated +
  ", adventure: gift=" + settings.enableGift +
  " seedling=" + settings.enableSeedling +
  " fruit=" + settings.enableFruit +
  ", maxEmptyLoops=" + settings.maxEmptyLoops);

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
floatyMod.appendLog(panel, "Seeding+Adventure — Account: Main AC (1)");

// Launch Pikmin Bloom (Main AC) and detect the icon
pikminIcon.launchAndDetectIcon(
  config.app.packageName,
  config.detection.templateDir,
  settings.pikminAccount,
  panel
);

// Run the Seeding + Adventure pipeline (NOT mushroom finder)
// This executes:
//   1. Seedling pipeline (collect + farm + throw repeated)
//   2. Adventure pipeline (gift + seedling + fruit)
try {
  require("./daily_task_seeding_adventure_main").run(settings, panel);
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