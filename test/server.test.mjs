// The server-only entry: partner sign-in, Kairmel admin, and the guarantee that the browser entry
// never carries the shared secret.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPartnerAuth, createKairmelAdmin, partnerAuth, kairmelAdmin, KairmelApiError } from "../dist/server.js";
import { YaatalApiError } from "../dist/index.js";

const ENGINE = "https://engine.test";
const GATEWAY = "https://gateway.test";
const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");

function fakeFetch(answer) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const headers = new Headers(init.headers);
    const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    calls.push({ url: String(url), method: init.method ?? "GET", headers, body });
    const result = answer(String(url), init);
    return result instanceof Response ? result : Response.json(result ?? {});
  };
  return { fetch, calls };
}

test("partnerAuth: start, status, verify carry the shared secret and no bearer token", async () => {
  const { fetch, calls } = fakeFetch(url => {
    if (url.endsWith("/start")) return { id: "ACD3", whatsapp_url: "https://wa.me/221700000000?text=LOGIN-ACD3", expires_in_seconds: 600 };
    if (url.includes("/status")) return { status: "code_sent" };
    return { pid: "0d9c2f8e-1111-4222-8333-444455556666" };
  });
  const auth = createPartnerAuth({ baseUrl: ENGINE, secret: "s3cret", fetch });

  const started = await auth.start();
  assert.equal(started.id, "ACD3");
  assert.equal((await auth.status("ACD3")).status, "code_sent");
  assert.equal((await auth.verify("ACD3", "123456")).pid, "0d9c2f8e-1111-4222-8333-444455556666");

  assert.deepEqual(calls.map(c => `${c.method} ${c.url}`), [
    `POST ${ENGINE}/api/auth/whatsapp/partner/start`,
    `GET ${ENGINE}/api/auth/whatsapp/partner/status?id=ACD3`,
    `POST ${ENGINE}/api/auth/whatsapp/partner/verify`,
  ]);
  assert.deepEqual(calls[2].body, { id: "ACD3", code: "123456" });
  for (const c of calls) {
    assert.equal(c.headers.get("x-engine-auth-secret"), "s3cret");
    assert.equal(c.headers.get("authorization"), null);
  }
});

test("partnerAuth: a wrong code is a 401 YaatalApiError; no secret is a clear error", async () => {
  const { fetch } = fakeFetch(() => new Response("unauthorized!", { status: 401 }));
  await assert.rejects(
    createPartnerAuth({ baseUrl: ENGINE, secret: "s3cret", fetch }).verify("ACD3", "000000"),
    e => e instanceof YaatalApiError && e.status === 401,
  );
  assert.throws(() => createPartnerAuth({ baseUrl: ENGINE, env: {} }), /ENGINE_AUTH_SECRET/);
});

test("partnerAuth default reads ENGINE_AUTH_SECRET and the Engine URL from the environment", async () => {
  const saved = { s: process.env.ENGINE_AUTH_SECRET, u: process.env.YAATAL_ENGINE_API_URL, f: globalThis.fetch };
  const { fetch, calls } = fakeFetch(() => ({ status: "pending" }));
  process.env.ENGINE_AUTH_SECRET = "env-secret";
  process.env.YAATAL_ENGINE_API_URL = ENGINE;
  globalThis.fetch = fetch;
  try {
    await partnerAuth.status("X1");
  } finally {
    for (const [k, v] of [["ENGINE_AUTH_SECRET", saved.s], ["YAATAL_ENGINE_API_URL", saved.u]]) {
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
    globalThis.fetch = saved.f;
  }
  assert.equal(calls[0].url, `${ENGINE}/api/auth/whatsapp/partner/status?id=X1`);
  assert.equal(calls[0].headers.get("x-engine-auth-secret"), "env-secret");
});

test("kairmelAdmin: upsert by pid (C1) and mint a key", async () => {
  const pid = "0d9c2f8e-1111-4222-8333-444455556666";
  const { fetch, calls } = fakeFetch(url => (url.endsWith("/keys")
    ? { key_id: "k1", api_key: "yk_live_abc" }
    : { id: "acc1", engine_pid: pid, created: true, balance_xof: 0 }));
  const admin = createKairmelAdmin({ baseUrl: GATEWAY, adminToken: "issuer-tok", fetch });

  const account = await admin.upsertAccountByPid(pid, { name: "Awa Diop" });
  assert.deepEqual(account, { id: "acc1", engine_pid: pid, created: true, balance_xof: 0 });
  const key = await admin.createKey("acc1", "default");
  assert.equal(key.api_key, "yk_live_abc");

  assert.deepEqual(calls.map(c => `${c.method} ${c.url}`), [
    `PUT ${GATEWAY}/admin/accounts/by-pid/${pid}`,
    `POST ${GATEWAY}/admin/accounts/acc1/keys`,
  ]);
  assert.deepEqual(calls[0].body, { name: "Awa Diop" });
  assert.deepEqual(calls[1].body, { label: "default" });
  for (const c of calls) assert.equal(c.headers.get("authorization"), "Bearer issuer-tok");
});

test("kairmelAdmin: the body is optional, gateway errors surface as KairmelApiError", async () => {
  const pid = "0d9c2f8e-1111-4222-8333-444455556666";
  const { fetch, calls } = fakeFetch(() => Response.json({ error: { code: "forbidden" } }, { status: 403 }));
  const admin = createKairmelAdmin({ baseUrl: GATEWAY, adminToken: "t", fetch });
  await assert.rejects(
    admin.upsertAccountByPid(pid),
    e => e instanceof KairmelApiError && e.status === 403 && e.body.error.code === "forbidden",
  );
  assert.equal(calls[0].body, undefined);
  assert.equal(calls[0].headers.get("content-type"), null);
  assert.throws(() => createKairmelAdmin({ env: {} }), /KAIRMEL_ADMIN_TOKEN/);
  assert.equal(typeof kairmelAdmin.upsertAccountByPid, "function");
});

test("the browser entry never carries the partner secret header or the server module", () => {
  const seen = new Set();
  const queue = [join(DIST, "index.js")];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    assert.ok(!source.includes("X-Engine-Auth-Secret"), `${file} must not contain X-Engine-Auth-Secret`);
    assert.ok(!source.includes("ENGINE_AUTH_SECRET"), `${file} must not mention ENGINE_AUTH_SECRET`);
    assert.ok(!/KAIRMEL_ADMIN_TOKEN|\/admin\/accounts/.test(source), `${file} must carry no admin surface`);
    for (const [, spec] of source.matchAll(/(?:from|import)\s*["'](\.[^"']+)["']/g)) {
      assert.ok(!/server(\.js)?$/.test(spec), `${file} imports the server module`);
      queue.push(resolve(dirname(file), spec));
    }
  }
  assert.ok(seen.size > 10, "walked the whole import graph of the main entry");
  assert.ok(readFileSync(join(DIST, "server.js"), "utf8").includes("X-Engine-Auth-Secret"), "the secret header lives in server.js");
});

test("package.json exposes ./server and keeps it out of the main export", () => {
  const pkg = JSON.parse(readFileSync(resolve(DIST, "..", "package.json"), "utf8"));
  assert.deepEqual(pkg.exports["./server"], { types: "./dist/server.d.ts", import: "./dist/server.js" });
  assert.equal(pkg.exports["."].import, "./dist/index.js");
});
