import { copyFile, mkdir, stat } from "node:fs/promises";

const serverEntry = new URL("../dist/server/index.js", import.meta.url);
const sourceConfig = new URL("../.openai/hosting.json", import.meta.url);
const configDirectory = new URL("../dist/.openai/", import.meta.url);
const destinationConfig = new URL("../dist/.openai/hosting.json", import.meta.url);

await stat(serverEntry);
await stat(sourceConfig);
await mkdir(configDirectory, { recursive: true });
await copyFile(sourceConfig, destinationConfig);

console.log("Prepared vinext deployment bundle in dist/");
