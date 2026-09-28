import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function read(relativePath) {
  return readFileSync(join(root, relativePath), "utf8");
}

function assertContains(name, source, expected) {
  if (!source.includes(expected)) {
    throw new Error(`${name} is missing ${expected}`);
  }
}

function assertNotContains(name, source, forbidden) {
  if (source.includes(forbidden)) {
    throw new Error(`${name} still contains forbidden contract ${forbidden}`);
  }
}

const files = {
  auth: read("src/auth.ts"),
  ai: read("src/ai.ts"),
  inference: read("src/inference.ts"),
  livekit: read("src/livekit.ts"),
  voice: read("src/voice.ts"),
  client: read("src/client.ts"),
  analytics: read("src/analytics.ts"),
  bobo: read("src/bobo.ts"),
  delivery: read("src/delivery.ts"),
  harness: read("src/harness.ts"),
  notifications: read("src/notifications.ts"),
  orders: read("src/orders.ts"),
  products: read("src/products.ts"),
  search: read("src/search.ts"),
  social: read("src/social.ts"),
  index: read("src/index.ts"),
};

for (const namespace of [
  "ai",
  "livekit",
  "voice",
  "analytics",
  "auth",
  "bobo",
  "delivery",
  "harness",
  "notifications",
  "products",
  "orders",
  "search",
  "social",
]) {
  assertContains("client.ts", files.client, `readonly ${namespace}:`);
}

const expectedRoutes = {
  auth: ["/api/auth/whatsapp/start", "/api/auth/whatsapp/status/", "/api/auth/whatsapp/verify", "/api/auth/bootstrap/start", "/api/auth/bootstrap", "/api/auth/verify/"],
  ai: ["/api/ai/chat", "/api/ai/chat/sync"],
  inference: ["/v1/models", "/v1/chat/completions", "/v1/balance"],
  livekit: ["/api/livekit/token"],
  voice: ["/api/voice/transcribe", "/api/voice/session"],
  analytics: [
    "/api/analytics/track",
    "/api/analytics/identify",
  ],
  delivery: [
    "/api/delivery/drivers",
    "/api/delivery/assign",
    "/api/delivery/preferences",
  ],
  bobo: [
    "/api/bobo/checkout",
    "/api/bobo/orders",
    "/api/bobo/kyc",
    "/confirm-delivery",
    "/dispute",
    "/cancel",
  ],
  delivery: [
    "/api/deliveries",
    "/status",
    "/confirm",
  ],
  harness: [
    "/api/harness/proposals",
    "/approve",
    "/reject",
  ],
  notifications: [
    "/api/notifications",
    "/api/notifications/unread-count",
    "/read",
    "/read-all",
  ],
  orders: [
    "/api/orders",
    "/api/orders/me",
    "/status",
    "/cancel",
  ],
  products: [
    "/api/products",
    "/upvote",
  ],
  search: [
    "/api/search/products",
    "/api/search/merchants",
    "/api/search/orders",
  ],
  social: [
    "/api/social/events",
  ],
};

for (const [name, routes] of Object.entries(expectedRoutes)) {
  for (const route of routes) {
    assertContains(`${name}.ts`, files[name], route);
  }
}

for (const [name, source] of Object.entries(files)) {
  for (const forbidden of [
    "simulatePayment",
    "simulate-payment",
    "updatePayment",
    "UpdatePaymentStatusRequest",
    "active_only",
    "SearchMetadata",
    "SearchHighlights",
  ]) {
    assertNotContains(`${name}.ts`, source, forbidden);
  }
}

for (const exported of [
  "AiClient",
  "LiveKitClient",
  "VoiceClient",
  "YaatalInferenceClient",
  "createYaatalInference",
  "AnalyticsClient",
  "BoboClient",
  "DeliveryClient",
  "HarnessClient",
  "NotificationsClient",
  "OrdersClient",
  "ProductsClient",
  "SearchClient",
  "SocialClient",
  "JsonObject",
  "JsonValue",
]) {
  assertContains("index.ts", files.index, exported);
}

console.log("SDK contract smoke passed");
