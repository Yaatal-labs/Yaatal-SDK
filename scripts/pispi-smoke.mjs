// Unit-style smoke test for src/pispi.ts (built to dist/index.js). Pure
// offline PI-SPI QR generation -- no stub engine, no network.
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

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
  parsePiSpiAlias,
  isPiSpiAliasShaped,
} = await import(pathToFileURL(indexPath).href); // a file:// URL, so it also loads on Windows

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

// Alias extraction from a scanned QR -- the step that spares a buyer typing a
// 36-character UUID at checkout. Round-trips against a payload this package
// generated, which is the only payload we can produce without a real one.
{
  const { payload } = createStaticMerchantQr({
    alias: DUMMY_ALIAS,
    countryCode: "SN",
    referenceLabel: "SCAN_ME",
  });
  assert(
    parsePiSpiAlias(payload) === DUMMY_ALIAS,
    `alias round-trip failed: got ${parsePiSpiAlias(payload)}`,
  );

  // A dynamic payload carries an amount, which shifts every later TLV offset.
  // Reading the alias must not depend on where tag 36 happens to sit.
  const dynamic = createDynamicMerchantQr({
    alias: DUMMY_ALIAS,
    countryCode: "SN",
    referenceLabel: "SCAN_ME_2",
    amount: 15000,
  });
  assert(
    parsePiSpiAlias(dynamic.payload) === DUMMY_ALIAS,
    "alias round-trip failed for a dynamic payload",
  );

  // Anything that is not a valid PI-SPI QR yields null, never a guess. A
  // checkout that accepted a stranger's identifier here would address the
  // payment request to the wrong person.
  for (const junk of [
    "",
    "hello world",
    "https://example.com/pay",
    payload.slice(0, payload.length - 4), // truncated: CRC no longer matches
    payload.replace("int.bceao.pi", "int.example.xx"),
  ]) {
    assert(
      parsePiSpiAlias(junk) === null,
      `expected null for non-PI-SPI payload: ${junk.slice(0, 40)}`,
    );
  }

  // A malformed TLV length must be rejected, not parsed. Payload validation
  // does not walk the TLV run -- it extracts fields by pattern and checks the
  // CRC -- so a payload with a non-digit length header and a recomputed CRC
  // passes it and reaches our reader. `parseInt("0A", 10)` would call that
  // length 0 and resync the scan onto the middle of a value; the reader
  // requires four ASCII digits instead. Guards the contract rather than a
  // known exploit: the `int.bceao.pi` GUID check already stops a resync from
  // yielding a stranger's alias.
  {
    const crc = (s) => {
      let c = 0xffff;
      for (const ch of s) {
        c ^= ch.charCodeAt(0) << 8;
        for (let k = 0; k < 8; k++)
          c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff;
      }
      return c.toString(16).toUpperCase().padStart(4, "0");
    };
    const at = payload.indexOf("int.bceao.pi");
    const body = (payload.slice(0, at - 4) + "0A" + payload.slice(at - 2)).slice(
      0,
      payload.length - 4,
    );
    const crafted = body + crc(body);
    assert(
      validatePiSpiQrPayload(crafted).valid,
      "the crafted payload must reach our reader, else this proves nothing",
    );
    assert(
      parsePiSpiAlias(crafted) === null,
      "a non-digit TLV length must yield null",
    );
  }

  assert(isPiSpiAliasShaped(DUMMY_ALIAS), "dummy alias should be alias-shaped");
  for (const bad of ["", "221770000000", DUMMY_ALIAS.slice(0, 20)]) {
    assert(!isPiSpiAliasShaped(bad), `${bad} must not be alias-shaped`);
  }
}

console.log("PI-SPI alias parsing smoke passed");
