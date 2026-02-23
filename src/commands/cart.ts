import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { getClient } from "../client.js";
import { resolveFormat, output } from "../output.js";
import { withErrorHandling } from "../errors.js";
import { formatPrice } from "../utils/format.js";
import type { Order, OutputFormat } from "../types.js";

function renderCart(order: Order, format: OutputFormat): void {
  output(order, format, (data) => {
    if (!data.items.length) return chalk.dim("Your cart is empty.");

    const lines = data.items.map((line) => {
      const article = line.items[0];
      return `  ${chalk.bold(article.name)}  ${chalk.dim(article.unit_quantity)}  ${formatPrice(line.price)}`;
    });

    const footer = [
      "",
      chalk.bold(`Items: ${data.total_count}`),
      chalk.bold(`Total: ${formatPrice(data.total_price)}`),
      data.total_savings
        ? chalk.green(`Savings: ${formatPrice(data.total_savings)}`)
        : null,
      data.total_deposit
        ? chalk.dim(`Deposit: ${formatPrice(data.total_deposit)}`)
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    return lines.join("\n") + "\n" + footer;
  }, (data) => {
    const table = new Table({
      head: ["ID", "Name", "Unit Qty", "Price"],
    });
    for (const line of data.items) {
      const article = line.items[0];
      table.push([article.id, article.name, article.unit_quantity, formatPrice(line.price)]);
    }

    const summary = new Table();
    summary.push(
      { "Total items": `${data.total_count}` },
      { "Total price": formatPrice(data.total_price) },
      { Savings: formatPrice(data.total_savings) },
      { Deposit: formatPrice(data.total_deposit) },
    );

    return table.toString() + "\n" + summary.toString();
  });
}

export function registerCartCommands(program: Command): void {
  const cart = program
    .command("cart")
    .description("Shopping cart commands");

  cart
    .command("show", { isDefault: true })
    .description("Show current shopping cart")
    .action(
      withErrorHandling(async (_opts, cmd) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching cart…").start();

        const client = getClient(opts.country);
        const order: Order = await client.getShoppingCart();

        spinner?.stop();
        renderCart(order, format);
      }),
    );

  cart
    .command("add <productId> [quantity]")
    .description("Add a product to the cart")
    .action(
      withErrorHandling(async (productId: string, quantity: string | undefined, _opts: any, cmd: any) => {
        const opts = cmd.optsWithGlobals();
        const qty = parseInt(quantity ?? "1", 10);
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Adding to cart…").start();

        const client = getClient(opts.country);
        const order: Order = await client.addProductToShoppingCart(productId, qty);

        spinner?.stop();

        if (!opts.json) {
          console.log(chalk.green(`Added ${qty}× ${productId} to cart.`));
        }
        renderCart(order, format);
      }),
    );

  cart
    .command("remove <productId>")
    .description("Remove a product from the cart")
    .option("--qty <n>", "Quantity to remove", "1")
    .action(
      withErrorHandling(async (productId: string, _opts: any, cmd: any) => {
        const opts = cmd.optsWithGlobals();
        const localOpts = cmd.opts();
        const qty = parseInt(localOpts.qty, 10);
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Removing from cart…").start();

        const client = getClient(opts.country);
        const order: Order = await client.removeProductFromShoppingCart(productId, qty);

        spinner?.stop();

        if (!opts.json) {
          console.log(chalk.green(`Removed ${qty}× ${productId} from cart.`));
        }
        renderCart(order, format);
      }),
    );

  cart
    .command("clear")
    .description("Clear the entire shopping cart")
    .action(
      withErrorHandling(async (_opts, cmd) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Clearing cart…").start();

        const client = getClient(opts.country);
        const order: Order = await client.clearShoppingCart();

        spinner?.stop();

        if (!opts.json) {
          console.log(chalk.green("Cart cleared."));
        }
        renderCart(order, format);
      }),
    );
}
