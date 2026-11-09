# Neon schema and independent authentication plan

Status: design preparation only. No target database has been provisioned and no source records have been exported or changed.

## Recommended target

Use Neon PostgreSQL for application data and Better Auth for independent identity/session management, deployed through the TanStack Start server on Vercel. This is a recommended implementation direction, not a claim that Better Auth has already been installed or configured.

Better Auth officially supports PostgreSQL and UUID ID generation. Its password API supports custom hash and verify functions. The default password hash is scrypt; Supabase Auth commonly stores bcrypt hashes. Therefore a migration can potentially preserve existing password hashes only if the source hash format is confirmed and a bcrypt verifier is implemented and tested. New passwords should use the target's selected modern hash. Never copy hashes into logs, Git, ordinary reports, or client responses.

## Identity compatibility rules

1. Preserve each source Auth user UUID as the target Better Auth user ID wherever possible. Application tables use UUID user references extensively.
2. Create the Better Auth user/account records with those exact IDs; do not generate replacement IDs during bulk import.
3. Import email, verified state, display name, and timestamps only after a source export has been verified and normalized.
4. Import password hashes only after confirming the exact GoTrue/Supabase hash format and verifying test accounts in an isolated staging database. Use a custom verifier for legacy hashes and rehash on successful login if the selected Better Auth lifecycle permits it. If that cannot be proven, use a secure password-reset/account-claim flow; do not promise password preservation.
5. Do not migrate Supabase refresh tokens or active sessions. Sessions are provider-specific. Users will need fresh target sessions after cutover.
6. Keep source UUIDs stable in all progress, profile, XP, learning-event, chat, community, moderation, and Shorts records.
7. For deleted, banned, unconfirmed, or provider-linked accounts, preserve source status and provider metadata where appropriate; do not silently reactivate accounts or fabricate OAuth credentials.

## PostgreSQL schema adaptation

The source migrations are not directly executable on Neon because they assume Supabase-managed schemas, roles, and functions. Adapt them in explicit phases:

- Create the independent auth schema/tables with Better Auth's generated schema and a reviewed UUID-compatible configuration.
- Replace references to `auth.users(id)` with the target auth user table's UUID key and preserve `ON DELETE CASCADE` behavior only where the source schema specifies it.
- Replace `auth.uid()` and `auth.jwt()` usage with server-verified identity. Do not emulate these functions using untrusted client-set session variables.
- Remove Supabase-only grants and roles (`anon`, `authenticated`, `service_role`) from Neon migrations. Use separate least-privilege database roles and enforce user ownership in authenticated server functions. Keep privileged database credentials server-only.
- Convert Supabase RLS policies into explicit server-side authorization checks before any browser-to-database path is enabled. RLS may be retained only if the target's identity context is securely established and tested.
- Review every SECURITY DEFINER function: set a fixed safe search_path, revoke default PUBLIC execution, grant only to the intended server role, and validate the caller/owner inside the function.
- Preserve all indexes, unique constraints, check constraints, foreign keys, triggers, and transaction semantics. Do not reduce this to a table-only copy.
- Replace Supabase Storage bucket SQL with Vercel Blob upload/read/delete routes. Blob keys remain private; every read/download must check the owning user or publication visibility against Neon records.
- Use a filename-based migration ledger with a unique full migration name. The two Content migrations named 0009 must both run exactly once; ordering must be explicit and stable.

## Source-to-target domain map

| Source domain | Target treatment |
|---|---|
| auth.users | Better Auth user + credential account; preserve UUID |
| auth.identities | Better Auth account/provider links; migrate only verified provider data |
| auth.sessions / refresh tokens | Do not import; issue new sessions |
| profiles | Preserve profile rows and user UUID references |
| user_progress / XP / awards | Preserve rows, unique constraints, XP RPC invariants and progress sync semantics |
| learner profile, learning journal/events | Preserve records and ordering/indexes |
| AI provider secrets | Do not copy ciphertext blindly; provision new provider secrets in Vercel environment/secret store and re-enter credentials |
| AI request quotas/leases | Preserve concurrency-safe acquisition/release behavior |
| chat threads | Preserve user/thread composite key and JSON message validation |
| community / reports / rate limits | Preserve constraints, triggers and moderation authorization |
| Shorts videos/comments/follows/saved/likes | Preserve relations and moderation state; migrate media objects separately |
| Supabase Storage objects | Copy to private Blob and verify every object against source metadata |
| Supabase Edge Functions / server RPCs | Reimplement as Vercel server functions or tested PostgreSQL functions |

## Required parity checks before cutover

- User counts by status and provider; exact UUID set comparison.
- Profiles, progress, XP totals, awards, learner records, journal events and chat thread counts.
- All Core and Content table row counts, plus per-table checksums or deterministic primary-key sampling.
- Foreign-key orphan checks and duplicate/unique-key checks.
- Function, trigger, index, constraint and grant inventory compared against the reviewed target.
- RLS-to-server-authorization test matrix for owner, other user, anonymous request, and privileged server request.
- Storage object count, byte size, MIME type, checksum, private-read behavior, upload ownership and deletion behavior.
- Auth staging tests for existing password, password reset, email verification, banned/deleted users, and session revocation.

## Current hard blockers

- Lovable's database query action is still rate-limited (46-minute cooldown at the latest attempt). The latest attempt was rejected before execution; no source query or write occurred.
- No Neon project/credentials or Vercel Blob store is connected to this workflow. Provisioning and secret entry require user account access.
- No complete source database dump, Auth export, or Storage archive exists yet.
- The source Content database topology is unresolved. Repository documentation conflicts on whether Content is co-located or a separate Supabase project.
- Password-preserving migration is conditional on verified access to password hashes and a successful isolated Better Auth compatibility test.

## Safety

Do not apply these source migrations directly to Neon. Do not run a production data import until there is a restorable source backup, a provisioned staging target, a reviewed schema conversion, and an explicit rollback plan. Keep Lovable/Supabase online until end-to-end parity and user login tests pass.
