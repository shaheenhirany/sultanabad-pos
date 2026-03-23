# AKU Store POS Android Wrapper

This is a separate Capacitor Android wrapper for `https://store-pos.aku.edu`.
It does not modify the existing `com.sultanabad.canteen.pos` app.

## App identity
- App ID: `edu.aku.storepos`
- App name: `AKU Store POS`
- Target URL: `https://store-pos.aku.edu`

## Build debug APK
1. Ensure Android SDK exists at:
   - `C:\Users\Shaheen\AppData\Local\Android\Sdk`
2. Ensure JDK 21 is used for Gradle build.

PowerShell:

```powershell
cd C:\Users\Shaheen\POS\store-pos-aku-android\android
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
$env:PATH="$env:JAVA_HOME\bin;$env:PATH"
.\gradlew.bat assembleDebug
```

## Output APK
- `android\app\build\outputs\apk\debug\app-debug.apk`

## Open in Android Studio

```powershell
cd C:\Users\Shaheen\POS\store-pos-aku-android
npx cap open android
```
