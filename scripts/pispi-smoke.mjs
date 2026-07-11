// Unit-style smoke test for src/pispi.ts (built to dist/index.js). Pure
// offline PI-SPI QR generation -- no stub engine, no network.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const indexPath = join(root, "dist/index.js");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(
  existsSync(indexPath),
  "Missing generated dist/index.js. Run `npm run build` first.",
);

const {
  createDynamicMerchantQr,
  createStaticMerchantQr,
  validatePiSpiQrPayload,
} = await import(indexPath);

// A syntactically valid, non-registered UUID v4 -- format-valid only, not a
// real onboarded PI-SPI merchant alias.
const DUMMY_ALIAS = "3497a720-ab11-4973-9619-534e04f263a1";

// STATIC QR: GUID, currency, channel marker, valid CRC.
{
  const { payload, type } = createStaticMerchantQr({
    alias: DUMMY_ALIAS,
    countryCode: "SN",
    referenceLabel: "CAISSE_A01",
  });
  assert(type === "STATIC", `expected type STATIC, got ${type}`);
  assert(payload.includes("int.bceao.pi"), "static payload missing BCEAO GUID");
  assert(payload.includes("952"), "static payload missing XOF currency 952");
  // Tag 62 sub-11 (merchant channel), TLV-encoded as id "11" + len "03" +
  // value "000", is "000" for STATIC.
  assert(payload.includes("1103000"), "static payload missing channel marker 000");
  assert(!payload.includes("5404"), "static (no-amount) payload unexpectedly has tag 54 (amount)");

  const result = validatePiSpiQrPayload(payload);
  assert(result.valid, `static payload failed round-trip validation: ${JSON.stringify(result.errors)}`);
  assert(result.data?.alias === DUMMY_ALIAS, "round-trip data missing alias");
}

// DYNAMIC QR: GUID, currency, channel marker, amount, valid CRC.
{
  const { payload, type } = createDynamicMerchantQr({
    alias: DUMMY_ALIAS,
    countryCode: "SN",
    referenceLabel: "ORDER-42",
    amount: 2500,
  });
  assert(type === "DYNAMIC", `expected type DYNAMIC, got ${type}`);
  assert(payload.includes("int.bceao.pi"), "dynamic payload missing BCEAO GUID");
  assert(payload.includes("952"), "dynamic payload missing XOF currency 952");
  // Tag 62 sub-11 (merchant channel), TLV-encoded as id "11" + len "03" +
  // value "400", is "400" for DYNAMIC.
  assert(payload.includes("1103400"), "dynamic payload missing channel marker 400");
  assert(payload.includes("54042500"), "dynamic payload missing amount tag 54");

  const result = validatePiSpiQrPayload(payload);
  assert(result.valid, `dynamic payload failed round-trip validation: ${JSON.stringify(result.errors)}`);
  assert(result.data?.amount === "2500", "round-trip data missing amount");
}

// Alias validation: the underlying package (not this wrapper) enforces UUID
// v4 -- confirmed against its compiled source, not just its README (whose
// own second example uses a phone-number-shaped alias, which the shipped
// validator rejects).
{
  let threw = false;
  try {
    createStaticMerchantQr({
      alias: "2250000000001",
      countryCode: "SN",
      referenceLabel: "BAD-ALIAS",
    });
  } catch (err) {
    threw = true;
    assert(
      /UUID/i.test(err.message),
      `expected a UUID-v4 validation error, got: ${err.message}`,
    );
  }
  assert(threw, "expected createStaticMerchantQr to reject a non-UUID alias");
}

// Corrupted CRC must fail round-trip validation.
{
  const { payload } = createStaticMerchantQr({
    alias: DUMMY_ALIAS,
    countryCode: "SN",
    referenceLabel: "CRC-CHECK",
  });
  const corrupted = `${payload.slice(0, -1)}${payload.at(-1) === "0" ? "1" : "0"}`;
  const result = validatePiSpiQrPayload(corrupted);
  assert(!result.valid, "corrupted CRC unexpectedly validated as valid");
}

console.log("PI-SPI QR smoke passed");
