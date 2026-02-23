import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import Table from "cli-table3";
import { promptLogin } from "../utils/interactive.js";
import { getAnonClient, getClient } from "../client.js";
import { setAuthKey, setUsername, clearAuth } from "../config.js";
import { withErrorHandling } from "../errors.js";
import { output, resolveFormat } from "../output.js";

export function registerAuthCommands(program: Command): void {
  program
    .command("login")
    .description("Log in to your Picnic account")
    .option("-u, --username <email>", "Account email")
    .option("-p, --password <password>", "Account password")
    .action(
      withErrorHandling(async (_opts, cmd) => {
        const opts = cmd.optsWithGlobals();
        const localOpts = cmd.opts();

        const credentials =
          localOpts.username && localOpts.password
            ? { username: localOpts.username, password: localOpts.password }
            : await promptLogin(localOpts.username);

        const spinner = opts.json ? null : ora("Logging in…").start();

        const client = getAnonClient(opts.country);
        const result = await client.login(credentials.username, credentials.password);

        setAuthKey(result.authKey);
        setUsername(credentials.username);

        spinner?.stop();

        if (result.second_factor_authentication_required) {
          const msg = "Logged in, but 2FA is required. Run: picnic 2fa generate";
          if (opts.json) {
            output({ success: true, second_factor_required: true, user_id: result.user_id }, resolveFormat(opts));
          } else {
            console.log(chalk.yellow(msg));
          }
          return;
        }

        if (opts.json) {
          output({ success: true, user_id: result.user_id }, resolveFormat(opts));
        } else {
          console.log(chalk.green("Logged in successfully."));
        }
      }),
    );

  program
    .command("logout")
    .description("Clear stored credentials")
    .action(
      withErrorHandling(async (_opts, cmd) => {
        const opts = cmd.optsWithGlobals();
        clearAuth();

        if (opts.json) {
          output({ success: true }, resolveFormat(opts));
        } else {
          console.log(chalk.green("Logged out."));
        }
      }),
    );

  program
    .command("whoami")
    .description("Show current user details")
    .action(
      withErrorHandling(async (_opts, cmd) => {
        const opts = cmd.optsWithGlobals();
        const spinner = opts.json ? null : ora("Fetching user details…").start();

        const client = getClient(opts.country);
        const user = await client.getUserDetails();

        spinner?.stop();

        if (opts.json) {
          output(user, resolveFormat(opts));
          return;
        }

        if (opts.table) {
          const table = new Table();
          table.push(
            { Name: `${user.firstname} ${user.lastname}` },
            { Email: user.contact_email },
            {
              Address: `${user.address.street} ${user.address.house_number}${user.address.house_number_ext ?? ""}, ${user.address.postcode} ${user.address.city}`,
            },
            { Phone: user.phone },
            { "Total deliveries": `${user.total_deliveries}` },
          );
          console.log(table.toString());
        } else {
          console.log(chalk.bold("Name:"), `${user.firstname} ${user.lastname}`);
          console.log(chalk.bold("Email:"), user.contact_email);
          console.log(
            chalk.bold("Address:"),
            `${user.address.street} ${user.address.house_number}${user.address.house_number_ext ?? ""}, ${user.address.postcode} ${user.address.city}`,
          );
          console.log(chalk.bold("Phone:"), user.phone);
          console.log(chalk.bold("Total deliveries:"), user.total_deliveries);
        }
      }),
    );

  const twofa = program
    .command("2fa")
    .description("Two-factor authentication commands");

  twofa
    .command("generate")
    .description("Request a 2FA code via SMS")
    .action(
      withErrorHandling(async (_opts, cmd) => {
        const opts = cmd.optsWithGlobals();
        const spinner = opts.json ? null : ora("Requesting 2FA code…").start();

        const client = getClient(opts.country);
        await client.generate2FACode("SMS");

        spinner?.stop();

        if (opts.json) {
          output({ success: true, method: "SMS" }, resolveFormat(opts));
        } else {
          console.log(chalk.green("2FA code sent via SMS."));
        }
      }),
    );

  twofa
    .command("verify <code>")
    .description("Verify a 2FA code")
    .action(
      withErrorHandling(async (code: string, _opts: any, cmd: any) => {
        const opts = cmd.optsWithGlobals();
        const spinner = opts.json ? null : ora("Verifying 2FA code…").start();

        const client = getClient(opts.country);
        await client.verify2FACode(code);

        spinner?.stop();

        if (opts.json) {
          output({ success: true }, resolveFormat(opts));
        } else {
          console.log(chalk.green("2FA verified successfully."));
        }
      }),
    );
}
