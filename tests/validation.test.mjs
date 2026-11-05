import test from "node:test";
import assert from "node:assert/strict";
import { target, actions } from "../relay/validation.mjs";
test("targets preserve hostname, numeric port and IPv6 boundaries", () => {
  assert.equal(
    target({ host: "play.example.net" }).address,
    "play.example.net:19132",
  );
  assert.equal(target({ host: "::1", port: "19133" }).address, "[::1]:19133");
});
test("rejects malformed targets and injection-shaped inputs", () => {
  for (const host of [
    "https://example.com",
    "localhost/path",
    "--help",
    "host;touch x",
    "",
  ])
    assert.throws(() => target({ host }));
  for (const port of [0, 65536, NaN, 1.5])
    assert.throws(() => target({ host: "localhost", port }));
  assert.throws(() => target({ host: "localhost", name: "../bad" }));
});
test("control API restricts arbitrary upstream instructions", () => {
  assert(actions.has("moveRawInput"));
  assert(!actions.has("command"));
  assert(!actions.has("eval"));
});
