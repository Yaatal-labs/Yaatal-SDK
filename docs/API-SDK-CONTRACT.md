# API And SDK Contract / Contrat API Et SDK

Branch: `yaatal/sdk-client-extraction`

This file lists the Engine endpoints that are covered by SDK V1 or are required
to test that SDK surface.

Ce fichier liste les endpoints Engine couverts par le SDK V1 ou nécessaires pour
tester ce SDK.

## English

### Status

SDK V1 covers the practical app path:

- auth
- products
- orders
- delivery
- BOBO checkout and order lifecycle
- search
- notifications
- analytics

The SDK does not expose direct payment mutation, BOBO payment simulation, vector
search, push token registration, dashboards, or anonymous analytics.

### Endpoint Matrix

| Area | Method | Path | Auth | SDK method | Test evidence |
|---|---|---|---|---|---|
| Auth | `POST` | `/api/auth/register` | public | `client.auth.register` | `requests::auth::*` |
| Auth | `POST` | `/api/auth/login` | public | `client.auth.login` | `requests::auth::*` |
| Auth | `GET` | `/api/auth/current` | JWT | `client.auth.current` | `requests::auth::can_get_current_user` |
| Products | `GET` | `/api/products` | public | `client.products.list` | covered through search/order request tests |
| Products | `GET` | `/api/products/{id}` | public | `client.products.get` | covered through BOBO app wrappers |
| Products | `POST` | `/api/products` | JWT | `client.products.create` | controller contract |
| Products | `PUT` | `/api/products/{id}` | JWT | `client.products.update` | controller contract |
| Products | `DELETE` | `/api/products/{id}` | JWT | `client.products.remove` | controller contract |
| Products | `POST` | `/api/products/{id}/upvote` | JWT | `client.products.upvote` | controller contract |
| Orders | `POST` | `/api/orders` | JWT | `client.orders.create` | `requests::orders_security::*` |
| Orders | `GET` | `/api/orders` | JWT | `client.orders.list` | controller contract |
| Orders | `GET` | `/api/orders/me` | JWT | `client.orders.me` | BOBO service wrapper |
| Orders | `GET` | `/api/orders/{id}` | JWT | `client.orders.get` | search/order request tests |
| Orders | `PATCH` | `/api/orders/{id}/status` | JWT seller | `client.orders.updateStatus` | controller contract |
| Orders | `POST` | `/api/orders/{id}/cancel` | JWT buyer | `client.orders.cancel` | controller contract |
| Delivery | `POST` | `/api/deliveries` | JWT buyer | `client.delivery.create` | `requests::deliveries::*` |
| Delivery | `GET` | `/api/deliveries` | JWT buyer/seller | `client.delivery.list` | `requests::deliveries::*` |
| Delivery | `GET` | `/api/deliveries/{id}` | JWT buyer/seller | `client.delivery.get` | `requests::deliveries::*` |
| Delivery | `PATCH` | `/api/deliveries/{id}/status` | JWT seller | `client.delivery.updateStatus` | `requests::deliveries::*` |
| Delivery | `POST` | `/api/deliveries/{id}/confirm` | JWT buyer | `client.delivery.confirm` | `requests::deliveries::*` |
| BOBO | `POST` | `/api/bobo/checkout` | JWT | `client.bobo.checkout` | checkout controller, delivery tests |
| BOBO | `GET` | `/api/bobo/checkout/{order_id}/payment` | JWT buyer | `client.bobo.paymentStatus` | `requests::bobo_security::*` |
| BOBO | `GET` | `/api/bobo/orders` | JWT buyer | `client.bobo.listOrders` | controller contract |
| BOBO | `GET` | `/api/bobo/orders/{id}` | JWT buyer | `client.bobo.getOrder` | controller contract |
| BOBO | `GET` | `/api/bobo/orders/{id}/escrow` | JWT buyer | `client.bobo.escrow` | controller contract |
| BOBO | `POST` | `/api/bobo/orders/{id}/confirm-delivery` | JWT buyer | `client.bobo.confirmDelivery` | delivery confirmation path |
| BOBO | `POST` | `/api/bobo/orders/{id}/dispute` | JWT buyer | `client.bobo.dispute` | controller contract |
| BOBO | `POST` | `/api/bobo/orders/{id}/cancel` | JWT buyer | `client.bobo.cancel` | controller contract |
| BOBO KYC | `POST` | `/api/bobo/kyc` | JWT | `client.bobo.submitKyc` | controller contract |
| BOBO KYC | `GET` | `/api/bobo/kyc` | JWT | `client.bobo.kycStatus` | controller contract |
| Search | `GET` | `/api/search/products` | public | `client.search.products` | `requests::search::*` |
| Search | `GET` | `/api/search/merchants` | public | `client.search.merchants` | `requests::search::*` |
| Search | `GET` | `/api/search/orders` | JWT buyer/seller | `client.search.orders` | `requests::search::*` |
| Notifications | `GET` | `/api/notifications` | JWT | `client.notifications.list` | `requests::notifications::*` |
| Notifications | `GET` | `/api/notifications/unread-count` | JWT | `client.notifications.unreadCount` | `requests::notifications::*` |
| Notifications | `PATCH` | `/api/notifications/{id}/read` | JWT owner | `client.notifications.markRead` | `requests::notifications::*` |
| Notifications | `PATCH` | `/api/notifications/read-all` | JWT | `client.notifications.markAllRead` | `requests::notifications::*` |
| Analytics | `POST` | `/api/analytics/track` | JWT | `client.analytics.track` | `requests::analytics::*` |
| Analytics | `POST` | `/api/analytics/identify` | JWT | `client.analytics.identify` | `requests::analytics::*` |

### Contributor Test Path

Local SDK checks:

```bash
npm ci
npm run test:contracts
npm run build
npm run test:pack-install
```

Publish dry run for beta:

```bash
npm publish --dry-run --tag beta --access public
```

Engine-side contract prerequisite: the Engine repo owns Rust controllers,
request tests, migrations, and deployment gates. Before promoting a new Engine
contract, run the Engine CI gates there (`cargo fmt`, `cargo clippy`, and
`cargo test --workspace -- --test-threads=1`). This SDK repo verifies the typed
client package and published npm surface.

### Security Rules

- Buyer identity comes from JWT, not request body.
- Seller-only actions check the seller profile.
- Buyer confirmation is the delivery path that releases escrow.
- Payment status is changed by payment/webhook paths, not by generic order APIs.
- `simulatePayment` is not exposed.

## Français

### Statut

Le SDK V1 couvre le chemin applicatif utile:

- auth
- produits
- commandes
- livraison
- checkout BOBO et cycle de vie commande
- recherche
- notifications
- analytics

Le SDK n'expose pas de mutation directe de paiement, pas de simulation de
paiement BOBO, pas de recherche vectorielle, pas d'enregistrement de token push,
pas de dashboard et pas d'analytics anonyme.

### Matrice Des Endpoints

| Domaine | Méthode | Route | Auth | Méthode SDK | Preuve test |
|---|---|---|---|---|---|
| Auth | `POST` | `/api/auth/register` | public | `client.auth.register` | `requests::auth::*` |
| Auth | `POST` | `/api/auth/login` | public | `client.auth.login` | `requests::auth::*` |
| Auth | `GET` | `/api/auth/current` | JWT | `client.auth.current` | `requests::auth::can_get_current_user` |
| Produits | `GET` | `/api/products` | public | `client.products.list` | via tests recherche/commande |
| Produits | `GET` | `/api/products/{id}` | public | `client.products.get` | via wrappers BOBO |
| Produits | `POST` | `/api/products` | JWT | `client.products.create` | contrat contrôleur |
| Produits | `PUT` | `/api/products/{id}` | JWT | `client.products.update` | contrat contrôleur |
| Produits | `DELETE` | `/api/products/{id}` | JWT | `client.products.remove` | contrat contrôleur |
| Produits | `POST` | `/api/products/{id}/upvote` | JWT | `client.products.upvote` | contrat contrôleur |
| Commandes | `POST` | `/api/orders` | JWT | `client.orders.create` | `requests::orders_security::*` |
| Commandes | `GET` | `/api/orders` | JWT | `client.orders.list` | contrat contrôleur |
| Commandes | `GET` | `/api/orders/me` | JWT | `client.orders.me` | wrapper service BOBO |
| Commandes | `GET` | `/api/orders/{id}` | JWT | `client.orders.get` | tests recherche/commande |
| Commandes | `PATCH` | `/api/orders/{id}/status` | JWT vendeur | `client.orders.updateStatus` | contrat contrôleur |
| Commandes | `POST` | `/api/orders/{id}/cancel` | JWT acheteur | `client.orders.cancel` | contrat contrôleur |
| Livraison | `POST` | `/api/deliveries` | JWT acheteur | `client.delivery.create` | `requests::deliveries::*` |
| Livraison | `GET` | `/api/deliveries` | JWT acheteur/vendeur | `client.delivery.list` | `requests::deliveries::*` |
| Livraison | `GET` | `/api/deliveries/{id}` | JWT acheteur/vendeur | `client.delivery.get` | `requests::deliveries::*` |
| Livraison | `PATCH` | `/api/deliveries/{id}/status` | JWT vendeur | `client.delivery.updateStatus` | `requests::deliveries::*` |
| Livraison | `POST` | `/api/deliveries/{id}/confirm` | JWT acheteur | `client.delivery.confirm` | `requests::deliveries::*` |
| BOBO | `POST` | `/api/bobo/checkout` | JWT | `client.bobo.checkout` | contrôleur checkout, tests livraison |
| BOBO | `GET` | `/api/bobo/checkout/{order_id}/payment` | JWT acheteur | `client.bobo.paymentStatus` | `requests::bobo_security::*` |
| BOBO | `GET` | `/api/bobo/orders` | JWT acheteur | `client.bobo.listOrders` | contrat contrôleur |
| BOBO | `GET` | `/api/bobo/orders/{id}` | JWT acheteur | `client.bobo.getOrder` | contrat contrôleur |
| BOBO | `GET` | `/api/bobo/orders/{id}/escrow` | JWT acheteur | `client.bobo.escrow` | contrat contrôleur |
| BOBO | `POST` | `/api/bobo/orders/{id}/confirm-delivery` | JWT acheteur | `client.bobo.confirmDelivery` | chemin confirmation livraison |
| BOBO | `POST` | `/api/bobo/orders/{id}/dispute` | JWT acheteur | `client.bobo.dispute` | contrat contrôleur |
| BOBO | `POST` | `/api/bobo/orders/{id}/cancel` | JWT acheteur | `client.bobo.cancel` | contrat contrôleur |
| KYC BOBO | `POST` | `/api/bobo/kyc` | JWT | `client.bobo.submitKyc` | contrat contrôleur |
| KYC BOBO | `GET` | `/api/bobo/kyc` | JWT | `client.bobo.kycStatus` | contrat contrôleur |
| Recherche | `GET` | `/api/search/products` | public | `client.search.products` | `requests::search::*` |
| Recherche | `GET` | `/api/search/merchants` | public | `client.search.merchants` | `requests::search::*` |
| Recherche | `GET` | `/api/search/orders` | JWT acheteur/vendeur | `client.search.orders` | `requests::search::*` |
| Notifications | `GET` | `/api/notifications` | JWT | `client.notifications.list` | `requests::notifications::*` |
| Notifications | `GET` | `/api/notifications/unread-count` | JWT | `client.notifications.unreadCount` | `requests::notifications::*` |
| Notifications | `PATCH` | `/api/notifications/{id}/read` | JWT propriétaire | `client.notifications.markRead` | `requests::notifications::*` |
| Notifications | `PATCH` | `/api/notifications/read-all` | JWT | `client.notifications.markAllRead` | `requests::notifications::*` |
| Analytics | `POST` | `/api/analytics/track` | JWT | `client.analytics.track` | `requests::analytics::*` |
| Analytics | `POST` | `/api/analytics/identify` | JWT | `client.analytics.identify` | `requests::analytics::*` |

### Chemin De Test Contributeur

Checks SDK locaux:

```bash
npm ci
npm run test:contracts
npm run build
npm run test:pack-install
```

Dry run de publication beta:

```bash
npm publish --dry-run --tag beta --access public
```

Pré-requis contrat côté Engine: le repo Engine possède les contrôleurs Rust,
les tests de requête, les migrations et les gates de déploiement. Avant de
promouvoir un nouveau contrat Engine, exécuter les gates Engine là-bas (`cargo
fmt`, `cargo clippy` et `cargo test --workspace -- --test-threads=1`). Ce repo
SDK vérifie le client typé et la surface npm publiée.

### Règles De Sécurité

- L'identité acheteur vient du JWT, pas du body.
- Les actions vendeur vérifient le profil vendeur.
- La confirmation acheteur est le chemin de livraison qui libère escrow.
- Le statut paiement change via les chemins paiement/webhook, pas via l'API commande générique.
- `simulatePayment` n'est pas exposé.
