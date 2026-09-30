# TheSpot JobFinder — Flutter app

Android and iOS app for the TheSpot JobFinder API: Google sign-in, Fresher/Experienced job search with prompt, state, city, category, education and posted-within filters, results in a table, job details with contacts and Apply, and search history. Ads are Google AdMob only (banner + rewarded video).

## Run

```bash
cd mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:5000/api   # Android emulator → local server
flutter run --dart-define=API_BASE_URL=https://your-domain/api     # production server
```

Checks: `dart format --set-exit-if-changed lib test`, `flutter analyze`, `flutter test`.

## Google sign-in

1. In Google Cloud Console create OAuth clients: **Android** (package `com.thespotjobfinder.thespot_jobfinder` + your signing SHA-1) and **iOS** (bundle ID).
2. The app uses the server's web client ID (`GOOGLE_CLIENT_ID`, read from `/api/auth/config`) as `serverClientId`, so the server verifies the ID token. Add the Android/iOS client IDs to `GOOGLE_MOBILE_CLIENT_IDS` on the server.
3. iOS: set `GOOGLE_IOS_CLIENT_ID` and `GOOGLE_IOS_REVERSED_CLIENT_ID` in `ios/Flutter/Release.xcconfig` (and `Debug.xcconfig`).

## Google AdMob

- App IDs: Android `admobAppId=ca-app-pub-…~…` in `android/gradle.properties`; iOS `ADMOB_APP_ID` in `ios/Flutter/*.xcconfig`. Google's test app IDs are used by default.
- Ad units come from the server (`ADMOB_{ANDROID,IOS}_{BANNER,REWARDED}_ID`). Debug builds show Google test banners when no banner unit is set.
- Rewarded video: in AdMob → ad unit → **Server-side verification**, set the callback URL to `https://your-domain/api/admob/ssv`. The app sends the search ID as custom data; results unlock only after Google's signed callback reaches the server. Without a rewarded unit (or if Google does not confirm within 30 s) the app plays the server's timed video instead, and the server counts the watch time.
