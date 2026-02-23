import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { getClient } from "../client.js";
import { resolveFormat, output } from "../output.js";
import { withErrorHandling } from "../errors.js";
import type { OrderStatus } from "../types.js";

export function registerOrderCommands(program: Command): void {
  const order = program
    .command("order")
    .description("Order commands");

  order
    .command("status <orderId>")
    .description("Check order status")
    .action(
      withErrorHandling(async (orderId: string, _opts: any, cmd: any) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching order status…").start();

        const client = getClient(opts.country);
        const status: OrderStatus = await client.getOrderStatus(orderId);

        spinner?.stop();

        output(status, format, (data) => {
          const color = data.checkout_status === "COMPLETED" ? chalk.green
            : data.checkout_status === "CANCELLED" ? chalk.red
            : chalk.blue;
          return [
            chalk.bold(`Order ${orderId}`),
            `  Checkout status: ${color(data.checkout_status)}`,
          ].join("\n");
        }, (data) => {
          const table = new Table();
          table.push(
            { "Order ID": orderId },
            { "Checkout Status": data.checkout_status },
          );
          return table.toString();
        });
      }),
    );
}
