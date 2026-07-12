#!/usr/bin/env node
// This package has no @types/node (it stays browser/React-Native safe — see
// env.ts's globalThis casts). The CLI is the one Node-only entry point; it
// pulls in just the slivers of the Node surface it touches via casts instead
// of adding @types/node as a new dependency. TS hard-codes "node:"-prefixed
// specifiers as requiring real Node types, so the import itself needs one
// narrow suppression; the wrapper type below keeps every call site typed.
// @ts-expect-error -- no @types/node; parseArgs is typed by ParseArgsFn below.
import { parseArgs as nodeParseArgs } from "node:util";
import {
  createDynamicMerchantQr,
  createStaticMerchantQr,
  createYaatalClient,
  YaatalApiError,
  type YaatalClient,
} from "./index.js";

type ParseArgsFn = (config: {
  args?: string[];
  options?: Record<string, { type: "string" }>;
  strict?: boolean;
  allowPositionals?: boolean;
}) => { values: Record<string, string | undefined>; positionals: string[] };

const parseArgs = nodeParseArgs as unknown as ParseArgsFn;

interface NodeProcess {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode: number | undefined;
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
}

function nodeProcess(): NodeProcess {
  const runtime = globalThis as typeof globalThis & { process?: NodeProcess };
  if (!runtime.process) {
    throw new Error("the yaatal CLI requires a Node.js runtime");
  }
  return runtime.process;
}

const process = nodeProcess();

const HELP = `yaatal - kernel CLI for Yaatal Engine (agent-first, JSON only)

Usage:
  yaatal <command> <subcommand> [args] [options]
  yaatal --help

Environment:
  YAATAL_ENGINE_URL   Engine base URL (required, e.g. http://localhost:5150)
  YAATAL_TOKEN        Bearer token for authenticated requests (optional)

Commands:
  products list [--limit N]
  products get <id>
  orders list
  orders get <id>
  deliveries list [--order-id X]
  deliveries get <id>
  deliveries confirm-by-code <code>
  proposals list [--status <s>]
  proposals approve <id>
  proposals reject <id>
  social events [--platform <p>] [--since <ts>] [--limit N]
  search products <query>
  auth login --email E --password P
  pispi qr --alias <uuid-v4> [--amount <xof>] [--name <s>] [--city <s>] [--ref <s>] [--country <cc>]

pispi qr:
  Generates a BCEAO PI-SPI interoperable payment-QR payload offline (no
  Engine call). --alias must be a UUID v4 (the package's own validator
  rejects anything else). --amount present -> DYNAMIC QR; omitted -> STATIC.
  --ref sets the payer-facing reference label (default "YAATAL"); --country
  is a UEMOA ISO2 code (default "SN"). --name/--city are accepted but
  currently have no effect on the payload -- see src/pispi.ts. Format-valid
  QRs generate today; scanning them in production requires a real merchant
  alias from PI-SPI onboarding (see Yaatal-Engine's
  docs/PISPI-API-NOTES.md).

Output contract:
  Success            -> JSON result on stdout, exit 0
  API/network error  -> {"error":..., "status":...} on stderr, exit 1
  Usage error        -> {"error":..., "status":null} on stderr, exit 2

There are no interactive prompts. Run "yaatal --help" or
"yaatal <command> --help" any time; both print this page.
`;

class UsageError extends Error {}

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value ?? null)}\n`);
}

function printError(error: unknown, status: number | null = null): void {
  process.stderr.write(`${JSON.stringify({ error, status })}\n`);
}

function requirePositional(rest: string[], usage: string): string {
  const value = rest[0];
  if (!value) {
    throw new UsageError(`missing argument: ${usage}`);
  }
  return value;
}

function requireInt(value: string, flag: string): number {
  const n = Number(value);
  if (!Number.isInteger(n)) {
    throw new UsageError(`${flag} must be an integer`);
  }
  return n;
}

function parseFlags(
  rest: string[],
  options: Record<string, { type: "string" }>,
): Record<string, string | undefined> {
  try {
    const { values } = parseArgs({
      args: rest,
      options,
      strict: true,
      allowPositionals: false,
    });
    return values as Record<string, string | undefined>;
  } catch (err) {
    throw new UsageError(err instanceof Error ? err.message : String(err));
  }
}

async function productsCommand(
  client: YaatalClient,
  sub: string | undefined,
  rest: string[],
): Promise<unknown> {
  switch (sub) {
    case "list": {
      const { limit } = parseFlags(rest, { limit: { type: "string" } });
      return client.products.list(
        limit === undefined ? {} : { per_page: requireInt(limit, "--limit") },
      );
    }
    case "get":
      return client.products.get(requirePositional(rest, "products get <id>"));
    default:
      throw new UsageError(`unknown products subcommand: ${sub ?? "(none)"}`);
  }
}

async function ordersCommand(
  client: YaatalClient,
  sub: string | undefined,
  rest: string[],
): Promise<unknown> {
  switch (sub) {
    case "list":
      return client.orders.list();
    case "get":
      return client.orders.get(requirePositional(rest, "orders get <id>"));
    default:
      throw new UsageError(`unknown orders subcommand: ${sub ?? "(none)"}`);
  }
}

async function deliveriesCommand(
  client: YaatalClient,
  sub: string | undefined,
  rest: string[],
): Promise<unknown> {
  switch (sub) {
    case "list": {
      const values = parseFlags(rest, { "order-id": { type: "string" } });
      const orderId = values["order-id"];
      return client.delivery.list(
        orderId === undefined ? {} : { order_id: orderId },
      );
    }
    case "get":
      return client.delivery.get(requirePositional(rest, "deliveries get <id>"));
    case "confirm-by-code": {
      const code = requirePositional(
        rest,
        "deliveries confirm-by-code <code>",
      );
      return client.delivery.confirmByCode({ delivery_code: code });
    }
    default:
      throw new UsageError(`unknown deliveries subcommand: ${sub ?? "(none)"}`);
  }
}

async function proposalsCommand(
  client: YaatalClient,
  sub: string | undefined,
  rest: string[],
): Promise<unknown> {
  switch (sub) {
    case "list": {
      const { status } = parseFlags(rest, { status: { type: "string" } });
      return client.harness.list(status === undefined ? {} : { status });
    }
    case "approve":
      return client.harness.approve(
        requirePositional(rest, "proposals approve <id>"),
      );
    case "reject":
      return client.harness.reject(
        requirePositional(rest, "proposals reject <id>"),
      );
    default:
      throw new UsageError(`unknown proposals subcommand: ${sub ?? "(none)"}`);
  }
}

async function socialCommand(
  client: YaatalClient,
  sub: string | undefined,
  rest: string[],
): Promise<unknown> {
  switch (sub) {
    case "events": {
      const { platform, since, limit } = parseFlags(rest, {
        platform: { type: "string" },
        since: { type: "string" },
        limit: { type: "string" },
      });
      return client.social.events({
        ...(platform === undefined ? {} : { platform }),
        ...(since === undefined ? {} : { since }),
        ...(limit === undefined ? {} : { limit: requireInt(limit, "--limit") }),
      });
    }
    default:
      throw new UsageError(`unknown social subcommand: ${sub ?? "(none)"}`);
  }
}

async function searchCommand(
  client: YaatalClient,
  sub: string | undefined,
  rest: string[],
): Promise<unknown> {
  switch (sub) {
    case "products":
      return client.search.products({
        q: requirePositional(rest, "search products <query>"),
      });
    default:
      throw new UsageError(`unknown search subcommand: ${sub ?? "(none)"}`);
  }
}

async function authCommand(
  client: YaatalClient,
  sub: string | undefined,
  rest: string[],
): Promise<unknown> {
  switch (sub) {
    case "login": {
      const { email, password } = parseFlags(rest, {
        email: { type: "string" },
        password: { type: "string" },
      });
      if (!email || !password) {
        throw new UsageError("auth login requires --email and --password");
      }
      return client.auth.login({ email, password });
    }
    default:
      throw new UsageError(`unknown auth subcommand: ${sub ?? "(none)"}`);
  }
}

async function pispiCommand(
  sub: string | undefined,
  rest: string[],
): Promise<unknown> {
  switch (sub) {
    case "qr": {
      const values = parseFlags(rest, {
        alias: { type: "string" },
        amount: { type: "string" },
        name: { type: "string" },
        city: { type: "string" },
        ref: { type: "string" },
        country: { type: "string" },
      });
      const alias = values.alias;
      if (!alias) {
        throw new UsageError("pispi qr requires --alias <uuid-v4>");
      }

      const input = {
        alias,
        countryCode: values.country ?? "SN",
        referenceLabel: values.ref ?? "YAATAL",
        ...(values.name === undefined ? {} : { merchantName: values.name }),
        ...(values.city === undefined ? {} : { merchantCity: values.city }),
      };

      try {
        return values.amount === undefined
          ? createStaticMerchantQr(input)
          : createDynamicMerchantQr({
              ...input,
              amount: requireInt(values.amount, "--amount"),
            });
      } catch (err) {
        // @pi-spi/qrcode throws a plain Error on any invalid input (alias
        // not UUID v4, unsupported country code, referenceLabel too long,
        // ...). This command is pure/offline -- no network call happens --
        // so any error thrown here is by definition a usage error, not an
        // API/network failure.
        throw new UsageError(err instanceof Error ? err.message : String(err));
      }
    }
    default:
      throw new UsageError(`unknown pispi subcommand: ${sub ?? "(none)"}`);
  }
}

async function dispatch(
  client: YaatalClient,
  command: string,
  sub: string | undefined,
  rest: string[],
): Promise<unknown> {
  switch (command) {
    case "products":
      return productsCommand(client, sub, rest);
    case "orders":
      return ordersCommand(client, sub, rest);
    case "deliveries":
      return deliveriesCommand(client, sub, rest);
    case "proposals":
      return proposalsCommand(client, sub, rest);
    case "social":
      return socialCommand(client, sub, rest);
    case "search":
      return searchCommand(client, sub, rest);
    case "auth":
      return authCommand(client, sub, rest);
    default:
      throw new UsageError(`unknown command: ${command}`);
  }
}

async function run(argv: string[]): Promise<number> {
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write(HELP);
    return 0;
  }

  const [command, sub, ...rest] = argv;

  try {
    if (!command) {
      throw new UsageError("missing command; run: yaatal --help");
    }

    // pispi qr is pure/offline (no Engine call) -- it must not require
    // YAATAL_ENGINE_URL, unlike every other command below.
    if (command === "pispi") {
      const result = await pispiCommand(sub, rest);
      printJson(result);
      return 0;
    }

    const engineUrl = process.env["YAATAL_ENGINE_URL"];
    if (!engineUrl) {
      throw new UsageError(
        "YAATAL_ENGINE_URL is required (set it to your Engine base URL)",
      );
    }

    const token = process.env["YAATAL_TOKEN"];
    const client = createYaatalClient({
      baseUrl: engineUrl,
      ...(token ? { token } : {}),
    });

    const result = await dispatch(client, command, sub, rest);
    printJson(result);
    return 0;
  } catch (err) {
    if (err instanceof UsageError) {
      printError(err.message);
      return 2;
    }

    if (err instanceof YaatalApiError) {
      printError(err.body ?? err.message, err.status);
      return 1;
    }

    printError(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

run(process.argv.slice(2)).then((code) => {
  process.exitCode = code;
});
