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
    buildNumber: "60",
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        "We use the camera to scan codes or take photos for your listings.",
      NSLocationWhenInUseUsageDescription:
        "Show relevant results and services near your location.",
      NSLocationAlwaysUsageDescription:
        "Send you alerts about properties matching your criteria even when the app is not in use.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Send you alerts about properties matching your criteria when you're near them.",
      UIBackgroundModes: ['location'],
      // OAuth URL schemes for development
      CFBundleURLTypes: [
        {
          CFBundleURLName: 'com.mrktfy.oauth',
          CFBundleURLSchemes: ['mrktfy', 'com.mrktfy.mrktfy', 'exp', 'com.googleusercontent.apps']
        }
      ]
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
plugins: [
  "expo-secure-store",
  "expo-web-browser",
  [
    "@stripe/stripe-react-native",
    {
      merchantIdentifier: process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID ?? "merchant.com.mrktfy"
    }
  ],
  [
    "expo-notifications",
    {
      icon: "./assets/notification-icon.png",
      color: "#107AB0",
      defaultChannel: "default"
    }
  ]
],
  extra: {
    // ✅ EAS project link (required for dynamic config)
    eas: { projectId: "ceda178c-216c-4079-9b77-b98548c5a79c" },

    // ✅ Build-time envs (read from EAS or local dotenv/env-cmd)
    // if run with npx expo start --config app.config.js, these will be undefined but read from .env
    API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL ?? process.env.API_BASE_URL ?? "",
    API_BACKUP_BASE_URL: process.env.EXPO_PUBLIC_API_BACKUP_BASE_URL ?? process.env.API_BACKUP_BASE_URL ?? "",
    API_KEY: process.env.EXPO_PUBLIC_API_KEY ?? process.env.API_KEY ?? "",
    APP_ENV: process.env.EXPO_PUBLIC_APP_ENV ?? process.env.APP_ENV ?? "production",
    GOOGLE_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "",
    APPLE_CLIENT_ID: process.env.EXPO_PUBLIC_APPLE_CLIENT_ID ?? "com.mrktfy.mrktfy",
    STRIPE_PUBLISHABLE_KEY: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
    APPLE_MERCHANT_ID: process.env.EXPO_PUBLIC_APPLE_MERCHANT_ID ?? "",
    ENABLE_APPLE_PAY: process.env.EXPO_PUBLIC_ENABLE_APPLE_PAY === "true",
  }
});
