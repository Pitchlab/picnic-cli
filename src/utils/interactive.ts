import { select, input, password } from "@inquirer/prompts";
import type { DeliverySlot } from "../types.js";
import { formatWindow, formatPrice } from "./format.js";
import { CliError } from "../errors.js";

export async function promptLogin(prefillEmail?: string): Promise<{ username: string; password: string }> {
  const username = prefillEmail ?? await input({ message: "Email:" });
  const pass = await password({ message: "Password:" });
  return { username, password: pass };
}

export async function pickSlot(slots: DeliverySlot[]): Promise<string> {
  const available = slots.filter((s) => s.is_available);
  if (!available.length) throw new CliError("No delivery slots available");

  return select({
    message: "Pick a delivery slot:",
    choices: available.map((s) => ({
      name: `${formatWindow(s.window_start, s.window_end)}${s.minimum_order_value != null ? `  (min ${formatPrice(s.minimum_order_value)})` : ""}`,
      value: s.slot_id,
      description: s.selected ? "currently selected" : undefined,
    })),
  });
}
