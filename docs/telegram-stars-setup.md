# Telegram Stars integration

This document describes the provider integration only. Subscription names, paid plan names, prices, and entitlements are intentionally not configured here.

## Runtime secrets

Configure these as server-side environment variables only (never in Flutter or browser code):

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (or the existing `SUPABASE_SERVICE_ROLE_KEY`)
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET` (1–256 characters; use only letters, digits, underscores, and hyphens)
- `TELEGRAM_BOT_USERNAME=cloudysupport_t_bot`

Do not commit bot tokens or Supabase secret/service-role keys.

## Database

Apply the Drizzle migrations in order, including:

- `0020_cloudy_subscriptions.sql`
- `0021_telegram_stars_payments.sql`

The migration adds one-time account-link tokens, Telegram account ownership, payment orders, and atomic/idempotent payment fulfillment. Authenticated users can read only their own Telegram link and payment orders. Only server-side service credentials can create links, orders, or activate subscriptions.

## Payment flow

1. An authenticated Cloudy account requests a short-lived Telegram deep link from `POST /api/telegram/stars` with `{ "action": "create-link" }`.
2. The user opens the link and starts the existing bot. The webhook consumes the one-time token and binds that Telegram account to the Cloudy user.
3. Once a paid plan is configured, the app requests an invoice with `{ "action": "create-invoice", "planCode": "<configured-plan-code>" }`.
4. The server sends a Telegram Stars invoice in `XTR`, with the 30-day recurring subscription period.
5. The bot update handler validates `pre_checkout_query` against the server-created order and activates access only after a verified `successful_payment`.
6. Renewal, cancellation, failure, and refund updates are reflected in the subscription tables. The app reads access from `my_subscription_access`.

Telegram Stars invoice creation requires a configured active monthly plan with currency `XTR`, an integer price from 1 to 10,000 Stars, and a display title of at most 32 characters. No paid plan is seeded by this integration.

## Existing support bot: do not replace its webhook blindly

Telegram supports either long polling or one webhook receiver for a bot; setting a new webhook replaces the receiver. The new endpoint `POST /api/telegram/stars-webhook` handles account-link and Stars payment updates only. It must be integrated into the existing support bot's current update handler (or the current handler must safely forward all Telegram updates to it) before changing the bot webhook URL. This protects existing support commands and message routing. The current bot receiver must also subscribe to the Telegram update types `message`, `pre_checkout_query`, and `subscription` (plus any update types already used by support). Do not narrow `allowed_updates` in a way that drops existing support events.

The endpoint checks Telegram's `X-Telegram-Bot-Api-Secret-Token` header against `TELEGRAM_WEBHOOK_SECRET`.

## Current activation blockers

- Confirm the Supabase project ID before applying migrations. The repository's `supabase/config.toml` project ID and the currently connected Supabase project do not match.
- Identify the existing support bot's current webhook/long-polling host and integrate the Stars handler without interrupting support.
- Configure server secrets.
- Add the paid plan name, price in Stars, and entitlements only after they are decided.
- Test using Telegram's Stars test environment before production payments.
