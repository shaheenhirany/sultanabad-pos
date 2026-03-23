# Notifications and App Updates

## Prerequisite
- Set `GOOGLE_APPLICATION_CREDENTIALS` to a Firebase service-account JSON path.

PowerShell example:
```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account.json"
```

## Send Push Notification
```powershell
npm run notify:send -- --title "POS Update" --body "New menu uploaded" --url "https://canteen-sultanabad.web.app"
```

## Set App Update Policy
```powershell
npm run notify:update-config -- --latest "1.1.0" --min "1.0.0" --url "https://your-apk-download-url" --message "A new version is available."
```

Rules:
- If app version `< min`, users see a force-update blocker.
- If app version `< latest`, users see a dismissible update banner.

## App Version
Set build version for update checks via Vite env:
```powershell
$env:VITE_APP_VERSION="1.0.0"
npm run build
```
