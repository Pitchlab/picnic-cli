import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { getClient } from "../client.js";
import { resolveFormat, output } from "../output.js";
import { withErrorHandling } from "../errors.js";
import { formatWindow, formatPrice } from "../utils/format.js";
import { pickSlot } from "../utils/interactive.js";
import type { GetDeliverySlotsResult, Order } from "../types.js";

export function registerSlotCommands(program: Command): void {
  const slots = program
    .command("slots")
    .description("Delivery slot commands");

  slots
    .command("show", { isDefault: true })
    .description("List available delivery slots")
    .action(
      withErrorHandling(async (_opts, cmd) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching delivery slots…").start();

        const client = getClient(opts.country);
        const result: GetDeliverySlotsResult = await client.getDeliverySlots();

        spinner?.stop();

        output(result, format, (data) => {
          if (!data.delivery_slots.length) return chalk.yellow("No delivery slots available.");
          return data.delivery_slots
            .map((s) => {
              const window = formatWindow(s.window_start, s.window_end);
              const available = s.is_available ? chalk.green("available") : chalk.dim("unavailable");
              const selected = s.selected ? chalk.cyan(" [selected]") : "";
              const minOrder = s.minimum_order_value != null ? `  min ${formatPrice(s.minimum_order_value)}` : "";
              return `  ${chalk.bold(window)}  ${available}${selected}${minOrder}  ${chalk.dim(s.slot_id)}`;
            })
            .join("\n");
        }, (data) => {
          if (!data.delivery_slots.length) return "No delivery slots available.";
          const table = new Table({
            head: ["Slot ID", "Window", "Available", "Selected", "Min Order"],
          });
          for (const s of data.delivery_slots) {
            table.push([
              s.slot_id,
              formatWindow(s.window_start, s.window_end),
              s.is_available ? chalk.green("yes") : chalk.dim("no"),
              s.selected ? chalk.cyan("yes") : "no",
              s.minimum_order_value != null ? formatPrice(s.minimum_order_value) : "-",
            ]);
          }
          return table.toString();
        });
      }),
    );

  slots
    .command("set <slotId>")
    .description("Select a delivery slot")
    .action(
      withErrorHandling(async (slotId: string, _opts: any, cmd: any) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Setting delivery slot…").start();

        const client = getClient(opts.country);
        const order: Order = await client.setDeliverySlot(slotId);

        spinner?.stop();

        if (!opts.json) {
          console.log(chalk.green(`Delivery slot ${slotId} selected.`));
        }

        output(order, format, (data) => {
          return [
            chalk.bold(`Total items: ${data.total_count}`),
            chalk.bold(`Total price: ${formatPrice(data.total_price)}`),
          ].join("\n");
        }, (data) => {
          const table = new Table();
          table.push(
            { "Total items": `${data.total_count}` },
            { "Total price": formatPrice(data.total_price) },
          );
          return table.toString();
        });
      }),
    );

  slots
    .command("pick")
    .description("Interactively pick a delivery slot")
    .action(
      withErrorHandling(async (_opts, cmd) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching delivery slots…").start();

        const client = getClient(opts.country);
        const result: GetDeliverySlotsResult = await client.getDeliverySlots();

        spinner?.stop();

        const slotId = await pickSlot(result.delivery_slots);

        const setSpinner = opts.json ? null : ora("Setting delivery slot…").start();
        const order: Order = await client.setDeliverySlot(slotId);
        setSpinner?.stop();

        if (!opts.json) {
          console.log(chalk.green(`Delivery slot ${slotId} selected.`));
        }

        output(order, format, (data) => {
          return [
            chalk.bold(`Total items: ${data.total_count}`),
            chalk.bold(`Total price: ${formatPrice(data.total_price)}`),
          ].join("\n");
        }, (data) => {
          const table = new Table();
          table.push(
            { "Total items": `${data.total_count}` },
            { "Total price": formatPrice(data.total_price) },
          );
          return table.toString();
        });
      }),
    );
}
