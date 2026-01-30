// app.config.js
import 'dotenv/config';

export default () => ({
  name: "mrktfy",
  slug: "mrktfy",
  scheme: "mrktfy",
  owner: "mrktfy",
  version: "1.0.9",
  orientation: "portrait",
  icon: "./assets/mrktfy-icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/mrktfy-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.mrktfy.mrktfy",
    buildNumber: "18",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        "We use the camera to scan codes or take photos for your listings.",
      NSLocationWhenInUseUsageDescription:
        "Show relevant results and services near your location."
    }
  },
  android: {
    package: "com.mrktfy.mrktfy",
    versionCode: 18,
    adaptiveIcon: {
      foregroundImage: "./assets/mrktfy-icon.png",
      backgroundColor: "#ffffff"
    },
    edgeToEdgeEnabled: true
  },
  web: {
    favicon: "./assets/mrktfy-icon.png"
  },
  plugins: ["expo-secure-store", "expo-web-browser", "./plugins/withRNWorkletsPodfile", "./plugins/withRNWorkletsHeaderfix"],
  extra: {
    // ✅ EAS project link (required for dynamic config)
    eas: { projectId: "ceda178c-216c-4079-9b77-b98548c5a79c" },

    // ✅ Build-time envs (read from EAS or local dotenv/env-cmd)
    // if run with npx expo start --config app.config.js, these will be undefined but read from .env
    API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? "",
    API_KEY: process.env.EXPO_PUBLIC_API_KEY ?? process.env.API_KEY ?? "",
    APP_ENV: process.env.EXPO_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "production",
  }
});
