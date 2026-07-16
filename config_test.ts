import { loadConfig } from "./config.ts";

Deno.test("loadConfig prefers inline JSON over the config file", async () => {
  const config = await loadConfig(
    "/missing/config.json",
    '{"peers":[{"type":"storage","name":"inline","baseDir":"./data"}]}',
  );

  if (config.peers[0]?.name !== "inline") {
    throw new Error("Expected inline configuration");
  }
});

Deno.test("loadConfig reads the config file without inline JSON", async () => {
  const configFile = await Deno.makeTempFile();
  try {
    await Deno.writeTextFile(
      configFile,
      '{"peers":[{"type":"storage","name":"file","baseDir":"./data"}]}',
    );

    const config = await loadConfig(configFile);
    if (config.peers[0]?.name !== "file") {
      throw new Error("Expected file configuration");
    }
  } finally {
    await Deno.remove(configFile);
  }
});
