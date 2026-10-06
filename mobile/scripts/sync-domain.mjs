import { readFile, writeFile } from "node:fs/promises";
const source = await readFile(
  new URL("../../src/lib/lunch.ts", new URL(".", import.meta.url)),
  "utf8",
);
await writeFile(
  new URL("../src/lib/domain.ts", import.meta.url),
  "// Synced from ../../../src/lib/lunch.ts by npm run sync:domain.\n" + source,
);
