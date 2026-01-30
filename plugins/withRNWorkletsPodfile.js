// plugins/withRNWorkletsPodfile.js
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function ensureRNWorkletsPod(podfile) {
  const podLine = `  pod 'RNWorklets', :path => "../node_modules/react-native-worklets"`;

  // Already present
  if (podfile.includes("pod 'RNWorklets'") || podfile.includes('pod "RNWorklets"')) {
    return podfile;
  }

  const lines = podfile.split("\n");
  let inserted = false;

  // Insert AFTER: config = use_native_modules!(config_command)
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];

    // match the whole line regardless of spacing
    if (!inserted && /config\s*=\s*use_native_modules!\s*\(\s*config_command\s*\)\s*$/.test(l)) {
      lines.splice(i + 1, 0, podLine);
      inserted = true;
      break;
    }
  }

  // Fallback: insert after use_expo_modules!
  if (!inserted) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^\s*use_expo_modules!\s*$/.test(l)) {
        lines.splice(i + 1, 0, podLine);
        inserted = true;
        break;
      }
    }
  }

  // Fallback: insert near top of target block (after first "target '...'" line)
  if (!inserted) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/^\s*target\s+['"].+['"]\s+do\s*$/.test(l)) {
        lines.splice(i + 1, 0, podLine);
        inserted = true;
        break;
      }
    }
  }

  return lines.join("\n");
}

module.exports = function withRNWorkletsPodfile(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const iosDir = config.modRequest.platformProjectRoot; // ios/
      const podfilePath = path.join(iosDir, "Podfile");

      if (!fs.existsSync(podfilePath)) return config;

      const podfile = fs.readFileSync(podfilePath, "utf8");
      const updated = ensureRNWorkletsPod(podfile);

      if (updated !== podfile) {
        fs.writeFileSync(podfilePath, updated);
      }

      return config;
    },
  ]);
};
