const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const podfilePath = path.join(projectRoot, 'ios', 'Podfile');
const iapPodspecPath = path.join(projectRoot, 'node_modules', 'react-native-iap', 'RNIap.podspec');

// Clean up any manual RCT-Folly line that was added during earlier workarounds
if (fs.existsSync(podfilePath)) {
  let podfile = fs.readFileSync(podfilePath, 'utf8');
  const follyComment = podfile.indexOf('# RCT-Folly is required by react-native-iap');
  if (follyComment !== -1) {
    const follyPod = podfile.indexOf("pod 'RCT-Folly'", follyComment);
    if (follyPod !== -1) {
      const nl = String.fromCharCode(10);
      const start = podfile.lastIndexOf(nl, follyComment);
      const end = podfile.indexOf(nl, follyPod);
      podfile = podfile.slice(0, start) + podfile.slice(end);
      fs.writeFileSync(podfilePath, podfile);
      console.log('✅ Removed manual RCT-Folly lines from ios/Podfile.');
    } else {
      console.log('ℹ️ Found RCT-Folly comment but not pod line.');
    }
  } else {
    console.log('ℹ️ No manual RCT-Folly line in ios/Podfile.');
  }
} else {
  console.log('ℹ️ No ios/Podfile found.');
}

// Patch react-native-iap so it does not try to pull in RCT-Folly / new-arch deps
if (fs.existsSync(iapPodspecPath)) {
  let podspec = fs.readFileSync(iapPodspecPath, 'utf8');
  const newArchStart = podspec.indexOf("  # Don't install the dependencies when we run `pod install` in the old architecture.");
  if (newArchStart !== -1) {
    const newArchEnd = podspec.indexOf('  end', newArchStart);
    if (newArchEnd !== -1) {
      podspec = podspec.slice(0, newArchStart) + podspec.slice(newArchEnd + 5);
      fs.writeFileSync(iapPodspecPath, podspec);
      console.log('✅ Patched RNIap.podspec to remove New Architecture dependencies.');
    } else {
      console.log('⚠️ Could not find closing end of RNIap new-arch block.');
    }
  } else {
    console.log('ℹ️ RNIap.podspec already patched or not in expected state.');
  }
} else {
  console.log('ℹ️ RNIap podspec not found, skipping.');
}
