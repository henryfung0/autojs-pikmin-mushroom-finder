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
 *   {number}  settleDelay     - Delay after each swipe (500-10000 ms)
 *   {number}  maxEmptyScrolls - Max empty scrolls before reposition (1-15)
 *   Returns null if the user pressed Exit or cancelled.
 */
function showConfigDialog() {
  // Inflate the XML layout into a real Android View hierarchy.
  // ui.inflate() creates proper CompoundButton/SeekBar Java objects
  // whose children are accessible by id (view.id).
  // Passing a raw XML descriptor to dialogs.build() keeps it as a
  // non-method descriptor — ui.inflate() avoids that limitation.
  var view = ui.inflate(
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

        {/* Settle Delay */}
        <text text="Settle delay (seconds)" textSize="13sp" margin="8 0 0 0"/>
        <text id="settleDelayValue" text="2.5" textSize="11sp"
              textColor="#888888" margin="4 0 0 0"/>
        <seekbar id="settleDelay" progress="4" max="19" margin="0 0 4 0"/>
        <text text="Wait time after each swipe for map tiles. Increase if map is blurry."
              textSize="9sp" textColor="#666666" margin="4 0 8 0"/>

        {/* Max Empty Scrolls */}
        <text text="Max empty scrolls" textSize="13sp" margin="8 0 0 0"/>
        <text id="maxEmptyScrollsValue" text="5" textSize="11sp"
              textColor="#888888" margin="4 0 0 0"/>
        <seekbar id="maxEmptyScrolls" progress="4" max="14" margin="0 0 4 0"/>
        <text text="Consecutive scrolls without any map content before reposition."
              textSize="9sp" textColor="#666666" margin="4 0 8 0"/>

        {/* Checkboxes */}
        <checkbox id="autoLaunch" text="Auto-launch Pikmin Bloom"
                  checked="true" margin="8 0 0 0"/>
        <checkbox id="detectLargeColor" text="Include large color mushrooms"
                  checked="true" margin="8 0 0 0"/>
        <checkbox id="detectLargeElement" text="Include large element mushrooms"
                  checked="true" margin="8 0 0 0"/>
        <checkbox id="debugMode" text="Debug Mode" checked="false"
                  margin="8 0 0 0"/>

        {/* Button row */}
        <horizontal gravity="center" margin="12 0 0 0">
          <button id="resetBtn" text="Reset" textSize="13sp"
                  style="Widget.AppCompat.Button.ButtonBar.AlertDialog"
                  layout_weight="1"/>
          <button id="exitBtn" text="Exit" textSize="13sp"
                  style="Widget.AppCompat.Button.ButtonBar.AlertDialog"
                  layout_weight="1"/>
          <button id="startBtn" text="Start" textSize="13sp"
                  style="Widget.AppCompat.Button.ButtonBar.AlertDialog"
                  layout_weight="1"/>
        </horizontal>
      </vertical>
    </frame>
  );

  view.threshold.setOnSeekBarChangeListener({
    onProgressChanged: function(seekBar, progress, fromUser) {
      if (fromUser) view.thresholdValue.setText(((progress + 70) / 100).toFixed(2));
    },
    onStartTrackingTouch: function(seekBar) {},
    onStopTrackingTouch: function(seekBar) {}
  });
  view.settleDelay.setOnSeekBarChangeListener({
    onProgressChanged: function(seekBar, progress, fromUser) {
      if (fromUser) view.settleDelayValue.setText(String(((progress * 500) + 500) / 1000));
    },
    onStartTrackingTouch: function(seekBar) {},
    onStopTrackingTouch: function(seekBar) {}
  });
  view.maxEmptyScrolls.setOnSeekBarChangeListener({
    onProgressChanged: function(seekBar, progress, fromUser) {
      if (fromUser) view.maxEmptyScrollsValue.setText(String(progress + 1));
    },
    onStartTrackingTouch: function(seekBar) {},
    onStopTrackingTouch: function(seekBar) {}
  });

  var dialogResult = { choice: null, values: null };

  view.startBtn.on("click", function() {
    dialogResult.choice = "start";
    dialogResult.values = {
      threshold: (view.threshold.progress + 70) / 100,
      autoLaunch: view.autoLaunch.isChecked(),
      detectLargeColor: view.detectLargeColor.isChecked(),
      detectLargeElement: view.detectLargeElement.isChecked(),
      debugMode: view.debugMode.isChecked(),
      settleDelay: (view.settleDelay.progress * 500) + 500,
      maxEmptyScrolls: view.maxEmptyScrolls.progress + 1
    };
    d.dismiss();
  });

  view.exitBtn.on("click", function() {
    dialogResult.choice = "exit";
    d.dismiss();
  });

  view.resetBtn.on("click", function() {
    view.threshold.setProgress(15);
    view.thresholdValue.setText("0.85");
    view.settleDelay.setProgress(4);
    view.settleDelayValue.setText("2.5");
    view.maxEmptyScrolls.setProgress(4);
    view.maxEmptyScrollsValue.setText("5");
    view.autoLaunch.setChecked(true);
    view.detectLargeColor.setChecked(true);
    view.detectLargeElement.setChecked(true);
    view.debugMode.setChecked(false);
  });

  var d = dialogs.build({
    customView: view,
    wrapInScrollView: true
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

  return dialogResult.values;
}

module.exports = {
  showConfigDialog: showConfigDialog
};
