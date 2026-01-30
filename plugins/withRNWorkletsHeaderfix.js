// plugins/withRNWorkletsHeaderFix.js
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function ensurePostInstallPatch(podfile) {
  const marker = "post_install do |installer|";

  const patch = `
  # --- RNWorklets header fix (EAS iOS) ---
  installer.pods_project.targets.each do |t|
    next unless t.name == 'RNWorklets'
    t.build_configurations.each do |config|
      # Ensure headers like <rnworklets/rnworklets.h> can be found
      hs = config.build_settings['HEADER_SEARCH_PATHS'] || ['$(inherited)']
      hs = [hs].flatten

      hs << '$(PODS_ROOT)/../node_modules/react-native-worklets/apple'
      hs << '$(PODS_ROOT)/../node_modules/react-native-worklets/apple/worklets'
      hs << '$(PODS_ROOT)/../node_modules/react-native-worklets/apple/worklets/include'
      hs << '$(PODS_ROOT)/../node_modules/react-native-worklets/apple/worklets/apple'

      config.build_settings['HEADER_SEARCH_PATHS'] = hs.uniq
    end
  end
`;

  // If Podfile already has our patch, do nothing
  if (podfile.includes("RNWorklets header fix (EAS iOS)")) return podfile;

  // If post_install exists, inject inside it
  if (podfile.includes(marker)) {
    // insert right after the post_install line
    return podfile.replace(marker, `${marker}\n${patch}`);
  }

  // If no post_install exists, append one at end
  return podfile + `

post_install do |installer|
${patch}
end
`;
}

module.exports = function withRNWorkletsHeaderFix(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const iosDir = config.modRequest.platformProjectRoot;
      const podfilePath = path.join(iosDir, "Podfile");
      if (!fs.existsSync(podfilePath)) return config;

      const podfile = fs.readFileSync(podfilePath, "utf8");
      const updated = ensurePostInstallPatch(podfile);

      if (updated !== podfile) fs.writeFileSync(podfilePath, updated);
      return config;
    },
  ]);
};
