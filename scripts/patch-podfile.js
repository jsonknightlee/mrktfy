const fs = require("fs");
const path = require("path");

const podfilePath = path.join(__dirname, "..", "ios", "Podfile");
const line = "pod 'RNWorklets', :path => '../node_modules/react-native-worklets'";
const anchor = "config = use_native_modules!(config_command)";

if (!fs.existsSync(podfilePath)) {
  console.log("⚠️ ios/Podfile not found yet, skipping patch.");
  process.exit(0);
}

let content = fs.readFileSync(podfilePath, "utf8");

if (content.includes(line)) {
  console.log("✅ Podfile already contains RNWorklets patch.");
  process.exit(0);
}

if (!content.includes(anchor)) {
  console.log("❌ Anchor not found in Podfile. Can't safely patch.");
  process.exit(1);
}

content = content.replace(
  anchor,
  `${anchor}\n\n  # ✅ Fix: RNReanimated depends on RNWorklets but Expo autolinking may not add it\n  ${line}`
);

fs.writeFileSync(podfilePath, content, "utf8");
console.log("✅ Patched ios/Podfile with RNWorklets.");
