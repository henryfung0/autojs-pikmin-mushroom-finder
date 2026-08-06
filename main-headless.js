"auto";

var config    = require("./ui/config");
var configUi  = require("./ui/config_ui");
var floatyMod = require("./ui/floaty");
var pikminIcon = require("./lib/pikmin_icon");

var thisEngine = engines.myEngine();
engines.all().forEach(function(engine) {
  if (engine.id !== thisEngine.id) {
    engine.forceStop();
  }
});

var settings = {
  mode: "Mushroom Finder",
  threshold: config.detection.threshold,
  settleDelay: config.scan.settleDelay,
  maxEmptyScrolls: config.scan.maxEmptyScrolls,
  detectLargeColor: config.detection.detectLargeColor,
  detectLargeElement: config.detection.detectLargeElement,
  largeColorThreshold: config.detection.largeColorThreshold,
  largeElementThreshold: config.detection.largeElementThreshold,
  autoLaunch: true,
  pikminAccount: config.account.pikminAccount
};

toast("Pikmin Bloom — headless mode");
console.info("Headless mode — threshold=" + settings.threshold +
  ", settleDelay=" + settings.settleDelay +
  ", maxEmptyScrolls=" + settings.maxEmptyScrolls +
  ", autoLaunch=" + settings.autoLaunch);

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
pikminIcon.launchAndDetectIcon(
  config.app.packageName,
  config.detection.templateDir,
  config.account.pikminAccount || 1,
  panel
);

require("./mushroom_finder/main").run(settings, panel);
