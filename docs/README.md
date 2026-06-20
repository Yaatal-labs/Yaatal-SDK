# SDK Documentation / Documentation SDK

| File | Use |
|---|---|
| `API-SDK-CONTRACT.md` | Engine endpoints covered by `@yaatal/client` V1 |
| `API-ENDPOINT-INVENTORY.md` | Engine route inventory and SDK coverage notes |
| `BYO-AI-INTEGRATION.md` | How apps can connect their own AI service through the SDK boundary |
| `deployment/sdk-v1-rollout-checklist.md` | Tester smoke checklist for a deployed Engine URL |

## Local checks

```bash
npm ci
npm run test:contracts
npm run build
npm run test:pack-install
npm publish --dry-run --tag beta --access public
```
