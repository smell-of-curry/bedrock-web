import { cp, mkdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const run = (cmd, args, cwd = root) =>
  execFileSync(cmd, args, { cwd, stdio: "inherit" });
await rm(resolve(root, "dist"), { recursive: true, force: true });
await mkdir(resolve(root, "dist/renderer"), { recursive: true });
await mkdir(resolve(root, ".build"), { recursive: true });
run("npm", ["ci", "--ignore-scripts"], resolve(root, "upstream/viewer"));
run(
  "npm",
  ["run", "build", "--", "--base=./"],
  resolve(root, "upstream/viewer"),
);
await cp(resolve(root, "web"), resolve(root, "dist"), { recursive: true });
await cp(
  resolve(root, "upstream/viewer/dist"),
  resolve(root, "dist/renderer"),
  { recursive: true },
);
run(
  "go",
  ["build", "-o", resolve(root, ".build/gotestbds"), "."],
  resolve(root, "upstream"),
);
