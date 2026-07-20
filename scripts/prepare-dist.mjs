import { cp, mkdir, rm, stat } from "node:fs/promises";

const source = new URL("../out/", import.meta.url);
const destination = new URL("../dist/", import.meta.url);

await stat(source);
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true });

console.log("Prepared static deployment output in dist/");
