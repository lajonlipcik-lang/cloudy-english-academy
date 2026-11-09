# Cloudy English — Flutter migration

## Exact-copy rule

This project must remain a faithful copy of the current Cloudy English app. Do not change its layout, colors, typography, illustrations, animations, sound effects, lesson content, progression rules, account behavior, AI behavior, profile, or Shorts/community features. The only permitted user-visible differences are verified performance, responsiveness, memory, and animation-smoothness improvements.

The old app remains the source of truth until every screen and interaction has passed parity checks on iPhone and Android. Do not merge flutter-migration into main before that gate.

## Current transition strategy

The Flutter entry point currently uses a WebView compatibility shell that loads the existing Cloudy web application unchanged. This preserves the existing UI and behavior while native Dart modules are ported and tested. It is not yet the completed native Flutter migration.

The query parameter cloudyNative=1 suppresses only the existing iOS Add to Home Screen gate inside the Flutter shell. Normal browser/PWA visits do not include this parameter and keep their existing behavior.

## Current implementation status

- The current 60-lesson bilingual catalog is copied into assets/cloudy_catalog.json and parsed by lib/domain/cloudy_catalog.dart.
- lib/domain/cloudy_exercise.dart models all eight current browser exercise/study card types and preserves their JSON contracts.
- lib/domain/cloudy_exercise_builder.dart ports lesson exercise generation, the grammar introduction/vocabulary/guided/recall/practice sequence, and answer validation.
- lib/domain/cloudy_progress_engine.dart ports progress normalization, XP/streaks, achievements, review behavior, server XP application, and conflict-safe three-way progress merging.
- lib/domain/cloudy_learning_store.dart preserves adaptive mastery, spaced-review ordering, active sessions, and an offline event outbox in the existing learning-intelligence storage namespace.
- lib/progress/cloudy_local_progress_store.dart preserves the existing cl2 guest/account keys, dirty/synced markers, and account activation rules.
- lib/data/cloudy_auth_repository.dart ports password sign-in/sign-up, password reset, auth-session observation, and the existing 13+ profile-age rules using only the public Supabase publishable key. It is not yet connected to replacement native screens.
- lib/data/cloudy_mobile_api.dart calls the authenticated /api/cloudy/mobile endpoint for progress load/save, server-authoritative lesson XP, and learning-event sync.
- lib/services/cloudy_progress_sync_service.dart coordinates account activation, guest migration, optimistic-concurrency conflict retries, server XP awards, and learning-event acknowledgements.
- src/routes/api/cloudy/mobile.ts now supports authenticated progress loading in addition to its existing save, XP-award, and learning-event actions.
- Tests cover the catalog, all exercise types, progress rules, local persistence, auth policy, adaptive learning, mobile API contracts, and account synchronization.
- The existing application remains loaded by the WebView shell in lib/main.dart. These Dart modules are migration foundations and are not yet wired into replacement native screens.
- Native screen navigation, visual parity, native audio/microphone behavior, and full device verification are not complete.

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

The native auth adapter reads the public Supabase project URL and publishable key from build-time values. Never put a Supabase service-role or secret key in the Flutter app.

## Migration sequence

1. Verify the exact lesson catalog, all eight exercise types, and every exercise-generation rule.
2. Connect the native auth/session lifecycle to the existing Supabase account behavior.
3. Connect native screens to the local progress store and authenticated mobile API.
4. Port every screen and interaction, including profile, settings, AI chat, Shorts, legal/access pages, audio, microphone, retries, and original sound effects.
5. Compare every screen and interaction against the current application on iPhone and Android.
6. Optimize only after parity; never trade fidelity or features for speed.

## Acceptance gate

Do not replace the compatibility shell, merge this branch into main, or call the Flutter version complete until all existing features and saved progress are verified against the current app. Demo-only screens and placeholder actions are not parity.
