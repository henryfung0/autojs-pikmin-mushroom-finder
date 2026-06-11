/**
 * config_ui.js
 *
 * Pre-flight configuration dialog for Pikmin Bloom Mushroom Finder.
 * Shows a floating settings dialog before the scan starts, allowing
 * the user to adjust detection parameters and toggle options.
 *
 * Values are read from the layout when the dialog closes.
 *
 * Exports:
 *   showConfigDialog() - Show dialog, return settings or null
 */

/**
 * Show the pre-flight configuration dialog.
 *
 * @returns {Object|null} Settings object with keys:
 *   {number}  threshold    - Confidence threshold (0.70-0.99)
 *   {boolean} autoLaunch   - Auto-launch Pikmin Bloom
 *   {boolean} debugMode    - Enable debug logging
 *   {number}  sweepCount   - Swipes per row (1-6)
 *   {number}  settleDelay  - Delay after each swipe (500-10000 ms)
 *   Returns null if the user pressed Exit or cancelled.
 */
function showConfigDialog() {
  var layout = (
    <frame>
      <vertical padding="16 8">
        <text text="Mushroom Finder" textSize="18sp" textColor="#1976D2"
              gravity="center" margin="0 0 0 16"/>

        {/* Confidence Threshold */}
        <text text="Confidence Threshold" textSize="13sp" margin="4 0 0 0"/>
        <text id="thresholdValue" text="0.85" textSize="11sp"
              textColor="#888888" margin="4 0 0 0"/>
        <seekbar id="threshold" progress="15" max="29" margin="0 0 4 0"/>
        <text text="Match sensitivity. Lower = more matches (more false positives)."
              textSize="9sp" textColor="#666666" margin="4 0 4 0"/>

        {/* Swipes per Row */}
        <text text="Swipes per row" textSize="13sp" margin="8 0 0 0"/>
        <text id="sweepCountValue" text="3" textSize="11sp"
              textColor="#888888" margin="4 0 0 0"/>
        <seekbar id="sweepCount" progress="2" max="5" margin="0 0 4 0"/>
        <text text="Horizontal passes per row. More = wider coverage, slower scan."
              textSize="9sp" textColor="#666666" margin="4 0 4 0"/>

        {/* Settle Delay */}
        <text text="Settle delay (ms)" textSize="13sp" margin="8 0 0 0"/>
        <text id="settleDelayValue" text="2500" textSize="11sp"
              textColor="#888888" margin="4 0 0 0"/>
        <seekbar id="settleDelay" progress="4" max="19" margin="0 0 4 0"/>
        <text text="Wait time after each swipe for map tiles. Increase if map is blurry."
              textSize="9sp" textColor="#666666" margin="4 0 8 0"/>

        {/* Checkboxes */}
        <checkbox id="autoLaunch" text="Auto-launch Pikmin Bloom"
                  checked="true" margin="8 0 0 0"/>
        <checkbox id="debugMode" text="Debug Mode" checked="false"
                  margin="8 0 0 0"/>
      </vertical>
    </frame>
  );

  var dialogResult = { choice: null };

  var d = dialogs.build({
    customView: layout,
    wrapInScrollView: true,
    positiveText: "Start Scan",
    negativeText: "Exit"
  });

  d.on("positive", function() {
    dialogResult.choice = "start";
  });

  d.on("negative", function() {
    dialogResult.choice = "exit";
  });

  d.on("cancel", function() {
    dialogResult.choice = "exit";
  });

  d.show();

  while (dialogResult.choice === null) {
    sleep(200);
  }

  if (dialogResult.choice === "exit") {
    return null;
  }

  // Read final values from the layout
  var threshold = (layout.threshold.progress + 70) / 100;
  var autoLaunch = layout.autoLaunch.checked;
  var debugMode = layout.debugMode.checked;
  var sweepCount = layout.sweepCount.progress + 1;
  var settleDelay = (layout.settleDelay.progress * 500) + 500;

  return {
    threshold: threshold,
    autoLaunch: autoLaunch,
    debugMode: debugMode,
    sweepCount: sweepCount,
    settleDelay: settleDelay
  };
}

module.exports = {
  showConfigDialog: showConfigDialog
};
