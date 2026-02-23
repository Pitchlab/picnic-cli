# picnic-cli

CLI for the [Picnic](https://picnic.app) online supermarket. Search products, manage your cart, pick delivery slots, and track deliveries — all from the terminal.

> **Disclaimer:** This is an **unofficial** project and is not affiliated with, endorsed by, or supported by Picnic. It uses an undocumented API through the [`picnic-api`](https://www.npmjs.com/package/picnic-api) package. Use at your own risk — using unofficial API clients **could result in your Picnic account being suspended or banned**. The author accepts no responsibility for any consequences arising from the use of this tool.

> Checkout/payment happens in the Picnic app. This CLI handles everything up to that point.

## Prerequisites

- **Node.js** >= 20
- **pnpm** (recommended) or npm
- A Picnic account (NL or DE)

## Setup

```bash
# Clone the repo and navigate to picnic-cli
cd picnic-cli

# Install dependencies
pnpm install

# Build
pnpm build

# Run in development mode (no build needed)
pnpm dev --help
```

### Global install (optional)

```bash
pnpm build
pnpm link --global
picnic --help
```

## Authentication

```bash
# Interactive login (prompts for email + password)
picnic login

# Semi-interactive (prompts for password only)
picnic login -u your@email.com

# Non-interactive
picnic login -u your@email.com -p yourpassword

# If 2FA is required
picnic 2fa generate     # sends SMS code
picnic 2fa verify 123456

# Check current user
picnic whoami

# Logout (clears stored auth token)
picnic logout
```

Credentials are stored in `~/.config/picnic-cli/config.json`.

## Usage

### Searching

```bash
# Search for products
picnic search "melk"

# Get search suggestions
picnic suggest "kaas"
```

### Cart Management

```bash
# View cart
picnic cart

# Add product (use product ID from search results)
picnic cart add <productId>
picnic cart add <productId> 3      # add 3 units

# Remove product
picnic cart remove <productId>

# Clear entire cart
picnic cart clear
```

### Delivery Slots

```bash
# List available slots
picnic slots

# Set a specific slot
picnic slots set <slotId>

# Interactive slot picker
picnic slots pick
```

### Deliveries

```bash
# List all deliveries
picnic deliveries

# Filter by status
picnic deliveries --status CURRENT
picnic deliveries --status COMPLETED

# Delivery details
picnic delivery show <id>

# Track delivery position
picnic delivery track <id>

# View delivery route
picnic delivery route <id>

# Cancel a delivery
picnic delivery cancel <id>

# Rate a delivery (0-10)
picnic delivery rate <id> 8

# Request invoice email
picnic delivery invoice <id>
```

### Products

```bash
# Product details
picnic product show <id>

# Full product page (JSON only)
picnic product page <id>

# Download product image
picnic product image <imageId>
picnic product image <imageId> --size large
```

### Categories

```bash
# Browse top-level categories
picnic categories

# Drill into a category (shows subcategories)
picnic category <id>
```

### User & Account

```bash
# User details
picnic user

# User info (feature toggles)
picnic user info

# Profile menu
picnic user profile

# Referral (MGM) details
picnic user mgm

# Consent settings
picnic user consent
picnic user consent --general
```

### Orders & Wallet

```bash
# Order status
picnic order status <orderId>

# Payment profile
picnic wallet

# Transaction history
picnic wallet transactions
picnic wallet transactions --page 1

# Transaction details
picnic wallet transaction <id>
```

### Miscellaneous

```bash
# Messages, reminders, parcels
picnic messages
picnic reminders
picnic parcels

# Customer service info
picnic support

# Raw API request (escape hatch)
picnic raw GET /api/15/user
picnic raw POST /api/15/some-endpoint --data '{"key":"value"}'
```

## Global Options

| Flag | Description |
|---|---|
| `-j, --json` | Output raw JSON (pipe-friendly) |
| `-t, --table` | Output as table |
| `-c, --country <code>` | Country code: NL or DE (default: NL) |
| `--no-color` | Disable colored output |
| `-v, --verbose` | Verbose/debug output |

## Output Formats

Every command supports three output modes:

- **Pretty** (default): Human-friendly colored output
- **JSON** (`--json`): Raw JSON, ideal for piping to `jq`
- **Table** (`--table`): Structured table output

```bash
# Pipe search results to jq
picnic search "melk" --json | jq '.[].name'

# Table view of cart
picnic cart --table
```

## Development

```bash
# Run in dev mode (uses tsx, no build needed)
pnpm dev --help

# Type check without building
pnpm typecheck

# Build for production
pnpm build

# Run E2E tests (requires credentials)
PICNIC_TEST_USERNAME=you@email.com PICNIC_TEST_PASSWORD=pass pnpm test:e2e
```

## Configuration

Config is stored at `~/.config/picnic-cli/config.json` and includes:

- `countryCode` — NL or DE (default: NL)
- `apiVersion` — API version (default: "15")
- `authKey` — Auth token from login
- `username` — Stored email for convenience
- `defaultOutput` — Default output format (pretty/json/table)

## API Coverage

This CLI wraps the [`picnic-api`](https://www.npmjs.com/package/picnic-api) npm package. It does not make raw HTTP calls.

**Not implemented** (by design):
- Checkout/order confirmation (use the Picnic app)
- `setConsentSettings` (destructive, low CLI value)
- `getBundleArticleIds` (deprecated)
- `getImageAsDataUri` (use `product image` instead)
