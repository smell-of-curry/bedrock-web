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
    for (const headers of [
      {},
      { Origin: "https://attacker.example" },
      { Host: "attacker.example:18080", Origin: "http://attacker.example:18080" },
      { Origin: base, "Sec-Fetch-Site": "cross-site" },
    ]) {
      assert.equal((await fetch(base + "/api/local-session", { method: "POST", headers })).status, 403);
    }
    const paired = await fetch(base + "/api/local-session", {
      method: "POST", headers: { Origin: base, "Sec-Fetch-Site": "same-origin" },
    });
    assert.equal(paired.status, 200);
    const cookie = paired.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly; SameSite=Strict/);
    const headers = { Cookie: cookie.split(";")[0], Origin: base };
    assert.equal((await fetch(base + "/api/status", { method: "POST", headers })).status, 200);
    assert.equal((await fetch(base + "/api/signout", { method: "POST", headers })).status, 200);
    assert.equal((await fetch(base + "/api/status", { method: "POST", headers })).status, 401);
  } finally {
    if (child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  }
});
