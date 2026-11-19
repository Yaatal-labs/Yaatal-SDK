// Bocalines calls module against a fake fetch: X-API-Key auth, /api/v1 paths, input checks.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createCallsClient } from "../dist/calls.js";
import { YaatalApiError } from "../dist/index.js";

const HOST = "https://calls.test";

function fakeFetch(answer = () => ({})) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    calls.push({ url: String(url), method: init.method ?? "GET", headers: new Headers(init.headers), body });
    const result = answer(String(url));
    return result instanceof Response ? result : Response.json(result);
  };
  return { fetch, calls };
}
const client = (fetch) => createCallsClient({ baseUrl: `${HOST}/`, apiKey: "key-1", fetch });

test("calls: agents and runs hit the workflow routes with X-API-Key", async () => {
  const { fetch, calls } = fakeFetch(url => (url.includes("/runs?") ? { runs: [], total_count: 0, page: 2, limit: 10, total_pages: 0 } : []));
  const api = client(fetch);
  await api.listAgents();
  await api.listAgents({ status: ["active", "archived"] });
  await api.getAgent(5);
  const list = await api.listRuns(5, { page: 2, limit: 10, sort_order: "asc", filters: [{ attribute: "status", value: "completed" }] });
  await api.getRun(5, 9);
  assert.equal(list.page, 2);
  assert.deepEqual(calls.map(c => `${c.method} ${c.url}`), [
    `GET ${HOST}/api/v1/workflow/fetch`,
    `GET ${HOST}/api/v1/workflow/fetch?status=active%2Carchived`,
    `GET ${HOST}/api/v1/workflow/fetch/5`,
    `GET ${HOST}/api/v1/workflow/5/runs?page=2&limit=10&sort_order=asc&filters=%5B%7B%22attribute%22%3A%22status%22%2C%22value%22%3A%22completed%22%7D%5D`,
    `GET ${HOST}/api/v1/workflow/5/runs/9`,
  ]);
  for (const c of calls) {
    assert.equal(c.headers.get("x-api-key"), "key-1");
    assert.equal(c.headers.get("authorization"), null);
  }
});

test("calls: text chat start and message", async () => {
  const { fetch, calls } = fakeFetch(() => ({ workflow_run_id: 9, revision: 2 }));
  const api = client(fetch);
  await api.startTextChat(5, { initial_context: { name: "Ada" } });
  await api.sendTextMessage(5, 9, "Hi", { expected_revision: 1 });
  assert.deepEqual(calls.map(c => `${c.method} ${c.url}`), [
    `POST ${HOST}/api/v1/workflow/5/text-chat/sessions`,
    `POST ${HOST}/api/v1/workflow/5/text-chat/sessions/9/messages`,
  ]);
  assert.deepEqual(calls[0].body, { initial_context: { name: "Ada" } });
  assert.deepEqual(calls[1].body, { text: "Hi", expected_revision: 1 });
  assert.throws(() => api.sendTextMessage(5, 9, "  "), /empty/);
  assert.throws(() => api.getAgent(0), /positive integer/);
  assert.throws(() => api.getRun(5, 1.5), /runId/);
});

test("calls: phone call needs E.164 and picks the draft route on request", async () => {
  const { fetch, calls } = fakeFetch(() => ({ status: "initiated", workflow_run_id: 3, workflow_run_name: "WR-1" }));
  const api = client(fetch);
  const body = { phone_number: "+14155550123", initial_context: { name: "Ada" } };
  assert.equal((await api.startPhoneCall("uu/id", body)).workflow_run_id, 3);
  await api.startPhoneCall("uuid", body, { draft: true });
  assert.deepEqual(calls.map(c => c.url), [
    `${HOST}/api/v1/public/agent/workflow/uu%2Fid`,
    `${HOST}/api/v1/public/agent/test/workflow/uuid`,
  ]);
  assert.deepEqual(calls[0].body, body);
  assert.throws(() => api.startPhoneCall("uuid", { phone_number: "415 555 0123" }), /E\.164/);
  assert.equal(calls.length, 2);
});

test("calls: API errors surface as YaatalApiError and the key is never in the error", async () => {
  const { fetch } = fakeFetch(() => new Response(JSON.stringify({ detail: "Invalid API key" }), { status: 401 }));
  await assert.rejects(client(fetch).getAgent(1), e => e instanceof YaatalApiError && e.status === 401 && !JSON.stringify(e.body).includes("key-1") && !e.message.includes("key-1"));
  assert.throws(() => createCallsClient({ baseUrl: HOST, apiKey: "" }), /API key/);
});
