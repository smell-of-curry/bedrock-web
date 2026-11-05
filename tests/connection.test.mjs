import test from "node:test";
import assert from "node:assert/strict";
import { connectionURL, initialConnection, readJSON } from "../web/connection.js";

test("Pages defaults and old saved Pages settings open the local client", () => {
  assert.equal(initialConnection("https://smell-of-curry.github.io"), "http://127.0.0.1:8080");
  assert.equal(initialConnection("https://smell-of-curry.github.io", "https://smell-of-curry.github.io"), "http://127.0.0.1:8080");
  assert.equal(initialConnection("https://smell-of-curry.github.io", "https://relay.example/"), "https://relay.example");
  assert.throws(() => connectionURL("https://smell-of-curry.github.io"), /GitHub Pages/);
  assert.throws(() => connectionURL("bad"), /full game service address/);
  assert.throws(() => connectionURL("https://user:secret@example.com"), /without credentials/);
});
test("website error pages produce an actionable error instead of a JSON parser error", async () => {
  await assert.rejects(readJSON(new Response("<html>404</html>", { headers: { "content-type": "text/html" } })), /not the game service/);
  await assert.rejects(readJSON(new Response("broken", { headers: { "content-type": "application/json" } })), /unreadable response/);
  assert.deepEqual(await readJSON(Response.json({ ok: true })), { ok: true });
});
