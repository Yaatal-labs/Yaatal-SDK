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
| `client.auth` | login, registration, session/user helpers |
| `client.products` | product CRUD/listing backed by Engine |
| `client.orders` | generic Engine order APIs |
| `client.delivery` | generic delivery lifecycle APIs |
| `client.search` | SQL-backed product, merchant, and order search |
| `client.notifications` | in-app notification records |
| `client.analytics` | authenticated `track` and `identify` |
| `client.bobo` | BOBO checkout, orders, escrow, and KYC bridge helpers |

There is no `client.ai` in V1. Apps can bring their own AI service and call
Engine through the SDK. See [BYO AI Integration](docs/BYO-AI-INTEGRATION.md).

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
npm run test:pack-install
npm run example:node-smoke
npm publish --dry-run --tag beta --access public
```

`test:contracts` checks the source contract without external services. `build`
generates the publishable `dist/` files. `test:pack-install` packs the package,
installs it into a temporary consumer app, and imports `@yaatal/client` through
the package export.

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
| `client.auth` | login, inscription, session et utilisateur |
| `client.products` | produits gérés par Engine |
| `client.orders` | commandes génériques Engine |
| `client.delivery` | cycle de vie livraison |
| `client.search` | recherche produits, marchands et commandes |
| `client.notifications` | notifications in-app |
| `client.analytics` | `track` et `identify` authentifiés |
| `client.bobo` | checkout, commandes, escrow et KYC BOBO |

Il n'y a pas de `client.ai` en V1. Chaque app peut brancher son propre service
IA et appeler Engine via le SDK. Voir
[Intégration IA externe](docs/BYO-AI-INTEGRATION.md).

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
