# UI Integration Guide / Guide D'Intégration UI

[English](#english) | [Français](#francais)

## English

This guide is for BOBO and other frontend contributors. The goal is to keep UI
work simple: install `@yaatal/client`, configure one Engine URL, then call
typed SDK methods from app services or hooks.

### What Changes In The App

Replace scattered backend access like this:

```ts
await fetch(`${engineUrl}/api/bobo/orders/${orderId}/confirm-delivery`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
});
```

with a local app helper:

```ts
await boboOrders.confirmDelivery(orderId);
```

where the helper uses the SDK:

```ts
import { createYaatalClient } from "@yaatal/client";

export function makeYaatalClient(token?: string) {
  return createYaatalClient({
    baseUrl: process.env.EXPO_PUBLIC_ENGINE_API_URL,
    token,
  });
}
```

### Recommended App Shape

```text
screen/component
  -> hook or feature service
  -> @yaatal/client
  -> Engine
```

Keep Engine URLs, token headers, and raw endpoint paths out of screens. Screens
should work with app-level names such as `loadProducts`, `checkoutCart`, or
`confirmDelivery`.

### Environment

For local Engine:

```bash
EXPO_PUBLIC_ENGINE_API_URL=http://localhost:5150
```

For staging:

```bash
EXPO_PUBLIC_ENGINE_API_URL=https://your-engine-staging-url
```

For server-side scripts:

```bash
YAATAL_ENGINE_API_URL=https://your-engine-staging-url
```

The SDK defaults to `http://localhost:5150` only when no URL is provided. A
deployed BOBO build must set the Engine URL explicitly.

### Migration Order

Start with the flows already covered by Engine and the SDK:

1. Auth/session restore.
2. Product discovery and search.
3. BOBO checkout.
4. BOBO order list/detail.
5. Delivery confirmation.
6. Notifications, where UI already exists.
7. Analytics events that are useful for beta learning.

Keep PocketBase only for surfaces that do not yet have Engine contracts. Do not
delete a PocketBase path until the matching Engine endpoint exists and the SDK
method has been tested.

### Minimal BOBO Service Example

```ts
import { createYaatalClient, type BoboCheckoutRequest } from "@yaatal/client";

export function createBoboApi(input: { token?: string; engineUrl?: string }) {
  const client = createYaatalClient({
    baseUrl: input.engineUrl ?? process.env.EXPO_PUBLIC_ENGINE_API_URL,
    token: input.token,
  });

  return {
    searchProducts: (q: string) => client.search.products({ q, limit: 20 }),
    checkout: (request: BoboCheckoutRequest) => client.bobo.checkout(request),
    orders: () => client.bobo.listOrders({ limit: 25 }),
    confirmDelivery: (orderId: number) => client.bobo.confirmDelivery(orderId),
    unreadNotifications: () => client.notifications.unreadCount(),
  };
}
```

### Testing Checklist

- Wrong Engine URL shows a clear network/config error in the app.
- Login stores an Engine JWT and SDK calls use it.
- Product search works without auth when expected.
- Order search/listing requires auth.
- Checkout creates an order against the staging Engine.
- Buyer confirmation is the delivery/payment release trigger.
- Analytics failures do not block checkout.
- Remaining PocketBase calls are listed in a migration note.

## Francais

Ce guide s'adresse aux contributeurs BOBO et frontend. Le but est de garder le
travail UI simple: installer `@yaatal/client`, configurer une seule URL Engine,
puis appeler des méthodes SDK typées depuis des services ou hooks de l'app.

### Ce Qui Change Dans L'App

Remplacez les accès backend dispersés comme:

```ts
await fetch(`${engineUrl}/api/bobo/orders/${orderId}/confirm-delivery`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
});
```

par un helper local:

```ts
await boboOrders.confirmDelivery(orderId);
```

où le helper utilise le SDK:

```ts
import { createYaatalClient } from "@yaatal/client";

export function makeYaatalClient(token?: string) {
  return createYaatalClient({
    baseUrl: process.env.EXPO_PUBLIC_ENGINE_API_URL,
    token,
  });
}
```

### Forme Recommandée

```text
screen/component
  -> hook ou service feature
  -> @yaatal/client
  -> Engine
```

Gardez les URLs Engine, les headers token et les routes brutes hors des écrans.
Les écrans devraient manipuler des noms applicatifs comme `loadProducts`,
`checkoutCart` ou `confirmDelivery`.

### Environnement

Pour Engine en local:

```bash
EXPO_PUBLIC_ENGINE_API_URL=http://localhost:5150
```

Pour staging:

```bash
EXPO_PUBLIC_ENGINE_API_URL=https://votre-url-engine-staging
```

Pour les scripts côté serveur:

```bash
YAATAL_ENGINE_API_URL=https://votre-url-engine-staging
```

Le SDK utilise `http://localhost:5150` seulement quand aucune URL n'est fournie.
Un build BOBO déployé doit configurer l'URL Engine explicitement.

### Ordre De Migration

Commencez par les flux déjà couverts par Engine et le SDK:

1. Auth/session restore.
2. Discovery produits et recherche.
3. Checkout BOBO.
4. Liste/détail commandes BOBO.
5. Confirmation livraison.
6. Notifications, si l'UI existe déjà.
7. Analytics utiles pour apprendre pendant la beta.

Gardez PocketBase uniquement pour les surfaces qui n'ont pas encore de contrat
Engine. Ne supprimez pas un chemin PocketBase tant que l'endpoint Engine
équivalent n'existe pas et que la méthode SDK n'a pas été testée.

### Exemple De Service BOBO Minimal

```ts
import { createYaatalClient, type BoboCheckoutRequest } from "@yaatal/client";

export function createBoboApi(input: { token?: string; engineUrl?: string }) {
  const client = createYaatalClient({
    baseUrl: input.engineUrl ?? process.env.EXPO_PUBLIC_ENGINE_API_URL,
    token: input.token,
  });

  return {
    searchProducts: (q: string) => client.search.products({ q, limit: 20 }),
    checkout: (request: BoboCheckoutRequest) => client.bobo.checkout(request),
    orders: () => client.bobo.listOrders({ limit: 25 }),
    confirmDelivery: (orderId: number) => client.bobo.confirmDelivery(orderId),
    unreadNotifications: () => client.notifications.unreadCount(),
  };
}
```

### Checklist De Test

- Une mauvaise URL Engine produit une erreur claire dans l'app.
- Le login stocke un JWT Engine et les appels SDK l'utilisent.
- La recherche produits fonctionne sans auth quand c'est prévu.
- La recherche/liste commandes demande l'auth.
- Le checkout crée une commande sur Engine staging.
- La confirmation acheteur déclenche la finalisation livraison/paiement.
- Un échec analytics ne bloque pas le checkout.
- Les appels PocketBase restants sont listés dans une note de migration.
