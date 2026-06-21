# SDK Documentation / Documentation SDK

[English](#english) | [Français](#francais)

## English

Start with the root [README](../README.md) if you only need to install the SDK,
configure an Engine URL, or wire BOBO UI work.

| File | Use |
|---|---|
| `../CONTRIBUTING.md` | Contributor setup and PR expectations |
| `UI-INTEGRATION.md` | How BOBO/UI code should call the SDK |
| `BETA-SANDBOX.md` | Staging sandbox setup for contributors and testers |
| `API-SDK-CONTRACT.md` | Engine endpoints covered by `@yaatal/client` V1 |
| `API-ENDPOINT-INVENTORY.md` | Engine route inventory and SDK coverage notes |
| `BYO-AI-INTEGRATION.md` | How apps can connect their own AI service through the SDK boundary |
| `deployment/sdk-v1-rollout-checklist.md` | Tester smoke checklist for a deployed Engine URL |

### Local Checks

```bash
npm ci
npm run test:contracts
npm run build
npm run test:pack-install
npm publish --dry-run --tag beta --access public
```

## Francais

Commencez par le [README](../README.md) racine si vous voulez seulement
installer le SDK, configurer une URL Engine ou brancher l'UI BOBO.

| Fichier | Usage |
|---|---|
| `../CONTRIBUTING.md` | Setup contributeur et attentes PR |
| `UI-INTEGRATION.md` | Comment le code BOBO/UI devrait appeler le SDK |
| `BETA-SANDBOX.md` | Setup sandbox staging pour contributeurs et testeurs |
| `API-SDK-CONTRACT.md` | Endpoints Engine couverts par `@yaatal/client` V1 |
| `API-ENDPOINT-INVENTORY.md` | Inventaire des routes Engine et notes de couverture SDK |
| `BYO-AI-INTEGRATION.md` | Comment brancher un service IA externe avec la frontière SDK |
| `deployment/sdk-v1-rollout-checklist.md` | Checklist smoke pour une URL Engine déployée |

### Vérifications Locales

```bash
npm ci
npm run test:contracts
npm run build
npm run test:pack-install
npm publish --dry-run --tag beta --access public
```
