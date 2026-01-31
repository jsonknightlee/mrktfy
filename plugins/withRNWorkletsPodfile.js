// plugins/withRNWorkletsPodfile.js
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function ensureRNWorkletsInsideTarget(podfile) {
  const marker = "# >>> RNWORKLETS_AUTOFIX";
  const podLine = `  pod 'RNWorklets', :path => "../node_modules/react-native-worklets"`;

  // If already present, no-op
  if (podfile.includes("pod 'RNWorklets'") || podfile.includes('pod "RNWorklets"')) {
    return podfile;
  }

  const lines = podfile.split("\n");
  let inserted = false;

  for (let i = 0; i < lines.length; i++) {
    // first target block
    if (/^\s*target\s+['"].+['"]\s+do\s*$/.test(lines[i])) {
      lines.splice(i + 1, 0, `  ${marker}`, podLine, `  # <<< RNWORKLETS_AUTOFIX`);
      inserted = true;
      break;
    }
  }

  return inserted ? lines.join("\n") : podfile;
}

function injectDebugPrint(podfile) {
  // optional: makes EAS logs prove the line exists
  // prints only the RNWORKLETS_AUTOFIX section (safe and short)
  if (podfile.includes("RNWORKLETS_AUTOFIX_PRINT")) return podfile;

  if (!podfile.includes("post_install do |installer|")) {
    podfile += `

post_install do |installer|
  react_native_post_install(installer) if defined?(react_native_post_install)
end
`;
  }

  const marker = "post_install do |installer|";
  const idx = podfile.indexOf(marker);
  const insertPos = idx + marker.length;

  const injection = `
  # RNWORKLETS_AUTOFIX_PRINT
  begin
    podfile_path = File.join(__dir__, 'Podfile')
    content = File.read(podfile_path)
    content.each_line do |line|
      if line.include?('RNWORKLETS_AUTOFIX') || line.include?("pod 'RNWorklets'")
        puts "[RNWORKLETS_AUTOFIX] #{line.strip}"
      end
    end
  rescue => e
    puts "[RNWORKLETS_AUTOFIX] failed to print Podfile: #{e}"
  end
`;

  return podfile.slice(0, insertPos) + injection + podfile.slice(insertPos);
}

module.exports = function withRNWorkletsPodfile(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const iosDir = config.modRequest.platformProjectRoot; // ios/
      const podfilePath = path.join(iosDir, "Podfile");

      if (!fs.existsSync(podfilePath)) return config;

      const original = fs.readFileSync(podfilePath, "utf8");
      let updated = original;

      updated = ensureRNWorkletsInsideTarget(updated);
      updated = injectDebugPrint(updated);

      if (updated !== original) {
        fs.writeFileSync(podfilePath, updated);
      }

      return config;
    },
  ]);
};
