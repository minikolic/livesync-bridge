import type { Config } from "./types.ts";

export async function loadConfig(
  configFile: string,
  configJson?: string,
): Promise<Config> {
  return JSON.parse(configJson ?? await Deno.readTextFile(configFile));
}
