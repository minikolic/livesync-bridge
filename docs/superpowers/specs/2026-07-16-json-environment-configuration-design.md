# JSON Environment Configuration Design

## Goal

Allow LiveSync Bridge to receive its complete `Config` object as JSON in an
environment variable, so deployments do not need to mount a configuration
file.

## Interface and precedence

- `LSB_CONFIG_JSON` contains the same JSON object accepted by
  `dat/config.json`.
- When `LSB_CONFIG_JSON` is defined, it is parsed without reading a
  configuration file.
- When it is undefined, startup keeps using the path from `LSB_CONFIG`, or
  `./dat/config.json` when that variable is also undefined.
- An empty or malformed `LSB_CONFIG_JSON` follows the existing configuration
  parse-error path; it does not silently fall back to a file.

## Implementation

Extract the existing read-and-parse operation into one small configuration
loader. The loader accepts the file path and optional JSON string, selects the
JSON string with nullish precedence, and returns the parsed `Config`. `main.ts`
will pass `Deno.env.get("LSB_CONFIG_JSON")` to it.

No field-level environment variables, Base64 encoding, schema library, or
configuration merge will be added.

## Verification

A native Deno test will prove both supported paths:

1. Inline JSON wins and succeeds even when the supplied file path is missing.
2. With no inline JSON, the loader reads and parses the supplied file.

The existing Deno checks will also be run after the focused test.

## Documentation

`readme.md` will document `LSB_CONFIG_JSON`, its precedence over `LSB_CONFIG`,
and examples for direct execution and Docker Compose.
