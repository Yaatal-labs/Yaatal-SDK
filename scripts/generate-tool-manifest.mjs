#!/usr/bin/env node
/**
 * generate-tool-manifest.mjs
 *
 * Generates a JSON tool manifest from the Yaatal SDK's exported methods,
 * grouped by resource. Auth is excluded (handled by the broker).
 *
 * The SDK exports 8 namespaces via YaatalClient: auth, products, orders,
 * bobo, delivery, search, notifications, analytics. This script mirrors
 * that surface into a structured manifest consumable by an MCP server.
 *
 * Usage:
 *   node ./scripts/generate-tool-manifest.mjs [--out <path>]
 *
 * Output: manifest.json (or path given by --out)
 */

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Method signature registry.
//
// Each entry maps a YaatalClient namespace -> array of method descriptors.
// A descriptor carries: the JS method name (camelCase), the action name
// (the short label exposed to the model), the read/write classification,
// and a params schema describing positional + body parameters.
//
// The registry is derived directly from src/*.ts so it stays in sync with
// the SDK surface. Read methods use HTTP GET semantics; write methods use
// POST/PATCH/PUT/DELETE.
// ---------------------------------------------------------------------------

/** @typedef {"R" | "W"} RWClass */

/**
 * @typedef {Object} ParamSpec
 * @property {string} name
 * @property {"string"|"number"|"boolean"|"object"|"array"|"integer"} type
 * @property {boolean} [required]
 * @property {string} [description]
 * @property {boolean} [positional] - true if it's a path/positional param
 */

/**
 * @typedef {Object} ActionDef
 * @property {string} name - action name (e.g. "list", "get", "create")
 * @property {string} method - dotted sdk path (e.g. "products.list")
 * @property {RWClass} rw - "R" (read) or "W" (write)
 * @property {string} description
 * @property {ParamSpec[]} [params] - parameters for the action
 */

/**
 * @typedef {Object} ToolDef
 * @property {string} name - tool name e.g. "yaatal.catalog"
 * @property {string} description
 * @property {ActionDef[]} actions
 */

/** Helper to keep param specs terse. */
const P = (name, type, opts = {}) => ({
  name,
  type,
  ...("required" in opts ? { required: opts.required } : {}),
  ...(opts.description ? { description: opts.description } : {}),
  ...(opts.positional ? { positional: true } : {}),
});

// --- Resource: products (catalog) ------------------------------------------
const productsActions = [
  {
    name: "list",
    method: "products.list",
    rw: "R",
    description: "List products with optional filtering and pagination.",
    params: [
      P("page", "integer", { description: "Page number (1-based)." }),
      P("per_page", "integer", { description: "Items per page." }),
      P("category", "string", { description: "Filter by category." }),
      P("merchant_id", "string", { description: "Filter by merchant id." }),
      P("search", "string", { description: "Free-text search query." }),
    ],
  },
  {
    name: "get",
    method: "products.get",
    rw: "R",
    description: "Fetch a single product by id.",
    params: [P("id", "string", { required: true, positional: true, description: "Product id." })],
  },
  {
    name: "create",
    method: "products.create",
    rw: "W",
    description: "Create a new product.",
    params: [
      P("name", "string", { required: true }),
      P("price_cents", "integer", { required: true }),
      P("stock", "integer", { required: true }),
      P("category", "string", { required: true }),
      P("description", "string"),
      P("discount_price_cents", "integer"),
      P("images", "string"),
    ],
  },
  {
    name: "update",
    method: "products.update",
    rw: "W",
    description: "Update an existing product by id.",
    params: [
      P("id", "string", { required: true, positional: true, description: "Product id." }),
      P("name", "string"),
      P("description", "string"),
      P("price_cents", "integer"),
      P("discount_price_cents", "integer"),
      P("stock", "integer"),
      P("category", "string"),
      P("images", "string"),
      P("is_active", "boolean"),
    ],
  },
  {
    name: "remove",
    method: "products.remove",
    rw: "W",
    description: "Delete a product by id.",
    params: [P("id", "string", { required: true, positional: true, description: "Product id." })],
  },
  {
    name: "upvote",
    method: "products.upvote",
    rw: "W",
    description: "Upvote a product by id.",
    params: [P("id", "string", { required: true, positional: true, description: "Product id." })],
  },
];

// --- Resource: orders -------------------------------------------------------
const ordersActions = [
  {
    name: "create",
    method: "orders.create",
    rw: "W",
    description: "Create a new order.",
    params: [
      P("seller_id", "string", { required: true }),
      P("items", "array", { required: true, description: "Array of { product_id, quantity }." }),
      P("payment_method", "string", { required: true }),
      P("delivery_method", "string", { required: true }),
    ],
  },
  {
    name: "list",
    method: "orders.list",
    rw: "R",
    description: "List orders with pagination.",
    params: [
      P("page", "integer"),
      P("per_page", "integer"),
    ],
  },
  {
    name: "me",
    method: "orders.me",
    rw: "R",
    description: "List the current user's orders.",
    params: [
      P("page", "integer"),
      P("per_page", "integer"),
    ],
  },
  {
    name: "get",
    method: "orders.get",
    rw: "R",
    description: "Fetch a single order by id.",
    params: [P("id", "string", { required: true, positional: true, description: "Order id." })],
  },
  {
    name: "update_status",
    method: "orders.updateStatus",
    rw: "W",
    description: "Update an order's status.",
    params: [
      P("id", "string", { required: true, positional: true, description: "Order id." }),
      P("status", "string", { required: true, description: "One of: pending, confirmed, shipped, delivered, cancelled." }),
    ],
  },
  {
    name: "cancel",
    method: "orders.cancel",
    rw: "W",
    description: "Cancel an order by id.",
    params: [P("id", "string", { required: true, positional: true, description: "Order id." })],
  },
];

// --- Resource: bobo (commerce / escrow) -------------------------------------
const boboActions = [
  {
    name: "checkout",
    method: "bobo.checkout",
    rw: "W",
    description: "Create a Bobo checkout (escrow-backed payment).",
    params: [
      P("payment_method", "string", { required: true, description: "'cash' or 'wave'." }),
      P("buyer_id", "string"),
      P("seller_id", "string"),
      P("product_id", "string"),
      P("quantity", "integer"),
      P("items", "array", { description: "Array of { product_id, quantity }." }),
      P("delivery_method", "string"),
      P("shipping_address", "string"),
      P("phone_number", "string"),
      P("payer_msisdn", "string"),
      P("idempotency_key", "string"),
    ],
  },
  {
    name: "payment_status",
    method: "bobo.paymentStatus",
    rw: "R",
    description: "Check the payment status of a Bobo order.",
    params: [P("order_id", "integer", { required: true, positional: true, description: "Bobo order id." })],
  },
  {
    name: "create_order",
    method: "bobo.createOrder",
    rw: "W",
    description: "Create a raw Bobo escrow order.",
    params: [
      P("merchant_id", "string", { required: true }),
      P("total_xof", "integer", { required: true }),
      P("delivery_lat", "number"),
      P("delivery_lng", "number"),
    ],
  },
  {
    name: "list_orders",
    method: "bobo.listOrders",
    rw: "R",
    description: "List Bobo orders.",
    params: [P("limit", "integer")],
  },
  {
    name: "get_order",
    method: "bobo.getOrder",
    rw: "R",
    description: "Fetch a single Bobo order (with escrow) by id.",
    params: [P("order_id", "integer", { required: true, positional: true, description: "Bobo order id." })],
  },
  {
    name: "escrow",
    method: "bobo.escrow",
    rw: "R",
    description: "Fetch the escrow record for a Bobo order.",
    params: [P("order_id", "integer", { required: true, positional: true, description: "Bobo order id." })],
  },
  {
    name: "confirm_delivery",
    method: "bobo.confirmDelivery",
    rw: "W",
    description: "Confirm delivery for a Bobo order, releasing escrow.",
    params: [P("order_id", "integer", { required: true, positional: true, description: "Bobo order id." })],
  },
  {
    name: "dispute",
    method: "bobo.dispute",
    rw: "W",
    description: "Open a dispute on a Bobo order.",
    params: [P("order_id", "integer", { required: true, positional: true, description: "Bobo order id." })],
  },
  {
    name: "cancel",
    method: "bobo.cancel",
    rw: "W",
    description: "Cancel a Bobo order.",
    params: [P("order_id", "integer", { required: true, positional: true, description: "Bobo order id." })],
  },
  {
    name: "submit_kyc",
    method: "bobo.submitKyc",
    rw: "W",
    description: "Submit KYC information for Bobo onboarding.",
    params: [
      P("provider", "string", { required: true }),
      P("document_hash_b64", "string", { required: true }),
      P("jurisdiction", "string", { required: true }),
    ],
  },
  {
    name: "kyc_status",
    method: "bobo.kycStatus",
    rw: "R",
    description: "Check the current user's KYC status.",
    params: [],
  },
];

// --- Resource: delivery -----------------------------------------------------
const deliveryActions = [
  {
    name: "create",
    method: "delivery.create",
    rw: "W",
    description: "Create a delivery request for an order.",
    params: [
      P("order_id", "string", { required: true }),
      P("method", "string"),
      P("pickup_address", "string"),
      P("dropoff_address", "string"),
      P("dropoff_lat", "number"),
      P("dropoff_lng", "number"),
      P("phone_number", "string"),
      P("notes", "string"),
    ],
  },
  {
    name: "list",
    method: "delivery.list",
    rw: "R",
    description: "List deliveries with optional filters.",
    params: [
      P("order_id", "string"),
      P("status", "string", { description: "Delivery status." }),
      P("limit", "integer"),
    ],
  },
  {
    name: "get",
    method: "delivery.get",
    rw: "R",
    description: "Fetch a single delivery by id.",
    params: [P("id", "string", { required: true, positional: true, description: "Delivery id." })],
  },
  {
    name: "update_status",
    method: "delivery.updateStatus",
    rw: "W",
    description: "Update the status of a delivery.",
    params: [
      P("id", "string", { required: true, positional: true, description: "Delivery id." }),
      P("status", "string", { required: true, description: "New delivery status." }),
      P("proof_note", "string"),
    ],
  },
  {
    name: "confirm",
    method: "delivery.confirm",
    rw: "W",
    description: "Confirm a delivery (mark as delivered with proof).",
    params: [
      P("id", "string", { required: true, positional: true, description: "Delivery id." }),
      P("proof_note", "string"),
    ],
  },
];

// --- Resource: search -------------------------------------------------------
const searchActions = [
  {
    name: "products",
    method: "search.products",
    rw: "R",
    description: "Search the product catalog.",
    params: [
      P("q", "string", { description: "Search query (alias: query)." }),
      P("query", "string", { description: "Alias for q." }),
      P("page", "integer"),
      P("per_page", "integer"),
      P("limit", "integer", { description: "Alias for per_page." }),
      P("category", "string"),
      P("merchant_id", "string"),
    ],
  },
  {
    name: "merchants",
    method: "search.merchants",
    rw: "R",
    description: "Search merchants.",
    params: [
      P("q", "string", { description: "Search query (alias: query)." }),
      P("query", "string", { description: "Alias for q." }),
      P("page", "integer"),
      P("per_page", "integer"),
      P("limit", "integer", { description: "Alias for per_page." }),
    ],
  },
  {
    name: "orders",
    method: "search.orders",
    rw: "R",
    description: "Search orders.",
    params: [
      P("q", "string", { description: "Search query (alias: query)." }),
      P("query", "string", { description: "Alias for q." }),
      P("page", "integer"),
      P("per_page", "integer"),
      P("limit", "integer", { description: "Alias for per_page." }),
      P("status", "string"),
      P("role", "string", { description: "'buyer' or 'seller'." }),
    ],
  },
];

// --- Resource: notifications ------------------------------------------------
const notificationsActions = [
  {
    name: "list",
    method: "notifications.list",
    rw: "R",
    description: "List notifications for the current user.",
    params: [P("limit", "integer")],
  },
  {
    name: "unread_count",
    method: "notifications.unreadCount",
    rw: "R",
    description: "Get the count of unread notifications.",
    params: [],
  },
  {
    name: "mark_read",
    method: "notifications.markRead",
    rw: "W",
    description: "Mark a single notification as read.",
    params: [P("id", "string", { required: true, positional: true, description: "Notification id." })],
  },
  {
    name: "mark_all_read",
    method: "notifications.markAllRead",
    rw: "W",
    description: "Mark all notifications as read.",
    params: [],
  },
];

// --- Resource: analytics ----------------------------------------------------
const analyticsActions = [
  {
    name: "track",
    method: "analytics.track",
    rw: "W",
    description: "Track an analytics event.",
    params: [
      P("event", "string", { required: true, description: "Event name." }),
      P("properties", "object", { description: "Arbitrary event properties." }),
    ],
  },
  {
    name: "identify",
    method: "analytics.identify",
    rw: "W",
    description: "Identify the current user with traits.",
    params: [
      P("traits", "object", { description: "User trait key/value pairs." }),
    ],
  },
];

// ---------------------------------------------------------------------------
// Tool group definitions.
//
// The `name` is the tool surface name exposed to the model; `namespace` is
// the property on YaatalClient that owns these methods.
// ---------------------------------------------------------------------------
const tools = [
  {
    name: "yaatal.catalog",
    namespace: "products",
    description: "Product catalog management.",
    actions: productsActions,
  },
  {
    name: "yaatal.orders",
    namespace: "orders",
    description: "Order lifecycle management.",
    actions: ordersActions,
  },
  {
    name: "yaatal.commerce",
    namespace: "bobo",
    description: "Bobo commerce, escrow payments, and KYC.",
    actions: boboActions,
  },
  {
    name: "yaatal.delivery",
    namespace: "delivery",
    description: "Delivery tracking and management.",
    actions: deliveryActions,
  },
  {
    name: "yaatal.search",
    namespace: "search",
    description: "Cross-resource search (products, merchants, orders).",
    actions: searchActions,
  },
  {
    name: "yaatal.notifications",
    namespace: "notifications",
    description: "User notification management.",
    actions: notificationsActions,
  },
  {
    name: "yaatal.analytics",
    namespace: "analytics",
    description: "Analytics event tracking and identification.",
    actions: analyticsActions,
  },
];

// ---------------------------------------------------------------------------
// Manifest assembly
// ---------------------------------------------------------------------------
const MANIFEST_VERSION = "0.1.0";

function buildManifest() {
  /** @type {{version: string, generated_at?: string, tools: ToolDef[]}} */
  const manifest = {
    version: MANIFEST_VERSION,
    tools: tools.map((t) => ({
      name: t.name,
      namespace: t.namespace,
      description: t.description,
      actions: t.actions.map((a) => ({
        name: a.name,
        method: a.method,
        rw: a.rw,
        description: a.description,
        params: a.params ?? [],
      })),
    })),
  };
  return manifest;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  let outArg = null;
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--out" || args[i] === "-o") && i + 1 < args.length) {
      outArg = args[++i];
    }
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const repoRoot = resolve(here, "..");
  const outPath = resolve(outArg ?? repoRoot, "manifest.json");

  const manifest = buildManifest();
  const json = JSON.stringify(manifest, null, 2) + "\n";

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, json, "utf8");

  const totalTools = manifest.tools.length;
  const totalActions = manifest.tools.reduce(
    (sum, t) => sum + t.actions.length,
    0,
  );
  const reads = manifest.tools.reduce(
    (sum, t) => sum + t.actions.filter((a) => a.rw === "R").length,
    0,
  );
  const writes = totalActions - reads;

  console.error(`manifest written to ${outPath}`);
  console.error(`  tools:    ${totalTools}`);
  console.error(`  actions:  ${totalActions} (${reads} read, ${writes} write)`);
}

main().catch((err) => {
  console.error("generate-tool-manifest: error:", err);
  process.exit(1);
});