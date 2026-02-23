import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { getClient } from "../client.js";
import { resolveFormat, output } from "../output.js";
import { withErrorHandling } from "../errors.js";
import { formatPrice } from "../utils/format.js";

export function registerSearchCommands(program: Command): void {
  program
    .command("search <query>")
    .description("Search for products")
    .action(
      withErrorHandling(async (query: string, _opts: any, cmd: any) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Searching…").start();

        const client = getClient(opts.country);
        const results = await client.search(query) as any[];

        spinner?.stop();

        output(results, format, (data) => {
          if (!data.length) return chalk.yellow("No results found.");
          return data
            .map(
              (r) =>
                `${chalk.bold(r.name)}  ${chalk.dim(r.id)}\n  ${formatPrice(r.display_price)}  ·  ${r.unit_quantity}`,
            )
            .join("\n\n");
        }, (data) => {
          if (!data.length) return "No results found.";
          const table = new Table({
            head: ["ID", "Name", "Price", "Unit Qty"],
          });
          for (const r of data) {
            table.push([r.id, r.name, formatPrice(r.display_price), r.unit_quantity]);
          }
          return table.toString();
        });
      }),
    );

  program
    .command("suggest <query>")
    .description("Get search suggestions")
    .action(
      withErrorHandling(async (query: string, _opts: any, cmd: any) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching suggestions…").start();

        const client = getClient(opts.country);
        const results = await client.getSuggestions(query) as any[];

        spinner?.stop();

        output(results, format, (data) => {
          if (!data.length) return chalk.yellow("No suggestions found.");
          return data
            .map((s, i) => `  ${chalk.dim(`${i + 1}.`)} ${s.suggestion}`)
            .join("\n");
        }, (data) => {
          if (!data.length) return "No suggestions found.";
          const table = new Table({
            head: ["#", "Suggestion"],
          });
          data.forEach((s, i) => table.push([i + 1, s.suggestion]));
          return table.toString();
        });
      }),
    );
}
