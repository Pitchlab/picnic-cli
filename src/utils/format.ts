import chalk from "chalk";

/** Picnic API prices are in cents */
export function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

/** Format delivery window: "ma 24 feb 14:00–15:00" */
export function formatWindow(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const dateStr = s.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const startTime = s.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  const endTime = e.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  return `${dateStr} ${startTime}–${endTime}`;
}

/** Colorize delivery status */
export function formatStatus(status: string): string {
  switch (status) {
    case "CURRENT": return chalk.blue(status);
    case "COMPLETED": return chalk.green(status);
    case "CANCELLED": return chalk.red(status);
    default: return chalk.gray(status);
  }
}

/** Unix timestamp to readable date */
export function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleDateString("nl-NL", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
