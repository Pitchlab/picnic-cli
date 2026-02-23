import chalk from "chalk";

export class CliError extends Error {
  constructor(message: string, public exitCode: number = 1) {
    super(message);
    this.name = "CliError";
  }
}

/**
 * HOF that wraps every command action for uniform error handling.
 */
export function withErrorHandling(
  fn: (...args: any[]) => Promise<void>,
): (...args: any[]) => Promise<void> {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err: unknown) {
      if (err instanceof CliError) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(err.exitCode);
      }
      if (err && typeof err === "object" && "code" in err && "message" in err) {
        const apiErr = err as { code: string; message: string };
        console.error(chalk.red(`API Error [${apiErr.code}]: ${apiErr.message}`));
        process.exit(1);
      }
      if (err instanceof Error) {
        console.error(chalk.red(`Error: ${err.message}`));
        process.exit(1);
      }
      throw err;
    }
  };
}
