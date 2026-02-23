# Changelog

## [0.2.0] - 2026-02-23

### Documentation
- Comprehensive README with full usage examples for all commands, setup instructions, global options, output formats, and development guide.
- Add disclaimer to README: unofficial project, no affiliation with Picnic, risk of account ban, no liability accepted.
- Note in README that picnic-cli is a thin wrapper around `picnic-api` which does the heavy lifting.

### Changed
- **Categories**: Rewrote to use page-based API (`/pages/search-page-root`) after Picnic removed `/my_store` endpoint. Extracts categories from PML server-driven UI components.
- **Product show**: Rewrote to use `getProductDetailsPage()` after Picnic removed `/articles/{id}` endpoint. Extracts name, brand, price, allergens, highlights, description from nested page structure.
- **Search**: Fixed `display_price` handling — now a number (cents) instead of formatted string.
- **Cart add**: Changed from `cart add <id> --qty N` to `cart add <id> [quantity]` (positional arg).
- **Slots**: Handle missing `minimum_order_value` field (removed from API).
- **Deliveries**: Handle null `delivery_time` — falls back to slot window.

### Added
- `category <id>` command — drill into categories to see subcategories.
- `stripPicnicMarkdown()` — strips Picnic's custom color syntax `#(COLOR)text#(COLOR)`.

### Removed
- `lists` and `list` commands — Picnic removed the `/lists` endpoint.
- `categories --depth` option — no longer applicable with page-based API.

### Fixed
- Commander action callback signatures across all commands (added `_opts` parameter).
- Error handling for plain `Error` instances thrown by picnic-api.
- Wallet transaction display — access `line.items[0]` for article details.
- Auth command import paths and output calls.

## [0.1.0] - 2026-02-23

### Added
- Initial release of picnic-cli
- **Auth**: login (interactive/non-interactive), logout, whoami, 2FA generate/verify
- **Search**: product search and suggestions
- **Cart**: view, add, remove, clear shopping cart
- **Slots**: list delivery slots, set slot, interactive slot picker
- **Deliveries**: list, detail, track position, view route, cancel, rate, request invoice
- **Products**: product details, product page, image download
- **Categories**: browse categories and curated lists
- **User**: user details, info, profile, MGM/referral, consent settings
- **Orders**: order status
- **Wallet**: payment profile, transaction history, transaction details
- **Misc**: messages, reminders, support contact, parcels, raw API requests
- Three output modes: pretty (default), JSON (`--json`), table (`--table`)
- Country support: NL (default) and DE via `--country` flag
- Persistent config at `~/.config/picnic-cli/config.json`
- E2E test suite (gated behind env vars)
