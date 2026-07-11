@echo off
echo Building React Web App...
call npm run build

echo Syncing with Capacitor...
call npx cap sync

echo Building Android APK...
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
cd android
call gradlew.bat assembleDebug

echo Build Complete!
