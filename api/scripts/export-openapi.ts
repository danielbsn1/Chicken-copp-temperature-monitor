import { writeFileSync } from "node:fs";
import { buildApp } from "../src/app.js";

const app = await buildApp();
await app.ready();

writeFileSync("openapi.json", `${JSON.stringify(app.swagger(), null, 2)}\n`);
await app.close();
console.log("openapi.json atualizado");
