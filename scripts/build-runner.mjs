import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
const root = resolve(import.meta.dirname, "..");
const dir = resolve(root, ".build/runner");
await mkdir(dir, { recursive: true });
for (const file of await readdir(resolve(root, "upstream"))) {
  if (
    (file.endsWith(".go") && !file.endsWith("_test.go")) ||
    file === "go.mod" ||
    file === "go.sum"
  )
    await cp(resolve(root, "upstream", file), resolve(dir, file));
}
let main = await readFile(resolve(dir, "main.go"), "utf8");
const anchor =
  "\tif err := applyBotSkin(&dialer.ClientData, config, name); err != nil {";
if (main.split(anchor).length !== 2)
  throw Error(
    "Upstream runner changed: review authentication injection before building.",
  );
main = main.replace(
  anchor,
  "\tif err := configureWebAuthentication(ctx, &dialer, config.Network.ServerAddress); err != nil { return err }\n" +
    anchor,
);
const runAnchor = "\terr := test.RunCtx(ctx)";
if (main.split(runAnchor).length !== 2) throw Error("Upstream session entry changed: review transfer handling.");
main = main.replace(runAnchor, "\terr := runWebSession(ctx, test)");
await writeFile(resolve(dir, "main.go"), main);
await cp(
  resolve(root, "relay/authentication.go.txt"),
  resolve(dir, "web_authentication.go"),
);
await cp(resolve(root, "relay/network_test.go.txt"), resolve(dir, "web_network_test.go"));
await cp(resolve(root, "relay/session.go.txt"), resolve(dir, "web_session.go"));
let mod = await readFile(resolve(dir, "go.mod"), "utf8");
mod = mod.replace(
  "module github.com/smell-of-curry/go-test-bds",
  "module github.com/smell-of-curry/bedrock-web/runner",
);
mod +=
  "\nrequire github.com/smell-of-curry/go-test-bds v0.0.0\nreplace github.com/smell-of-curry/go-test-bds => ../../upstream\n";
await writeFile(resolve(dir, "go.mod"), mod);
execFileSync(
  "go",
  ["build", "-mod=mod", "-o", resolve(root, ".build/gotestbds"), "."],
  { cwd: dir, stdio: "inherit" },
);
if (process.argv.includes("--test")) {
  execFileSync("go", ["test", "-mod=mod", "-timeout=30s", "."], { cwd: dir, stdio: "inherit" });
}
