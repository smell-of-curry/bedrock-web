import test from "node:test";
import assert from "node:assert/strict";
import { target } from "../relay/validation.mjs";
test("authenticated identity is default and offline is explicit", () => {
  assert.equal(target({ host: "play.pokebedrock.com" }).authentication, "xbox");
  assert.equal(
    target({ host: "127.0.0.1", authentication: "offline" }).authentication,
    "offline",
  );
  assert.throws(() => target({ host: "localhost", authentication: "bypass" }));
});
