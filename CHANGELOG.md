# Changelog / Journal Des Changements

All notable SDK changes should be recorded here.

Les changements importants du SDK doivent etre notes ici.

## 0.2.0-beta.0 - Unreleased

Adds the Engine `main` routes apps and AI agents need next (reviewed against Engine merge #49,
2026-09-11), and a client for the Yaatal API. No existing call changed.

### Added

- `client.auth`: WhatsApp sign-in (`startWhatsApp`, `whatsappStatus`, `verifyWhatsApp`),
  bootstrap grants for embedded surfaces (`startBootstrap`, `redeemBootstrap`), `verifyEmail`.
- `client.ai`: Engine's AI gateway (`chat`, `chatSync`); Engine picks the model.
- `client.voice`: `transcribe` (raw audio body) and `sessionUrl` (WebSocket).
- `client.livekit`: `token` for live rooms.
- `createYaatalInference` / `client.inference`: the Yaatal API, OpenAI-compatible, billed in XOF:
  `models`, `chat`, `chatStream` (SSE, usage included), `balance`.
- Behavioural tests (`npm run test:unit`) against a fake fetch for every new call.

### Fixed

- Builds only read this package's own `@types`, so a stray global `@types/node` can no longer
  change what `src/cli.ts` compiles against.
- `scripts/pispi-smoke.mjs` imports `dist/` through a `file://` URL, so it also runs on Windows.

### Not yet covered

- Payments (`/api/payments/*`), the merchant dashboard, delivery drivers and preferences.
  Webhooks and SMS/USSD stay server-to-server and out of the SDK.

## 0.1.0-beta.0 - Unreleased

### Added

- Initial standalone `@yaatal/client` package.
- Typed clients for auth, products, orders, delivery, search, notifications,
  analytics, and BOBO commerce bridge APIs.
- Offline BCEAO PI-SPI interoperable payment-QR generation (`src/pispi.ts`,
  `yaatal pispi qr` CLI command) over BCEAO's official `@pi-spi/qrcode`
  package — no Engine call required.
- `"pispi"` as a BOBO checkout payment method, with an optional `pispi_alias`
  (the buyer's 36-character PI-SPI payment address). The alias selects the flow:
  omit it for the QR flow (the merchant presents a dynamic QR, the buyer scans),
  supply it to have the Engine send a request-to-pay addressed to that buyer.
- Package smoke tests for contract shape and installability.
- Bilingual GitHub onboarding, UI integration, sandbox, and contribution docs.

### Notes

- V1 targets one configured Engine instance.
- The SDK does not expose `client.ai`.
- The SDK is published to npm/GitHub; it is not deployed as a Railway service.
