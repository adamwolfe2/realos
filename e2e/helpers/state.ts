import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { GlobalTestState } from "./global-setup";

const CACHE_PATH = resolve(__dirname, "../.cache/test-state.json");

let cached: GlobalTestState | null = null;

export function readTestState(): GlobalTestState {
  if (cached) return cached;
  try {
    const raw = readFileSync(CACHE_PATH, "utf8");
    cached = JSON.parse(raw) as GlobalTestState;
    return cached;
  } catch (err) {
    throw new Error(
      `Could not read e2e test state at ${CACHE_PATH}. ` +
        `Did global-setup run? Original error: ${(err as Error).message}`
    );
  }
}
