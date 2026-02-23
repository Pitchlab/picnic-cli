import PicnicClient from "picnic-api";
import type { CountryCode } from "./types.js";
import { getConfig } from "./config.js";
import { CliError } from "./errors.js";

let _client: InstanceType<typeof PicnicClient> | null = null;

/**
 * Get authenticated client. Throws CliError if no authKey.
 */
export function getClient(countryOverride?: string): InstanceType<typeof PicnicClient> {
  if (_client) return _client;
  const cfg = getConfig();
  if (!cfg.authKey) {
    throw new CliError("Not authenticated. Run: picnic login");
  }
  _client = new PicnicClient({
    countryCode: (countryOverride ?? cfg.countryCode) as CountryCode,
    apiVersion: cfg.apiVersion,
    authKey: cfg.authKey,
  });
  return _client;
}

/**
 * Unauthenticated client for login flow only.
 */
export function getAnonClient(countryOverride?: string): InstanceType<typeof PicnicClient> {
  const cfg = getConfig();
  return new PicnicClient({
    countryCode: (countryOverride ?? cfg.countryCode) as CountryCode,
    apiVersion: cfg.apiVersion,
  });
}
