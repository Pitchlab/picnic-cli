# picnic-cli

CLI for Picnic online supermarket, wrapping the `picnic-api` npm package.

## Tech

- Node.js >= 20, ESM (`"type": "module"`)
- TypeScript with `Node16` module resolution
- `commander` for CLI framework, `conf` for config store
- `chalk`, `cli-table3`, `ora` for output formatting
- `@inquirer/prompts` for interactive flows
- `picnic-api` is CommonJS — use `import PicnicClient from "picnic-api"` (esModuleInterop handles it)

## Conventions

- All imports use `.js` extension (ESM)
- One command group per file, exports `register*Commands(program)`
- Every `.action()` wrapped in `withErrorHandling`
- Every API call gets `ora` spinner (suppressed in `--json` mode)
- All data goes through `output()` — never raw `console.log`
- Prices from API are in cents — always format as `€X.XX`
- Use `nl-NL` locale for date/time formatting
- Types come from `picnic-api` — don't redefine them
- Interface naming: `IFoo`, class naming: `Foo`
- Use `pnpm` for package management

## Key Files

- `src/index.ts` — entry point, command registration
- `src/client.ts` — PicnicClient factory (authenticated + anonymous)
- `src/config.ts` — conf store with credentials and preferences
- `src/output.ts` — output dispatcher (json/table/pretty)
- `src/errors.ts` — CliError + withErrorHandling HOF
- `src/utils/format.ts` — price, date, status formatters
- `src/utils/interactive.ts` — inquirer prompt helpers
- `src/commands/` — one file per command group
