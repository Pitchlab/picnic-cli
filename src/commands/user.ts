import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { getClient } from "../client.js";
import { resolveFormat, output } from "../output.js";
import { withErrorHandling } from "../errors.js";
import { formatPrice } from "../utils/format.js";

export function registerUserCommands(program: Command): void {
  const user = program
    .command("user")
    .description("User account commands");

  user
    .command("show", { isDefault: true })
    .description("Show user details")
    .action(
      withErrorHandling(async (_opts, cmd) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching user details…").start();

        const client = getClient(opts.country);
        const userData = await client.getUserDetails();

        spinner?.stop();

        output(userData, format, (data) => {
          const addr = data.address;
          const addressLine = `${addr.street} ${addr.house_number}${addr.house_number_ext ? ` ${addr.house_number_ext}` : ""}, ${addr.postcode} ${addr.city}`;

          return [
            chalk.bold(`${data.firstname} ${data.lastname}`),
            `  Address:       ${addressLine}`,
            `  Phone:         ${data.phone}`,
            `  Email:         ${data.contact_email}`,
            `  Deliveries:    ${data.completed_deliveries} completed / ${data.total_deliveries} total`,
          ].join("\n");
        }, (data) => {
          const addr = data.address;
          const addressLine = `${addr.street} ${addr.house_number}${addr.house_number_ext ? ` ${addr.house_number_ext}` : ""}, ${addr.postcode} ${addr.city}`;
          const table = new Table();
          table.push(
            { Name: `${data.firstname} ${data.lastname}` },
            { Address: addressLine },
            { Phone: data.phone },
            { Email: data.contact_email },
            { "Total Deliveries": `${data.total_deliveries}` },
            { "Completed Deliveries": `${data.completed_deliveries}` },
          );
          return table.toString();
        });
      }),
    );

  user
    .command("info")
    .description("Show user info (ID, feature toggles)")
    .action(
      withErrorHandling(async (_opts, cmd) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching user info…").start();

        const client = getClient(opts.country);
        const info = await client.getUserInfo();

        spinner?.stop();

        output(info, format, (data) => {
          const lines: string[] = [
            chalk.bold("User Info"),
            `  User ID:       ${data.user_id}`,
            `  Phone:         ${data.redacted_phone_number}`,
          ];

          if (data.feature_toggles?.length) {
            lines.push("", chalk.bold("  Feature Toggles:"));
            for (const toggle of data.feature_toggles) {
              lines.push(`    - ${toggle.name}`);
            }
          }

          return lines.join("\n");
        }, (data) => {
          const info = new Table();
          info.push(
            { "User ID": data.user_id },
            { Phone: data.redacted_phone_number },
          );

          const parts = [info.toString()];

          if (data.feature_toggles?.length) {
            const toggleTable = new Table({ head: ["Feature Toggle"] });
            for (const toggle of data.feature_toggles) {
              toggleTable.push([toggle.name]);
            }
            parts.push(toggleTable.toString());
          }

          return parts.join("\n");
        });
      }),
    );

  user
    .command("profile")
    .description("Show profile menu")
    .action(
      withErrorHandling(async (_opts, cmd) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching profile…").start();

        const client = getClient(opts.country);
        const profile = await client.getProfileMenu();

        spinner?.stop();

        output(profile, format);
      }),
    );

  user
    .command("mgm")
    .description("Show referral (MGM) details")
    .action(
      withErrorHandling(async (_opts, cmd) => {
        const opts = cmd.optsWithGlobals();
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching referral details…").start();

        const client = getClient(opts.country);
        const mgm = await client.getMgmDetails();

        spinner?.stop();

        output(mgm, format, (data) => {
          return [
            chalk.bold("Referral (MGM) Details"),
            `  Code:          ${chalk.cyan(data.mgm_code)}`,
            `  Share URL:     ${data.share_url}`,
            `  Earned:        ${formatPrice(data.amount_earned)}`,
            `  Invitee value: ${formatPrice(data.invitee_value)}`,
            `  Inviter value: ${formatPrice(data.inviter_value)}`,
          ].join("\n");
        }, (data) => {
          const table = new Table();
          table.push(
            { "Referral Code": data.mgm_code },
            { "Share URL": data.share_url },
            { "Amount Earned": formatPrice(data.amount_earned) },
            { "Invitee Value": formatPrice(data.invitee_value) },
            { "Inviter Value": formatPrice(data.inviter_value) },
          );
          return table.toString();
        });
      }),
    );

  user
    .command("consent")
    .description("Show consent settings")
    .option("--general", "Show general consent settings")
    .action(
      withErrorHandling(async (_opts, cmd) => {
        const opts = cmd.optsWithGlobals();
        const localOpts = cmd.opts();
        const general = localOpts.general ?? false;
        const format = resolveFormat(opts);
        const spinner = opts.json ? null : ora("Fetching consent settings…").start();

        const client = getClient(opts.country);
        const settings = await client.getConsentSettings(general);

        spinner?.stop();

        output(settings, format, (data) => {
          if (!data.length) return chalk.dim("No consent settings found.");

          return data
            .map(
              (s: { id: string; text: { title: string; text: string }; established_decision: boolean }) =>
                `  ${s.established_decision ? chalk.green("✓") : chalk.red("✗")}  ${chalk.bold(s.text.title)}\n     ${chalk.dim(s.text.text)}`,
            )
            .join("\n\n");
        }, (data) => {
          if (!data.length) return "No consent settings found.";
          const table = new Table({ head: ["ID", "Title", "Description", "Decision"] });
          for (const s of data) {
            table.push([s.id, s.text.title, s.text.text, s.established_decision ? "Yes" : "No"]);
          }
          return table.toString();
        });
      }),
    );
}
