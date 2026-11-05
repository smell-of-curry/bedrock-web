import test from "node:test";
import assert from "node:assert/strict";
import { connectionError } from "../relay/errors.mjs";
test("server rejection preserves actionable text but omits login code and transport prefix", () => {
  const log =
    "Authenticate at https://www.microsoft.com/link using the code SECRET.\nAuthentication successful.\nlevel=ERROR error=" +
    JSON.stringify(
      "dial minecraft 1.2.3.4:55: §cVPN/Proxy connections are not allowed.§r<new-line>Link with /link.",
    );
  assert.equal(
    connectionError(log),
    "VPN/Proxy connections are not allowed.\nLink with /link.",
  );
  assert(!connectionError("Authenticate using SECRET").includes("SECRET"));
});
