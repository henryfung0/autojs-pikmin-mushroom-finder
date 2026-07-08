/**
 * config_ui.js
 *
 * Combined settings dialog for Pikmin Bloom automation (Mushroom Finder / Advanture modes).
 * Shows a single dialog with mode selection, common settings, and mode-specific
 * configuration sections that toggle based on the selected mode.
 *
 * Exports:
 *   showConfigDialog() - Show the combined dialog, return settings object or null
 */

/**
 * Show the combined config dialog.
 *
 * @returns {Object|null} Settings object with keys:
 *   {string}  mode             - Selected automation mode ("Mushroom Finder" or "Advanture")
 *   {boolean} autoLaunch       - Auto-launch Pikmin Bloom
 *   {number}  threshold        - Confidence threshold (0.70 – 0.99)
 *   {boolean} detectLargeColor - Include large color mushrooms
 *   {boolean} detectLargeElement - Include large element mushrooms
 *   {number}  settleDelay      - Post-swipe settle delay in ms (500 – 10000)
 *   {number}  maxEmptyScrolls  - Max empty scrolls before re-centering (1 – 15)
 *   Returns null if the user pressed Exit or cancelled.
 */
function showConfigDialog() {
  // Inflate the XML layout into a real Android View hierarchy.
  var view = ui.inflate(
    <frame bg="#1E1E1E">
      <vertical padding="16 8">
        <text text="Pikmin Bloom" textSize="18sp" textColor="#E0E0E0"
              gravity="center" margin="0 0 0 8"/>

        {/* Mode Selection */}
        <spinner id="modeSelector" entries="Mushroom Finder|Pikmin Daily Task"
                 textSize="14sp" textColor="#E0E0E0" gravity="center" margin="0 0 16 0"/>

        {/* Common checkboxes (always visible) */}
        <checkbox id="autoLaunch" text="Auto-launch Pikmin Bloom"
                  checked="true" textSize="14sp" textColor="#E0E0E0" margin="0 0 0 4"/>
        <text text="Mushroom Finder Settings" textSize="15sp"
              textColor="#64B5F6" margin="0 0 0 4"/>

        {/* Mushroom-specific settings (hidden by default) */}
        <vertical id="mushroomSettings" visibility="gone">
          {/* Confidence Threshold */}
          <text text="Confidence Threshold: 0.85" textSize="13sp"
                textColor="#CCCCCC" margin="0 4 0 0" id="thresholdLabel"/>
          <text text="0.85" textSize="12sp" textColor="#999999"
                gravity="end" id="thresholdValue"/>
          <seekbar id="threshold" progress="15" max="29"
                   margin="0 0 0 8"/>

          {/* Settle Delay */}
          <text text="Settle Delay: 2.5s" textSize="13sp"
                textColor="#CCCCCC" margin="0 4 0 0" id="settleDelayLabel"/>
          <text text="2.5" textSize="12sp" textColor="#999999"
                gravity="end" id="settleDelayValue"/>
          <seekbar id="settleDelay" progress="4" max="19"
                   margin="0 0 0 8"/>

          {/* Max Empty Scrolls */}
          <text text="Max Empty Scrolls: 5" textSize="13sp"
                textColor="#CCCCCC" margin="0 4 0 0" id="maxEmptyScrollsLabel"/>
          <text text="5" textSize="12sp" textColor="#999999"
                gravity="end" id="maxEmptyScrollsValue"/>
          <seekbar id="maxEmptyScrolls" progress="4" max="14"
                   margin="0 0 0 8"/>

          <checkbox id="detectLargeColor" text="Include large color mushrooms"
                    checked="true" textSize="14sp" textColor="#E0E0E0" margin="0 4 0 4"/>
          <checkbox id="detectLargeElement" text="Include large element mushrooms"
                    checked="true" textSize="14sp" textColor="#E0E0E0" margin="0 0 0 4"/>
        </vertical>

        {/* Advanture-specific settings (visible by default) */}
        <vertical id="advantureSettings">
          <text text="Pikmin Daily Task:" textSize="14sp" textColor="#64B5F6" margin="0 8 0 4"/>
          <checkbox id="enableCollect" text="Auto Collect" checked="true"
                   textSize="14sp" textColor="#E0E0E0" margin="0 0 0 4"/>
          <checkbox id="enableFarm" text="Auto Farm" checked="true"
                   textSize="14sp" textColor="#E0E0E0" margin="0 0 0 4"/>
          <checkbox id="enableThrowRepeated" text="Throw Repeated" checked="true"
                   textSize="14sp" textColor="#E0E0E0" margin="0 0 0 4"/>
          <text text="Collect:" textSize="14sp" textColor="#64B5F6" margin="0 8 0 4"/>
          <checkbox id="enableGift" text="Gift" checked="true" textSize="14sp" textColor="#E0E0E0" margin="0 0 0 4"/>
          <checkbox id="enableSeedling" text="Seedling" checked="true" textSize="14sp" textColor="#E0E0E0" margin="0 0 0 4"/>
          <checkbox id="enableFruit" text="Fruit" checked="true" textSize="14sp" textColor="#E0E0E0" margin="0 0 0 4"/>

          {/* Max Empty Loops */}
          <text text="Max Empty Loops: 10" textSize="13sp"
                textColor="#CCCCCC" margin="0 8 0 0" id="maxEmptyLoopsLabel"/>
          <text text="10" textSize="12sp" textColor="#999999"
                gravity="end" id="maxEmptyLoopsValue"/>
          <seekbar id="maxEmptyLoops" progress="9" max="29"
                   margin="0 0 0 8"/>
        </vertical>

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

  var dialogResult = { choice: null, values: null };

  // Default to Pikmin Daily Task
  view.modeSelector.setSelection(1);

  // ── Mode spinner listener ────────────────────────
  view.modeSelector.setOnItemSelectedListener({
    onItemSelected: function(parent, viewRef, position, id) {
      if (position === 0) {  // Mushroom Finder selected
        view.mushroomSettings.visibility = android.view.View.VISIBLE;
        view.advantureSettings.visibility = android.view.View.GONE;
      } else {  // Pikmin Daily Task selected (position 1)
        view.mushroomSettings.visibility = android.view.View.GONE;
        view.advantureSettings.visibility = android.view.View.VISIBLE;
      }
    }
  });

  // ── Seekbar listeners ────────────────────────────

  // Confidence threshold (progress 0-29 → value 0.70-0.99)
  view.threshold.setOnSeekBarChangeListener({
    onProgressChanged: function(seekBar, progress, fromUser) {
      var value = ((progress + 70) / 100).toFixed(2);
      view.thresholdValue.setText(value);
    }
  });

  // Settle delay (progress 0-19 → value 500-10000 ms)
  view.settleDelay.setOnSeekBarChangeListener({
    onProgressChanged: function(seekBar, progress, fromUser) {
      var value = ((progress * 500) + 500) / 1000;
      view.settleDelayValue.setText(String(value));
    }
  });

  // Max empty scrolls (progress 0-14 → value 1-15)
  view.maxEmptyScrolls.setOnSeekBarChangeListener({
    onProgressChanged: function(seekBar, progress, fromUser) {
      var value = progress + 1;
      view.maxEmptyScrollsValue.setText(String(value));
    }
  });

  // Max empty loops for advanture (progress 0-29 → value 1-30)
  view.maxEmptyLoops.setOnSeekBarChangeListener({
    onProgressChanged: function(seekBar, progress, fromUser) {
      var value = progress + 1;
      view.maxEmptyLoopsValue.setText(String(value));
    }
  });

  // ── Start button ─────────────────────────────────
  view.startBtn.on("click", function() {
    dialogResult.choice = "start";
    dialogResult.values = {
      mode: view.modeSelector.getSelectedItem(),
      autoLaunch: view.autoLaunch.isChecked(),
      threshold: (view.threshold.progress + 70) / 100,
      detectLargeColor: view.detectLargeColor.isChecked(),
      detectLargeElement: view.detectLargeElement.isChecked(),
      settleDelay: (view.settleDelay.progress * 500) + 500,
      maxEmptyScrolls: view.maxEmptyScrolls.progress + 1,
      enableCollect: view.enableCollect.isChecked(),
      enableFarm: view.enableFarm.isChecked(),
      enableThrowRepeated: view.enableThrowRepeated.isChecked(),
      enableGift: view.enableGift.isChecked(),
      enableSeedling: view.enableSeedling.isChecked(),
      enableFruit: view.enableFruit.isChecked(),
      maxEmptyLoops: view.maxEmptyLoops.progress + 1
    };
    d.dismiss();
  });

  // ── Reset button ─────────────────────────────────
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
    view.enableCollect.setChecked(true);
    view.enableFarm.setChecked(true);
    view.enableThrowRepeated.setChecked(true);
    view.enableGift.setChecked(true);
    view.enableSeedling.setChecked(true);
    view.enableFruit.setChecked(true);
    view.maxEmptyLoops.setProgress(9);
    view.maxEmptyLoopsValue.setText("10");
  });

  // ── Exit button ──────────────────────────────────
  view.exitBtn.on("click", function() {
    dialogResult.choice = "exit";
    d.dismiss();
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
