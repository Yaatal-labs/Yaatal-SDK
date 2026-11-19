// Business profile reads against a fake fetch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createBusinessClient } from "../dist/business.js";
import { YaatalApiError } from "../dist/index.js";

const W = "https://voice.test";

test("business: profile, facts and precall hit the public routes", async () => {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? "GET", headers: new Headers(init.headers) });
    if (String(url).endsWith("/facts")) return new Response("## BUSINESS FACTS (live profile v3)\nOpen daily.", { headers: { "content-type": "text/plain" } });
    if (String(url).endsWith("/precall")) return Response.json({ initial_context: { business_id: "acme", business_name: "Acme", business_facts: "f" } });
    return Response.json({ id: "acme", version: 3, updated_at: "t", data: { name: "Acme", hours: [], notices: [], offers: [], facts: [], unknown: [] } });
  };
  const api = createBusinessClient({ baseUrl: W, fetch });
  assert.equal((await api.profile("acme")).version, 3);
  assert.match(await api.facts("acme"), /^## BUSINESS FACTS/);
  assert.equal((await api.precall("acme")).initial_context.business_name, "Acme");
  assert.deepEqual(calls.map(c => `${c.method} ${c.url}`), [`GET ${W}/api/biz/acme`, `GET ${W}/api/biz/acme/facts`, `POST ${W}/api/biz/acme/precall`]);
  for (const c of calls) assert.equal(c.headers.get("authorization"), null);
});

test("business: ids are checked, 404 surfaces as YaatalApiError", async () => {
  const fetch = async () => new Response(JSON.stringify({ error: "not found" }), { status: 404 });
  const api = createBusinessClient({ baseUrl: W, fetch });
  assert.throws(() => api.profile("../admin"), /slug/);
  assert.throws(() => api.facts("A"), /slug/);
  await assert.rejects(api.profile("azad"), e => e instanceof YaatalApiError && e.status === 404);
});
