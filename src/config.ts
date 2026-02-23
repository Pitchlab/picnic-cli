import Conf from "conf";
import type { IPicnicCliConfig } from "./types.js";

const config = new Conf<IPicnicCliConfig>({
  projectName: "picnic-cli",
  defaults: {
    countryCode: "NL",
    apiVersion: "15",
    authKey: null,
    username: null,
    defaultOutput: "pretty",
  },
});

export function getConfig(): IPicnicCliConfig {
  return {
    countryCode: config.get("countryCode"),
    apiVersion: config.get("apiVersion"),
    authKey: config.get("authKey"),
    username: config.get("username"),
    defaultOutput: config.get("defaultOutput"),
  };
}

export function setAuthKey(authKey: string): void {
  config.set("authKey", authKey);
}

export function setUsername(username: string): void {
  config.set("username", username);
}

export function clearAuth(): void {
  config.set("authKey", null);
}

export { config };
