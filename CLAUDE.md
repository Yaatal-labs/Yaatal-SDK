# CLAUDE.md

`@yaatal/client` — typed TypeScript client for Yaatal Engine (plus a tool-manifest generator and
a minimal MCP server). The Engine owns all business state; this package owns request shapes, auth
headers, typed responses, and API errors. See `README.md` and `ROADMAP.md`.

## Available CLIs

- `yaatal` (`src/cli.ts`, built to `dist/cli.js`, `bin` entry in `package.json`) — the kernel CLI
  wrapping this package's client. Agent-first: every command prints one JSON value to stdout on
  success (exit 0); API/network errors print `{"error":..., "status":...}` to stderr (exit 1);
  usage errors print the same shape (exit 2). No interactive prompts. Config via
  `YAATAL_ENGINE_URL` (required) and `YAATAL_TOKEN` (optional). Run `yaatal --help` for the full
  command reference (`products`, `orders`, `deliveries`, `search`, `auth`). See the README's "CLI"
  section for details, and `scripts/cli-smoke.mjs` (`npm run test:cli`) for the runnable check.

## Development policy — Ponytail (lazy senior dev mode)

Agent-written code in this repo follows the [Ponytail](https://github.com/DietrichGebert/ponytail)
(MIT) efficiency ladder. Before writing code, stop at the first rung that holds:

1. Does this need to be built at all? (YAGNI) → skip it
2. Does it already exist in this codebase? → reuse the helper/util/pattern
3. Does the standard library do it? → use it
4. Does a native platform feature cover it? → use it
5. Does an already-installed dependency solve it? → use it
6. Can it be one line? → make it one line
7. Only then: write the minimum working code

The ladder runs **after** you understand the problem, not instead of it — read fully, trace the
real flow end-to-end, then climb. Fix root causes once, not symptoms per caller. No abstractions
that weren't requested; no new dependency if avoidable; deletion over addition; boring over
clever. Mark intentional simplifications with `ponytail:` comments naming the known ceiling and
the upgrade path.

Never lazy about: understanding the problem, input validation at trust boundaries, error handling
that prevents data loss, security, explicit requirements — and non-trivial logic leaves one
runnable check behind.

Full skills (`/ponytail-review`, `/ponytail-audit`, `/ponytail-debt`):
`/plugin marketplace add DietrichGebert/ponytail` → `/plugin install ponytail@ponytail`.
