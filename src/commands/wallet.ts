import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { getClient } from "../client.js";
import { resolveFormat, output } from "../output.js";
import { withErrorHandling } from "../errors.js";
import { formatPrice, formatTimestamp } from "../utils/format.js";

export function registerWalletCommands(program: Command): void {
  const wallet = program
    .command("wallet")
    .description("Wallet and payment commands");

  wallet
    .command("show", { isDefault: true })
    .description("Show payment profile")
    .action(
      withErrorHandling(async (_opts, cmd) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching payment profile…").start();

        const client = getClient(opts.country);
        const profile = await client.getPaymentProfile();

        spinner?.stop();

        output(profile, format, (data) => {
          if (!data.stored_payment_options?.length) return chalk.dim("No payment options found.");

          const lines: string[] = [chalk.bold("Payment Options"), ""];

          for (const opt of data.stored_payment_options) {
            const isPreferred = opt.id === data.preferred_payment_option_id;
            const prefix = isPreferred ? chalk.green("★ ") : "  ";
            const label = isPreferred ? chalk.bold(opt.display_name) : opt.display_name;
            const details = [opt.brand, opt.payment_method, opt.account].filter(Boolean).join(" · ");
            lines.push(`${prefix}${label}  ${chalk.dim(details)}`);
          }

          return lines.join("\n");
        }, (data) => {
          if (!data.stored_payment_options?.length) return "No payment options found.";
          const table = new Table({ head: ["ID", "Name", "Brand", "Method", "Account", "Preferred"] });
          for (const opt of data.stored_payment_options) {
            table.push([
              opt.id,
              opt.display_name,
              opt.brand,
              opt.payment_method,
              opt.account ?? "",
              opt.id === data.preferred_payment_option_id ? "Yes" : "",
            ]);
          }
          return table.toString();
        });
      }),
    );

  wallet
    .command("transactions")
    .description("List wallet transactions")
    .option("--page <n>", "Page number", "0")
    .action(
      withErrorHandling(async (_opts, cmd) => {
        const opts = cmd.optsWithGlobals();
        const localOpts = cmd.opts();
        const page = parseInt(localOpts.page, 10);
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching transactions…").start();

        const client = getClient(opts.country);
        const transactions = await client.getWalletTransactions(page);

        spinner?.stop();

        output(transactions, format, (data) => {
          if (!data.length) return chalk.dim("No transactions found.");

          return data
            .map(
              (t: { id: string; timestamp: number; amount_in_cents: number; status: string; transaction_method: string; display_name: string }) =>
                `  ${chalk.dim(t.id)}  ${formatTimestamp(t.timestamp)}  ${formatPrice(t.amount_in_cents)}  ${t.status}  ${t.display_name}`,
            )
            .join("\n");
        }, (data) => {
          if (!data.length) return "No transactions found.";
          const table = new Table({ head: ["ID", "Date", "Amount", "Status", "Method"] });
          for (const t of data) {
            table.push([
              t.id,
              formatTimestamp(t.timestamp),
              formatPrice(t.amount_in_cents),
              t.status,
              t.transaction_method,
            ]);
          }
          return table.toString();
        });
      }),
    );

  wallet
    .command("transaction <id>")
    .description("Show transaction details")
    .action(
      withErrorHandling(async (id: string, _opts: any, cmd: any) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching transaction details…").start();

        const client = getClient(opts.country);
        const details = await client.getWalletTransactionDetails(id);

        spinner?.stop();

        output(details, format, (data) => {
          const lines: string[] = [
            chalk.bold("Transaction Details"),
            `  Delivery ID:   ${chalk.cyan(data.delivery_id)}`,
          ];

          if (data.shop_items?.length) {
            lines.push("", chalk.bold("  Items:"));
            for (const line of data.shop_items) {
              const article = line.items[0];
              const name = article?.name ?? line.id;
              const unit = article?.unit_quantity ?? "";
              lines.push(`    ${name}  ${chalk.dim(unit)}  ${formatPrice(line.price)}`);
            }
          }

          if (data.deposits?.length) {
            lines.push("", chalk.bold("  Deposits:"));
            for (const d of data.deposits) {
              lines.push(`    ${d.type}  ×${d.count}  ${formatPrice(d.value)}`);
            }
          }

          if (data.returned_containers?.length) {
            lines.push("", chalk.bold("  Returned Containers:"));
            for (const c of data.returned_containers) {
              lines.push(`    ${c.localized_name}  ×${c.quantity}  ${formatPrice(c.price)}`);
            }
          }

          return lines.join("\n");
        }, (data) => {
          const parts: string[] = [];

          const info = new Table();
          info.push({ "Delivery ID": data.delivery_id });
          parts.push(info.toString());

          if (data.shop_items?.length) {
            const itemTable = new Table({ head: ["Name", "Unit Qty", "Price"] });
            for (const line of data.shop_items) {
              const article = line.items[0];
              const name = article?.name ?? line.id;
              const unit = article?.unit_quantity ?? "";
              itemTable.push([name, unit, formatPrice(line.price)]);
            }
            parts.push(itemTable.toString());
          }

          if (data.deposits?.length) {
            const depositTable = new Table({ head: ["Type", "Count", "Value"] });
            for (const d of data.deposits) {
              depositTable.push([d.type, d.count, formatPrice(d.value)]);
            }
            parts.push(depositTable.toString());
          }

          if (data.returned_containers?.length) {
            const containerTable = new Table({ head: ["Name", "Quantity", "Price"] });
            for (const c of data.returned_containers) {
              containerTable.push([c.localized_name, c.quantity, formatPrice(c.price)]);
            }
            parts.push(containerTable.toString());
          }

          return parts.join("\n");
        });
      }),
    );
}
