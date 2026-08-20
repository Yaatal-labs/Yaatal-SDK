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
- `"pispi"` as a BOBO checkout payment method, with an optional `pispi_alias`
  (the buyer's 36-character PI-SPI payment address). The alias selects the flow:
  omit it for the QR flow (the merchant presents a dynamic QR, the buyer scans),
  supply it to have the Engine send a request-to-pay addressed to that buyer.
- Package smoke tests for contract shape and installability.
- Bilingual GitHub onboarding, UI integration, sandbox, and contribution docs.

### Notes

- V1 targets one configured Engine instance.
- The SDK does not expose `client.ai`.
- The SDK is published to npm/GitHub; it is not deployed as a Railway service.
