// Commerce Sheet: seller calls (JWT) and buyer calls (no auth), against a fake fetch with the Engine's shapes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createYaatalClient, YaatalApiError } from "../dist/index.js";

const ENGINE = "https://engine.test";

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

const intent = {
  version: "yaatal.commerce-intent.v1", intent_id: "i1", status: "active", created_at: "2026-10-08T10:00:00Z",
  live_session_id: "live1",
  product: { id: "p1", name: "Boubou", description: null, price_fcfa: 25000, currency: "XOF", media_url: null, variants: ["M", "L"], remaining_stock: 4 },
  delivery: { fee_fcfa: 1500, note: "Dakar, sous 24 h" },
  public_url: "https://x/b/tok?src=copy", livestream_url: "https://x/b/tok?src=livestream",
  links: { copy: "https://x/b/tok?src=copy" }, share: { whatsapp: "https://wa.me/?text=a", telegram: "https://t.me/share/url?url=a" },
};
const receipt = {
  version: "yaatal.commerce-receipt.v1", receipt_id: "r1", reference: "YTL-AB12CD34", intent_id: "i1", product_id: "p1",
  product_name: "Boubou", quantity: 2, variant: "M", total_fcfa: 50000, delivery_fee_fcfa: 1500, currency: "XOF",
  payment_provider: "cash_on_delivery", payment_provider_label: "Paiement a la livraison", payment_status: "cod_pending",
  live_session_id: "live1", source_channel: "whatsapp", created_at: "2026-10-08T10:05:00Z", deduplicated: false,
};

test("commerce: put on air, list, close", async () => {
  const { fetch, calls } = fakeFetch(() => (calls.length === 2 ? [intent] : intent));
  const client = createYaatalClient({ baseUrl: ENGINE, token: "jwt-1", fetch });
  const body = { product_id: "p1", live_session_id: "live1", variants: ["M", "L"], delivery_fee_fcfa: 1500, delivery_note: "Dakar, sous 24 h", whatsapp: "221700000000" };

  const made = await client.commerce.putOnAir(body);
  assert.equal(made.product.price_fcfa, 25000);
  assert.deepEqual((await client.commerce.listOnAir({ live_session_id: "live1" })).map(i => i.intent_id), ["i1"]);
  await client.commerce.takeOffAir("i/1");

  assert.deepEqual(calls.map(c => `${c.method} ${c.url}`), [
    `POST ${ENGINE}/api/commerce/intents`,
    `GET ${ENGINE}/api/commerce/intents?live_session_id=live1`,
    `POST ${ENGINE}/api/commerce/intents/i%2F1/close`,
  ]);
  assert.deepEqual(calls[0].body, body);
  for (const c of calls) assert.equal(c.headers.get("authorization"), "Bearer jwt-1");
});

test("commerce: listOnAir and conversions without a session send no query", async () => {
  const { fetch, calls } = fakeFetch(url => url.endsWith("/conversions")
    ? { live_session_id: null, count: 1, units: 2, total_fcfa: 50000, by_channel: { whatsapp: 1 }, receipts: [receipt] }
    : []);
  const client = createYaatalClient({ baseUrl: ENGINE, token: "jwt-1", fetch });
  await client.commerce.listOnAir();
  const sales = await client.commerce.conversions();
  assert.equal(sales.total_fcfa, 50000);
  assert.equal(sales.by_channel.whatsapp, 1);
  assert.equal(sales.receipts[0].reference, "YTL-AB12CD34");
  assert.deepEqual(calls.map(c => c.url), [`${ENGINE}/api/commerce/intents`, `${ENGINE}/api/commerce/conversions`]);
  await client.commerce.conversions({ live_session_id: "live1" });
  assert.equal(calls[2].url, `${ENGINE}/api/commerce/conversions?live_session_id=live1`);
});

test("commerce: deliveries and the delivered/cancelled update", async () => {
  const order = { receipt, contact: { name: "Awa", phone: "221770000000", area: "Medina", note: null } };
  const { fetch, calls } = fakeFetch(url => (url.endsWith("/deliveries") || url.includes("/deliveries?") ? [order] : order));
  const client = createYaatalClient({ baseUrl: ENGINE, token: "jwt-1", fetch });

  const list = await client.commerce.deliveries();
  assert.equal(list[0].contact.area, "Medina");
  await client.commerce.deliveries({ status: "cod_pending" });
  const done = await client.commerce.updateDelivery("r1", { status: "delivered" });
  assert.equal(done.receipt.receipt_id, "r1");

  assert.deepEqual(calls.map(c => `${c.method} ${c.url}`), [
    `GET ${ENGINE}/api/commerce/deliveries`,
    `GET ${ENGINE}/api/commerce/deliveries?status=cod_pending`,
    `PATCH ${ENGINE}/api/commerce/deliveries/r1`,
  ]);
  assert.deepEqual(calls[2].body, { status: "delivered" });
});

test("sheet: get and checkout are anonymous even on a signed-in client", async () => {
  const sheet = { version: "yaatal.commerce-intent.v1", status: "active", merchant_name: "Boutique Awa", product: { ...intent.product, id: undefined }, delivery: intent.delivery, providers: [{ id: "cash_on_delivery", label: "Paiement a la livraison" }], sandbox: false };
  const { fetch, calls } = fakeFetch(url => (url.endsWith("/sheet") ? sheet : receipt));
  const client = createYaatalClient({ baseUrl: ENGINE, token: "jwt-1", fetch });
  const token = "AbCdEfGhIjKlMnOpQrStUv";

  const view = await client.sheet.get(token);
  assert.equal(view.providers[0].id, "cash_on_delivery");
  const req = { provider: "cash_on_delivery", quantity: 2, variant: "M", source_channel: "whatsapp", idempotency_key: "key-12345678", contact: { name: "Awa", phone: "221770000000", area: "Medina" } };
  const got = await client.sheet.checkout(token, req);
  assert.equal(got.total_fcfa, 50000);

  assert.deepEqual(calls.map(c => `${c.method} ${c.url}`), [
    `GET ${ENGINE}/b/${token}/sheet`,
    `POST ${ENGINE}/b/${token}/checkout`,
  ]);
  assert.deepEqual(calls[1].body, req);
  for (const c of calls) assert.equal(c.headers.get("authorization"), null, "buyer routes never carry the seller's JWT");
});

test("sheet: Engine error codes surface as YaatalApiError", async () => {
  const { fetch } = fakeFetch(() => Response.json({ error: "intent_closed" }, { status: 409 }));
  const client = createYaatalClient({ baseUrl: ENGINE, fetch });
  await assert.rejects(
    client.sheet.checkout("AbCdEfGhIjKlMnOpQrStUv", { provider: "wave", idempotency_key: "key-12345678" }),
    e => e instanceof YaatalApiError && e.status === 409 && e.body.error === "intent_closed",
  );
});
