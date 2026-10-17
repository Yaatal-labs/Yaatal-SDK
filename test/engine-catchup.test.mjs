// Behaviour of the namespaces added to catch up with Engine main (catalog is covered upstream): each call's URL, method, body,
// auth header and parsing, against a fake fetch that answers with Engine's response shapes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createYaatalClient, createKairmelClient, KairmelApiError } from "../dist/index.js";

const ENGINE = "https://engine.test";
const API = "https://api.test";

function fakeFetch(answer) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const headers = new Headers(init.headers);
    const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    calls.push({ url: String(url), method: init.method ?? "GET", headers, body });
    const result = answer(String(url), init);
    if (result instanceof Response) return result;
    return Response.json(result ?? {});
  };
  return { fetch, calls };
}

test("WhatsApp sign-in: start, poll, verify, and the session token is kept", async () => {
  const { fetch, calls } = fakeFetch(url => {
    if (url.endsWith("/start")) return { nonce: "ACD3", whatsapp_url: "https://wa.me/221700000000?text=LOGIN-ACD3", expires_in_seconds: 600 };
    if (url.includes("/status/")) return { code_sent: true };
    if (url.endsWith("/verify")) return { token: "jwt-1", pid: "p1", name: "Awa", is_verified: true };
    if (url.endsWith("/current")) return { pid: "p1", name: "Awa", email: "" };
  });
  const client = createYaatalClient({ baseUrl: ENGINE, fetch });

  const start = await client.auth.startWhatsApp();
  assert.equal(start.nonce, "ACD3");
  assert.equal((await client.auth.whatsappStatus("ACD3")).code_sent, true);
  const login = await client.auth.verifyWhatsApp({ nonce: "ACD3", code: "123456" });
  assert.equal(login.token, "jwt-1");
  await client.auth.current();

  assert.deepEqual(calls.map(c => `${c.method} ${c.url}`), [
    `POST ${ENGINE}/api/auth/whatsapp/start`,
    `GET ${ENGINE}/api/auth/whatsapp/status/ACD3`,
    `POST ${ENGINE}/api/auth/whatsapp/verify`,
    `GET ${ENGINE}/api/auth/current`,
  ]);
  assert.deepEqual(calls[2].body, { nonce: "ACD3", code: "123456" });
  assert.equal(calls[0].headers.get("authorization"), null, "start is anonymous");
  assert.equal(calls[3].headers.get("authorization"), "Bearer jwt-1", "verify keeps the session");
});

test("bootstrap: mint with the session, redeem for identity only", async () => {
  const { fetch, calls } = fakeFetch(url => url.endsWith("/start")
    ? { nonce: "n".repeat(43), surface: "studio", expires_in_seconds: 60 }
    : { authenticated: true, surface: "studio", pid: "p1", name: "Awa", is_verified: true });
  const client = createYaatalClient({ baseUrl: ENGINE, token: "jwt-1", fetch });

  const grant = await client.auth.startBootstrap({ surface: "studio" });
  const who = await client.auth.redeemBootstrap({ nonce: grant.nonce, surface: "studio" });
  assert.equal(who.pid, "p1");
  assert.equal(calls[0].url, `${ENGINE}/api/auth/bootstrap/start`);
  assert.equal(calls[0].headers.get("authorization"), "Bearer jwt-1");
  assert.deepEqual(calls[1].body, { nonce: grant.nonce, surface: "studio" });
});

test("email verification link", async () => {
  const { fetch, calls } = fakeFetch(() => ({}));
  await createYaatalClient({ baseUrl: ENGINE, fetch }).auth.verifyEmail("tok/en");
  assert.equal(calls[0].url, `${ENGINE}/api/auth/verify/tok%2Fen`);
});

test("Engine AI: messages only, the server picks the model", async () => {
  const { fetch, calls } = fakeFetch(() => ({ content: "Waaw", tier_used: 1, model: "m", request_id: "r1", capability: "chat" }));
  const client = createYaatalClient({ baseUrl: ENGINE, token: "jwt-1", fetch });
  const reply = await client.ai.chat({ messages: [{ role: "user", content: "Salaam" }] });
  await client.ai.chatSync({ messages: [{ role: "user", content: "Salaam" }] });
  assert.equal(reply.request_id, "r1");
  assert.deepEqual(calls.map(c => c.url), [`${ENGINE}/api/ai/chat`, `${ENGINE}/api/ai/chat/sync`]);
  assert.equal("model" in calls[0].body, false);
});

test("voice: raw audio upload, and a WebSocket session URL", async () => {
  const { fetch, calls } = fakeFetch(() => ({ transcription: "Na nga def" }));
  const client = createYaatalClient({ baseUrl: ENGINE, token: "jwt-1", fetch });
  const audio = new Uint8Array([82, 73, 70, 70]);

  const result = await client.voice.transcribe(audio, { contentType: "audio/wav" });
  assert.equal(result.transcription, "Na nga def");
  assert.equal(calls[0].url, `${ENGINE}/api/voice/transcribe`);
  assert.equal(calls[0].headers.get("content-type"), "audio/wav");
  assert.equal(calls[0].body, audio, "the body is the raw audio, not JSON");
  assert.equal(client.voice.sessionUrl(), "wss://engine.test/api/voice/session?token=jwt-1");
  assert.throws(() => createYaatalClient({ baseUrl: ENGINE, fetch }).voice.sessionUrl(), /signed-in/);
});

test("LiveKit token", async () => {
  const { fetch, calls } = fakeFetch(() => ({ token: "lk", url: "wss://lk.test", room: "live-1", identity: "p1", recording_enabled: false }));
  const client = createYaatalClient({ baseUrl: ENGINE, token: "jwt-1", fetch });
  const token = await client.livekit.token({ live_session_id: "1", room_type: "broadcast" });
  assert.equal(token.url, "wss://lk.test");
  assert.deepEqual(calls[0].body, { live_session_id: "1", room_type: "broadcast" });
});

test("Kairmel API: public models with XOF prices, keyed chat and balance", async () => {
  const { fetch, calls } = fakeFetch(url => {
    if (url.endsWith("/v1/models")) return { object: "list", data: [{ id: "kairmel/nemotron-3-super", object: "model", owned_by: "yaatal", tier: "standard", pricing: { currency: "XOF", input_per_million: 600, output_per_million: 1800 }, max_output_tokens: 8192 }] };
    if (url.endsWith("/v1/chat/completions")) return { id: "c1", object: "chat.completion", model: "kairmel/nemotron-3-super", choices: [{ index: 0, message: { role: "assistant", content: "Waaw" }, finish_reason: "stop" }], usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 } };
    if (url.endsWith("/v1/balance")) return { balance_xof: 4998.5, recent: [] };
  });
  const api = createKairmelClient({ baseUrl: `${API}/`, apiKey: "yk_test", fetch });

  const [model] = await api.models();
  assert.equal(model.pricing.currency, "XOF");
  const reply = await api.chat({ model: model.id, messages: [{ role: "user", content: "Salaam" }] });
  assert.equal(reply.choices[0].message.content, "Waaw");
  assert.equal((await api.balance()).balance_xof, 4998.5);

  assert.equal(calls[0].headers.get("authorization"), null, "models needs no key");
  assert.equal(calls[1].headers.get("authorization"), "Bearer yk_test");
  assert.equal(calls[1].body.stream, false);
  assert.equal(calls[1].url, `${API}/v1/chat/completions`);
});

test("Kairmel API: a stream yields every chunk, usage included, and stops at [DONE]", async () => {
  const chunk = (content, extra = {}) => ({ id: "c1", object: "chat.completion.chunk", model: "kairmel/x", choices: [{ index: 0, delta: { content }, finish_reason: null }], ...extra });
  const sse = [chunk("Wa"), chunk("aw"), chunk(null, { usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } })]
    .map(c => `data: ${JSON.stringify(c)}\n\n`).join("") + "data: [DONE]\n\n";
  // Split mid-line to prove partial lines are buffered.
  const cut = 37;
  const stream = new ReadableStream({ start(c) { const e = new TextEncoder(); c.enqueue(e.encode(sse.slice(0, cut))); c.enqueue(e.encode(sse.slice(cut))); c.close(); } });
  const { fetch, calls } = fakeFetch(() => new Response(stream, { headers: { "content-type": "text/event-stream" } }));
  const api = createKairmelClient({ baseUrl: API, apiKey: "yk_test", fetch });

  let text = "", usage;
  for await (const part of api.chatStream({ model: "kairmel/x", messages: [{ role: "user", content: "Salaam" }] })) {
    text += part.choices[0]?.delta.content ?? "";
    usage = part.usage ?? usage;
  }
  assert.equal(text, "Waaw");
  assert.equal(usage.total_tokens, 5);
  assert.equal(calls[0].body.stream, true);
  assert.deepEqual(calls[0].body.stream_options, { include_usage: true });
});

test("Kairmel API: errors carry status and body; a missing key is explained", async () => {
  const { fetch } = fakeFetch(() => Response.json({ error: { type: "insufficient_balance", message: "Solde épuisé." } }, { status: 402 }));
  const api = createKairmelClient({ baseUrl: API, apiKey: "yk_test", fetch });
  await assert.rejects(api.balance(), error => error instanceof KairmelApiError && error.status === 402 && error.body.error.type === "insufficient_balance");
  await assert.rejects(createKairmelClient({ baseUrl: API, env: {}, fetch }).balance(), /KAIRMEL_API_KEY/);
});

test("Kairmel API: with no address configured, the client calls api.kairmel.com", async () => {
  const { fetch, calls } = fakeFetch(() => ({ object: "list", data: [] }));
  await createKairmelClient({ env: {}, fetch }).models();
  assert.equal(calls[0].url, "https://api.kairmel.com/v1/models");
});

test("client.inference exists only when configured, and reuses the client's fetch", async () => {
  const { fetch, calls } = fakeFetch(() => ({ balance_xof: 1, recent: [] }));
  assert.equal(createYaatalClient({ baseUrl: ENGINE, fetch }).inference, undefined);
  const client = createYaatalClient({ baseUrl: ENGINE, fetch, inference: { baseUrl: API, apiKey: "yk_test" } });
  await client.inference.balance();
  assert.equal(calls[0].url, `${API}/v1/balance`);
});


test("merchant workspace: scoped reads, pagination, and payout destination", async () => {
  const dashboard = { total_revenue_cents: 25000, total_orders: 2, orders_by_status: { delivered: 1, pending: 1 } };
  const kyc = { status: "pending", document_ref: "CNI 1", submitted_at: "t", reviewed_at: null, payout_mobile: "+221770000000" };
  const { fetch, calls } = fakeFetch(url => url.endsWith("/dashboard") ? dashboard
    : url.endsWith("/payout-destination") ? kyc
    : url.includes("/products") ? { products: [], total: 0, page: 2, per_page: 10 }
    : { orders: [], total: 0, page: 3, per_page: 5 });
  const client = createYaatalClient({ baseUrl: ENGINE, token: "jwt-1", fetch });
  assert.deepEqual(await client.merchant.dashboard(), dashboard);
  assert.equal((await client.merchant.products({ page: 2, per_page: 10 })).page, 2);
  assert.equal((await client.merchant.orders({ page: 3, per_page: 5 })).per_page, 5);
  await client.merchant.products();
  await client.merchant.orders();
  assert.deepEqual(await client.commerce.setPayoutDestination({ mobile: kyc.payout_mobile }), kyc);
  assert.deepEqual(calls.map(c => [c.method, c.url.replace(ENGINE, "")]), [
    ["GET", "/api/merchant/dashboard"],
    ["GET", "/api/merchant/products?page=2&per_page=10"],
    ["GET", "/api/merchant/orders?page=3&per_page=5"],
    ["GET", "/api/merchant/products"],
    ["GET", "/api/merchant/orders"],
    ["POST", "/api/commerce/kyc/payout-destination"],
  ]);
  assert.deepEqual(calls[5].body, { mobile: kyc.payout_mobile });
  for (const c of calls) assert.equal(c.headers.get("authorization"), "Bearer jwt-1");
});

test("live selling: lifecycle bodies, encoded IDs and anonymous viewer calls", async () => {
  const pinned = { product_id: "p1", name: "Boubou", price_fcfa: 25000, image_url: null, keyword: "BOUBOU", sheet_url: "https://engine.test/b/tok?src=livestream" };
  const started = { id: "live1", room: "live-live1", status: "active", started_at: "t" };
  const ended = { id: "live1", status: "ended", ended_at: "t" };
  const view = { id: "live1", status: "active", seller: { name: null }, pinned, livekit_url: null, keyword_channels: { telegram: null, whatsapp: null } };
  const { fetch, calls } = fakeFetch(url => url.endsWith("/end") ? ended
    : url.endsWith("/pin") ? { pinned }
    : url.endsWith("/keyword") ? { match: pinned }
    : url.endsWith("/public") ? view
    : url.endsWith("/current/products") ? { session: { id: "live1", merchant_id: "m1", product_id: null, status: "active", started_at: "t", ended_at: null, created_at: "t", updated_at: "t" }, products: [] } : started);
  const client = createYaatalClient({ baseUrl: ENGINE, token: "jwt-1", fetch });
  assert.deepEqual(await client.liveSessions.start(), started);
  assert.deepEqual(await client.liveSessions.pin("live/1", { product_id: "p1", keyword: "BOUBOU" }), { pinned });
  await client.liveSessions.pin("live/1", { product_id: null });
  assert.deepEqual(await client.liveSessions.keyword("live/1", { text: "BOUBOU" }), { match: pinned });
  assert.deepEqual(await client.liveSessions.public("live/1"), view);
  assert.deepEqual(await client.liveSessions.end("live/1"), ended);
  assert.equal((await client.liveSessions.currentProducts()).session.id, "live1");
  assert.deepEqual(calls.map(c => [c.method, c.url.replace(ENGINE, "")]), [
    ["POST", "/api/live-sessions/"],
    ["PUT", "/api/live-sessions/live%2F1/pin"],
    ["PUT", "/api/live-sessions/live%2F1/pin"],
    ["POST", "/api/live-sessions/live%2F1/keyword"],
    ["GET", "/api/live-sessions/live%2F1/public"],
    ["POST", "/api/live-sessions/live%2F1/end"],
    ["GET", "/api/live-sessions/current/products"],
  ]);
  assert.equal(calls[0].body, undefined);
  assert.equal(calls[5].body, undefined);
  assert.deepEqual(calls[1].body, { product_id: "p1", keyword: "BOUBOU" });
  assert.deepEqual(calls[2].body, { product_id: null });
  assert.deepEqual(calls[3].body, { text: "BOUBOU" });
  for (const [i, c] of calls.entries()) assert.equal(c.headers.get("authorization"), [3, 4].includes(i) ? null : "Bearer jwt-1");
});

test("LiveKit viewer token is anonymous even on a signed-in client", async () => {
  const token = { token: "lk-viewer", url: "wss://lk.test", room: "live-live1", identity: "viewer-1", recording_enabled: false };
  const { fetch, calls } = fakeFetch(() => token);
  const client = createYaatalClient({ baseUrl: ENGINE, token: "jwt-1", fetch });
  assert.deepEqual(await client.livekit.viewerToken({ live_session_id: "live1" }), token);
  assert.equal(calls[0].url, ENGINE + "/api/livekit/viewer-token");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].headers.get("authorization"), null);
  assert.deepEqual(calls[0].body, { live_session_id: "live1" });
});


test("egress: opaque JSON pass-through, owner auth, encoded session and job IDs", async () => {
  // The service schemas are absent from the reference; this checks transport without inventing them.
  const answer = { opaque: true };
  const { fetch, calls } = fakeFetch(() => answer);
  const client = createYaatalClient({ baseUrl: ENGINE, token: "jwt-1", fetch });
  assert.deepEqual(await client.liveSessions.egress("live/1"), answer);
  assert.deepEqual(await client.liveSessions.startEgress("live/1", {}), answer);
  assert.deepEqual(await client.liveSessions.stopEgress("live/1", "job/1"), answer);
  assert.deepEqual(calls.map(c => [c.method, c.url.replace(ENGINE, "")]), [
    ["GET", "/api/live-sessions/live%2F1/egress"],
    ["POST", "/api/live-sessions/live%2F1/egress"],
    ["POST", "/api/live-sessions/live%2F1/egress/job%2F1/stop"],
  ]);
  assert.equal(calls[0].body, undefined);
  assert.deepEqual(calls[1].body, {});
  assert.equal(calls[2].body, undefined);
  for (const c of calls) assert.equal(c.headers.get("authorization"), "Bearer jwt-1");
});
