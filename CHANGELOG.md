# Changelog / Journal Des Changements

All notable SDK changes should be recorded here.

Les changements importants du SDK doivent etre notes ici.

## 0.1.0-beta.0 - Unreleased

### Added

- Initial standalone `@yaatal/client` package.
- Typed clients for auth, products, orders, delivery, search, notifications,
  analytics, and BOBO commerce bridge APIs.
- Offline BCEAO PI-SPI interoperable payment-QR generation (`src/pispi.ts`,
  `yaatal pispi qr` CLI command) over BCEAO's official `@pi-spi/qrcode`
  package — no Engine call required.
- `"pispi"` as a BOBO checkout payment method, with `pispi_alias` (the buyer's
  36-character PI-SPI payment address). `BoboCheckoutRequest` is now a union, so
  omitting the alias on a PI-SPI checkout is a compile error rather than a 400:
  the Engine sends a real request-to-pay at checkout, and an RTP has to be
  addressed to someone.
- Package smoke tests for contract shape and installability.
- Bilingual GitHub onboarding, UI integration, sandbox, and contribution docs.

### Notes

- V1 targets one configured Engine instance.
- The SDK does not expose `client.ai`.
- The SDK is published to npm/GitHub; it is not deployed as a Railway service.
