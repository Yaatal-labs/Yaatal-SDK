# SDK V1 Engine Rollout Checklist / Checklist De Deploiement Engine SDK V1

This runbook validates a deployed Yaatal Engine URL for SDK V1 testers without
reading Rust source.

Ce guide valide une URL Engine deployee pour les testeurs SDK V1 sans lire le
code Rust.

## English

### URL Selection

Set one Engine base URL before testing. Do not include a trailing slash and do
not include `/api`.

```bash
export ENGINE_API_URL="https://<railway-service>.up.railway.app"
```

BOBO web examples should use the same value through:

```bash
EXPO_PUBLIC_ENGINE_API_URL="$ENGINE_API_URL"
```

BYO-AI or other SDK examples should use:

```bash
ENGINE_API_URL="$ENGINE_API_URL"
```

The currently documented BOBO production example points at
`https://yaatal-engine-production.up.railway.app`. Use a staging Railway URL
instead when validating a staged SDK or app release.

### Environment Matrix

| Variable | Required for SDK V1 smoke? | Environment | Notes |
|---|---:|---|---|
| `ENGINE_API_URL` | Yes, client-side | Local, staging, production | Tester/app base URL. Local default is `http://localhost:5150`; staging/production use the deployed Railway URL. |
| `EXPO_PUBLIC_ENGINE_API_URL` | Yes for BOBO web/mobile examples | Local, staging, production | Same value as `ENGINE_API_URL`; used by Expo builds. |
| `DATABASE_URL` | Yes, server-side | Local, staging, production | Engine boot requires Postgres. Railway should point at the Railway Postgres service. |
| `JWT_SECRET` | Yes, server-side | Local, staging, production | Engine boot and auth require it. Use a strong secret outside local dev. |
| `PORT` | Railway-managed | Staging, production | Railway injects it; do not hardcode in SDK examples. |
| `APP_URL` | Optional | Staging, production | Useful for generated links and host metadata; not required for SDK smoke. |
| `WAVE_API_BASE`, `WAVE_API_KEY`, `WAVE_WEBHOOK_SECRET`, `WAVE_MERCHANT_ID` | No | Staging, production | Needed only for real Wave payment rail tests. The SDK V1 generic smoke uses `payment_method: "cash"` and must not be blocked by missing Wave config. |
| `POSTHOG_API_KEY` | No | Local, staging, production | If missing, analytics falls back to logging. `/api/analytics/track` and `/api/analytics/identify` should still return success. |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` | No | Staging, production | Only needed for `/api/livekit/*`. Missing config makes LiveKit endpoints return 503, but SDK V1 commerce/auth/search testing can continue. |
| `SILICONFLOW_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `HUGGINGFACE_API_KEY` | No | Local, staging, production | AI router provider keys are optional for SDK V1 commerce smoke. Set them only when validating AI cascade behavior. |
| `OLLAMA_BASE_URL` | No | Local or BYO-AI labs | `/api/ai/chat` proxies Ollama-compatible streaming. Do not require Ollama for SDK V1 rollout testing. |
| `HF_API_TOKEN` | No | Voice/cloud transcription only | Separate from `HUGGINGFACE_API_KEY`; used by voice transcription paths, not SDK V1 commerce smoke. |
| `VOICE_SERVICE_URL`, `SEARCH_SERVICE_URL`, `SEARCH_SERVICE_TIMEOUT_SECONDS` | No | Bo-Plex/search service testing | Optional sidecars. The SDK V1 `/api/search/products` smoke below uses the Engine SQL search route, not the external search service. |
| `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` | No | Push testing only | Notification list/unread smoke uses DB-backed notification records and should not require OneSignal. |

Optional providers must not block SDK V1 testing. A staging deployment with only
`DATABASE_URL` and `JWT_SECRET` should be enough for health, auth, products,
search, generic orders, deliveries, notifications, and analytics smoke.

### Local, Staging, Production

| Concern | Local dev | Staging | Production |
|---|---|---|---|
| Engine URL | `http://localhost:5150` | Railway staging URL | Railway production URL |
| Database | Docker Compose Postgres | Staging Railway Postgres | Production Railway Postgres |
| Smoke data | Free to create/delete | Preferred place for full write smoke | Use only designated smoke accounts or read-only checks unless a release owner approves writes |
| Optional providers | Usually unset | Set only for provider-specific QA | Set only when production provider behavior is required |
| SDK examples | Point to local URL | Point BOBO/BYO-AI to staging URL | Point BOBO/BYO-AI to production URL after promotion |

### Staging And Release Checklist

1. Confirm the deployed URL and set `ENGINE_API_URL`.
2. Confirm Railway deployment status is successful.
3. Confirm the server has `DATABASE_URL` and `JWT_SECRET`.
4. Confirm optional provider gaps are recorded but not treated as blockers for SDK V1.
5. Run the smoke checklist below against staging.
6. Point BOBO and BYO-AI examples at the same staging `ENGINE_API_URL`.
7. Promote only after smoke passes and release owner signs off on any residual provider gaps.
8. After production promotion, run `/health` plus a limited production smoke appropriate for the data policy.

### Smoke Checklist

The commands below assume `curl` and `jq`. If `jq` is unavailable, copy the
`token`, `id`, and `merchant_id` fields manually from each JSON response.

Use unique emails per run:

```bash
export RUN_ID="$(date +%Y%m%d%H%M%S)"
export SELLER_EMAIL="sdk-seller-${RUN_ID}@example.com"
export BUYER_EMAIL="sdk-buyer-${RUN_ID}@example.com"
export SMOKE_PASSWORD="12341234"
```

1. Health:

```bash
curl -fsS "$ENGINE_API_URL/health"
```

Expected: HTTP 200. `/_health` may also be available through Loco, but `/health`
is the release smoke target.

2. Auth register/login for the seller:

```bash
curl -fsS -X POST "$ENGINE_API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"SDK Smoke Seller\",\"email\":\"$SELLER_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}"

SELLER_LOGIN="$(curl -fsS -X POST "$ENGINE_API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$SELLER_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}")"
SELLER_TOKEN="$(printf '%s' "$SELLER_LOGIN" | jq -r '.token')"
```

Expected: register returns HTTP 200; login returns JSON with `token`, `pid`,
`name`, and `is_verified`.

3. Create a seller product and list products:

```bash
PRODUCT_JSON="$(curl -fsS -X POST "$ENGINE_API_URL/api/products" \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"SDK Smoke Basket $RUN_ID\",\"description\":\"Release smoke product\",\"price_cents\":2400,\"stock\":4,\"category\":\"smoke\",\"images\":null}")"

PRODUCT_ID="$(printf '%s' "$PRODUCT_JSON" | jq -r '.id')"
SELLER_PROFILE_ID="$(printf '%s' "$PRODUCT_JSON" | jq -r '.merchant_id')"

curl -fsS "$ENGINE_API_URL/api/products?category=smoke&search=Basket&per_page=10"
```

Expected: create returns HTTP 200 and the list response includes the created
product under `products`.

4. Search products:

```bash
curl -fsS "$ENGINE_API_URL/api/search/products?q=Basket&category=smoke&per_page=10"
```

Expected: HTTP 200 with a `products` array. The array should include the product
created above on a fresh staging database.

5. Auth register/login for the buyer:

```bash
curl -fsS -X POST "$ENGINE_API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"SDK Smoke Buyer\",\"email\":\"$BUYER_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}"

BUYER_LOGIN="$(curl -fsS -X POST "$ENGINE_API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$BUYER_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}")"
BUYER_TOKEN="$(printf '%s' "$BUYER_LOGIN" | jq -r '.token')"
```

Expected: buyer login returns a bearer token.

6. Create a generic order:

```bash
ORDER_JSON="$(curl -fsS -X POST "$ENGINE_API_URL/api/orders" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"seller_id\":\"$SELLER_PROFILE_ID\",\"items\":[{\"product_id\":\"$PRODUCT_ID\",\"quantity\":1}],\"payment_method\":\"cash\",\"delivery_method\":\"pickup\"}")"

ORDER_ID="$(printf '%s' "$ORDER_JSON" | jq -r '.id')"
```

Expected: HTTP 200, `status` is `pending`, and `payment_status` is `pending`.

7. Delivery create/status/confirm:

```bash
DELIVERY_JSON="$(curl -fsS -X POST "$ENGINE_API_URL/api/deliveries" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"order_id\":\"$ORDER_ID\",\"dropoff_address\":\"Dakar Plateau\",\"phone_number\":\"+221770000000\"}")"

DELIVERY_ID="$(printf '%s' "$DELIVERY_JSON" | jq -r '.id')"

curl -fsS "$ENGINE_API_URL/api/deliveries/$DELIVERY_ID" \
  -H "Authorization: Bearer $BUYER_TOKEN"

curl -fsS -X PATCH "$ENGINE_API_URL/api/deliveries/$DELIVERY_ID/status" \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"accepted"}'

curl -fsS -X POST "$ENGINE_API_URL/api/deliveries/$DELIVERY_ID/confirm" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"proof_note":"received by SDK V1 smoke tester"}'
```

Expected: create and get return HTTP 200; seller status update returns
`status: "accepted"`; buyer confirm returns `status: "delivered"`.

8. Notifications list/unread:

```bash
curl -fsS "$ENGINE_API_URL/api/notifications?limit=10" \
  -H "Authorization: Bearer $SELLER_TOKEN"

curl -fsS "$ENGINE_API_URL/api/notifications/unread-count" \
  -H "Authorization: Bearer $SELLER_TOKEN"

curl -fsS "$ENGINE_API_URL/api/notifications/unread-count" \
  -H "Authorization: Bearer $BUYER_TOKEN"
```

Expected: HTTP 200. A full write smoke should create order and delivery
notifications; exact counts depend on prior smoke runs for the same accounts.

9. Analytics track/identify:

```bash
curl -fsS -X POST "$ENGINE_API_URL/api/analytics/track" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event":"sdk.v1.smoke","properties":{"surface":"runbook","provider_optional":true}}'

curl -fsS -X POST "$ENGINE_API_URL/api/analytics/identify" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"traits":{"tester":"sdk-v1","surface":"runbook"}}'
```

Expected: both return HTTP 200 with `{"success":true}`. Missing
`POSTHOG_API_KEY` is not a failure.

### Rollback Guidance

Use the fastest safe rollback for the failure mode:

- Railway runtime regression: redeploy the previous successful Railway
  deployment from the Railway dashboard or CLI.
- Code regression after a branch promotion: redeploy the previous known-good
  branch SHA. Record the SHA in the release note before promotion.
- Env regression: restore the previous Railway variable set, then redeploy.
- Database migration regression: stop new promotion, capture logs, and use the
  migration owner plan before changing data. Do not silently point production at
  a different database.

After rollback, rerun `/health`, auth login, products list, and the failing
smoke step against the restored `ENGINE_API_URL`.

## Francais

### Choix De L'URL

Definir une seule URL de base Engine avant le test. Ne pas ajouter de slash final
et ne pas ajouter `/api`.

```bash
export ENGINE_API_URL="https://<railway-service>.up.railway.app"
```

Les exemples BOBO web doivent utiliser la meme valeur via:

```bash
EXPO_PUBLIC_ENGINE_API_URL="$ENGINE_API_URL"
```

Les exemples BYO-AI ou autres exemples SDK doivent utiliser:

```bash
ENGINE_API_URL="$ENGINE_API_URL"
```

L'exemple BOBO production deja documente pointe vers
`https://yaatal-engine-production.up.railway.app`. Pour valider une release SDK
ou app en staging, utiliser plutot l'URL Railway de staging.

### Matrice D'Environnement

| Variable | Requise pour le smoke SDK V1 ? | Environnement | Notes |
|---|---:|---|---|
| `ENGINE_API_URL` | Oui, cote client | Local, staging, production | URL de base pour le testeur ou l'app. En local: `http://localhost:5150`; en staging/production: URL Railway deployee. |
| `EXPO_PUBLIC_ENGINE_API_URL` | Oui pour BOBO web/mobile | Local, staging, production | Meme valeur que `ENGINE_API_URL`; utilisee par les builds Expo. |
| `DATABASE_URL` | Oui, cote serveur | Local, staging, production | L'Engine a besoin de Postgres pour demarrer. Sur Railway, pointer vers le service Postgres Railway. |
| `JWT_SECRET` | Oui, cote serveur | Local, staging, production | Necessaire au boot et a l'auth. Utiliser un secret fort hors local. |
| `PORT` | Gere par Railway | Staging, production | Railway l'injecte; ne pas le hardcoder dans les exemples SDK. |
| `APP_URL` | Optionnelle | Staging, production | Utile pour certains liens et metadata host; pas requise pour le smoke SDK. |
| `WAVE_API_BASE`, `WAVE_API_KEY`, `WAVE_WEBHOOK_SECRET`, `WAVE_MERCHANT_ID` | Non | Staging, production | Necessaire seulement pour tester le vrai rail Wave. Le smoke generique SDK V1 utilise `payment_method: "cash"` et ne doit pas bloquer si Wave manque. |
| `POSTHOG_API_KEY` | Non | Local, staging, production | Sans cle, analytics tombe sur les logs. `/api/analytics/track` et `/api/analytics/identify` doivent quand meme reussir. |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` | Non | Staging, production | Necessaire seulement pour `/api/livekit/*`. Sans config, ces endpoints retournent 503, mais les tests auth/commerce/search SDK V1 continuent. |
| `SILICONFLOW_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `HUGGINGFACE_API_KEY` | Non | Local, staging, production | Cles optionnelles pour le routeur IA. Les definir seulement pour valider la cascade IA. |
| `OLLAMA_BASE_URL` | Non | Local ou lab BYO-AI | `/api/ai/chat` proxy un stream compatible Ollama. Ne pas exiger Ollama pour le rollout SDK V1. |
| `HF_API_TOKEN` | Non | Transcription voix/cloud seulement | Different de `HUGGINGFACE_API_KEY`; utilise par les chemins voix, pas par le smoke commerce SDK V1. |
| `VOICE_SERVICE_URL`, `SEARCH_SERVICE_URL`, `SEARCH_SERVICE_TIMEOUT_SECONDS` | Non | Tests Bo-Plex/search service | Sidecars optionnels. Le smoke `/api/search/products` ci-dessous utilise la recherche SQL Engine, pas le service search externe. |
| `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` | Non | Push seulement | Le smoke notifications liste/unread lit les notifications en base et ne doit pas exiger OneSignal. |

Les fournisseurs optionnels ne doivent pas bloquer les tests SDK V1. Un
deploiement staging avec seulement `DATABASE_URL` et `JWT_SECRET` doit suffire
pour verifier health, auth, produits, recherche, commandes generiques,
livraisons, notifications et analytics.

### Local, Staging, Production

| Sujet | Local dev | Staging | Production |
|---|---|---|---|
| URL Engine | `http://localhost:5150` | URL Railway staging | URL Railway production |
| Base de donnees | Postgres Docker Compose | Postgres Railway staging | Postgres Railway production |
| Donnees de smoke | Creation/suppression libre | Endroit recommande pour le smoke ecriture complet | Utiliser seulement des comptes smoke designes ou des checks read-only sans accord release owner |
| Fournisseurs optionnels | Souvent absents | Definis seulement pour QA provider | Definis seulement si le comportement production provider est requis |
| Exemples SDK | Pointent vers local | BOBO/BYO-AI pointent vers staging | BOBO/BYO-AI pointent vers production apres promotion |

### Checklist Staging Et Release

1. Confirmer l'URL deployee et definir `ENGINE_API_URL`.
2. Confirmer que le deploiement Railway est en succes.
3. Confirmer que le serveur a `DATABASE_URL` et `JWT_SECRET`.
4. Noter les fournisseurs optionnels absents sans les traiter comme blockers SDK V1.
5. Executer le smoke ci-dessous contre staging.
6. Pointer BOBO et les exemples BYO-AI vers le meme `ENGINE_API_URL` de staging.
7. Promouvoir seulement apres smoke OK et accord release owner sur les ecarts provider restants.
8. Apres promotion production, executer `/health` et un smoke production limite selon la politique de donnees.

### Smoke Checklist

Les commandes utilisent `curl` et `jq`. Sans `jq`, copier manuellement les champs
`token`, `id` et `merchant_id` depuis les reponses JSON.

Utiliser des emails uniques par run:

```bash
export RUN_ID="$(date +%Y%m%d%H%M%S)"
export SELLER_EMAIL="sdk-seller-${RUN_ID}@example.com"
export BUYER_EMAIL="sdk-buyer-${RUN_ID}@example.com"
export SMOKE_PASSWORD="12341234"
```

1. Health:

```bash
curl -fsS "$ENGINE_API_URL/health"
```

Attendu: HTTP 200. `/_health` peut aussi exister via Loco, mais `/health` est
la cible smoke release.

2. Auth register/login vendeur:

```bash
curl -fsS -X POST "$ENGINE_API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"SDK Smoke Seller\",\"email\":\"$SELLER_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}"

SELLER_LOGIN="$(curl -fsS -X POST "$ENGINE_API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$SELLER_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}")"
SELLER_TOKEN="$(printf '%s' "$SELLER_LOGIN" | jq -r '.token')"
```

Attendu: register retourne HTTP 200; login retourne `token`, `pid`, `name` et
`is_verified`.

3. Creer un produit vendeur et lister les produits:

```bash
PRODUCT_JSON="$(curl -fsS -X POST "$ENGINE_API_URL/api/products" \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"SDK Smoke Basket $RUN_ID\",\"description\":\"Release smoke product\",\"price_cents\":2400,\"stock\":4,\"category\":\"smoke\",\"images\":null}")"

PRODUCT_ID="$(printf '%s' "$PRODUCT_JSON" | jq -r '.id')"
SELLER_PROFILE_ID="$(printf '%s' "$PRODUCT_JSON" | jq -r '.merchant_id')"

curl -fsS "$ENGINE_API_URL/api/products?category=smoke&search=Basket&per_page=10"
```

Attendu: creation HTTP 200 et la liste contient le produit cree dans `products`.

4. Rechercher les produits:

```bash
curl -fsS "$ENGINE_API_URL/api/search/products?q=Basket&category=smoke&per_page=10"
```

Attendu: HTTP 200 avec un tableau `products`. Sur une base staging fraiche, le
produit cree doit y apparaitre.

5. Auth register/login acheteur:

```bash
curl -fsS -X POST "$ENGINE_API_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"SDK Smoke Buyer\",\"email\":\"$BUYER_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}"

BUYER_LOGIN="$(curl -fsS -X POST "$ENGINE_API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$BUYER_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}")"
BUYER_TOKEN="$(printf '%s' "$BUYER_LOGIN" | jq -r '.token')"
```

Attendu: login acheteur retourne un bearer token.

6. Creer une commande generique:

```bash
ORDER_JSON="$(curl -fsS -X POST "$ENGINE_API_URL/api/orders" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"seller_id\":\"$SELLER_PROFILE_ID\",\"items\":[{\"product_id\":\"$PRODUCT_ID\",\"quantity\":1}],\"payment_method\":\"cash\",\"delivery_method\":\"pickup\"}")"

ORDER_ID="$(printf '%s' "$ORDER_JSON" | jq -r '.id')"
```

Attendu: HTTP 200, `status` vaut `pending` et `payment_status` vaut `pending`.

7. Livraison create/status/confirm:

```bash
DELIVERY_JSON="$(curl -fsS -X POST "$ENGINE_API_URL/api/deliveries" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"order_id\":\"$ORDER_ID\",\"dropoff_address\":\"Dakar Plateau\",\"phone_number\":\"+221770000000\"}")"

DELIVERY_ID="$(printf '%s' "$DELIVERY_JSON" | jq -r '.id')"

curl -fsS "$ENGINE_API_URL/api/deliveries/$DELIVERY_ID" \
  -H "Authorization: Bearer $BUYER_TOKEN"

curl -fsS -X PATCH "$ENGINE_API_URL/api/deliveries/$DELIVERY_ID/status" \
  -H "Authorization: Bearer $SELLER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"accepted"}'

curl -fsS -X POST "$ENGINE_API_URL/api/deliveries/$DELIVERY_ID/confirm" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"proof_note":"received by SDK V1 smoke tester"}'
```

Attendu: create et get retournent HTTP 200; le vendeur obtient
`status: "accepted"`; l'acheteur confirme et obtient `status: "delivered"`.

8. Notifications liste/unread:

```bash
curl -fsS "$ENGINE_API_URL/api/notifications?limit=10" \
  -H "Authorization: Bearer $SELLER_TOKEN"

curl -fsS "$ENGINE_API_URL/api/notifications/unread-count" \
  -H "Authorization: Bearer $SELLER_TOKEN"

curl -fsS "$ENGINE_API_URL/api/notifications/unread-count" \
  -H "Authorization: Bearer $BUYER_TOKEN"
```

Attendu: HTTP 200. Un smoke ecriture complet doit creer des notifications de
commande et livraison; les comptes exacts dependent des runs precedents sur les
memes comptes.

9. Analytics track/identify:

```bash
curl -fsS -X POST "$ENGINE_API_URL/api/analytics/track" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"event":"sdk.v1.smoke","properties":{"surface":"runbook","provider_optional":true}}'

curl -fsS -X POST "$ENGINE_API_URL/api/analytics/identify" \
  -H "Authorization: Bearer $BUYER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"traits":{"tester":"sdk-v1","surface":"runbook"}}'
```

Attendu: les deux appels retournent HTTP 200 avec `{"success":true}`. L'absence
de `POSTHOG_API_KEY` n'est pas un echec.

### Rollback

Choisir le rollback le plus rapide et sur:

- Regression runtime Railway: redeployer le dernier deploiement Railway en
  succes depuis le dashboard ou la CLI.
- Regression code apres promotion de branche: redeployer le SHA de branche
  precedent connu comme bon. Noter ce SHA dans la release note avant promotion.
- Regression env: restaurer l'ancien jeu de variables Railway, puis redeployer.
- Regression migration base: stopper la promotion, capturer les logs et suivre
  le plan du owner migration avant de modifier les donnees. Ne pas pointer
  silencieusement la production vers une autre base.

Apres rollback, relancer `/health`, auth login, products list et l'etape smoke
qui avait echoue contre le `ENGINE_API_URL` restaure.
