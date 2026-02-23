# Skill: picnic-cli

Work with the Picnic supermarket CLI to manage grocery shopping from the terminal.

## Context

picnic-cli is a TypeScript CLI wrapping the `picnic-api` npm package. It lives at `picnic-cli/` in the pitchlab-tools monorepo.

## Setup

```bash
cd picnic-cli
pnpm install
pnpm build  # or use pnpm dev for development
```

## Key Commands

### Authentication
```bash
pnpm dev -- login                    # Interactive login
pnpm dev -- login -u email@x.com    # Semi-interactive
pnpm dev -- whoami                   # Check current user
pnpm dev -- logout                   # Clear auth
```

### Shopping Workflow
```bash
pnpm dev -- search "melk"           # Find products
pnpm dev -- cart add <productId>    # Add to cart
pnpm dev -- cart                     # View cart
pnpm dev -- slots pick               # Pick delivery slot (interactive)
pnpm dev -- cart --json              # JSON output for scripting
```

### Browsing & Product Info
```bash
pnpm dev -- categories               # List all top-level categories
pnpm dev -- category <id>            # Browse subcategories
pnpm dev -- product show <id>        # Product details (name, price, allergens, etc.)
pnpm dev -- product page <id>        # Raw product page JSON
```

### Deliveries & Account
```bash
pnpm dev -- deliveries               # List deliveries
pnpm dev -- delivery show <id>       # Delivery details
pnpm dev -- support                  # Customer service info
pnpm dev -- user                     # User details
pnpm dev -- wallet                   # Payment info
```

## Development

- **Source**: `src/` directory, TypeScript with ESM
- **Build**: `pnpm build` (outputs to `dist/`)
- **Dev mode**: `pnpm dev -- <command>` (uses tsx, no build needed)
- **Type check**: `pnpm typecheck`
- **Tests**: `PICNIC_TEST_USERNAME=x PICNIC_TEST_PASSWORD=y pnpm test:e2e`

## Architecture

- `src/index.ts` — Entry point, registers all commands
- `src/client.ts` — PicnicClient factory (authenticated + anonymous)
- `src/config.ts` — Persistent config store (`~/.config/picnic-cli/`)
- `src/output.ts` — Output dispatcher (json/table/pretty)
- `src/errors.ts` — CliError + withErrorHandling HOF
- `src/utils/format.ts` — Price/date/status formatters
- `src/utils/interactive.ts` — Inquirer prompt helpers
- `src/commands/*.ts` — One file per command group

## Patterns

- Every command action is wrapped in `withErrorHandling`
- Every API call uses `ora` spinner (suppressed in `--json` mode)
- All output goes through `output()` — never raw `console.log` for data
- Global opts (`--json`, `--table`, `--country`) via `cmd.optsWithGlobals()`
- All imports use `.js` extension (ESM requirement)
- Prices from API are in cents — format with `formatPrice()` as `€X.XX`
- Types imported from `picnic-api/lib/types/picnic-api.js` (CJS package)

## Adding a New Command

1. Create `src/commands/newcmd.ts`
2. Export `registerNewCmdCommands(program: Command)`
3. Wrap actions in `withErrorHandling`
4. Use `ora` for spinners, `output()` for display
5. Import and register in `src/index.ts`
6. Run `pnpm build` to verify
