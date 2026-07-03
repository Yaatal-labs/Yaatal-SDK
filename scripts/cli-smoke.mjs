import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import http from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const cliPath = join(root, "dist/cli.js");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  existsSync(cliPath),
  "Missing generated dist/cli.js. Run `npm run build` first.",
);

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data ? JSON.parse(data) : undefined));
  });
}

function startStubEngine() {
  const server = http.createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (req.method === "GET" && req.url?.startsWith("/api/products")) {
      return send(200, {
        products: [{ id: "p1", name: "Rice", price_cents: 1000 }],
        total: 1,
        page: 1,
        per_page: 20,
      });
    }

    if (
      req.method === "POST" &&
      req.url === "/api/deliveries/confirm-by-code"
    ) {
      const body = await readBody(req);
      assert(
        body?.delivery_code === "ABC123",
        `unexpected confirm-by-code body: ${JSON.stringify(body)}`,
      );
      return send(200, {
        status: "confirmed",
        delivery_id: "d1",
        order_id: "o1",
        payment_released: true,
      });
    }

    if (req.method === "GET" && req.url === "/api/orders/missing") {
      return send(404, { error: "order not found" });
    }

    return send(404, { error: `unhandled stub route: ${req.method} ${req.url}` });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

// Must stay non-blocking: the stub engine below runs its HTTP server in this
// same process, so a synchronous child-process call (spawnSync/execFileSync)
// would freeze this event loop and deadlock against the CLI's own request.
async function runCli(args, env = {}) {
  try {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [cliPath, ...args],
      { encoding: "utf8", env: { ...process.env, ...env } },
    );
    return { status: 0, stdout, stderr };
  } catch (err) {
    return { status: err.code, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

const { server, baseUrl } = await startStubEngine();

try {
  // products list -> success, exit 0, JSON on stdout
  {
    const result = await runCli(["products", "list"], {
      YAATAL_ENGINE_URL: baseUrl,
    });
    assert(result.status === 0, `products list exited ${result.status}: ${result.stderr}`);
    const parsed = JSON.parse(result.stdout.trim());
    assert(parsed.total === 1, "products list did not return stubbed body");
    assert(result.stderr.trim() === "", "products list wrote to stderr unexpectedly");
  }

  // deliveries confirm-by-code -> success, exit 0
  {
    const result = await runCli(["deliveries", "confirm-by-code", "ABC123"], {
      YAATAL_ENGINE_URL: baseUrl,
    });
    assert(
      result.status === 0,
      `deliveries confirm-by-code exited ${result.status}: ${result.stderr}`,
    );
    const parsed = JSON.parse(result.stdout.trim());
    assert(parsed.status === "confirmed", "confirm-by-code did not return stubbed body");
    assert(parsed.delivery_id === "d1", "confirm-by-code missing delivery_id");
  }

  // API error -> exit 1, one-line JSON error on stderr
  {
    const result = await runCli(["orders", "get", "missing"], {
      YAATAL_ENGINE_URL: baseUrl,
    });
    assert(result.status === 1, `orders get (404) exited ${result.status}, expected 1`);
    const parsed = JSON.parse(result.stderr.trim());
    assert(parsed.status === 404, `expected status 404 in error JSON, got ${JSON.stringify(parsed)}`);
  }

  // usage error: missing YAATAL_ENGINE_URL -> exit 2
  {
    const env = { ...process.env };
    delete env.YAATAL_ENGINE_URL;
    const result = await execFileAsync(process.execPath, [cliPath, "products", "list"], {
      encoding: "utf8",
      env,
    }).then(
      ({ stdout, stderr }) => ({ status: 0, stdout, stderr }),
      (err) => ({ status: err.code, stdout: err.stdout ?? "", stderr: err.stderr ?? "" }),
    );
    assert(result.status === 2, `missing env var exited ${result.status}, expected 2`);
    const parsed = JSON.parse(result.stderr.trim());
    assert(typeof parsed.error === "string", "usage error missing message");
  }

  // usage error: unknown command -> exit 2
  {
    const result = await runCli(["bogus"], { YAATAL_ENGINE_URL: baseUrl });
    assert(result.status === 2, `unknown command exited ${result.status}, expected 2`);
  }

  // --help -> exit 0, teaches the tool, no JSON requirement
  {
    const result = await runCli(["--help"], { YAATAL_ENGINE_URL: baseUrl });
    assert(result.status === 0, `--help exited ${result.status}`);
    assert(result.stdout.includes("YAATAL_ENGINE_URL"), "--help did not document env vars");
    assert(result.stdout.includes("deliveries confirm-by-code"), "--help did not list commands");
  }

  console.log("CLI smoke passed");
} finally {
  server.close();
}
