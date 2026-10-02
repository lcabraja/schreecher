#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
# Embed the usage description for standalone CLI use. When launched by Raycast,
# macOS assigns microphone permission to the responsible parent application.
/usr/bin/xcrun swiftc -O native/Audio.swift -o assets/screecher-audio \
  -Xlinker -sectcreate -Xlinker __TEXT -Xlinker __info_plist -Xlinker native/Info.plist
/usr/bin/codesign --force --sign - --identifier io.screecher.audio assets/screecher-audio
