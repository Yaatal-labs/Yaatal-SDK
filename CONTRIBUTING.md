# Contributing / Contribuer

[English](#english) | [Français](#francais)

## English

Thanks for working on Yaatal SDK. Keep contributions small, typed, and tied to
real Engine endpoints.

### Local Setup

```bash
npm ci
npm run check
```

For the mocked example smoke:

```bash
npm run example:node-smoke
```

### Rules Of Thumb

- Do not hardcode Engine URLs. Use `baseUrl`, `EXPO_PUBLIC_ENGINE_API_URL`, or
  `YAATAL_ENGINE_API_URL`.
- Do not add app UI to this repo. This package is only the client.
- Do not add `client.ai` in V1. AI services should call Engine through the SDK.
- Keep request and response types exported from `src/index.ts`.
- Keep errors flowing through `YaatalApiError`.
- When adding a namespace, add contract smoke coverage.
- Update English and French docs together when contributor behavior changes.

### Before A PR

```bash
npm run test:contracts
npm run build
npm run test:pack-install
npm run example:node-smoke
git diff --check
```

## Francais

Merci de contribuer au SDK Yaatal. Gardez les contributions petites, typées et
liées à de vrais endpoints Engine.

### Setup Local

```bash
npm ci
npm run check
```

Pour tester l'exemple mocke:

```bash
npm run example:node-smoke
```

### Règles Pratiques

- Ne codez pas d'URL Engine en dur. Utilisez `baseUrl`,
  `EXPO_PUBLIC_ENGINE_API_URL` ou `YAATAL_ENGINE_API_URL`.
- N'ajoutez pas d'UI app dans ce repo. Ce package est seulement le client.
- N'ajoutez pas `client.ai` en V1. Les services IA doivent appeler Engine via le
  SDK.
- Exportez les types request/response depuis `src/index.ts`.
- Gardez les erreurs via `YaatalApiError`.
- Quand vous ajoutez un namespace, ajoutez une couverture smoke du contrat.
- Mettez à jour les docs anglais et français ensemble quand le comportement
  contributeur change.

### Avant Une PR

```bash
npm run test:contracts
npm run build
npm run test:pack-install
npm run example:node-smoke
git diff --check
```
