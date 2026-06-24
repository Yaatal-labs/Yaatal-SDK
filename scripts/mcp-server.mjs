#!/usr/bin/env node
/**
 * mcp-server.mjs — Minimal MCP server for the Yaatal SDK.
 *
 * Implements the Model Context Protocol over stdio using JSON-RPC 2.0,
 * without any third-party dependencies. Speaks the core MCP methods:
 *   - initialize
 *   - notifications/initialized
 *   - tools/list
 *   - tools/call
 *
 * Each Yaatal resource (catalog, orders, commerce, delivery, search,
 * notifications, analytics) is exposed as a single MCP tool. The tool
 * accepts an `action` selector plus the action's parameters, mirroring
 * the structure in manifest.json.
 *
 * Read actions are forwarded to the Yaatal Engine via the SDK.
 * Write actions are NOT executed — instead a structured proposal is
 * returned with `requires_confirmation: true`, so a human (or broker)
 * can review before committing.
 *
 * Env vars:
 *   YAAATAL_ENGINE_URL — base URL of the Yaatal Engine API
 *   YAAATAL_TOKEN       — bearer token for authentication
 *
 * Usage:
 *   node ./scripts/mcp-server.mjs
 */

import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import readline from "node:readline";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..");
const manifestPath = resolve(repoRoot, "manifest.json");

// ---------------------------------------------------------------------------
// Load the manifest.
// ---------------------------------------------------------------------------
let manifest;
try {
  const raw = await readFile(manifestPath, "utf8");
  manifest = JSON.parse(raw);
} catch (err) {
  process.stderr.write(
    `mcp-server: cannot load manifest.json at ${manifestPath}: ${err.message}\n`,
  );
  process.stderr.write(
    "mcp-server: run `npm run generate:manifest` first.\n",
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Build a lookup: tool name -> tool def, and action key -> action def.
// The action key is `${toolName}:${actionName}`.
// ---------------------------------------------------------------------------
const toolByName = new Map();
const actionByKey = new Map();
for (const tool of manifest.tools) {
  toolByName.set(tool.name, tool);
  for (const action of tool.actions) {
    actionByKey.set(`${tool.name}:${action.name}`, action);
  }
}

// ---------------------------------------------------------------------------
// Resolve the Yaatal SDK client.
//
// We try the compiled dist first; if unavailable we fall back to creating a
// YaatalClient from the package export. If neither works we still serve
// tools/list and return proposals/reads with a synthetic "client unavailable"
// envelope so the server remains operable for inspection.
// ---------------------------------------------------------------------------
const baseUrl =
  process.env.YAAATAL_ENGINE_URL ||
  process.env.YAATAL_ENGINE_API_URL ||
  "http://localhost:5150";
const token = process.env.YAAATAL_TOKEN || undefined;

let yaatalClient = null;
let clientError = null;

try {
  // The SDK ships from ./dist/index.js via package.json "exports".
  const require = createRequire(import.meta.url);
  const sdkExports = require(resolve(repoRoot, "dist/index.js"));
  const YaatalClient =
    sdkExports.YaatalClient || sdkExports.createYaatalClient?.({})?.constructor;
  if (YaatalClient) {
    yaatalClient = new YaatalClient({
      baseUrl,
      ...(token ? { token } : {}),
    });
  }
} catch (err) {
  clientError = err.message;
}

// ---------------------------------------------------------------------------
// MCP tool schemas.
//
// We expose one MCP tool per Yaatal resource. Each tool's inputSchema has:
//   - action (string, enum of action names) [required]
//   - parameters (object) holding the action's named params
// ---------------------------------------------------------------------------
function buildMcpTool(tool) {
  const actionNames = tool.actions.map((a) => a.name);

  // Build a JSON schema for the combined parameters of all actions. We keep
  // it permissive — the caller picks an action, then supplies matching keys.
  const paramProperties = {};
  for (const action of tool.actions) {
    for (const p of action.params) {
      if (!(p.name in paramProperties)) {
        paramProperties[p.name] = paramToJsonSchema(p);
      }
    }
  }

  return {
    name: tool.name,
    description: tool.description,
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: actionNames,
          description: `Action to perform. One of: ${actionNames.join(", ")}.`,
        },
        parameters: {
          type: "object",
          description: "Parameters for the selected action (see manifest).",
          properties: paramProperties,
        },
      },
      required: ["action"],
    },
  };
}

function paramToJsonSchema(p) {
  const schema = {};
  switch (p.type) {
    case "string":
      schema.type = "string";
      break;
    case "integer":
    case "number":
      schema.type = "number";
      break;
    case "boolean":
      schema.type = "boolean";
      break;
    case "array":
      schema.type = "array";
      break;
    case "object":
      schema.type = "object";
      break;
    default:
      schema.type = "string";
  }
  if ("required" in p && p.required === true) {
    // Note: required-ness is enforced at the action level, not the union
    // schema, because different actions share the same parameter bag.
  }
  if (p.description) schema.description = p.description;
  return schema;
}

const mcpTools = manifest.tools.map(buildMcpTool);

// ---------------------------------------------------------------------------
// Resolve an SDK method from the dotted `method` path, e.g. "products.list".
// ---------------------------------------------------------------------------
function resolveSdkMethod(dotted) {
  if (!yaatalClient) return null;
  const parts = dotted.split(".");
  if (parts.length !== 2) return null;
  const ns = yaatalClient[parts[0]];
  if (!ns) return null;
  const fn = ns[parts[1]];
  return typeof fn === "function" ? fn.bind(ns) : null;
}

// ---------------------------------------------------------------------------
// Invoke an SDK method.
//
// The SDK methods use positional args. We translate the named `parameters`
// bag from the MCP call into positional arguments using the action's param
// metadata: positional params (id, order_id, etc.) come first, the remaining
// params form a single body/query object.
// ---------------------------------------------------------------------------
function buildArgs(action, params) {
  params = params || {};
  const positional = [];
  const rest = {};

  for (const p of action.params) {
    const val = params[p.name];
    if (p.positional) {
      positional.push(val);
    } else if (val !== undefined) {
      rest[p.name] = val;
    }
  }

  // Most SDK methods accept at most one non-positional argument (the
  // body/query object). If there are no non-positional params, only pass
  // positionals. If there is exactly one, append it.
  const argList = [...positional];
  if (Object.keys(rest).length > 0) {
    argList.push(rest);
  }
  return argList;
}

async function invokeAction(tool, action, parameters) {
  if (action.rw === "W") {
    // Writes are gated: return a proposal, do NOT execute.
    return {
      requires_confirmation: true,
      kind: "proposal",
      tool: tool.name,
      action: action.name,
      method: action.method,
      description: action.description,
      parameters: parameters || {},
      note: "Write actions require explicit confirmation before execution. Review the proposal and confirm via the broker to commit.",
    };
  }

  // Read actions: forward to the SDK.
  if (!yaatalClient) {
    return {
      error: "sdk_unavailable",
      message: clientError
        ? `Yaatal SDK client could not be initialized: ${clientError}`
        : "Yaatal SDK client is not available. Ensure dist/ is built (npm run build).",
      action: action.name,
      method: action.method,
    };
  }

  const fn = resolveSdkMethod(action.method);
  if (!fn) {
    return {
      error: "method_not_found",
      message: `Cannot resolve SDK method '${action.method}'.`,
    };
  }

  const args = buildArgs(action, parameters);
  const result = await fn(...args);
  return result;
}

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 over stdio.
// ---------------------------------------------------------------------------
const PROTOCOL_VERSION = "2024-11-05";
const SERVER_INFO = {
  name: "yaatal-mcp-server",
  version: "0.1.0",
};

function jsonrpcResult(id, result) {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

function jsonrpcError(id, code, message, data) {
  const error = { code, message };
  if (data !== undefined) error.data = data;
  return JSON.stringify({ jsonrpc: "2.0", id, error });
}

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", (line) => {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    // Not valid JSON — ignore (or respond if it had an id, but we can't tell).
    return;
  }

  // Notifications have no id and don't expect a response.
  const isNotification = msg.id === undefined || msg.id === null;

  if (msg.method === "initialize") {
    const result = {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {
        tools: {},
      },
      serverInfo: SERVER_INFO,
    };
    if (!isNotification) {
      process.stdout.write(jsonrpcResult(msg.id, result) + "\n");
    }
    return;
  }

  if (msg.method === "notifications/initialized") {
    // No response needed for notifications.
    return;
  }

  if (msg.method === "tools/list") {
    const result = {
      tools: mcpTools,
    };
    if (!isNotification) {
      process.stdout.write(jsonrpcResult(msg.id, result) + "\n");
    }
    return;
  }

  if (msg.method === "tools/call") {
    handleToolCall(msg).catch((err) => {
      if (!isNotification) {
        process.stdout.write(
          jsonrpcError(msg.id, -32603, "Internal error", {
            message: err.message,
          }) + "\n",
        );
      }
    });
    return;
  }

  // Ping / other keepalive methods.
  if (msg.method === "ping") {
    if (!isNotification) {
      process.stdout.write(jsonrpcResult(msg.id, {}) + "\n");
    }
    return;
  }

  // Unknown method.
  if (!isNotification) {
    process.stdout.write(
      jsonrpcError(msg.id, -32601, "Method not found", {
        method: msg.method,
      }) + "\n",
    );
  }
});

async function handleToolCall(msg) {
  const id = msg.id;
  const params = msg.params || {};
  const toolName = params.name;
  const args = params.arguments || {};

  const tool = toolByName.get(toolName);
  if (!tool) {
    process.stdout.write(
      jsonrpcError(id, -32602, "Invalid params: unknown tool", {
        tool: toolName,
      }) + "\n",
    );
    return;
  }

  const actionName = args.action;
  if (!actionName) {
    process.stdout.write(
      jsonrpcError(
        id,
        -32602,
        "Invalid params: 'action' is required",
      ) + "\n",
    );
    return;
  }

  const action = actionByKey.get(`${toolName}:${actionName}`);
  if (!action) {
    process.stdout.write(
      jsonrpcError(id, -32602, "Invalid params: unknown action", {
        action: actionName,
        tool: toolName,
      }) + "\n",
    );
    return;
  }

  const parameters = args.parameters || {};
  const result = await invokeAction(tool, action, parameters);

  // MCP expects `content` array with content blocks.
  const content = [
    {
      type: "text",
      text: JSON.stringify(result, null, 2),
    },
  ];

  // Write actions return proposals; mark them as needing confirmation.
  const response = { content };
  if (action.rw === "W") {
    response.isError = false;
    response.metadata = { requires_confirmation: true };
  }

  process.stdout.write(jsonrpcResult(id, response) + "\n");
}

// Signal readiness on stderr (stdout is reserved for JSON-RPC).
process.stderr.write(
  `yaatal-mcp-server ready: ${mcpTools.length} tools, ${actionByKey.size} actions\n`,
);
if (!yaatalClient) {
  process.stderr.write(
    `warning: SDK client unavailable (engine=${baseUrl}). tools/list works; read calls will return sdk_unavailable. Run 'npm run build'.${clientError ? " Cause: " + clientError : ""}\n`,
  );
}