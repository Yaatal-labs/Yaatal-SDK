// Route drift: every Engine route the SDK calls must exist in the Engine's controllers.
//
// Set ENGINE_CONTROLLERS_DIR to a checkout's crates/yaatal-api/src/controllers to run it, e.g.
//   ENGINE_CONTROLLERS_DIR=../Yaatal-Engine/crates/yaatal-api/src/controllers npm run test:unit
// Without it (CI with no Engine checkout) the test is skipped, not failed.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..", "src");
const CONTROLLERS = process.env.ENGINE_CONTROLLERS_DIR;
const present = Boolean(CONTROLLERS) && existsSync(CONTROLLERS);

// SDK paths that are not meant to match an Engine controller route.
const NOT_ENGINE = [/^\/v1\//, /^\/admin\//]; // the Kairmel gateway, not the Engine

const norm = path => path.replace(/\/+$/, "").replace(/\{[^}]*\}/g, "{}") || "/";

/** `METHOD /path` for every route the controllers register. */
export function engineRoutes(dir) {
  const routes = new Set();
  for (const file of readdirSync(dir).filter(f => f.endsWith(".rs"))) {
    const source = readFileSync(join(dir, file), "utf8");
    // One builder chain per `Routes::new()`, up to the closing brace of its fn.
    for (const [, chain] of source.matchAll(/Routes::new\(\)([\s\S]*?)\n\}/g)) {
      const prefix = /\.prefix\(\s*"([^"]*)"\s*\)/.exec(chain)?.[1] ?? "";
      for (const [, path, handlers] of chain.matchAll(/\.add\(\s*"([^"]*)"\s*,([\s\S]*?)\)\s*(?=\.add\(|\.prefix\(|;|$)/g)) {
        for (const [, verb] of handlers.matchAll(/\b(get|post|put|patch|delete)\(/g)) {
          routes.add(`${verb.toUpperCase()} ${norm(prefix + path)}`);
        }
      }
    }
  }
  return routes;
}

/** `METHOD /path` for every `http.request(...)` call in the SDK's sources. */
export function sdkCalls(srcDir) {
  const calls = [];
  for (const file of readdirSync(srcDir).filter(f => f.endsWith(".ts"))) {
    const source = readFileSync(join(srcDir, file), "utf8");
    const consts = Object.fromEntries([...source.matchAll(/const\s+(\w+)\s*=\s*"([^"]+)"/g)].map(m => [m[1], m[2]]));
    const segments = source.split(/\.request</).slice(1);
    for (const segment of segments) {
      const call = segment.split(/\n\s*\n/)[0];
      const m = /^[^(]*>\(\s*(["'`])([^"'`]*)\1/.exec(call);
      if (!m) continue;
      let path = m[2].replace(/\$\{(\w+)\}/g, (all, name) => consts[name] ?? all).replace(/\$\{[^}]*\}/g, "{}");
      if (!path.startsWith("/")) continue;
      const method = /method:\s*"(\w+)"/.exec(call.slice(0, 400))?.[1] ?? "GET";
      calls.push({ file, method, path: norm(path) });
    }
  }
  return calls;
}

test("the route extractors see the routes they should", { skip: !present && "ENGINE_CONTROLLERS_DIR not set" }, () => {
  const routes = engineRoutes(CONTROLLERS);
  for (const expected of ["POST /api/commerce/intents", "PATCH /api/commerce/deliveries/{}", "GET /b/{}/sheet", "POST /b/{}/checkout", "POST /api/auth/whatsapp/partner/verify"]) {
    assert.ok(routes.has(expected), `engine routes include ${expected} (parsed ${routes.size})`);
  }
  const calls = sdkCalls(SRC);
  assert.ok(calls.length > 40, `parsed ${calls.length} SDK calls`);
  assert.ok(calls.some(c => c.method === "PATCH" && c.path === "/api/commerce/deliveries/{}"));
});

test("every Engine route the SDK calls exists in the Engine controllers", { skip: !present && "ENGINE_CONTROLLERS_DIR not set" }, () => {
  const routes = engineRoutes(CONTROLLERS);
  const missing = sdkCalls(SRC)
    .filter(c => !NOT_ENGINE.some(re => re.test(c.path)))
    .filter(c => !routes.has(`${c.method} ${c.path}`))
    .map(c => `${c.file}: ${c.method} ${c.path}`);
  assert.deepEqual([...new Set(missing)], [], "SDK calls with no matching Engine route");
});
