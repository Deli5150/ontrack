#!/bin/sh
# Builds the iPhone app (.ipa) for sideloading, signed by your Apple team (APPLE_TEAM_ID in .env).
set -e
cd "$(dirname "$0")/.."
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
VERSION=$(node -p "require('./package.json').version")
TEAM=$(grep '^APPLE_TEAM_ID=' .env | cut -d= -f2)
npx expo prebuild --platform ios --no-install
(cd ios && pod install)
xcodebuild -workspace ios/OnTrack.xcworkspace -scheme OnTrack -configuration Release -sdk iphoneos \
  -derivedDataPath build/ios-dd DEVELOPMENT_TEAM="$TEAM" CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates build
rm -rf build/Payload && mkdir -p build/Payload dist
cp -R build/ios-dd/Build/Products/Release-iphoneos/OnTrack.app build/Payload/
(cd build && rm -f "../dist/OnTrack-$VERSION.ipa" && zip -qr "../dist/OnTrack-$VERSION.ipa" Payload)
echo "dist/OnTrack-$VERSION.ipa"
