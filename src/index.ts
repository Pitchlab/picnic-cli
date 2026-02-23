#!/usr/bin/env node
import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerSearchCommands } from "./commands/search.js";
import { registerCartCommands } from "./commands/cart.js";
import { registerSlotCommands } from "./commands/slots.js";
import { registerDeliveryCommands } from "./commands/delivery.js";
import { registerProductCommands } from "./commands/product.js";
import { registerCategoryCommands } from "./commands/categories.js";
import { registerUserCommands } from "./commands/user.js";
import { registerOrderCommands } from "./commands/order.js";
import { registerWalletCommands } from "./commands/wallet.js";
import { registerMiscCommands } from "./commands/misc.js";

const program = new Command()
  .name("picnic")
  .description("CLI for Picnic online supermarket")
  .version("0.1.0")
  .option("-j, --json", "Output raw JSON")
  .option("-t, --table", "Output as table")
  .option("-c, --country <code>", "Country code: NL or DE")
  .option("--no-color", "Disable colors")
  .option("-v, --verbose", "Verbose/debug output");

registerAuthCommands(program);
registerSearchCommands(program);
registerCartCommands(program);
registerSlotCommands(program);
registerDeliveryCommands(program);
registerProductCommands(program);
registerCategoryCommands(program);
registerUserCommands(program);
registerOrderCommands(program);
registerWalletCommands(program);
registerMiscCommands(program);

program.parse();
