# JSON Environment Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Load the complete LiveSync Bridge configuration from `LSB_CONFIG_JSON` while preserving the existing file-based fallback and documenting both deployment forms.

**Architecture:** A single `loadConfig` function owns selection and parsing: an explicitly supplied JSON string wins via nullish precedence, otherwise it reads the configured file. `main.ts` supplies `Deno.env.get("LSB_CONFIG_JSON")`; no peer-field mapping or merge layer is introduced.

**Tech Stack:** Deno 2.6.9, TypeScript, native `Deno.test`, Docker for local verification because Deno is not installed on the host.

## Global Constraints

- The variable name is exactly `LSB_CONFIG_JSON`.
- A defined value, including an empty or malformed value, wins over the file and follows the existing parse-error path.
- When `LSB_CONFIG_JSON` is undefined, `LSB_CONFIG` remains the configuration file path and defaults to `./dat/config.json`.
- Add no dependency, field-level variables, Base64 encoding, schema validation, or configuration merging.
- Document direct Deno and Docker Compose usage in `readme.md`.
- Use focused runtime tests and the repository Docker build as verification;
  full `deno check main.ts` has pre-existing errors in the pinned
  `livesync-commonlib` submodule.
- Run focused tests with `--no-lock`; the upstream lockfile is already missing
  its declared `trystero` workspace entry and must not be repaired by this
  feature.

---

### Task 1: Load configuration JSON from the environment

**Files:**
- Create: `config.ts`
- Create: `config_test.ts`
- Modify: `main.ts:1-40`

**Interfaces:**
- Consumes: `Config` from `types.ts`, `Deno.readTextFile`, and the optional value returned by `Deno.env.get("LSB_CONFIG_JSON")`.
- Produces: `loadConfig(configFile: string, configJson?: string): Promise<Config>`.

- [x] **Step 1: Write the failing loader tests**

```ts
import { loadConfig } from "./config.ts";

Deno.test("loadConfig prefers inline JSON over the config file", async () => {
    const config = await loadConfig(
        "/missing/config.json",
        '{"peers":[{"type":"storage","name":"inline","baseDir":"./data"}]}',
    );

    if (config.peers[0]?.name !== "inline") throw new Error("Expected inline configuration");
});

Deno.test("loadConfig reads the config file without inline JSON", async () => {
    const configFile = await Deno.makeTempFile();
    try {
        await Deno.writeTextFile(
            configFile,
            '{"peers":[{"type":"storage","name":"file","baseDir":"./data"}]}',
        );

        const config = await loadConfig(configFile);
        if (config.peers[0]?.name !== "file") throw new Error("Expected file configuration");
    } finally {
        await Deno.remove(configFile);
    }
});
```

- [x] **Step 2: Run the focused test and verify the red state**

Run:

```bash
docker run --rm --mount type=bind,src=.,dst=/app -w /app denoland/deno:2.6.9 deno test --no-lock --no-check -A config_test.ts
```

Expected: FAIL because `./config.ts` does not exist.

- [x] **Step 3: Add the minimal loader**

Create `config.ts`:

```ts
import type { Config } from "./types.ts";

export async function loadConfig(configFile: string, configJson?: string): Promise<Config> {
    return JSON.parse(configJson ?? await Deno.readTextFile(configFile));
}
```

- [x] **Step 4: Run the focused test and verify the green state**

Run:

```bash
docker run --rm --mount type=bind,src=.,dst=/app -w /app denoland/deno:2.6.9 deno test --no-lock --no-check -A config_test.ts
```

Expected: PASS, 2 tests and 0 failures.

- [x] **Step 5: Wire the loader into startup**

Add the import in `main.ts`:

```ts
import { loadConfig } from "./config.ts";
```

Replace the existing read-and-parse statements inside the `try` block with:

```ts
    config = await loadConfig(configFile, Deno.env.get(`${KEY}CONFIG_JSON`));
```

Keep the existing `catch` block unchanged so malformed inline JSON has the same behavior as malformed file JSON.

- [x] **Step 6: Build the production image and rerun tests**

Run:

```bash
docker run --rm --mount type=bind,src=.,dst=/app -w /app denoland/deno:2.6.9 deno test --no-lock --no-check -A config_test.ts
docker build -t livesync-bridge:env-config .
```

Expected: both commands exit 0; the test reports 2 passed and 0 failed, and
the production image builds successfully.

- [x] **Step 7: Commit the behavior change**

```bash
git add config.ts config_test.ts main.ts
git commit -m "feat: load configuration from JSON environment variable"
```

### Task 2: Document environment configuration

**Files:**
- Modify: `readme.md:58`

**Interfaces:**
- Consumes: the `LSB_CONFIG_JSON` and `LSB_CONFIG` precedence implemented in Task 1.
- Produces: copyable direct Deno and Docker Compose examples.

- [x] **Step 1: Add the configuration-source documentation**

Insert immediately below the `# Configuration` heading in `readme.md`:

````markdown
By default, LiveSync Bridge reads `./dat/config.json`. Set `LSB_CONFIG` to use
a different configuration file path.

The complete configuration can instead be supplied as JSON through
`LSB_CONFIG_JSON`:

```bash
LSB_CONFIG_JSON='{"peers":[{"type":"storage","name":"storage","baseDir":"./data"}]}' deno task run
```

When `LSB_CONFIG_JSON` is set, it takes precedence over `LSB_CONFIG` and no
configuration file is read. The same variable can be used with Docker Compose:

```yaml
services:
  bridge:
    environment:
      LSB_CONFIG_JSON: '{"peers":[{"type":"storage","name":"storage","baseDir":"./data"}]}'
```
````

- [x] **Step 2: Verify documentation and repository formatting**

Run:

```bash
rg -n "LSB_CONFIG_JSON|LSB_CONFIG" readme.md
git diff --check
```

Expected: README matches show both variables and `git diff --check` exits 0.

- [x] **Step 3: Run full project verification**

Run:

```bash
docker run --rm --mount type=bind,src=.,dst=/app -w /app denoland/deno:2.6.9 deno fmt --check config.ts config_test.ts
docker run --rm --mount type=bind,src=.,dst=/app -w /app denoland/deno:2.6.9 deno lint config.ts config_test.ts
docker run --rm --mount type=bind,src=.,dst=/app -w /app denoland/deno:2.6.9 deno test --no-lock --no-check -A config_test.ts
docker build -t livesync-bridge:env-config .
```

Expected: every command exits 0, the focused tests report 2 passed and 0 failed, and the image builds successfully.

- [x] **Step 4: Commit the documentation**

```bash
git add readme.md docs/superpowers/plans/2026-07-16-json-environment-configuration.md
git commit -m "docs: explain JSON environment configuration"
```
