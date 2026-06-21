# Beta Sandbox Guide / Guide Sandbox Beta

[English](#english) | [Français](#francais)

## English

The beta sandbox is a controlled Engine environment for UI contributors and
testers. It is not a public multitenant Yaatal Cloud environment.

```text
BOBO or contributor app
  -> @yaatal/client
  -> staging Engine URL
  -> isolated staging database
```

### What The Sandbox Needs

- A staging Engine URL.
- A separate staging Postgres database.
- `JWT_SECRET` and `DATABASE_URL` configured.
- Engine migrations applied.
- CORS allowing the expected BOBO web/dev origins.
- Seed buyer and seller accounts.
- Seed merchants and products.
- Fake checkout/payment/delivery data only.
- A reset path for bad test data.
- Logs visible to maintainers.

### What Contributors Need

```bash
npm install @yaatal/client@beta
```

or, before npm publication:

```bash
npm install github:Yaatal-labs/Yaatal-SDK#main
```

Then configure:

```bash
EXPO_PUBLIC_ENGINE_API_URL=https://your-engine-staging-url
```

The sandbox owner should provide:

- buyer test email/password
- seller test email/password
- known product names to search
- known checkout path to test
- known limitations

### Smoke Flow

1. Open the app with the staging Engine URL configured.
2. Log in with a seed buyer account.
3. Search for a seeded product.
4. Add it to cart or create a checkout request.
5. Create a BOBO checkout.
6. View the order.
7. Confirm delivery as the buyer.
8. Verify notifications/unread count if the UI exists.
9. Verify analytics calls do not block user actions.

### Boundaries

- Do not put real customer data in sandbox.
- Do not use production payment credentials.
- Do not treat sandbox as tenant-isolated.
- Do not point BOBO beta builds at the accidental SDK Railway service.
- BOBO must point to Engine, not to the SDK package repo.

## Francais

Le sandbox beta est un environnement Engine contrôlé pour les contributeurs UI
et les testeurs. Ce n'est pas un environnement Yaatal Cloud public multitenant.

```text
BOBO ou app contributeur
  -> @yaatal/client
  -> URL Engine staging
  -> base staging isolée
```

### Ce Qu'Il Faut Côté Sandbox

- Une URL Engine staging.
- Une base Postgres staging séparée.
- `JWT_SECRET` et `DATABASE_URL` configurés.
- Migrations Engine appliquées.
- CORS ouvert aux origines BOBO web/dev prévues.
- Comptes test acheteur et vendeur.
- Marchands et produits seedés.
- Données checkout/paiement/livraison fictives seulement.
- Un chemin de reset pour les mauvaises données de test.
- Logs accessibles aux maintainers.

### Ce Qu'Il Faut Côté Contributeur

```bash
npm install @yaatal/client@beta
```

ou, avant publication npm:

```bash
npm install github:Yaatal-labs/Yaatal-SDK#main
```

Puis configurer:

```bash
EXPO_PUBLIC_ENGINE_API_URL=https://votre-url-engine-staging
```

Le responsable du sandbox devrait fournir:

- email/mot de passe acheteur test
- email/mot de passe vendeur test
- noms de produits connus pour la recherche
- chemin checkout à tester
- limites connues

### Parcours Smoke

1. Ouvrir l'app avec l'URL Engine staging configurée.
2. Se connecter avec un compte acheteur seedé.
3. Rechercher un produit seedé.
4. L'ajouter au panier ou créer une requête checkout.
5. Créer un checkout BOBO.
6. Voir la commande.
7. Confirmer la livraison côté acheteur.
8. Vérifier notifications/unread count si l'UI existe.
9. Vérifier que les appels analytics ne bloquent pas les actions utilisateur.

### Limites

- Ne mettez pas de vraies données client dans le sandbox.
- N'utilisez pas de credentials paiement production.
- Ne considérez pas le sandbox comme isolé par tenant.
- Ne pointez pas les builds BOBO beta vers le service Railway SDK accidentel.
- BOBO doit pointer vers Engine, pas vers le repo/package SDK.
