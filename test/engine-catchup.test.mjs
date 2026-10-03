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
  const token = await client.livekit.token({ room: "live-1", room_type: "broadcast" });
  assert.equal(token.url, "wss://lk.test");
  assert.deepEqual(calls[0].body, { room: "live-1", room_type: "broadcast" });
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
