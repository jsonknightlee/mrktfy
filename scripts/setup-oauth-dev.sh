#!/bin/bash

# Development OAuth Setup Script
# This script helps set up local development environment for OAuth testing

echo "🔧 Setting up OAuth Development Environment..."

# Check if .env.development exists
if [ ! -f ".env.development" ]; then
    echo "❌ .env.development not found. Creating template..."
    cat > .env.development << 'EOF'
# Development Environment Variables
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.38:3001
EXPO_PUBLIC_API_KEY=804276f41491b35e448d41fdb321d66f460a272fed36da3840463c480c505f2e
EXPO_PUBLIC_APP_ENV=development

# OAuth Development Configuration
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id-dev.apps.googleusercontent.com
EXPO_PUBLIC_APPLE_CLIENT_ID=com.mrktfy.mrktfy.dev

# Enable debug logging
EXPO_PUBLIC_DEBUG_MODE=true
EOF
    echo "✅ Created .env.development template"
    echo "🔧 Please update the OAuth client IDs in .env.development"
fi

# Install required dependencies
echo "📦 Installing OAuth dependencies..."
pnpm add expo-auth-session expo-crypto

# Create development build configuration
echo "🔧 Creating development build configuration..."

# Update eas.json for development
cat > eas.json << 'EOF'
{
  "cli": {
    "version": ">= 3.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "http://192.168.1.38:3001",
        "EXPO_PUBLIC_API_KEY": "804276f41491b35e448d41fdb321d66f460a272fed36da3840463c480c505f2e",
        "EXPO_PUBLIC_APP_ENV": "development",
        "EXPO_PUBLIC_DEBUG_MODE": "true"
      }
    },
    "preview": {
      "distribution": "store",
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "http://192.168.1.38:3001",
        "EXPO_PUBLIC_API_KEY": "804276f41491b35e448d41fdb321d66f460a272fed36da3840463c480c505f2e",
        "EXPO_PUBLIC_APP_ENV": "development"
      }
    },
    "production": {
      "distribution": "store",
      "env": {
        "EXPO_PUBLIC_API_BASE_URL": "https://mrktfy-realestate.onrender.com",
        "EXPO_PUBLIC_API_KEY": "804276f41491b35e448d41fdb321d66f460a272fed36da3840463c480c505f2e",
        "EXPO_PUBLIC_APP_ENV": "production"
      }
    }
  },
  "submit": {
    "production": {}
  }
}
EOF

echo "✅ Updated eas.json with development configuration"

# Start development server
echo "🚀 Starting development server with OAuth support..."
echo "📱 Use 'expo install' to get the correct native modules"
echo "🔧 Test OAuth flows with: npx expo start --dev-client"

echo ""
echo "🎯 OAuth Testing Instructions:"
echo "1. Update Google Client ID in .env.development"
echo "2. Configure OAuth redirect URIs in Google Console:"
echo "   - Development: exp://192.168.1.38:8081/--/oauth/google"
echo "   - Production: mrktfy://oauth/google"
echo "3. Run: npx expo start --dev-client"
echo "4. Build development client: eas build --platform ios --profile development"
echo "5. Test OAuth flows in development build"

echo ""
echo "🔍 Debug Mode Enabled:"
echo "- Console logs will show detailed OAuth flow information"
echo "- Network requests will be logged"
echo "- Authentication state changes will be tracked"
