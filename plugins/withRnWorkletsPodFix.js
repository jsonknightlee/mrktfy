const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withRNWorkletsPodFix(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      let podfile = fs.readFileSync(podfilePath, "utf8");

      const podLine = "pod 'RNWorklets', :path => '../node_modules/react-native-worklets'";
      const anchor = "config = use_native_modules!(config_command)";

      // 1) Ensure RNWorklets pod exists
      if (!podfile.includes(podLine)) {
        podfile = podfile.replace(
          anchor,
          `${anchor}\n\n  # ✅ Fix: RNReanimated depends on RNWorklets\n  ${podLine}`
        );
      }

      // 2) Ensure header search path fix exists
      const marker = "RNWorklets header search path fix";
      if (!podfile.includes(marker)) {
        podfile = podfile.replace(
          /post_install do \|installer\|\n([\s\S]*?)react_native_post_install\(/m,
          (match) => {
            return match + `
    # ✅ ${marker}
    installer.pods_project.targets.each do |t|
      next unless t.name == 'RNWorklets'
      t.build_configurations.each do |config|
        config.build_settings['HEADER_SEARCH_PATHS'] ||= '$(inherited)'
        # Add the folder that contains rnworklets/rnworklets.h
        config.build_settings['HEADER_SEARCH_PATHS'] << ' "$(SRCROOT)/../node_modules/react-native-worklets/apple"'
        config.build_settings['HEADER_SEARCH_PATHS'] << ' "$(SRCROOT)/../node_modules/react-native-worklets"'
      end
    end

`;
          }
        );
      }

      fs.writeFileSync(podfilePath, podfile);
      console.log("✅ Patched Podfile for RNWorklets pod + headers");
      return config;
    },
  ]);
};
