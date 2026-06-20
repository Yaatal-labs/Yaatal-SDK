# API Endpoint Inventory / Inventaire Des Endpoints API

Branch: `yaatal/sdk-client-extraction`

## English

This inventory lists the Engine routes registered by
`crates/yaatal-api/src/app.rs` and the controller `routes()` functions. It is
broader than `API-SDK-CONTRACT.md`: that file tracks the SDK V1 surface, while
this file shows every currently registered HTTP route that contributors may
encounter.

Loco default routes are still present through `AppRoutes::with_default_routes()`;
the custom health route is listed below as `/health`.

### Coverage Key

- `SDK V1`: exposed by `@yaatal/client`.
- `Engine-only`: available over HTTP, not part of SDK V1.
- `External`: intended for provider/webhook callers, not app SDK callers.
- `Covered`: has request-test coverage in `crates/yaatal-api/tests/requests`.
- `Partial`: some paths in the controller are covered, but not every route.
- `Gap`: no focused request test found in the current request suite.

### Route Matrix

| Area | Method | Path | Auth | SDK | Request-test status |
|---|---|---|---|---|---|
| Health | `GET` | `/health` | public | Engine-only | Covered |
| Auth | `POST` | `/api/auth/register` | public | SDK V1 | Covered |
| Auth | `GET` | `/api/auth/verify/{token}` | public email link | Engine-only | Covered |
| Auth | `POST` | `/api/auth/login` | public | SDK V1 | Covered |
| Auth | `POST` | `/api/auth/forgot` | public | SDK V1 | Covered |
| Auth | `POST` | `/api/auth/reset` | public token | SDK V1 | Covered |
| Auth | `GET` | `/api/auth/current` | JWT | SDK V1 | Covered |
| Auth | `POST` | `/api/auth/magic-link` | public | SDK V1 | Covered |
| Auth | `GET` | `/api/auth/magic-link/{token}` | public token | SDK V1 | Covered |
| Auth | `POST` | `/api/auth/resend-verification-mail` | public email | SDK V1 | Covered |
| Analytics | `POST` | `/api/analytics/track` | JWT | SDK V1 | Covered |
| Analytics | `POST` | `/api/analytics/identify` | JWT | SDK V1 | Covered |
| Products | `POST` | `/api/products` | JWT merchant/profile | SDK V1 | Covered |
| Products | `GET` | `/api/products` | public | SDK V1 | Covered |
| Products | `GET` | `/api/products/{id}` | public | SDK V1 | Covered |
| Products | `PUT` | `/api/products/{id}` | JWT owner | SDK V1 | Covered |
| Products | `DELETE` | `/api/products/{id}` | JWT owner | SDK V1 | Covered |
| Products | `POST` | `/api/products/{id}/upvote` | public | SDK V1 | Covered |
| Orders | `POST` | `/api/orders` | JWT buyer | SDK V1 | Covered |
| Orders | `GET` | `/api/orders` | JWT buyer | SDK V1 | Covered |
| Orders | `GET` | `/api/orders/me` | JWT buyer | SDK V1 | Covered |
| Orders | `GET` | `/api/orders/{id}` | JWT buyer/seller | SDK V1 | Covered |
| Orders | `PATCH` | `/api/orders/{id}/status` | JWT seller | SDK V1 | Covered |
| Orders | `POST` | `/api/orders/{id}/cancel` | JWT buyer | SDK V1 | Covered |
| Deliveries | `POST` | `/api/deliveries` | JWT buyer/seller for order | SDK V1 | Covered |
| Deliveries | `GET` | `/api/deliveries` | JWT buyer/seller | SDK V1 | Covered |
| Deliveries | `GET` | `/api/deliveries/{id}` | JWT buyer/seller | SDK V1 | Covered |
| Deliveries | `PATCH` | `/api/deliveries/{id}/status` | JWT seller | SDK V1 | Covered |
| Deliveries | `POST` | `/api/deliveries/{id}/confirm` | JWT buyer | SDK V1 | Covered |
| BOBO checkout | `POST` | `/api/bobo/checkout` | JWT buyer | SDK V1 | Covered via delivery/security paths |
| BOBO checkout | `GET` | `/api/bobo/checkout/{order_id}/payment` | JWT buyer | SDK V1 | Covered |
| BOBO orders | `POST` | `/api/bobo/orders` | JWT buyer | SDK V1 | Covered for auth/SQLite boundary |
| BOBO orders | `GET` | `/api/bobo/orders` | JWT buyer | SDK V1 | Covered for auth/SQLite boundary |
| BOBO orders | `GET` | `/api/bobo/orders/{order_id}` | JWT buyer | SDK V1 | Covered for auth/SQLite boundary |
| BOBO orders | `GET` | `/api/bobo/orders/{order_id}/escrow` | JWT buyer | SDK V1 | Covered for auth/SQLite boundary |
| BOBO orders | `POST` | `/api/bobo/orders/{order_id}/confirm-delivery` | JWT buyer | SDK V1 | Covered for auth/SQLite boundary + delivery path |
| BOBO orders | `POST` | `/api/bobo/orders/{order_id}/dispute` | JWT buyer | SDK V1 | Covered for auth/SQLite boundary |
| BOBO orders | `POST` | `/api/bobo/orders/{order_id}/cancel` | JWT buyer | SDK V1 | Covered for auth/SQLite boundary |
| BOBO KYC | `POST` | `/api/bobo/kyc` | JWT | SDK V1 | Covered for auth/input/SQLite boundary |
| BOBO KYC | `GET` | `/api/bobo/kyc` | JWT | SDK V1 | Covered for auth/SQLite boundary |
| Search | `GET` | `/api/search/products` | public | SDK V1 | Covered |
| Search | `GET` | `/api/search/merchants` | public | SDK V1 | Covered |
| Search | `GET` | `/api/search/orders` | JWT buyer/seller | SDK V1 | Covered |
| Notifications | `GET` | `/api/notifications` | JWT recipient | SDK V1 | Covered |
| Notifications | `GET` | `/api/notifications/unread-count` | JWT recipient | SDK V1 | Covered |
| Notifications | `PATCH` | `/api/notifications/{id}/read` | JWT recipient | SDK V1 | Covered |
| Notifications | `PATCH` | `/api/notifications/read-all` | JWT recipient | SDK V1 | Covered |
| Payments | `POST` | `/api/payments/initiate` | JWT | Engine-only | Covered |
| Payments | `POST` | `/api/payments/wave/webhook` | HMAC signature | External | Covered |
| Payments | `GET` | `/api/payments/{provider_ref}/poll` | JWT | Engine-only | Covered |
| Merchant | `GET` | `/api/merchant/dashboard` | JWT merchant profile | Engine-only | Covered |
| Merchant | `GET` | `/api/merchant/products` | JWT merchant profile | Engine-only | Covered |
| Merchant | `GET` | `/api/merchant/orders` | JWT merchant profile | Engine-only | Covered |
| Feed | `GET` | `/api/feed` | JWT | Engine-only | Covered |
| Posts | `POST` | `/api/posts` | JWT author | Engine-only | Covered |
| Posts | `GET` | `/api/posts` | public | Engine-only | Covered |
| Posts | `GET` | `/api/posts/{id}` | public | Engine-only | Covered |
| Posts | `PUT` | `/api/posts/{id}` | JWT author | Engine-only | Covered |
| Posts | `DELETE` | `/api/posts/{id}` | JWT author | Engine-only | Covered |
| Comments | `POST` | `/api/posts/{post_id}/comments` | JWT author | Engine-only | Covered |
| Comments | `GET` | `/api/posts/{post_id}/comments` | public | Engine-only | Covered |
| Comments | `DELETE` | `/api/posts/{post_id}/comments/{id}` | JWT author | Engine-only | Covered |
| AI | `POST` | `/api/ai/chat` | JWT | Engine-only | Covered for auth boundary |
| Voice | `POST` | `/api/voice/transcribe` | public raw audio body | Engine-only | Covered for missing-provider boundary |
| Voice | `GET` | `/api/voice/session` | `token` query JWT for WebSocket upgrade | Engine-only | Covered for upgrade boundary |
| Offline | `POST` | `/api/offline/ussd` | provider/webhook surface | External | Covered |
| Offline | `POST` | `/api/offline/sms` | provider/webhook surface | External | Covered |
| Webhooks | `POST` | `/api/webhooks/n8n` | signature-gated | External | Covered for config/signature boundary |
| Webhooks | `GET` | `/api/webhooks/n8n` | public health | External | Covered |
| LiveKit | `POST` | `/api/livekit/token` | JWT | Engine-only | Covered for auth/config boundary |
| LiveKit | `POST` | `/api/livekit/webhook` | LiveKit signed Authorization | External | Covered for config boundary |

### Contributor Priority

For SDK V1 work, keep `API-SDK-CONTRACT.md` and
`scripts/contract-smoke.mjs` in sync.

For broader Engine testability, the remaining useful additions are:

1. BOBO Postgres lifecycle tests against a real Postgres fixture.
2. AI chat streaming tests with a mocked Ollama-compatible upstream.
3. LiveKit token and signed-webhook happy-path tests with deterministic test credentials.
4. Voice transcription tests with a mocked provider or local cascade seam.

## Francais

Cet inventaire liste les routes Engine enregistrees dans
`crates/yaatal-api/src/app.rs` et dans les fonctions `routes()` des
controleurs. Il est plus large que `API-SDK-CONTRACT.md`: ce dernier document
suit la surface SDK V1, tandis que celui-ci montre toutes les routes HTTP
actuellement declarees.

Les routes Loco par defaut restent presentes via
`AppRoutes::with_default_routes()`; la route sante custom est listee ci-dessus
comme `/health`.

### Lecture Des Statuts

- `SDK V1`: expose par `@yaatal/client`.
- `Engine-only`: disponible en HTTP, mais hors SDK V1.
- `External`: prevu pour un provider ou webhook, pas pour le SDK applicatif.
- `Covered`: couvert par les request tests dans `crates/yaatal-api/tests/requests`.
- `Partial`: quelques chemins du controleur sont couverts, mais pas toutes les routes.
- `Gap`: pas de request test cible trouve dans la suite actuelle.

### Priorite Contributeurs

Pour le travail SDK V1, garder `API-SDK-CONTRACT.md` et
`scripts/contract-smoke.mjs` synchronises.

Pour rendre tout Engine plus testable, les ajouts restants utiles sont:

1. Tests du cycle BOBO avec une fixture Postgres reelle.
2. Tests du streaming AI avec un upstream compatible Ollama mocke.
3. Tests happy path LiveKit token et webhook signe avec des credentials de test deterministes.
4. Tests de transcription voice avec un provider mocke ou une couture locale du cascade router.
