# Cloudy English — Flutter migration

## Exact-copy rule

This project must remain a faithful copy of the current Cloudy English app. Do not change its layout, colors, typography, illustrations, animations, sound effects, lesson content, progression rules, account behavior, AI behavior, profile, or Shorts/community features. The only permitted user-visible differences are verified performance, responsiveness, memory, and animation-smoothness improvements.

The old app remains the source of truth until every screen and interaction has passed parity checks on iPhone and Android. Do not merge flutter-migration into main before that gate passes.

## Current transition strategy

The Flutter entry point currently uses a WebView compatibility shell that loads the existing Cloudy web application unchanged. This deliberately preserves the full existing UI and behavior while native Dart modules are migrated and verified. It is not yet the completed native Flutter migration.

The query parameter cloudyNative=1 suppresses only the existing iOS Add to Home Screen gate inside the Flutter shell. Normal browser/PWA visits do not include this parameter and keep their existing behavior.

## Flutter setup

The repository currently contains the Flutter package and Dart migration modules. Generate the platform runner projects once from this directory:

```sh
cd flutter
flutter create --platforms=android,ios .
flutter pub get
```

Run against a preview/deployment of the flutter-migration branch:

```sh
flutter run --dart-define=CLOUDY_API_BASE_URL=https://YOUR-CLOUDY-HOST
```

CLOUDY_API_BASE_URL must be the origin of the Cloudy host that contains the cloudyNative install-guide bypass and the authenticated /api/cloudy/mobile route. Do not point the Flutter shell at an unrelated or stale deployment.

When the native authentication/bootstrap is enabled, also provide SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY with --dart-define. Never place a Supabase service-role or secret key in the Flutter app.

The generated iOS Runner/Info.plist must include NSMicrophoneUsageDescription and NSCameraUsageDescription. The Android app manifest must include INTERNET, RECORD_AUDIO, and CAMERA permissions. These are required for the existing voice and Shorts media features; do not remove them during platform setup.

## Native modules already ported

- Exact current lesson catalog asset: all 60 lessons, all four CEFR paths, grammar foundations, vocabulary, and bilingual sentence data.
- Dart progress JSON model with the current cl2 keys and legacy single-level migration.
- All eight current study/exercise card types.
- Lesson exercise generation, guided grammar tasks, recall, pronunciation gating, and adaptive ordering.
- Guest/account local progress key scheme and cloud hydration conflict rules.
- XP, streak, lesson completion, daily goals, and three-way multi-device progress merge.
- Adaptive learning evidence, mastery scheduling, and offline event outbox.
- Supabase authentication/profile policy and authenticated backend client.
- Server-side mobile bridge that reuses existing Cloudy progress, XP, AI, learning-exam, chat-history, privacy, Shorts, and community operations without exposing service-role credentials.

## Validation status

Parity-focused Dart tests have been added for the data contracts and engines. The Flutter SDK is not available in the editing environment, so flutter analyze and flutter test have not yet been executed here. The branch CI workflow runs those checks after Flutter setup.

## Next native-port stages

1. Run Flutter analysis/tests and fix every finding.
2. Port the existing login, registration, guest, and welcome/onboarding screens pixel-for-pixel.
3. Port the learning home, lesson path, HUD, bottom dock, and settings.
4. Port every exercise interaction, audio/speech handling, and original sound effect.
5. Port tasks, league, profile, AI chat, Shorts, community, privacy/legal, and country access screens.
6. Compare screen captures and interaction behavior against the current app on iPhone and Android.
7. Only then remove the compatibility WebView and consider merging the Flutter app.
