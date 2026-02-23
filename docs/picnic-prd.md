# picnic-cli — PRD & Implementation Spec

> **Purpose**: This document is a complete, implementation-ready spec for a Node.js TypeScript CLI wrapping the unofficial Picnic supermarket API. Hand this to Claude Code and let it build.

---

## Context

**What**: A CLI for the Dutch/German online supermarket Picnic. Search products, manage your cart, pick delivery slots, track deliveries — all from the terminal. Checkout/payment happens in the Picnic app (single button press).

**Why**: Cart building and slot management from the terminal. Pipe-friendly JSON output for scripting. No phone distraction.

**API wrapper**: [`picnic-api`](https://www.npmjs.com/package/picnic-api) v3.2.0 — already typed TypeScript package. MIT licensed. We wrap this, we don't reimplement HTTP calls.

**Country**: Default `NL`. Also supports `DE`.

---

## 1. Tech Stack — Exact Versions

```json
{
  "dependencies": {
    "picnic-api": "^3.2.0",
    "commander": "^13.0.0",
    "conf": "^13.0.0",
    "chalk": "^5.4.0",
    "cli-table3": "^0.6.5",
    "ora": "^8.0.0",
    "@inquirer/prompts": "^7.0.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0"
  }
}
```

- **Runtime**: Node.js ≥ 20
- **Module system**: ESM (`"type": "module"`)
- **CLI framework**: `commander` — subcommands, typed options, auto-help
- **Config**: `conf` — JSON config store at `~/.config/picnic-cli/`, handles encryption
- **Output**: `chalk` for color, `cli-table3` for tables, `ora` for spinners
- **Interactive**: `@inquirer/prompts` for login flow, slot picker
- **Dev**: `tsx` for running TS directly during dev

---

## 2. Project Structure

```
picnic-cli/
├── src/
│   ├── index.ts                 # Entry point — program definition, command registration
│   ├── client.ts                # PicnicClient singleton factory
│   ├── config.ts                # conf store — credentials, preferences
│   ├── output.ts                # Output dispatcher (json / table / pretty)
│   ├── errors.ts                # CliError class, withErrorHandling wrapper
│   ├── types.ts                 # Re-exports from picnic-api + CLI-specific types
│   ├── commands/
│   │   ├── auth.ts              # login, logout, whoami, 2fa
│   │   ├── search.ts            # search, suggest
│   │   ├── cart.ts              # cart show, add, remove, clear
│   │   ├── slots.ts             # slots list, set, pick (interactive)
│   │   ├── delivery.ts          # deliveries list, detail, track, cancel, rate, invoice
│   │   ├── product.ts           # product detail, image download
│   │   ├── categories.ts        # categories, lists browsing
│   │   ├── user.ts              # user details, info, profile, mgm, consent
│   │   ├── order.ts             # order status
│   │   └── wallet.ts            # payment profile, transactions
│   └── utils/
│       ├── format.ts            # Price (cents→€), dates, status colorization
│       └── interactive.ts       # Inquirer prompt helpers
├── package.json
├── tsconfig.json
└── README.md
```

**Rule**: One command group per file. Each file exports a single `register*Commands(program: Command): void` function. No cross-command imports except shared infra (`client`, `output`, `errors`, `format`).

---

## 3. Configuration (`config.ts`)

Use `conf` with the project name `picnic-cli`.

### Stored Config Shape

```typescript
interface PicnicCliConfig {
  countryCode: "NL" | "DE";     // default: "NL"
  apiVersion: string;            // default: "15"
  authKey: string | null;        // from LoginResult.authKey, persisted after login
  username: string | null;       // email, stored for re-auth convenience
  defaultOutput: "pretty" | "json" | "table"; // default: "pretty"
}
```

### Behavior

- On first run with no config: defaults apply, `authKey` is `null`
- `login` stores `authKey` and `username`
- `logout` clears `authKey` (keeps `username` and preferences)
- Global `--country` flag overrides `countryCode` for that invocation only (does not persist)
- Config location: `~/.config/picnic-cli/config.json` (conf default)

---

## 4. Client Factory (`client.ts`)

```typescript
import PicnicClient from "picnic-api";
import type { CountryCode } from "picnic-api";

// Lazy singleton
let _client: InstanceType<typeof PicnicClient> | null = null;

/**
 * Get authenticated client. Throws CliError if no authKey.
 * countryOverride: from --country flag, takes precedence over config.
 */
export function getClient(countryOverride?: CountryCode): InstanceType<typeof PicnicClient> {
  if (_client) return _client;
  const cfg = getConfig();
  if (!cfg.authKey) {
    throw new CliError("Not authenticated. Run: picnic login");
  }
  _client = new PicnicClient({
    countryCode: countryOverride ?? cfg.countryCode,
    apiVersion: cfg.apiVersion,
    authKey: cfg.authKey,
  });
  return _client;
}

/**
 * Unauthenticated client for login flow only.
 */
export function getAnonClient(countryOverride?: CountryCode): InstanceType<typeof PicnicClient> {
  const cfg = getConfig();
  return new PicnicClient({
    countryCode: countryOverride ?? cfg.countryCode,
    apiVersion: cfg.apiVersion,
  });
}
```

---

## 5. Output System (`output.ts`)

Every command must go through the shared output dispatcher. This ensures `--json` works everywhere.

```typescript
type OutputFormat = "pretty" | "json" | "table";

interface OutputOpts {
  format: OutputFormat;
}

/**
 * Resolve output format from commander opts.
 * --json wins over --table, both win over config default.
 */
export function resolveFormat(opts: { json?: boolean; table?: boolean }): OutputFormat {
  if (opts.json) return "json";
  if (opts.table) return "table";
  return getConfig().defaultOutput;
}

/**
 * Universal output. Every command calls this.
 * - json: raw JSON to stdout (pipeable)
 * - table: cli-table3 rendering
 * - pretty: custom human-friendly rendering
 *
 * If no prettyFn/tableFn provided, falls back to JSON.
 */
export function output<T>(
  data: T,
  format: OutputFormat,
  prettyFn?: (data: T) => string,
  tableFn?: (data: T) => string,
): void {
  switch (format) {
    case "json":
      process.stdout.write(JSON.stringify(data, null, 2) + "\n");
      break;
    case "table":
      console.log(tableFn ? tableFn(data) : JSON.stringify(data, null, 2));
      break;
    case "pretty":
      console.log(prettyFn ? prettyFn(data) : JSON.stringify(data, null, 2));
      break;
  }
}
```

### Pretty Output Specs Per Command

| Command | Pretty Output |
|---|---|
| `search` | Table: `ID │ Name │ Price │ Unit Qty` |
| `cart` | Table of line items + summary line (total items, total price €, savings €, deposit €) |
| `slots` | Table: `Slot ID │ Window │ Available │ Selected │ Min Order €` |
| `deliveries` | Table: `ID │ Status (colored) │ Delivery Window │ Items │ Total €` |
| `delivery <id>` | Full detail block: slot, items, status, containers |
| `product <id>` | Name, price, unit qty, description, allergens, nutritional highlights |
| `user` / `whoami` | Name, address, email, phone, total deliveries |
| `wallet transactions` | Table: `ID │ Date │ Amount € │ Status │ Method` |

### Price Formatting

All prices from the API are in **cents**. Display as `€X.XX`. Use `nl-NL` locale for date formatting.

---

## 6. Error Handling (`errors.ts`)

```typescript
export class CliError extends Error {
  constructor(message: string, public exitCode: number = 1) {
    super(message);
    this.name = "CliError";
  }
}

/**
 * HOF that wraps every command action for uniform error handling.
 * - CliError → stderr + exit code
 * - API errors (has .code, .message) → formatted API error
 * - Unknown → rethrow
 */
export function withErrorHandling(
  fn: (...args: any[]) => Promise<void>
): (...args: any[]) => Promise<void> {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err: unknown) {
      if (err instanceof CliError) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(err.exitCode);
      }
      if (err && typeof err === "object" && "code" in err && "message" in err) {
        const apiErr = err as { code: string; message: string };
        console.error(chalk.red(`API Error [${apiErr.code}]: ${apiErr.message}`));
        process.exit(1);
      }
      throw err;
    }
  };
}
```

**Every** `.action()` handler must be wrapped in `withErrorHandling`. No exceptions.

---

## 7. Global Options & Entry Point (`index.ts`)

```typescript
#!/usr/bin/env node
import { Command } from "commander";
// import all register functions...

const program = new Command()
  .name("picnic")
  .description("CLI for Picnic online supermarket")
  .version("0.1.0")
  .option("-j, --json", "Output raw JSON")
  .option("-t, --table", "Output as table")
  .option("-c, --country <code>", "Country code: NL or DE")
  .option("--no-color", "Disable colors")
  .option("-v, --verbose", "Verbose/debug output");

// Register all command groups
registerAuthCommands(program);
registerSearchCommands(program);
registerCartCommands(program);
registerSlotCommands(program);
registerDeliveryCommands(program);
registerProductCommands(program);
registerCategoryCommands(program);
registerUserCommands(program);
registerOrderCommands(program);
registerWalletCommands(program);
registerMiscCommands(program);

program.parse();
```

**Binary**: `"bin": { "picnic": "./dist/index.js" }` in package.json.

---

## 8. Command Specifications

Each section below defines every command, its exact mapping to `picnic-api`, arguments, options, and expected behavior.

---

### 8.1 Auth Commands (`commands/auth.ts`)

#### `picnic login`

- **Interactive** (default): Prompt email, then prompt password (hidden)
- **Semi-interactive**: `picnic login -u email@x.com` → prompt password only
- **Non-interactive**: `picnic login -u email@x.com -p password` → no prompts
- Maps to: `client.login(username, password)`
- On success: store `LoginResult.authKey` and username in config
- If `LoginResult.second_factor_authentication_required` is `true`: print message telling user to run `picnic 2fa generate`
- Output: success message with user_id

```
Options:
  -u, --username <email>   Picnic account email
  -p, --password <pass>    Picnic account password
```

#### `picnic logout`

- Clears `authKey` from config (keeps username, preferences)
- Output: confirmation message

#### `picnic whoami`

- Maps to: `client.getUserDetails()`
- Pretty: name, email, address, total deliveries
- Fail with "Not authenticated" if no authKey

#### `picnic 2fa generate`

- Maps to: `client.generate2FACode("SMS")`
- Output: "2FA code sent via SMS"

#### `picnic 2fa verify <code>`

- Argument: `code` (string, required)
- Maps to: `client.verify2FACode(code)`
- Output: success/failure message

---

### 8.2 Search Commands (`commands/search.ts`)

#### `picnic search <query>`

- Argument: `query` (string, required)
- Maps to: `client.search(query)`
- Returns: `SearchResult[]`
- Pretty table columns: `ID | Name | Price | Unit Qty`
- Price: `display_price` field (already formatted string from API)

#### `picnic suggest <query>`

- Argument: `query` (string, required)
- Maps to: `client.getSuggestions(query)`
- Returns: `SuggestionResult[]`
- Pretty: numbered list of suggestions

---

### 8.3 Cart Commands (`commands/cart.ts`)

#### `picnic cart`

- Maps to: `client.getShoppingCart()`
- Returns: `Order`
- Pretty: table of items from `Order.items` (which are `OrderLine[]`, each containing `OrderArticle[]` in `.items`), plus summary footer
- Summary: total_count items, total_price €, total_savings €, total_deposit €

#### `picnic cart add <productId>`

- Argument: `productId` (string, required)
- Option: `--qty <n>` (number, default: 1)
- Maps to: `client.addProductToShoppingCart(productId, count)`
- Returns: updated `Order`
- Output: same as `picnic cart` (show updated cart)

#### `picnic cart remove <productId>`

- Argument: `productId` (string, required)
- Option: `--qty <n>` (number, default: 1)
- Maps to: `client.removeProductFromShoppingCart(productId, count)`
- Returns: updated `Order`
- Output: show updated cart

#### `picnic cart clear`

- Maps to: `client.clearShoppingCart()`
- Returns: empty `Order`
- Output: "Cart cleared" + empty cart summary

---

### 8.4 Slot Commands (`commands/slots.ts`)

#### `picnic slots`

- Maps to: `client.getDeliverySlots()`
- Returns: `GetDeliverySlotsResult`
- Pretty table from `.delivery_slots`: `Slot ID | Window (start–end) | Available | Selected | Min Order €`
- Highlight currently selected slot
- Show cut-off time

#### `picnic slots set <slotId>`

- Argument: `slotId` (string, required)
- Maps to: `client.setDeliverySlot(slotId)`
- Returns: updated `Order`
- Output: confirmation + updated cart summary

#### `picnic slots pick`

- Interactive command using `@inquirer/prompts` `select()`
- Fetches slots, filters to `is_available === true`
- Presents selectable list with formatted windows
- On selection: calls `client.setDeliverySlot(selectedSlotId)`
- Output: confirmation

---

### 8.5 Delivery Commands (`commands/delivery.ts`)

#### `picnic deliveries`

- Maps to: `client.getDeliveries(filter?)`
- Option: `--status <s>` — filter value: `CURRENT`, `COMPLETED`, or `CANCELLED`. If provided, pass `[status]` as filter array
- Returns: `Delivery[]`
- Pretty table: `ID | Status (colored) | Window | Creation Time`
- Status colors: CURRENT=blue, COMPLETED=green, CANCELLED=red

#### `picnic delivery <id>`

- Argument: `deliveryId` (string, required)
- Maps to: `client.getDelivery(deliveryId)`
- Returns: `Delivery`
- Pretty: full detail — slot window, status, orders with line items, returned containers

#### `picnic delivery track <id>`

- Argument: `deliveryId` (string, required)
- Maps to: `client.getDeliveryPosition(deliveryId)`
- Returns: `DeliveryPosition`
- Output: position data (scenario_ts)

#### `picnic delivery route <id>`

- Argument: `deliveryId` (string, required)
- Maps to: `client.getDeliveryScenario(deliveryId)`
- Returns: `DeliveryScenario`
- Pretty: vehicle info + scenario waypoints (lat/lng/ts)

#### `picnic delivery cancel <id>`

- Argument: `deliveryId` (string, required)
- Maps to: `client.cancelDelivery(deliveryId)`
- Output: confirmation or error

#### `picnic delivery rate <id> <rating>`

- Arguments: `deliveryId` (string), `rating` (number 0-10)
- Validate: rating must be integer 0-10, throw CliError otherwise
- Maps to: `client.setDeliveryRating(deliveryId, rating)`
- Output: confirmation

#### `picnic delivery invoice <id>`

- Argument: `deliveryId` (string, required)
- Maps to: `client.sendDeliveryInvoiceEmail(deliveryId)`
- Output: "Invoice email sent"

---

### 8.6 Product Commands (`commands/product.ts`)

#### `picnic product <id>`

- Argument: `productId` (string, required)
- Maps to: `client.getArticle(productId)`
- Returns: `Article`
- Pretty: name, price (from price_info.price, in cents), unit_quantity, description.main, allergens, highlights

#### `picnic product page <id>`

- Argument: `productId` (string, required)
- Maps to: `client.getProductDetailsPage(productId)`
- Returns: `any` (untyped)
- Output: JSON only (too dynamic for pretty rendering)

#### `picnic product image <imageId>`

- Argument: `imageId` (string, required)
- Option: `--size <s>` — one of: `tiny`, `small`, `medium`, `large`, `extra-large`. Default: `medium`
- Maps to: `client.getImage(imageId, size)`
- Returns: arrayBuffer as string
- Behavior: write to file `<imageId>_<size>.jpg` in current directory
- Output: "Saved to ./<filename>"

---

### 8.7 Category Commands (`commands/categories.ts`)

#### `picnic categories`

- Option: `--depth <n>` (number, default: 0)
- Maps to: `client.getCategories(depth)`
- Returns: `MyStore`
- Pretty: tree of `.catalog` categories with indentation by level

#### `picnic lists`

- Option: `--depth <n>` (number, default: 0)
- Maps to: `client.getLists(depth)`
- Returns: `Category[]`
- Pretty: tree of lists

#### `picnic list <id> [subId]`

- Arguments: `listId` (required), `subListId` (optional)
- Option: `--depth <n>` (number, default: 0)
- Maps to: `client.getList(listId, subListId, depth)`
- Returns: `SubCategory[] | SingleArticle[]`
- Pretty: if articles, show as product table; if subcategories, show as list

---

### 8.8 User Commands (`commands/user.ts`)

#### `picnic user`

- Maps to: `client.getUserDetails()`
- Returns: `User`
- Pretty: firstname, lastname, address, phone, email, total/completed deliveries

#### `picnic user info`

- Maps to: `client.getUserInfo()`
- Returns: `UserInfo`
- Pretty: user_id, redacted phone, feature toggles list

#### `picnic user profile`

- Maps to: `client.getProfileMenu()`
- Returns: `ProfileMenu`
- Output: profile data

#### `picnic user mgm`

- Maps to: `client.getMgmDetails()`
- Returns: `MgmDetails`
- Pretty: referral code, share URL, earned amount €

#### `picnic user consent`

- Option: `--general` (boolean flag)
- Maps to: `client.getConsentSettings(general)`
- Returns: `ConsentSetting[]`
- Pretty: table of consent items with current decisions

---

### 8.9 Order Commands (`commands/order.ts`)

#### `picnic order status <orderId>`

- Argument: `orderId` (string, required)
- Maps to: `client.getOrderStatus(orderId)`
- Returns: `OrderStatus`
- Pretty: checkout_status value

---

### 8.10 Wallet Commands (`commands/wallet.ts`)

#### `picnic wallet`

- Maps to: `client.getPaymentProfile()`
- Returns: `PaymentProfile`
- Pretty: stored payment options, preferred payment option

#### `picnic wallet transactions`

- Option: `--page <n>` (number, default: 0)
- Maps to: `client.getWalletTransactions(page)`
- Returns: `WalletTransaction[]`
- Pretty table: `ID | Date | Amount € | Status | Method`
- Amount: `amount_in_cents` → `€X.XX`
- Date: `timestamp` (unix) → formatted date

#### `picnic wallet transaction <id>`

- Argument: `walletTransactionId` (string, required)
- Maps to: `client.getWalletTransactionDetails(id)`
- Returns: `WalletTransactionDetails`
- Pretty: delivery_id, shop items, deposits, returned containers

---

### 8.11 Misc Commands (register directly on program or as `commands/misc.ts`)

#### `picnic messages`

- Maps to: `client.getMessages()`
- JSON output only (untyped response)

#### `picnic reminders`

- Maps to: `client.getReminders()`
- JSON output only (untyped response)

#### `picnic support`

- Maps to: `client.getCustomerServiceContactInfo()`
- Returns: `CustomerServiceContactInfo`
- Pretty: phone, email, whatsapp, opening times

#### `picnic parcels`

- Maps to: `client.getParcels()`
- JSON output only (untyped response)

#### `picnic raw <method> <path>`

- Arguments: `method` (GET|POST|PUT|DELETE), `path` (string)
- Option: `--data <json>` (string, JSON body for POST/PUT)
- Maps to: `client.sendRequest(method, path, parsedData)`
- Parse `--data` with `JSON.parse()`, throw CliError on invalid JSON
- Output: JSON always (raw escape hatch)

---

## 9. Formatting Utilities (`utils/format.ts`)

Implement these helpers. They're used across all pretty renderers.

```typescript
import chalk from "chalk";

/** Picnic API prices are in cents */
export function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

/** Format delivery window: "ma 24 feb 14:00–15:00" */
export function formatWindow(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const dateStr = s.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const startTime = s.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  const endTime = e.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  return `${dateStr} ${startTime}–${endTime}`;
}

/** Colorize delivery status */
export function formatStatus(status: string): string {
  switch (status) {
    case "CURRENT": return chalk.blue(status);
    case "COMPLETED": return chalk.green(status);
    case "CANCELLED": return chalk.red(status);
    default: return chalk.gray(status);
  }
}

/** Unix timestamp to readable date */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
```

---

## 10. Interactive Helpers (`utils/interactive.ts`)

```typescript
import { select, input, password } from "@inquirer/prompts";
import type { DeliverySlot } from "picnic-api";
import { formatWindow, formatPrice } from "./format.js";
import { CliError } from "../errors.js";

export async function promptLogin(prefillEmail?: string): Promise<{ username: string; password: string }> {
  const username = prefillEmail ?? await input({ message: "Email:" });
  const pass = await password({ message: "Password:" });
  return { username, password: pass };
}

export async function pickSlot(slots: DeliverySlot[]): Promise<string> {
  const available = slots.filter((s) => s.is_available);
  if (!available.length) throw new CliError("No delivery slots available");

  return select({
    message: "Pick a delivery slot:",
    choices: available.map((s) => ({
      name: `${formatWindow(s.window_start, s.window_end)}  (min ${formatPrice(s.minimum_order_value)})`,
      value: s.slot_id,
      description: s.selected ? "✓ currently selected" : undefined,
    })),
  });
}
```

---

## 11. TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/"]
}
```

---

## 12. package.json

```json
{
  "name": "picnic-cli",
  "version": "0.1.0",
  "description": "CLI for Picnic online supermarket",
  "type": "module",
  "bin": {
    "picnic": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "engines": {
    "node": ">=20"
  },
  "license": "MIT"
}
```

---

## 13. Implementation Checklist

Build in this order. Each step should produce a working (if incomplete) CLI.

### Phase 1: Foundation
- [ ] `npm init`, install all deps, set up tsconfig
- [ ] `src/types.ts` — re-export picnic-api types
- [ ] `src/config.ts` — conf store with defaults
- [ ] `src/errors.ts` — CliError + withErrorHandling
- [ ] `src/output.ts` — output dispatcher + resolveFormat
- [ ] `src/client.ts` — getClient + getAnonClient
- [ ] `src/utils/format.ts` — formatPrice, formatWindow, formatStatus, formatTimestamp
- [ ] `src/index.ts` — bare program with version/help, no commands yet
- [ ] Verify: `tsx src/index.ts --help` works

### Phase 2: Auth (unblocks everything else)
- [ ] `src/utils/interactive.ts` — promptLogin
- [ ] `src/commands/auth.ts` — login, logout, whoami, 2fa generate, 2fa verify
- [ ] Register in index.ts
- [ ] Verify: `tsx src/index.ts login` works end-to-end

### Phase 3: Core Shopping Flow
- [ ] `src/commands/search.ts` — search, suggest
- [ ] `src/commands/cart.ts` — cart, cart add, cart remove, cart clear
- [ ] `src/commands/slots.ts` — slots, slots set, slots pick
- [ ] `src/utils/interactive.ts` — pickSlot
- [ ] Register all in index.ts
- [ ] Verify: search → add to cart → pick slot flow works

### Phase 4: Delivery & Orders
- [ ] `src/commands/delivery.ts` — all 7 subcommands
- [ ] `src/commands/order.ts` — order status
- [ ] Register in index.ts

### Phase 5: Browsing & Info
- [ ] `src/commands/product.ts` — product, product page, product image
- [ ] `src/commands/categories.ts` — categories, lists, list
- [ ] `src/commands/user.ts` — user, user info, user profile, user mgm, user consent
- [ ] `src/commands/wallet.ts` — wallet, wallet transactions, wallet transaction
- [ ] Register in index.ts

### Phase 6: Misc & Polish
- [ ] Misc commands (messages, reminders, support, parcels, raw)
- [ ] `README.md` with usage examples
- [ ] `npm run build` produces working dist/
- [ ] Test `npm link` and verify `picnic` binary works globally

---

## 14. Patterns & Conventions

### Command Handler Pattern

Every command handler follows this exact pattern:

```typescript
someCommand
  .command("subcommand <requiredArg>")
  .description("What it does")
  .option("--flag <value>", "Description", "default")
  .action(withErrorHandling(async (requiredArg: string, opts: Record<string, any>) => {
    const client = getClient(opts.parent?.country);
    const spinner = ora("Loading...").start();
    const data = await client.someMethod(requiredArg);
    spinner.stop();
    output(data, resolveFormat(opts), prettyRenderer, tableRenderer);
  }));
```

Rules:
1. Always `withErrorHandling`
2. Always get client from factory (never instantiate directly)
3. Use `ora` spinner for any API call
4. Always go through `output()` — never `console.log` data directly
5. Access parent opts for global flags via commander's option inheritance

### Spinner Behavior

- Show spinner on every API call
- Stop spinner before any output
- In `--json` mode: suppress spinner entirely (clean pipe output)

### Exit Codes

- `0` — success
- `1` — general error / API error / auth failure
- `2` — invalid arguments / validation error

---

## 15. picnic-api Method Reference

Complete mapping of every method on `PicnicClient`. The types are already in the package — do NOT redefine them, import from `picnic-api`.

```
login(username: string, password: string): Promise<LoginResult>
generate2FACode(channel: string): Promise<null>
verify2FACode(code: string): Promise<ApiError | null>
getUserDetails(): Promise<User>
getUserInfo(): Promise<UserInfo>
getProfileMenu(): Promise<ProfileMenu>
search(query: string): Promise<SearchResult[]>
getSuggestions(query: string): Promise<SuggestionResult[]>
getArticle(productId: string): Promise<Article>
getProductDetailsPage(productId: string): Promise<any>
getImage(imageId: string, size: ImageSize): Promise<string>
getImageAsDataUri(imageId: string, size: ImageSize): Promise<string>
getCategories(depth?: number): Promise<MyStore>
getShoppingCart(): Promise<Order>
addProductToShoppingCart(productId: string, count?: number): Promise<Order>
removeProductFromShoppingCart(productId: string, count?: number): Promise<Order>
clearShoppingCart(): Promise<Order>
getDeliverySlots(): Promise<GetDeliverySlotsResult>
setDeliverySlot(slotId: string): Promise<Order>
getDeliveries(filter?: DeliveryStatus[]): Promise<Delivery[]>
getDelivery(deliveryId: string): Promise<Delivery>
getDeliveryPosition(deliveryId: string): Promise<DeliveryPosition>
getDeliveryScenario(deliveryId: string): Promise<DeliveryScenario>
cancelDelivery(deliveryId: string): Promise<any>
setDeliveryRating(deliveryId: string, rating: number): Promise<string>
sendDeliveryInvoiceEmail(deliveryId: string): Promise<string>
getOrderStatus(orderId: string): Promise<OrderStatus>
getLists(depth?: number): Promise<Category[]>
getList(listId: string, subListId?: string, depth?: number): Promise<SubCategory[] | SingleArticle[]>
getMgmDetails(): Promise<MgmDetails>
getConsentSettings(general?: boolean): Promise<ConsentSetting[]>
setConsentSettings(input: SetConsentSettingsInput): Promise<SetConsentSettingsResult>
getMessages(): Promise<any>
getReminders(): Promise<any>
getPaymentProfile(): Promise<PaymentProfile>
getWalletTransactions(pageNumber: number): Promise<WalletTransaction[]>
getWalletTransactionDetails(id: string): Promise<WalletTransactionDetails>
getCustomerServiceContactInfo(): Promise<CustomerServiceContactInfo>
getParcels(): Promise<any[]>
sendRequest<TReq, TRes>(method, path, data?, includePicnicHeaders?, isImageRequest?): Promise<TRes>
```

**Do not wrap `getBundleArticleIds`** — it's deprecated.
**Do not wrap `getImageAsDataUri`** — CLI should use `getImage` and write binary.
**Do not wrap `setConsentSettings`** — destructive, low CLI value.

---

## 16. Key Constraints

1. **No checkout**: The CLI does NOT implement order confirmation/checkout. Users confirm in the Picnic app. This is intentional.
2. **picnic-api is the transport**: Do NOT make raw HTTP calls. Use `client.sendRequest()` for anything not wrapped by the library.
3. **Types come from picnic-api**: Import them, don't redefine. The only new types are `PicnicCliConfig` and `OutputFormat`.
4. **ESM only**: All imports use `.js` extension (`import { x } from "./config.js"`).
5. **No tests in v0.1**: Ship first, test later. The API client is already tested upstream.
6. **Prices are cents**: Every price display must divide by 100. No exceptions.
7. **nl-NL locale**: For all date/time formatting.