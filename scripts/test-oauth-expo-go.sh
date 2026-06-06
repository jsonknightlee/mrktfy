#!/bin/bash

# OAuth Testing with Expo Go - Quick Setup
echo "🚀 Setting up OAuth Testing with Expo Go..."

# Start Expo Go with proper network configuration
echo "📱 Starting Expo Go with network tunnel..."
echo "🔧 Make sure your phone and computer are on the same WiFi network"

# Get the local IP address
LOCAL_IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}')
echo "🌐 Your local IP: $LOCAL_IP"

# Start Expo with tunnel mode for better connectivity
echo "🔗 Starting Expo with tunnel mode..."
echo "📱 Open Expo Go on your phone and scan the QR code"
echo "🔍 OAuth flows will work with tunnel URLs"

npx expo start --tunnel

echo ""
echo "🎯 OAuth Testing Instructions with Expo Go:"
echo "1. Install Expo Go from App Store"
echo "2. Scan the QR code above"
echo "3. Test OAuth flows - they'll work with tunnel URLs"
echo "4. Console logs will show detailed OAuth information"
echo ""
echo "🔗 OAuth Redirect URIs for Google Console:"
echo "- Development: exp://$LOCAL_IP:8081/--/oauth/google"
echo "- Tunnel: exp://exp.direct/--/oauth/google"
echo ""
echo "📱 This approach avoids development build connection issues!"
