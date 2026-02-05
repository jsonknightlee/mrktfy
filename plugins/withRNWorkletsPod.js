const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withRNWorkletsPod(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {ß
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      let podfile = fs.readFileSync(podfilePath, "utf8");

      const line = "pod 'RNWorklets', :path => '../node_modules/react-native-worklets'";
      const anchor = "config = use_native_modules!(config_command)";

      if (!podfile.includes(line)) {
        if (!podfile.includes(anchor)) {
          throw new Error("Anchor not found in Podfile; cannot insert RNWorklets pod line safely.");
        }
        podfile = podfile.replace(
          anchor,
          `${anchor}\n\n  # ✅ Fix: RNReanimated depends on RNWorklets but autolinking may not add it\n  ${line}`
        );
        fs.writeFileSync(podfilePath, podfile);
        console.log("✅ Injected RNWorklets pod line into Podfile.");
      } else {
        console.log("ℹ️ RNWorklets pod line already present.");
      }

      return config;
    },
  ]);
};
