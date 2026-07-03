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
  search products <query>
  auth login --email E --password P

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
