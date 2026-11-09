# Cloudy English — Flutter migration

## Exact-copy rule

This project must remain a faithful copy of the current Cloudy English app. Do not change its layout, colors, typography, illustrations, animations, sound effects, lesson content, progression rules, account behavior, AI behavior, profile, or Shorts/community features. The only permitted user-visible differences are verified performance, responsiveness, memory, and animation-smoothness improvements.

The old app remains the source of truth until every screen and interaction has passed parity checks on iPhone and Android. Do not merge flutter-migration into main before that gate.

## Current transition strategy

The Flutter entry point currently uses a WebView compatibility shell that loads the existing Cloudy web application unchanged. This preserves the existing UI and behavior while native Dart modules are ported and tested. It is not yet the completed native Flutter migration.

The query parameter cloudyNative=1 suppresses only the existing iOS Add to Home Screen gate inside the Flutter shell. Normal browser/PWA visits do not include this parameter and keep their existing behavior.

## Current implementation status

- Flutter package and iOS/Android plugin dependencies are declared in pubspec.yaml.
- The current 60-lesson bilingual catalog is copied into assets/cloudy_catalog.json.
- Cloudy progress serialization and settings are represented in lib/domain/cloudy_state.dart.
- The lesson/progress rules are being ported in lib/domain/cloudy_logic.dart, with parity-focused tests under test/.
- The existing application remains loaded by the WebView shell in lib/main.dart.
- Native authentication, native screens, audio/microphone integration, and full visual parity are not complete.

## Validation

The repository has a dedicated GitHub Actions workflow for flutter-migration. It resolves Flutter dependencies, formats Dart files, runs flutter analyze, and runs flutter test. A successful workflow is required before treating a migration step as verified.

The local editing environment does not currently have the Flutter SDK, so no local flutter analyze or flutter test result is claimed.

## Setup

Generate platform runner projects once from this directory if they are not already present:

```sh
cd flutter
flutter create --platforms=android,ios .
flutter pub get
```

Run against a preview deployment of the flutter-migration branch:

```sh
flutter run --dart-define=CLOUDY_API_BASE_URL=https://YOUR-CLOUDY-HOST
```

CLOUDY_API_BASE_URL must point to the Cloudy host that contains the cloudyNative install-guide bypass and the authenticated mobile API route. Do not point the Flutter shell at an unrelated or stale deployment.

Never put a Supabase service-role or secret key in the Flutter app.

## Migration sequence

1. Freeze and document the current data contracts and progression policy.
2. Port the exact lesson catalog and prove catalog parity.
3. Port progress normalization, exercise generation, lesson grading, XP/streaks, achievements, daily goals, and guest/account merge; run parity tests.
4. Port authentication, Supabase persistence, conflict handling, and server event synchronization.
5. Port every screen and interaction, including profile, settings, AI chat, Shorts, legal/access pages, audio, microphone, retries, and original sound effects.
6. Compare every screen and interaction against the current application on iPhone and Android.
7. Optimize only after parity; never trade fidelity or features for speed.

## Acceptance gate

Do not replace the compatibility shell, merge this branch into main, or call the Flutter version complete until all existing features and saved progress are verified against the current app. Demo-only screens and placeholder actions are not parity.
