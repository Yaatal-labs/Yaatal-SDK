// Gloop voice Worker boards module against a fake fetch: header options and input checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBoardsClient } from "../dist/boards.js";
import { YaatalApiError } from "../dist/index.js";

const W = "https://voice.test";

function fakeFetch(answer = () => ({ ok: true })) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    calls.push({ url: String(url), method: init.method ?? "GET", headers: new Headers(init.headers), body });
    const result = answer(String(url));
    return result instanceof Response ? result : Response.json(result);
  };
  return { fetch, calls };
}
const order = { agent: "nia", name: "Ada", phone: "+1 555 0100", fulfil: "pickup", size: "small", date: "2030-01-01", time: "12:00", items: [{ id: "jollof", qty: 1 }] };

test("boards: order, board feed and status move carry the demo key", async () => {
  const { fetch, calls } = fakeFetch(url => (url.includes("/api/board?") ? { orders: [{ id: 1, status: "new", name: "Ada", source: "web", created_at: "x" }] } : { ok: true, id: 7, status: "prepping" }));
  const api = createBoardsClient({ baseUrl: W, demoKey: "demo-1", fetch });
  assert.equal((await api.order(order)).id, 7);
  assert.equal((await api.board("nia"))[0].name, "Ada");
  await api.setStatus({ agent: "dioum", id: 1, to: "prepping" }, { staffPin: "1234" });
  assert.deepEqual(calls.map(c => `${c.method} ${c.url}`), [`POST ${W}/api/order`, `GET ${W}/api/board?agent=nia`, `POST ${W}/api/board/status`]);
  assert.deepEqual(calls[0].body, order);
  for (const c of calls) assert.equal(c.headers.get("x-demo-key"), "demo-1");
  assert.equal(calls[2].headers.get("x-staff-pin"), "1234");
  assert.equal(calls[0].headers.get("x-staff-pin"), null);
});

test("boards: no key sends none, extra headers pass through, defaults to the live Worker", async () => {
  const { fetch, calls } = fakeFetch(() => ({ orders: [] }));
  await createBoardsClient({ headers: { origin: "https://growthlooplab.com" }, fetch }).board("ivy");
  assert.equal(calls[0].url, "https://glooplab-voice.ameth749.workers.dev/api/board?agent=ivy");
  assert.equal(calls[0].headers.get("x-demo-key"), null);
  assert.equal(calls[0].headers.get("origin"), "https://growthlooplab.com");
});

test("boards: ingest sends only the ingest key, and checks the slug", async () => {
  const { fetch, calls } = fakeFetch(() => ({ ok: true, id: 3 }));
  const api = createBoardsClient({ baseUrl: W, ingestKey: "ing-1", fetch });
  await api.ingest({ agent: "jo", session: "s1", payload: { kind: "booking" }, source: "Phone (Bocalines)" });
  assert.equal(calls[0].headers.get("x-ingest-key"), "ing-1");
  assert.deepEqual(calls[0].body, { agent: "jo", session: "s1", payload: { kind: "booking" }, source: "Phone (Bocalines)" });
  assert.throws(() => api.ingest({ agent: "Bad Agent", payload: {} }), /slug/);
  assert.throws(() => createBoardsClient({ baseUrl: W, fetch }).ingest({ agent: "jo", payload: {} }), /ingestKey/);
  assert.equal(calls.length, 1);
});

test("boards: bad input is refused before any request", async () => {
  const { fetch, calls } = fakeFetch();
  const api = createBoardsClient({ baseUrl: W, fetch });
  assert.throws(() => api.order({ ...order, name: "" }), /name/);
  assert.throws(() => api.order({ ...order, phone: undefined }), /phone or an instagram/);
  assert.throws(() => api.order({ ...order, items: [] }), /items/);
  assert.throws(() => api.order({ ...order, notes: "x".repeat(301) }), /notes/);
  assert.throws(() => api.setStatus({ agent: "nia", id: 0, to: "done" }), /id/);
  assert.throws(() => api.setStatus({ agent: "nia", id: 1, to: "new" }), /prepping/);
  assert.equal(calls.length, 0);
});

test("boards: Worker errors surface as YaatalApiError with the error field", async () => {
  const { fetch } = fakeFetch(() => new Response(JSON.stringify({ error: "step", status: "done" }), { status: 409 }));
  await assert.rejects(createBoardsClient({ baseUrl: W, fetch }).setStatus({ agent: "nia", id: 1, to: "prepping" }), e => e instanceof YaatalApiError && e.status === 409 && e.body.error === "step");
});
