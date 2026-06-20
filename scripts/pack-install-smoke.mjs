import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const npm = process.env.npm_execpath
  ? { command: process.execPath, args: [process.env.npm_execpath] }
  : { command: "npm", args: [] };

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8"));
}

function pathExists(relativePath) {
  return existsSync(join(root, relativePath));
}

function runNpm(args, cwd = root, env = process.env) {
  return execFileSync(npm.command, [...npm.args, ...args], {
    cwd,
    env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function runNpmInherit(args, cwd = root, env = process.env) {
  execFileSync(npm.command, [...npm.args, ...args], {
    cwd,
    env,
    stdio: "inherit",
  });
}

function validatePackageMetadata(pkg) {
  assert(pkg.name === "@yaatal/client", "package name must be @yaatal/client");
  assert(
    typeof pkg.version === "string" && /^\d+\.\d+\.\d+(-[\w.-]+)?$/.test(pkg.version),
    "package version must be a publishable semver string",
  );
  assert(pkg.private !== true, "package must not be private");
  assert(pkg.license === "MIT OR Apache-2.0", "package license must remain dual MIT OR Apache-2.0");
  assert(pkg.type === "module", "package must remain ESM");
  assert(pkg.main === "./dist/index.js", "package main must point to dist/index.js");
  assert(pkg.module === "./dist/index.js", "package module must point to dist/index.js");
  assert(pkg.types === "./dist/index.d.ts", "package types must point to dist/index.d.ts");
  assert(
    pkg.exports?.["."]?.import === "./dist/index.js",
    "package exports import target must point to dist/index.js",
  );
  assert(
    pkg.exports?.["."]?.types === "./dist/index.d.ts",
    "package exports types target must point to dist/index.d.ts",
  );
  assert(Array.isArray(pkg.files), "package files must be explicit");
  assert(pkg.files.includes("dist"), "package files must include dist");
  assert(pkg.files.includes("README.md"), "package files must include README.md");
  assert(pkg.files.includes("src"), "package files must include src for source maps");
  assert(pkg.files.includes("LICENSE-MIT"), "package files must include LICENSE-MIT");
  assert(pathExists("README.md"), "README.md must exist before packaging");
}

function sourceBases() {
  return readdirSync(join(root, "src"))
    .filter((file) => file.endsWith(".ts"))
    .map((file) => file.slice(0, -3))
    .sort();
}

function validateDist() {
  assert(
    pathExists("dist/index.js") && pathExists("dist/index.d.ts"),
    "Missing generated dist/index.js or dist/index.d.ts. Run `npm run build` first.",
  );

  for (const base of sourceBases()) {
    for (const suffix of [".js", ".js.map", ".d.ts", ".d.ts.map"]) {
      assert(
        pathExists(`dist/${base}${suffix}`),
        `Missing generated dist/${base}${suffix}. Run \`npm run build\` first.`,
      );
    }
  }
}

function parsePackJson(output) {
  const trimmed = output.trim();
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");

  assert(start !== -1 && end !== -1, "npm pack did not return JSON output");
  return JSON.parse(trimmed.slice(start, end + 1));
}

function validatePackedFiles(files) {
  const paths = new Set(files.map((file) => file.path));

  for (const required of ["package.json", "README.md", "LICENSE-MIT", "dist/index.js", "dist/index.d.ts", "src/index.ts"]) {
    assert(paths.has(required), `Packed tarball is missing ${required}`);
  }

  for (const base of sourceBases()) {
    assert(paths.has(`dist/${base}.js`), `Packed tarball is missing dist/${base}.js`);
    assert(paths.has(`dist/${base}.d.ts`), `Packed tarball is missing dist/${base}.d.ts`);
  }

  for (const path of paths) {
    assert(!path.startsWith("scripts/"), `Packed tarball must not include script file ${path}`);
    assert(path !== "tsconfig.json", "Packed tarball must not include tsconfig.json");
  }
}

const consumerSmoke = `
import {
  YaatalApiError,
  YaatalClient,
  createYaatalClient,
} from "@yaatal/client";

const requests = [];
const fetchMock = async (input, init = {}) => {
  requests.push({
    url: String(input),
    method: init.method,
    headers: Object.fromEntries(new Headers(init.headers).entries()),
    body: init.body,
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

const client = createYaatalClient({
  baseUrl: "https://engine.example.test/",
  token: "local-token",
  fetch: fetchMock,
});

if (!(client instanceof YaatalClient)) {
  throw new Error("createYaatalClient did not return a YaatalClient");
}

if ("ai" in client) {
  throw new Error("V1 SDK must not expose client.ai");
}

const response = await client.analytics.track({
  event: "sdk_pack_install_smoke",
  properties: { source: "npm-pack" },
});

if (response.success !== true) {
  throw new Error("analytics.track did not parse the mocked response");
}

const request = requests[0];
if (!request) {
  throw new Error("consumer smoke did not issue a request");
}

if (request.url !== "https://engine.example.test/api/analytics/track") {
  throw new Error(\`unexpected request URL: \${request.url}\`);
}

if (request.method !== "POST") {
  throw new Error(\`unexpected request method: \${request.method}\`);
}

if (request.headers.authorization !== "Bearer local-token") {
  throw new Error("Authorization header was not attached");
}

if (request.headers["content-type"] !== "application/json") {
  throw new Error("JSON content type was not attached");
}

if (!String(request.body).includes("sdk_pack_install_smoke")) {
  throw new Error("request body was not serialized as expected");
}

if (typeof YaatalApiError !== "function") {
  throw new Error("YaatalApiError export is missing");
}
`;

const pkg = readJson("package.json");
validatePackageMetadata(pkg);
validateDist();

const tempRoot = mkdtempSync(join(tmpdir(), "yaatal-client-pack-"));

try {
  const npmEnv = {
    ...process.env,
    npm_config_cache: join(tempRoot, "npm-cache"),
    npm_config_update_notifier: "false",
    npm_config_dry_run: "false",
  };
  const packOutput = runNpm(
    ["pack", "--json", "--pack-destination", tempRoot],
    root,
    npmEnv,
  );
  const [packed] = parsePackJson(packOutput);

  assert(packed, "npm pack did not describe a tarball");
  validatePackedFiles(packed.files ?? []);

  const tarball = resolve(tempRoot, packed.filename);
  assert(existsSync(tarball), `npm pack did not create ${tarball}`);

  const consumerRoot = join(tempRoot, "consumer");
  mkdirSync(consumerRoot);
  writeFileSync(
    join(consumerRoot, "package.json"),
    `${JSON.stringify({ private: true, type: "module" }, null, 2)}\n`,
  );
  writeFileSync(join(consumerRoot, "smoke.mjs"), consumerSmoke);

  runNpmInherit([
    "install",
    tarball,
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--package-lock=false",
    "--silent",
  ], consumerRoot, npmEnv);
  execFileSync(process.execPath, ["smoke.mjs"], {
    cwd: consumerRoot,
    stdio: "inherit",
  });

  console.log(`SDK pack/install smoke passed for ${packed.filename}`);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
