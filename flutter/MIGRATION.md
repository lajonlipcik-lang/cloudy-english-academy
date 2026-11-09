# Cloudy English — Flutter migration

## Non-negotiable compatibility rule

Flutter must be a faithful port of the existing Cloudy English application. Do not redesign, simplify, remove, rename, reorder, or replace user-facing elements or behavior. The only allowed user-visible differences are verified improvements to performance, responsiveness, memory use, and animation smoothness.

## Source of truth

The current application remains authoritative until the Flutter version passes feature-by-feature parity checks. Keep all migration work on flutter-migration; do not change main as part of this migration.

## Current source map

- Visual shell and markup: src/server-assets/cloudy-english.html
- Main visual styles: src/server-assets/cloudy-english.css
- UI theme, settings drawer, transitions: src/server-assets/cloudy-ui.css and src/server-assets/cloudy-ui.js
- Main app behavior, auth bridge messages, local/cloud progress sync: src/server-assets/cloudy-english-app.js
- Lesson exercises and voice recognition: src/server-assets/cloudy-exercises.js
- Lesson catalog: src/server-assets/cloudy-catalog.js and src/lib/cloudy/data.ts
- Speech matching: src/server-assets/cloudy-speech.js
- Learning intelligence and evidence: src/server-assets/cloudy-learning.js
- Supabase session/progress/AI bridge: src/features/cloudy-app/useCloudyAppBridge.ts
- Typed progress rules: src/lib/cloudy/types.ts, src/lib/cloudy/logic.ts and src/lib/cloudy/progress-policy.ts

## Current Flutter implementation

- flutter/lib/main.dart: WebView compatibility shell; the existing web application is still the runtime UI.
- flutter/assets/cloudy_catalog.json and flutter/lib/domain/cloudy_catalog.dart: complete 60-lesson curriculum, level sections, and 27 grammar foundations.
- flutter/lib/domain/cloudy_exercise.dart: typed JSON-compatible models for all eight exercise/study card types.
- flutter/lib/domain/cloudy_state.dart: persisted progress/settings model using the current cl2 JSON keys.
- flutter/lib/data/cloudy_progress_store.dart: guest and account-scoped local progress persistence, compatible key selection, safe guest merge, and explicit post-sync cleanup.
- flutter/lib/domain/cloudy_logic.dart: lesson stages, exercise generation, guided grammar tasks, answer/retry rules, XP/streaks, achievements, daily chest, guest/account merge, and progress sanitization.
- flutter/lib/domain/cloudy_learning_store.dart: local adaptive mastery, spaced-review prioritization, session tracking, and offline event outbox.
- flutter/test/: parity-focused tests for progress, catalog loading, exercise serialization, learning persistence, guest/account progress merge, and exercise generation.
- .github/workflows/flutter-ci.yml: Flutter dependency, analyzer, and test workflow for the migration branch.

These are migration foundations, not evidence that the native app is complete or that all tests have passed. The native screen layer, native authentication, media integrations, backend event synchronization, and full parity validation remain outstanding.

## Quality gates

1. Keep the original web application unchanged.
2. Verify each Dart data contract against its TypeScript and browser-runtime source.
3. Run formatting, flutter analyze, and flutter test for every logic change.
4. Port one feature area at a time and retain the original behavior.
5. Compare screenshots and interaction flows on iPhone and Android.
6. Do not remove the WebView compatibility shell until every feature has a native equivalent and the parity checklist passes.
7. Do not merge flutter-migration into main before the full acceptance gate passes.

## Acceptance gate

No feature may be marked complete based only on a placeholder, static mock, or successful compilation. Completion requires functional parity, saved-progress compatibility, and device verification.
