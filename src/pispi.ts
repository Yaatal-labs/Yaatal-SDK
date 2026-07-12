// Thin, typed wrapper over `@pi-spi/qrcode` (BCEAO's official MIT-licensed
// PI-SPI QR SDK, npm `@pi-spi/qrcode`, author BCEAO — https://github.com/pi-spi/qrcode-js).
// Pure offline EMVCo payload generation: no Engine call, no network, nothing
// async except the SVG helper we deliberately don't wrap (see below).
//
// This module was written against the package's actual shipped API
// (`node_modules/@pi-spi/qrcode/dist/index.d.ts` + `dist/index.mjs`), not a
// summary of it. Two real discrepancies were found between the package's
// README and its shipped code/behavior; both are called out below so callers
// don't get surprised by them a second time.
//
// 1. Alias format (README vs. code): the package's own second README example
//    (`generateQrCodeSvg`) passes `alias: '2250000000001'` — a phone-number-
//    shaped string, not a UUID. But the shipped `validateAlias()` (compiled
//    into `dist/index.mjs`) hard-enforces
//    `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`
//    and throws "L'alias doit être un UUID v4 valide." on anything else. That
//    README example does not match what the code actually accepts. We follow
//    the code: `alias` below is documented and validated (by the underlying
//    package, at call time) as UUID v4 only.
//
// 2. Merchant name/city are NOT real inputs in this package version. EMV tag
//    59 (merchant name) and tag 60 (merchant city) are hardcoded by the
//    package to the placeholder `"X"` for every payload — there is no field
//    in `QrPayloadInput` that reaches them. `merchantName`/`merchantCity`
//    below are accepted for interface stability only and currently have NO
//    effect on the generated payload.
//    ponytail: known ceiling is `@pi-spi/qrcode@1.0.0` hardcoding tags 59/60;
//    upgrade path is to forward these fields once a future package version
//    exposes real tag 59/60 inputs (there is no `options.additionalData` path
//    to them today — that only reaches the nested tag-62 sub-tags).

import {
  buildPayloadString,
  isValidPispiQrPayload,
  type QrPayloadInput,
  type QrType,
  type QrValidationResult,
} from "@pi-spi/qrcode";

export type PiSpiQrType = QrType;
export type PiSpiQrValidationResult = QrValidationResult;

export interface PiSpiMerchantQrInput {
  /**
   * PI-SPI account alias. Must be a UUID v4 string — enforced by the
   * underlying package's `validateAlias()`, not by this wrapper (see file
   * header for the README/code mismatch this follows).
   */
  alias: string;
  /** ISO 3166-1 alpha-2 UEMOA member code: BJ, BF, CI, ML, NE, SN, TG, GW. */
  countryCode: string;
  /**
   * Reference presented to the payer (package-enforced max 25 chars). This
   * is the package's only per-transaction reference/order-id field — there
   * is no separate `orderId` input.
   */
  referenceLabel: string;
  /** Currently a no-op — see file header note 2. Accepted for forward compat. */
  merchantName?: string;
  /** Currently a no-op — see file header note 2. Accepted for forward compat. */
  merchantCity?: string;
}

export interface PiSpiDynamicQrInput extends PiSpiMerchantQrInput {
  /**
   * Amount in whole XOF — digits only, package-enforced max 13 digits. XOF
   * has zero minor units (same invariant `yaatal-payments` already
   * documents), so this is never a decimal/cents value.
   */
  amount: number | string;
}

export interface PiSpiQrResult {
  payload: string;
  type: PiSpiQrType;
}

function toPackageInput(
  qrType: QrType,
  input: PiSpiMerchantQrInput,
  amount?: number | string,
): QrPayloadInput {
  return {
    alias: input.alias,
    countryCode: input.countryCode,
    qrType,
    referenceLabel: input.referenceLabel,
    ...(amount === undefined ? {} : { amount }),
  };
}

/**
 * Builds a STATIC PI-SPI merchant QR payload (EMV tag 62 sub-11 = "000") —
 * a reusable, amount-less merchant QR (e.g. a fixed till/counter code).
 */
export function createStaticMerchantQr(
  input: PiSpiMerchantQrInput,
): PiSpiQrResult {
  return {
    payload: buildPayloadString(toPackageInput("STATIC", input)),
    type: "STATIC",
  };
}

/**
 * Builds a DYNAMIC PI-SPI merchant QR payload (tag 62 sub-11 = "400") for a
 * single transaction with a fixed amount (tag 54).
 */
export function createDynamicMerchantQr(
  input: PiSpiDynamicQrInput,
): PiSpiQrResult {
  return {
    payload: buildPayloadString(
      toPackageInput("DYNAMIC", input, input.amount),
    ),
    type: "DYNAMIC",
  };
}

/**
 * Re-exported so callers can validate/round-trip a payload (parses the TLV
 * segments and recomputes the CRC) without a second direct dependency on
 * `@pi-spi/qrcode`.
 */
export { isValidPispiQrPayload as validatePiSpiQrPayload };
