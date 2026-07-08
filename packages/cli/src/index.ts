#!/usr/bin/env bun
import { editProject } from "./edit";
import { initProject } from "./init";

const USAGE = `engine — game editor CLI

Usage:
  engine edit <dir>   Open <dir> as a project in the editor
  engine init <dir>   Scaffold a new project folder at <dir>
`;

async function main(argv: string[]) {
  const [command, dir] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(USAGE);
    return;
  }

  if (command === "edit") {
    if (!dir) throw new Error("usage: engine edit <dir>");
    await editProject(dir);
    return;
  }

  if (command === "init") {
    if (!dir) throw new Error("usage: engine init <dir>");
    const root = await initProject(dir);
    console.log(`engine: created project at ${root}`);
    console.log(`  next: engine edit ${dir}`);
    return;
  }

  throw new Error(`unknown command "${command}"\n\n${USAGE}`);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`engine: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
