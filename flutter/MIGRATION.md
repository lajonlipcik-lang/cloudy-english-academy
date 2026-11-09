# Cloudy English — Flutter migration

## Non-negotiable compatibility rule

Flutter must be a faithful port of the existing Cloudy English application. Do not redesign, simplify, remove, rename, reorder, or replace user-facing elements or behavior. The only allowed user-visible differences are verified improvements to performance, responsiveness, memory use, and animation smoothness.

## Source of truth

The current application remains authoritative until the Flutter version passes feature-by-feature parity checks. Keep all migration work on flutter-migration; do not change main as part of this migration.

## Current implementation map

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

## Migration sequence

1. Freeze and document existing state/data contracts; add parity tests before replacing behavior.
2. Port the exact curriculum and progress/XP rules to Dart and prove JSON compatibility.
3. Port authentication, Supabase persistence, guest-to-account merge, and conflict handling.
4. Port every lesson screen and exercise type, including audio, microphone, retries, and sound effects.
5. Port profile, achievements, daily goals, settings, AI chat, Shorts, and legal/access pages.
6. Compare every screen and interaction against the current application on iPhone and Android.
7. Optimize only after parity; never trade fidelity or features for speed.

## Acceptance gate

Do not replace the existing app, merge this branch into main, or call the Flutter version complete until all existing features and saved progress are verified against the current app. Demo-only screens and placeholder actions are not parity.
