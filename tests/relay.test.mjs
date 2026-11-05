import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
test("relay protects control and rejects cross-origin writes", async () => {
  const port = 18080;
  const child = spawn(process.execPath, ["relay/server.mjs"], {
    env: { ...process.env, PORT: String(port), RELAY_TOKEN: "integration-key" },
  });
  try {
    await Promise.race([
      once(child.stdout, "data"),
      once(child, "exit").then(() => {
        throw Error(
          "Relay exited before listening; check local port permissions",
        );
      }),
    ]);
    const base = `http://127.0.0.1:${port}`;
    assert.equal((await fetch(base + "/api/health")).status, 200);
    assert.equal(
      (await fetch(base + "/api/connect", { method: "POST", body: "{}" }))
        .status,
      401,
    );
    assert.equal(
      (
        await fetch(base + "/api/connect", {
          method: "POST",
          headers: {
            Authorization: "Bearer integration-key",
            Origin: "https://attacker.example",
          },
          body: "{}",
        })
      ).status,
      403,
    );
    assert.equal((await fetch(base + "/stream")).status, 401);
    const invalid = await fetch(base + "/api/connect", {
      method: "POST",
      headers: { Authorization: "Bearer integration-key" },
      body: JSON.stringify({ host: "--bad" }),
    });
    assert.equal(invalid.status, 400);
    assert.match((await invalid.json()).error, /hostname/);
  } finally {
    if (child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  }
});
