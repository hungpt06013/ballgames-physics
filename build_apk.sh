#!/usr/bin/env bash
# Builds a signed APK without Gradle: aapt2 -> javac -> d8 -> zipalign -> apksigner
set -euo pipefail
cd "$(dirname "$0")"
SDK="${ANDROID_HOME:-$(cd ../android-sdk && pwd)}"
BT="$SDK/build-tools/36.1.0"
JAR="$SDK/platforms/android-34/android.jar"
VERSION_CODE="${VERSION_CODE:-1}"
VERSION_NAME="${VERSION_NAME:-1.0}"
OUT=build
rm -rf "$OUT"; mkdir -p "$OUT/classes" "$OUT/assets/www"
cp www/index.html www/engine.js www/audio.js www/meta.js www/draw.js www/highlights.js www/game.js "$OUT/assets/www/"

"$BT/aapt2" compile --dir android/res -o "$OUT/res.zip"
"$BT/aapt2" link -o "$OUT/unsigned.apk" -I "$JAR" \
  --manifest android/AndroidManifest.xml -A "$OUT/assets" --java "$OUT/gen" \
  --min-sdk-version 21 --target-sdk-version 34 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NAME" "$OUT/res.zip"

javac -nowarn -source 8 -target 8 -bootclasspath "$JAR" -classpath "$JAR" -d "$OUT/classes" \
  "$OUT"/gen/com/ballgames/physics/R.java android/src/com/ballgames/physics/MainActivity.java 2>&1 | grep -v "warning: \[options\]" || true
"$BT/d8" --release --min-api 21 --lib "$JAR" --output "$OUT" $(find "$OUT/classes" -name '*.class')
(cd "$OUT" && zip -q unsigned.apk classes.dex)
"$BT/zipalign" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

KS=release.jks
if [ ! -f "$KS" ]; then
  keytool -genkeypair -keystore "$KS" -storepass ballgames -keypass ballgames -alias ballgames \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Ballgames Physics, O=Ballgames, C=VN" >/dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:ballgames --key-pass pass:ballgames \
  --out BallgamesPhysics.apk "$OUT/aligned.apk"
"$BT/apksigner" verify --verbose BallgamesPhysics.apk | head -5
ls -la BallgamesPhysics.apk
