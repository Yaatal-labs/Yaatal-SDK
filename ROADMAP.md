# Roadmap / Feuille De Route

[English](#english) | [Francais](#francais)

## English

This roadmap is intentionally practical. The SDK should stay small and match
real Engine contracts.

### Beta

- Publish `@yaatal/client@beta`.
- Keep install from GitHub supported for early contributors.
- Point BOBO beta builds at a staging Engine sandbox.
- Wire BOBO UI flows through SDK services/hooks.
- Keep PocketBase only where Engine has no matching contract yet.
- Collect contract bugs through GitHub issues.

### V1

- Stabilize auth, products, orders, delivery, search, notifications, analytics,
  and BOBO bridge methods.
- Document all request and response types.
- Keep CI green on supported Node versions.
- Add examples only when they help UI contributors test real flows.
- Tag a non-beta release after BOBO beta traffic validates the contract.

### Later

- Multitenant Engine support, if Yaatal becomes a hosted platform.
- Token registration for push providers.
- Admin/reporting SDK surfaces.
- Provider-specific AI helpers only if Engine adds a stable AI contract. Until
  then, apps should bring their own AI service.

## Francais

Cette feuille de route reste volontairement pratique. Le SDK doit rester petit
et suivre les vrais contrats Engine.

### Beta

- Publier `@yaatal/client@beta`.
- Garder l'installation depuis GitHub pour les premiers contributeurs.
- Pointer les builds BOBO beta vers un sandbox Engine staging.
- Brancher les flux UI BOBO via des services/hooks qui utilisent le SDK.
- Garder PocketBase seulement quand Engine n'a pas encore de contrat equivalent.
- Collecter les bugs de contrat via GitHub Issues.

### V1

- Stabiliser auth, produits, commandes, livraison, recherche, notifications,
  analytics et les helpers BOBO bridge.
- Documenter les types request/response.
- Garder CI verte sur les versions Node supportees.
- Ajouter des exemples seulement quand ils aident les contributeurs UI a tester
  de vrais flux.
- Tagger une release non-beta apres validation du contrat par le trafic beta
  BOBO.

### Plus Tard

- Support multitenant cote Engine, si Yaatal devient une plateforme hebergee.
- Enregistrement de tokens pour les providers push.
- Surfaces SDK admin/reporting.
- Helpers IA specifiques seulement si Engine ajoute un contrat IA stable. En
  attendant, les apps doivent brancher leur propre service IA.
