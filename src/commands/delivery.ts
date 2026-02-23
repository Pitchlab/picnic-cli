import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { getClient } from "../client.js";
import { resolveFormat, output } from "../output.js";
import { withErrorHandling, CliError } from "../errors.js";
import { formatPrice, formatStatus, formatWindow, formatTimestamp } from "../utils/format.js";
import type { Delivery, DeliveryPosition, DeliveryScenario, DeliveryStatus } from "../types.js";

export function registerDeliveryCommands(program: Command): void {
  // ── Top-level `deliveries` (plural) ────────────────────────────────
  program
    .command("deliveries")
    .description("List deliveries")
    .option("--status <status>", "Filter by status (CURRENT, COMPLETED, CANCELLED)")
    .action(
      withErrorHandling(async (_opts, cmd) => {
        const opts = cmd.optsWithGlobals();
        const localOpts = cmd.opts();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching deliveries…").start();

        const client = getClient(opts.country);
        const filter: DeliveryStatus[] | undefined = localOpts.status
          ? [localOpts.status as DeliveryStatus]
          : undefined;
        const deliveries: Delivery[] = await client.getDeliveries(filter);

        spinner?.stop();

        output(deliveries, format, (data) => {
          if (!data.length) return chalk.dim("No deliveries found.");
          return data
            .map((d) => {
              const window = d.delivery_time
                ? formatWindow(d.delivery_time.start, d.delivery_time.end)
                : d.slot
                  ? formatWindow(d.slot.window_start, d.slot.window_end)
                  : "-";
              return `  ${chalk.bold(d.delivery_id)}  ${formatStatus(d.status)}  ${window}  ${chalk.dim(d.creation_time)}`;
            })
            .join("\n");
        }, (data) => {
          if (!data.length) return "No deliveries found.";
          const table = new Table({
            head: ["ID", "Status", "Window", "Creation Time"],
          });
          for (const d of data) {
            table.push([
              d.delivery_id,
              formatStatus(d.status),
              d.delivery_time
                ? formatWindow(d.delivery_time.start, d.delivery_time.end)
                : d.slot
                  ? formatWindow(d.slot.window_start, d.slot.window_end)
                  : "-",
              d.creation_time,
            ]);
          }
          return table.toString();
        });
      }),
    );

  // ── `delivery` command group ───────────────────────────────────────
  const delivery = program
    .command("delivery")
    .description("Delivery detail commands");

  delivery
    .command("show <id>", { isDefault: true })
    .description("Show delivery details")
    .action(
      withErrorHandling(async (deliveryId: string, _opts: any, cmd: any) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching delivery…").start();

        const client = getClient(opts.country);
        const d: Delivery = await client.getDelivery(deliveryId);

        spinner?.stop();

        output(d, format, (data) => {
          const lines: string[] = [
            chalk.bold(`Delivery ${data.delivery_id}`),
            `  Status:        ${formatStatus(data.status)}`,
            `  Window:        ${formatWindow(data.delivery_time.start, data.delivery_time.end)}`,
            `  Created:       ${data.creation_time}`,
          ];

          if (data.orders?.length) {
            lines.push("", chalk.bold("  Orders:"));
            for (const order of data.orders) {
              lines.push(`    Order ${chalk.cyan(order.id)}`);
              if (order.items) {
                for (const line of order.items) {
                  const article = line.items[0];
                  lines.push(`      ${article.name}  ${chalk.dim(article.unit_quantity)}  ${formatPrice(line.price)}`);
                }
              }
            }
          }

          if (data.returned_containers?.length) {
            lines.push("", chalk.bold("  Returned containers:"));
            for (const c of data.returned_containers) {
              lines.push(`    ${JSON.stringify(c)}`);
            }
          }

          return lines.join("\n");
        }, (data) => {
          const info = new Table();
          info.push(
            { "Delivery ID": data.delivery_id },
            { Status: formatStatus(data.status) },
            { Window: formatWindow(data.delivery_time.start, data.delivery_time.end) },
            { Created: data.creation_time },
          );

          const parts = [info.toString()];

          if (data.orders?.length) {
            const orderTable = new Table({
              head: ["Order ID", "Item", "Unit Qty", "Price"],
            });
            for (const order of data.orders) {
              if (order.items) {
                for (const line of order.items) {
                  const article = line.items[0];
                  orderTable.push([order.id, article.name, article.unit_quantity, formatPrice(line.price)]);
                }
              }
            }
            parts.push(orderTable.toString());
          }

          return parts.join("\n");
        });
      }),
    );

  delivery
    .command("track <id>")
    .description("Track delivery position")
    .action(
      withErrorHandling(async (deliveryId: string, _opts: any, cmd: any) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Tracking delivery…").start();

        const client = getClient(opts.country);
        const position: DeliveryPosition = await client.getDeliveryPosition(deliveryId);

        spinner?.stop();

        output(position, format, (data) => {
          return [
            chalk.bold("Delivery Position"),
            `  Scenario timestamp: ${chalk.cyan(data.scenario_ts)}`,
          ].join("\n");
        }, (data) => {
          const table = new Table();
          table.push({ "Scenario TS": data.scenario_ts });
          return table.toString();
        });
      }),
    );

  delivery
    .command("route <id>")
    .description("Get delivery route scenario")
    .action(
      withErrorHandling(async (deliveryId: string, _opts: any, cmd: any) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching delivery route…").start();

        const client = getClient(opts.country);
        const result: DeliveryScenario = await client.getDeliveryScenario(deliveryId);

        spinner?.stop();

        output(result, format, (data) => {
          const lines: string[] = [];

          if (data.vehicle) {
            lines.push(chalk.bold("Vehicle"));
            lines.push(`  Image: ${chalk.dim(data.vehicle.image)}`);
            lines.push("");
          }

          lines.push(chalk.bold("Waypoints"));
          for (const wp of data.scenario) {
            lines.push(`  ${chalk.dim(wp.ts)}  ${wp.lat}, ${wp.lng}`);
          }

          return lines.join("\n");
        }, (data) => {
          const parts: string[] = [];

          if (data.vehicle) {
            const vehicleTable = new Table();
            vehicleTable.push({ Image: data.vehicle.image });
            parts.push(vehicleTable.toString());
          }

          const wpTable = new Table({
            head: ["Timestamp", "Latitude", "Longitude"],
          });
          for (const wp of data.scenario) {
            wpTable.push([wp.ts, wp.lat, wp.lng]);
          }
          parts.push(wpTable.toString());

          return parts.join("\n");
        });
      }),
    );

  delivery
    .command("cancel <id>")
    .description("Cancel a delivery")
    .action(
      withErrorHandling(async (deliveryId: string, _opts: any, cmd: any) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Cancelling delivery…").start();

        const client = getClient(opts.country);
        const result = await client.cancelDelivery(deliveryId);

        spinner?.stop();

        output(result, format, () => {
          return chalk.green(`Delivery ${deliveryId} cancelled.`);
        }, () => {
          return `Delivery ${deliveryId} cancelled.`;
        });
      }),
    );

  delivery
    .command("rate <id> <rating>")
    .description("Rate a delivery (0–10)")
    .action(
      withErrorHandling(async (deliveryId: string, ratingStr: string, _opts: any, cmd: any) => {
        const rating = parseInt(ratingStr, 10);
        if (!Number.isInteger(rating) || rating < 0 || rating > 10) {
          throw new CliError("Rating must be an integer between 0 and 10.", 2);
        }

        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Rating delivery…").start();

        const client = getClient(opts.country);
        const result = await client.setDeliveryRating(deliveryId, rating);

        spinner?.stop();

        output(result, format, () => {
          return chalk.green(`Delivery ${deliveryId} rated ${rating}/10.`);
        }, () => {
          return `Delivery ${deliveryId} rated ${rating}/10.`;
        });
      }),
    );

  delivery
    .command("invoice <id>")
    .description("Send delivery invoice email")
    .action(
      withErrorHandling(async (deliveryId: string, _opts: any, cmd: any) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Sending invoice email…").start();

        const client = getClient(opts.country);
        const result = await client.sendDeliveryInvoiceEmail(deliveryId);

        spinner?.stop();

        output(result, format, () => {
          return chalk.green("Invoice email sent.");
        }, () => {
          return "Invoice email sent.";
        });
      }),
    );
}
