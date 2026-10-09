# @yaatal/client

Typed TypeScript client for Yaatal Engine.

Client TypeScript typé pour Yaatal Engine.

[English](#english) | [Français](#francais)

## English

`@yaatal/client` is the frontend and integration client for Yaatal Engine. It
does not run a server and it does not own business state. Install it in BOBO or
another app, point it at an Engine URL, then call typed methods instead of
hand-writing `fetch` calls.

```text
BOBO or another UI
  -> @yaatal/client
  -> Yaatal Engine HTTP API
  -> Engine database and business rules
```

Engine remains the source of truth for auth, products, orders, delivery,
notifications, analytics, and BOBO commerce. The SDK handles request URLs,
query strings, JSON bodies, bearer auth, typed responses, and API errors.

### Current Scope

V1 is a client for one configured Engine instance. It is ready for local
development, BOBO integration, and a controlled staging sandbox. It is not yet a
public multitenant hosted-platform SDK.

The package exposes:

| Namespace | Use |
|---|---|
| `client.auth` | login, registration, WhatsApp sign-in, bootstrap grants, session/user helpers |
| `client.products` | product CRUD/listing backed by Engine |
| `client.orders` | generic Engine order APIs (deprecated, retires with the Sheet) |
| `client.delivery` | generic delivery lifecycle APIs |
| `client.search` | SQL-backed product, merchant, and order search (`search.orders` is deprecated) |
| `client.notifications` | in-app notification records |
| `client.analytics` | authenticated `track` and `identify` |
| `client.bobo` | BOBO checkout, orders, escrow, and KYC bridge helpers (deprecated, retires with the Sheet) |
| `client.commerce` | Commerce Sheet, seller side: put a product on air, links, conversions, pay-on-delivery orders |
| `client.sheet` | Commerce Sheet, buyer side (no sign-in): read a link's sheet and check out |
| `client.harness` | Yaatal Harness L1 proposal review (list/approve/reject) |
| `client.social` | inbound social-channel events (WhatsApp, Telegram, ...) |
| `client.ai` | Engine's AI gateway: Engine picks the tier and model |
| `client.voice` | audio transcription and live voice session URLs |
| `client.livekit` | tokens for live audio/video rooms |
| `client.inference` | the Kairmel API, OpenAI-compatible and billed in XOF (FCFA), when configured |

Apps can still bring their own AI service; see
[BYO AI Integration](docs/BYO-AI-INTEGRATION.md).

### WhatsApp Sign-In

The person starts the WhatsApp conversation, so no WhatsApp template is needed.

```ts
const attempt = await client.auth.startWhatsApp();
window.open(attempt.whatsapp_url); // they send the prefilled message from their own WhatsApp
// Poll until Engine has replied on WhatsApp with a 6-digit code:
while (!(await client.auth.whatsappStatus(attempt.nonce)).code_sent) {
  await new Promise(resolve => setTimeout(resolve, 2000));
}
await client.auth.verifyWhatsApp({ nonce: attempt.nonce, code: typedCode }); // token kept on the client
```

### Commerce Sheet

A seller puts a product on air and gets one link per channel. A buyer opens the link with no
account and checks out. All money is whole FCFA (XOF) integers (`*_fcfa`).

```ts
// Seller (signed in)
const link = await client.commerce.putOnAir({ product_id, delivery_fee_fcfa: 1500 });
await client.commerce.conversions({ live_session_id });
await client.commerce.updateDelivery(receiptId, { status: "delivered" });
const money = await client.commerce.money();  // in_escrow, balance, paid_out, refunded, kyc_status
await client.commerce.submitKyc("CNI 1 234 5678 90123"); // a reference, never the document; gates payouts

// Buyer (anonymous: `client.sheet` never sends a bearer token)
const sheet = await client.sheet.get(token);
const receipt = await client.sheet.checkout(token, {
  provider: "cash_on_delivery",
  idempotency_key: crypto.randomUUID(),
  contact: { name: "Awa", phone: "221770000000", area: "Medina" },
});
// Paid online: send the buyer to receipt.payment.launch_url (Wave's page, or the sandbox's).
// Back on your page, read it back with the proof the buyer holds (payment ref or idempotency key):
const back = await client.sheet.receipt(token, receipt.receipt_id, { tx: receipt.payment!.tx_id });
await client.sheet.confirm(token, receipt.receipt_id, { tx: receipt.payment!.tx_id }); // releases escrow
// or: await client.sheet.dispute(token, receiptId, proof, "Pas reçu");

// Kairmel API credit, bought as the signed-in user, paid on the Sheet:
await client.commerce.buyTokenPack(packToken, { provider: "wave", idempotency_key: crypto.randomUUID() });
```

### Server-only helpers (`@yaatal/client/server`)

Holds secrets, so it is a separate entry that the main `@yaatal/client` never imports. Use it on a
backend only.

```ts
import { partnerAuth, kairmelAdmin } from "@yaatal/client/server";

// WhatsApp sign-in for a partner platform: needs ENGINE_AUTH_SECRET (and YAATAL_ENGINE_API_URL).
const { id, whatsapp_url } = await partnerAuth.start();
await partnerAuth.status(id);                 // { status: "pending" | "code_sent" | "expired" }
const { pid } = await partnerAuth.verify(id, code);

// Act for that user (sell, read sales) with a 15-minute Engine session: needs this partner's
// own secret, i.e. its line in the Engine's ENGINE_PARTNER_SECRETS (the shared legacy secret
// is refused). The user becomes a merchant if they weren't one.
const seller = await partnerAuth.asUser(pid);
await seller.commerce.putOnAir({ product_id });

// Kairmel account keyed by that Engine pid: needs KAIRMEL_ADMIN_TOKEN (and KAIRMEL_API_URL).
const account = await kairmelAdmin.upsertAccountByPid(pid, { name: "Awa Diop" });
const { api_key } = await kairmelAdmin.createKey(account.id, "default");
```

`createPartnerAuth(options)` and `createKairmelAdmin(options)` take the same values explicitly.

### Kairmel API (AI billed in FCFA)

One OpenAI-compatible endpoint for every model Kairmel sells, billed per token from a prepaid
balance in XOF. It has its own address (`https://api.kairmel.com`, the client's default) and its own
`yk_...` keys, separate from Engine sessions. Keep the key server-side.

```ts
import { createKairmelClient } from "@yaatal/client";

const api = createKairmelClient({ apiKey: process.env.KAIRMEL_API_KEY }); // baseUrl or KAIRMEL_API_URL to point elsewhere

const models = await api.models(); // public: ids and XOF prices per million tokens
const reply = await api.chat({ model: models[0].id, messages: [{ role: "user", content: "Salaam" }] });

for await (const chunk of api.chatStream({ model: models[0].id, messages })) {
  process.stdout.write(chunk.choices[0]?.delta.content ?? "");
}

const { balance_xof } = await api.balance();
```

Any OpenAI SDK also works: set its base URL to `https://api.kairmel.com/v1` and use a Kairmel key.

Separately, `createStaticMerchantQr` / `createDynamicMerchantQr` /
`validatePiSpiQrPayload` (`src/pispi.ts`) are plain, offline functions — not
an Engine-backed `client.*` namespace — for generating BCEAO PI-SPI
interoperable payment-QR payloads locally. See [CLI](#cli) below for the
`yaatal pispi qr` command.

### Install

After npm publication:

```bash
npm install @yaatal/client@beta
```

Before npm publication, or when testing directly from GitHub:

```bash
npm install github:Yaatal-labs/Yaatal-SDK#main
```

For local SDK development:

```bash
npm ci
npm run build
```

### Configure Engine URL

For Expo, React Native, or browser builds:

```bash
EXPO_PUBLIC_ENGINE_API_URL=https://your-engine-staging-url
```

For Node/server-side usage:

```bash
YAATAL_ENGINE_API_URL=https://your-engine-staging-url
```

You can also pass the URL directly:

```ts
import { createYaatalClient } from "@yaatal/client";

const client = createYaatalClient({
  baseUrl: "http://localhost:5150",
});
```

If no URL is configured, the SDK defaults to `http://localhost:5150`.

### Auth

```ts
const session = await client.auth.login({
  email: "buyer@example.com",
  password: "secret",
});

client.setToken(session.token);
```

If the app already has an Engine JWT:

```ts
const client = createYaatalClient({
  baseUrl: process.env.EXPO_PUBLIC_ENGINE_API_URL,
  token,
});
```

Authenticated SDK calls attach:

```text
Authorization: Bearer <jwt>
```

### UI Integration Shape

Do not scatter SDK calls through every screen. Put the client behind a small app
service or hook layer:

```text
BOBO screen
  -> BOBO hook/service
  -> @yaatal/client
  -> Engine
```

Example:

```ts
import { createYaatalClient } from "@yaatal/client";

export function makeYaatalClient(token?: string) {
  return createYaatalClient({
    baseUrl: process.env.EXPO_PUBLIC_ENGINE_API_URL,
    token,
  });
}
```

Then BOBO code can call domain helpers:

```ts
export async function confirmOrderDelivery(orderId: number, token: string) {
  return makeYaatalClient(token).bobo.confirmDelivery(orderId);
}
```

For a fuller app migration path, read
[UI Integration Guide](docs/UI-INTEGRATION.md).

### Common Calls

```ts
const products = await client.search.products({ q: "rice", limit: 20 });
const orders = await client.bobo.listOrders({ limit: 25 });

const checkout = await client.bobo.checkout({
  items: [{ product_id: "product-id", quantity: 1 }],
  payment_method: "wave",
  delivery_method: "bobo_managed",
  shipping_address: "Dakar",
  phone_number: "+221770000000",
  idempotency_key: crypto.randomUUID(),
});

await client.bobo.confirmDelivery(checkout.order.bobo_order_id);
```

PI-SPI has two flows. Omit `pispi_alias` for the **QR** flow — the merchant
presents a dynamic QR (the top-level `createDynamicMerchantQr`) carrying the order
reference, the buyer scans it, and the Engine settles by polling. Supply the
buyer's 36-character payment address to send a **request-to-pay** instead:

```ts
// QR: nothing to collect from the buyer.
const checkout = await client.bobo.checkout({
  items: [{ product_id: "product-id", quantity: 1 }],
  payment_method: "pispi",
  delivery_method: "bobo_managed",
  idempotency_key: crypto.randomUUID(),
});

// RTP: addressed to a payment address the buyer already gave you.
await client.bobo.checkout({
  items: [{ product_id: "product-id", quantity: 1 }],
  payment_method: "pispi",
  pispi_alias: "9b1b2499-3e50-435b-b757-ac7a83d8aa8c",
  idempotency_key: crypto.randomUUID(),
});
```

### CLI

The package also ships a `yaatal` kernel CLI — a small, agent-first command
surface over the same client, for driving Engine from a terminal or from an
agent's tool loop instead of hand-writing `fetch`/`curl` calls.

```bash
npm run build   # produces dist/cli.js
npx yaatal --help
```

Configure it with environment variables (no CLI flags for these):

```bash
export YAATAL_ENGINE_URL=http://localhost:5150   # required
export YAATAL_TOKEN=<jwt>                        # optional bearer token
```

Commands:

```text
yaatal products list [--limit N]
yaatal products get <id>
yaatal orders list
yaatal orders get <id>
yaatal deliveries list [--order-id X]
yaatal deliveries get <id>
yaatal deliveries confirm-by-code <code>
yaatal proposals list [--status <s>]
yaatal proposals approve <id>
yaatal proposals reject <id>
yaatal social events [--platform <p>] [--since <ts>] [--limit N]
yaatal search products <query>
yaatal auth login --email E --password P
yaatal pispi qr --alias <uuid-v4> [--amount <xof>] [--name <s>] [--city <s>] [--ref <s>] [--country <cc>]
```

`pispi qr` generates a BCEAO PI-SPI interoperable payment-QR (EMVCo payload,
GUID `int.bceao.pi`, currency `952`/XOF) fully offline via BCEAO's official
`@pi-spi/qrcode` package — it makes no Engine call and needs no
`YAATAL_ENGINE_URL`. `--alias` must be a UUID v4 (the package's own
validator rejects anything else, despite one non-UUID example surviving in
that package's own README — see `src/pispi.ts` for the discrepancy).
Passing `--amount` produces a DYNAMIC QR; omitting it produces a STATIC one.
`--name`/`--city` are accepted for interface stability but currently have no
effect on the payload — this package version hardcodes EMV tags 59/60 to a
placeholder. **Honesty note:** this only generates format-valid QR payloads;
a real merchant alias comes solely from PI-SPI onboarding, so scanning one of
these QRs in production requires that registration first (see
Yaatal-Engine's `docs/PISPI-API-NOTES.md`).

Every command prints one JSON value to stdout on success (exit `0`). Failures
never print prose: API/network errors print `{"error":..., "status":...}` to
stderr and exit `1`; bad usage (missing command, missing `YAATAL_ENGINE_URL`,
unknown flags) prints the same shape and exits `2`. There are no interactive
prompts, so it is safe to call from an agent's tool loop. `yaatal --help` and
`yaatal <command> --help` both print the full one-page reference above.

Agent integration note: if you are wiring an agent to this SDK, list `yaatal`
under an "Available CLIs" section in that agent's `CLAUDE.md`/`AGENTS.md`
rather than having it call `@yaatal/client` via raw HTTP.

### Contributor Paths

| Contributor | Start Here |
|---|---|
| UI / BOBO app work | [UI Integration Guide](docs/UI-INTEGRATION.md) |
| Beta tester setup | [Beta Sandbox Guide](docs/BETA-SANDBOX.md) |
| Quick code examples | [Examples](examples/README.md) |
| Roadmap review | [Roadmap](ROADMAP.md) |
| Release notes | [Changelog](CHANGELOG.md) |
| API contract review | [API SDK Contract](docs/API-SDK-CONTRACT.md) |
| Endpoint coverage review | [API Endpoint Inventory](docs/API-ENDPOINT-INVENTORY.md) |
| BYO AI integration | [BYO AI Integration](docs/BYO-AI-INTEGRATION.md) |
| Release checklist | [SDK V1 Rollout Checklist](docs/deployment/sdk-v1-rollout-checklist.md) |

### Local Checks

```bash
npm run test:contracts
npm run build
npm run test:cli
npm run test:pispi
npm run test:unit
npm run test:pack-install
npm run example:node-smoke
npm publish --dry-run --tag beta --access public
```

`test:contracts` checks the source contract without external services. `build`
generates the publishable `dist/` files. `test:cli` builds against a stub
HTTP engine and exercises the `yaatal` CLI end to end. `test:pispi` exercises
offline PI-SPI QR generation (`src/pispi.ts`) with a dummy UUID-v4 alias.
`test:pack-install` packs the package, installs it into a temporary consumer
app, and imports `@yaatal/client` through
the package export. `test:unit` runs the behavioural tests against a fake fetch; set
`ENGINE_CONTROLLERS_DIR=<engine>/crates/yaatal-api/src/controllers` to also check that every route
the SDK calls exists in an Engine checkout (skipped when unset).

### Boundaries

- The SDK is not deployed to Railway.
- Engine is deployed to Railway or run locally.
- BOBO web/native owns the app shell and UI.
- The SDK only connects apps to Engine.
- A staging sandbox is enough for a closed beta. Real multitenancy is a later
  Engine/platform concern.

## Francais

`@yaatal/client` est le client d'intégration pour Yaatal Engine. Il ne lance pas
de serveur et ne garde pas l'état métier. Installez-le dans BOBO ou dans une
autre app, pointez-le vers une URL Engine, puis utilisez des méthodes typées au
lieu d'écrire des appels `fetch` à la main.

```text
BOBO ou une autre UI
  -> @yaatal/client
  -> API HTTP Yaatal Engine
  -> base de données et règles métier Engine
```

Engine reste la source de vérité pour l'auth, les produits, les commandes, la
livraison, les notifications, l'analytics et le commerce BOBO. Le SDK gère les
URLs, les paramètres de requête, les corps JSON, le bearer token, les réponses
typées et les erreurs API.

### Périmètre Actuel

La V1 cible une seule instance Engine configurée. Elle convient au
développement local, à l'intégration BOBO et à un sandbox staging contrôlé. Ce
n'est pas encore un SDK SaaS public multitenant.

Le package expose:

| Namespace | Usage |
|---|---|
| `client.auth` | login, inscription, connexion WhatsApp, grants bootstrap, session et utilisateur |
| `client.products` | produits gérés par Engine |
| `client.orders` | commandes génériques Engine (déprécié, disparaît avec la Sheet) |
| `client.delivery` | cycle de vie livraison |
| `client.search` | recherche produits, marchands et commandes |
| `client.notifications` | notifications in-app |
| `client.analytics` | `track` et `identify` authentifiés |
| `client.bobo` | checkout, commandes, escrow et KYC BOBO (déprécié, disparaît avec la Sheet) |
| `client.commerce` | Commerce Sheet, côté vendeur : mise en ligne d'un produit, liens, conversions, commandes payées à la livraison |
| `client.sheet` | Commerce Sheet, côté acheteur (sans compte) : lire la fiche d'un lien et payer |
| `@yaatal/client/server` | serveur uniquement : `partnerAuth` (connexion WhatsApp partenaire) et `kairmelAdmin` |
| `client.harness` | revue des propositions L1 du Yaatal Harness (list/approve/reject) |
| `client.social` | événements sociaux entrants (WhatsApp, Telegram, ...) |
| `client.ai` | passerelle IA d'Engine : Engine choisit le tier et le modèle |
| `client.voice` | transcription audio et URL de session vocale en direct |
| `client.livekit` | tokens pour les salles audio/vidéo en direct |
| `client.inference` | l'API Kairmel, compatible OpenAI et facturée en XOF (FCFA), si configurée |

Chaque app peut toujours brancher son propre service IA ; voir
[Intégration IA externe](docs/BYO-AI-INTEGRATION.md). La connexion WhatsApp et l'API Kairmel
sont décrites en exemple dans la partie anglaise ci-dessus.

### Installation

Après publication npm:

```bash
npm install @yaatal/client@beta
```

Avant publication npm, ou pour tester directement depuis GitHub:

```bash
npm install github:Yaatal-labs/Yaatal-SDK#main
```

Pour développer le SDK localement:

```bash
npm ci
npm run build
```

### Configurer L'URL Engine

Pour Expo, React Native ou une app web:

```bash
EXPO_PUBLIC_ENGINE_API_URL=https://votre-url-engine-staging
```

Pour Node ou un usage serveur:

```bash
YAATAL_ENGINE_API_URL=https://votre-url-engine-staging
```

Vous pouvez aussi passer l'URL directement:

```ts
import { createYaatalClient } from "@yaatal/client";

const client = createYaatalClient({
  baseUrl: "http://localhost:5150",
});
```

Sans URL configurée, le SDK utilise `http://localhost:5150`.

### Auth

```ts
const session = await client.auth.login({
  email: "buyer@example.com",
  password: "secret",
});

client.setToken(session.token);
```

Si l'app possède déjà un JWT Engine:

```ts
const client = createYaatalClient({
  baseUrl: process.env.EXPO_PUBLIC_ENGINE_API_URL,
  token,
});
```

Les appels authentifiés ajoutent:

```text
Authorization: Bearer <jwt>
```

### Forme D'Intégration UI

Évitez de mettre des appels SDK dans chaque écran. Placez le client derrière
une petite couche service ou hook de l'app:

```text
écran BOBO
  -> hook/service BOBO
  -> @yaatal/client
  -> Engine
```

Exemple:

```ts
import { createYaatalClient } from "@yaatal/client";

export function makeYaatalClient(token?: string) {
  return createYaatalClient({
    baseUrl: process.env.EXPO_PUBLIC_ENGINE_API_URL,
    token,
  });
}
```

Puis le code BOBO peut appeler des helpers métier:

```ts
export async function confirmOrderDelivery(orderId: number, token: string) {
  return makeYaatalClient(token).bobo.confirmDelivery(orderId);
}
```

Pour le chemin de migration complet, lisez le
[Guide d'intégration UI](docs/UI-INTEGRATION.md).

### Appels Courants

```ts
const products = await client.search.products({ q: "rice", limit: 20 });
const orders = await client.bobo.listOrders({ limit: 25 });

const checkout = await client.bobo.checkout({
  items: [{ product_id: "product-id", quantity: 1 }],
  payment_method: "wave",
  delivery_method: "bobo_managed",
  shipping_address: "Dakar",
  phone_number: "+221770000000",
  idempotency_key: crypto.randomUUID(),
});

await client.bobo.confirmDelivery(checkout.order.bobo_order_id);
```

PI-SPI propose deux flux. Sans `pispi_alias`, c'est le flux **QR** : le
marchand affiche un QR dynamique (`createDynamicMerchantQr`, export racine)
portant la reference de commande, l'acheteur le scanne, et le moteur regle par
polling. Avec l'adresse de paiement (36 caracteres) de l'acheteur, c'est une
**demande de paiement** qui lui est adressee :

```ts
// QR : rien a demander a l'acheteur.
const checkout = await client.bobo.checkout({
  items: [{ product_id: "product-id", quantity: 1 }],
  payment_method: "pispi",
  delivery_method: "bobo_managed",
  idempotency_key: crypto.randomUUID(),
});
```

### Chemins Pour Contribuer

| Profil | Commencer Ici |
|---|---|
| UI / app BOBO | [Guide d'intégration UI](docs/UI-INTEGRATION.md) |
| Test beta | [Guide sandbox beta](docs/BETA-SANDBOX.md) |
| Exemples rapides | [Exemples](examples/README.md) |
| Roadmap | [Feuille de route](ROADMAP.md) |
| Notes de release | [Changelog](CHANGELOG.md) |
| Revue contrat API | [Contrat API SDK](docs/API-SDK-CONTRACT.md) |
| Couverture endpoints | [Inventaire endpoints API](docs/API-ENDPOINT-INVENTORY.md) |
| IA externe | [Intégration IA externe](docs/BYO-AI-INTEGRATION.md) |
| Release | [Checklist rollout SDK V1](docs/deployment/sdk-v1-rollout-checklist.md) |

### Vérifications Locales

```bash
npm run test:contracts
npm run build
npm run test:pack-install
npm run example:node-smoke
npm publish --dry-run --tag beta --access public
```

`test:contracts` vérifie le contrat source sans service externe. `build`
génère les fichiers publiables dans `dist/`. `test:pack-install` prépare le
package, l'installe dans une app temporaire et importe `@yaatal/client` via
l'export du package.

### Limites

- Le SDK ne se déploie pas sur Railway.
- Engine se déploie sur Railway ou tourne en local.
- BOBO web/native garde l'app shell et l'UI.
- Le SDK connecte seulement les apps à Engine.
- Un sandbox staging suffit pour une beta fermée. Le vrai multitenant viendra
  plus tard côté Engine/platform.
