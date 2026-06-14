"auto";

var layout = (
  <frame>
    <vertical padding="16 8">
      <checkbox id="testCb" text="Test Checkbox" checked="true"/>
    </vertical>
  </frame>
);

var d = dialogs.build({
  customView: layout,
  positiveText: "OK",
  negativeText: "Cancel"
});

d.show();
sleep(1000);

toast("checked type=" + typeof layout.testCb.checked + " value=" + layout.testCb.checked);
console.info("checked type=" + typeof layout.testCb.checked + " value=" + layout.testCb.checked);
sleep(3000);
