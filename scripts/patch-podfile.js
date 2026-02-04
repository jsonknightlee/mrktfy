const fs = require("fs");
const path = require("path");

const podfilePath = path.join(__dirname, "..", "ios", "Podfile");
const needle = "pod 'RNWorklets', :path => '../node_modules/react-native-worklets'";
const insertAfter = "config = use_native_modules!(config_command)";

let podfile = fs.readFileSync(podfilePath, "utf8");

if (!podfile.includes(needle)) {
  podfile = podfile.replace(
    insertAfter,
    `${insertAfter}\n\n  # ✅ Fix for RNReanimated -> RNWorklets pod resolution\n  ${needle}`
  );
  fs.writeFileSync(podfilePath, podfile, "utf8");
  console.log("✅ Patched Podfile with RNWorklets pod.");
} else {
  console.log("ℹ️ Podfile already patched.");
}
