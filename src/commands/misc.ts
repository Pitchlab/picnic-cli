import type { Command } from "commander";
import ora from "ora";
import { withErrorHandling, CliError } from "../errors.js";
import { output, resolveFormat } from "../output.js";
import { getClient } from "../client.js";

interface CustomerServiceContactInfo {
  contact_details: {
    email: string;
    phone: string;
    whatsapp: string;
  };
  opening_times: {
    [date: string]: {
      start: number[];
      end: number[];
    };
  };
}

export function registerMiscCommands(program: Command): void {
  program
    .command("messages")
    .description("Get messages")
    .action(
      withErrorHandling(async (_opts: Record<string, unknown>, cmd: Command) => {
        const globalOpts = cmd.optsWithGlobals();
        const spinner = globalOpts.json ? null : ora("Fetching messages…").start();
        const client = await getClient(globalOpts.country);
        const messages = await client.getMessages();
        spinner?.succeed("Messages fetched");
        output(messages, resolveFormat(globalOpts));
      }),
    );

  program
    .command("reminders")
    .description("Get reminders")
    .action(
      withErrorHandling(async (_opts: Record<string, unknown>, cmd: Command) => {
        const globalOpts = cmd.optsWithGlobals();
        const spinner = globalOpts.json ? null : ora("Fetching reminders…").start();
        const client = await getClient(globalOpts.country);
        const reminders = await client.getReminders();
        spinner?.succeed("Reminders fetched");
        output(reminders, resolveFormat(globalOpts));
      }),
    );

  program
    .command("support")
    .description("Get customer service contact info")
    .action(
      withErrorHandling(async (_opts: Record<string, unknown>, cmd: Command) => {
        const globalOpts = cmd.optsWithGlobals();
        const spinner = globalOpts.json ? null : ora("Fetching support info…").start();
        const client = await getClient(globalOpts.country);
        const info: CustomerServiceContactInfo = await client.getCustomerServiceContactInfo();
        spinner?.succeed("Support info fetched");
        output(
          info,
          resolveFormat(globalOpts),
          (data: CustomerServiceContactInfo) => {
            const lines: string[] = [];
            lines.push(`Phone:    ${data.contact_details.phone}`);
            lines.push(`Email:    ${data.contact_details.email}`);
            lines.push(`WhatsApp: ${data.contact_details.whatsapp}`);
            lines.push("");
            lines.push("Opening times:");
            for (const [date, times] of Object.entries(data.opening_times)) {
              const start = times.start.join(":");
              const end = times.end.join(":");
              lines.push(`  ${date}: ${start} – ${end}`);
            }
            return lines.join("\n");
          },
        );
      }),
    );

  program
    .command("parcels")
    .description("Get parcels")
    .action(
      withErrorHandling(async (_opts: Record<string, unknown>, cmd: Command) => {
        const globalOpts = cmd.optsWithGlobals();
        const spinner = globalOpts.json ? null : ora("Fetching parcels…").start();
        const client = await getClient(globalOpts.country);
        const parcels = await client.getParcels();
        spinner?.succeed("Parcels fetched");
        output(parcels, resolveFormat(globalOpts));
      }),
    );

  program
    .command("raw <method> <path>")
    .description("Send a raw API request")
    .option("--data <json>", "JSON body")
    .action(
      withErrorHandling(async (method: string, path: string, opts: Record<string, unknown>, cmd: Command) => {
        const globalOpts = cmd.optsWithGlobals();
        let parsedData: unknown = undefined;
        if (opts.data) {
          try {
            parsedData = JSON.parse(opts.data as string);
          } catch {
            throw new CliError("Invalid JSON in --data");
          }
        }
        const spinner = globalOpts.json ? null : ora(`${method} ${path}…`).start();
        const client = await getClient(globalOpts.country);
        const result = await client.sendRequest(method as "GET" | "POST" | "PUT" | "DELETE", path, parsedData);
        spinner?.succeed(`${method} ${path} complete`);
        output(result, "json");
      }),
    );
}
