# Examples / Exemples

These examples are for contributors wiring apps to Engine through
`@yaatal/client`.

Ces exemples aident les contributeurs a brancher des apps a Engine via
`@yaatal/client`.

## Files

| File | Use |
|---|---|
| `bobo-client-factory.ts` | Minimal BOBO-style client factory and service wrapper |
| `node-smoke.mjs` | Node smoke script using a mocked `fetch` implementation |

## Run The Node Smoke Example

Build the SDK first:

```bash
npm ci
npm run build
```

Then run:

```bash
npm run example:node-smoke
```

The smoke script does not call a real Engine. It verifies URL construction,
bearer auth, JSON body handling, and typed import shape.
