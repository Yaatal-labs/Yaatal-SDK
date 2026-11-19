# Changelog / Journal Des Changements

All notable SDK changes should be recorded here.

Les changements importants du SDK doivent etre notes ici.

## 0.4.0-beta.1 - Unreleased

### Added / Ajouts

- `@yaatal-labs/client/calls`: Bocalines (our calling system) with `X-API-Key` auth: `listAgents`, `getAgent`,
  `listRuns`, `getRun`, `startTextChat`, `sendTextMessage`, `startPhoneCall`.
  Bocalines (notre système d'appels), authentifié par `X-API-Key`.
- `@yaatal-labs/client/boards`: the Gloop voice Worker's `order`, `board`, `setStatus` (forward-only, optional staff PIN)
  and `ingest`; demo key, ingest key and extra headers are options.
  Commandes, tableau, changement de statut (en avant seulement) et ingestion du Worker vocal Gloop.
- `@yaatal-labs/client/business`: read-only business profiles: `profile`, `facts`, `precall`. Edits stay operator-side.
  Profils d'entreprise en lecture seule.
- Not added: a speech module. The Kairmel gateway (Yaatal-OS `apps/token-gateway`) has no audio routes yet, so there is
  nothing to wrap.
  Pas de module voix : la passerelle Kairmel n'a pas encore de routes audio.

## 0.3.0-beta.1 - 2026-11-18

### Changed / Changements

- The npm package is now `@yaatal-labs/client` (the `@yaatal` scope is not reachable). `0.2.0-beta.1` was never published.
  Le package npm s'appelle maintenant `@yaatal-labs/client`. `0.2.0-beta.1` n'a jamais été publié.

### Added / Ajouts

- Subpath entry points so an app imports only what it uses: `@yaatal-labs/client/inference`, `/live-sessions`, `/auth`,
  `/commerce`, `/delivery`, `/products`, `/merchant`, `/types`.
  Points d'entrée par module : une app importe seulement ce qu'elle utilise.
- Release workflow: pushing a `v*` tag builds the package on GitHub and attaches the `.tgz` to a GitHub release (no npm
  token needed). Apps install it from the release URL.
  Publication : un tag `v*` construit le paquet sur GitHub et joint le `.tgz` à une release.

- Merchant workspace: `client.merchant.dashboard`, `products` and `orders`, with pagination.
  Espace marchand : tableau de bord et listes paginées de produits et commandes.
- `client.commerce.setPayoutDestination` for the seller's payout mobile number.
  Destination de versement du vendeur via son numéro mobile.
- Live selling: start/end, product pins, public viewer projection, keyword lookup and egress.
  Vente en direct : démarrage/fin, produits épinglés, vue publique, mots-clés et multistream.
- Anonymous LiveKit `viewerToken`; broadcast token requests accept `live_session_id` without `room`.
  Jetons LiveKit anonymes ; demandes broadcast avec `live_session_id`, sans `room`.
- Route smoke coverage and offline mocked checks for the new merchant and live calls.
  Vérifications des routes et tests simulés hors ligne des appels marchands et directs.

### Fixed / Corrections

- Commerce delivery updates accept `shipped` for paid online orders; KYC exposes `payout_mobile`.
  Les livraisons en ligne acceptent `shipped` ; le KYC expose `payout_mobile`.

### Notes

- Egress service schemas are absent from the reference: JSON input pass-through and `unknown` responses.
  Schémas egress absents de la référence : entrée JSON transmise telle quelle et réponses `unknown`.

### Deprecated / Dépréciations

- Engine `VoiceClient` and its methods are scheduled for retirement; app voice uses its own talker.
  `VoiceClient` et ses méthodes vont être retirés ; les apps utilisent leur propre talker.

## 0.2.0-beta.0 - Unreleased

Adds the Engine `main` routes apps and AI agents need next (reviewed against Engine merge #49,
2026-09-11), and a client for the Kairmel API. No existing call changed.

### Added

- `client.auth`: WhatsApp sign-in (`startWhatsApp`, `whatsappStatus`, `verifyWhatsApp`),
  bootstrap grants for embedded surfaces (`startBootstrap`, `redeemBootstrap`), `verifyEmail`.
- `client.ai`: Engine's AI gateway (`chat`, `chatSync`); Engine picks the model.
- `client.voice`: `transcribe` (raw audio body) and `sessionUrl` (WebSocket).
- `client.livekit`: `token` for live rooms.
- `createKairmelClient` / `client.inference`: the Kairmel API, OpenAI-compatible, billed in XOF:
  `models`, `chat`, `chatStream` (SSE, usage included), `balance`.
- Behavioural tests (`npm run test:unit`) against a fake fetch for every new call.
- `client.commerce` (`putOnAir`, `listOnAir`, `takeOffAir`, `conversions`, `deliveries`,
  `updateDelivery`) and `client.sheet` (`get`, `checkout`, never sends a bearer token): the
  Commerce Sheet, with request and response types mirrored from the Engine's Rust structs. All
  amounts are whole FCFA integers (`*_fcfa`).
- `@yaatal/client/server`, a server-only subpath export: `partnerAuth` (`start`, `status`,
  `verify`; header `X-Engine-Auth-Secret`) and `kairmelAdmin` (`upsertAccountByPid`, `createKey`).
  The main entry never imports it; a test walks the main bundle's import graph to prove it.
- `test/engine-routes.test.mjs`: diffs every Engine route the SDK calls against the routes in an
  Engine checkout (`ENGINE_CONTROLLERS_DIR`; skipped when unset).
- `RequestOptions.auth: false` sends a request with no Authorization header.

### Deprecated

- `client.bobo`, `client.orders` and `client.search.orders` retire with the Sheet. Use
  `client.commerce` and `client.sheet`. They still work in this release.

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
  package; no Engine call required.
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
