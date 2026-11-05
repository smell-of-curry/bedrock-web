import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("sign-in stays private, survives disconnect, and clears on sign out", async () => {
  const dir = await mkdtemp(join(tmpdir(), "bedrock-session-test-"));
  const runner = join(dir, "runner.mjs");
  await writeFile(
    runner,
    `#!/usr/bin/env node
import http from 'node:http';import fs from 'node:fs';
let input='';for await(const b of process.stdin)input+=b;
const token=JSON.parse(input);
fs.writeSync(3,JSON.stringify({access_token:'TEST-ONLY-SECRET',refresh_token:'TEST-ONLY-REFRESH'})+'\\n');
console.log('[BEDROCK_PACKET] id='+ (token?2:1));
const port=Number(process.argv[process.argv.indexOf('--control')+1].split(':').pop());
http.createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');
if(req.method==='POST'){let body='';for await(const part of req)body+=part;res.end(JSON.stringify({status:'success',data:{action:JSON.parse(body).name,path:req.url}}));return;}
res.end(JSON.stringify({bots:[{name:'FixtureGamertag',online:true}]}));}).listen(port,'127.0.0.1');
`,
    { mode: 0o700 },
  );
  const child = spawn(process.execPath, ["relay/server.mjs"], {
    env: {
      ...process.env,
      PORT: "18090",
      CONTROL_PORT: "18092",
      VIEWER_PORT: "18091",
      BEDROCK_RUNNER: runner,
      RELAY_TOKEN: "fixture-key",
    },
  });
  const api = async (path, data = {}) => {
    const r = await fetch("http://127.0.0.1:18090/api/" + path, {
      method: "POST",
      headers: {
        Authorization: "Bearer fixture-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    const result = await r.json();
    assert.equal(r.status, 200, JSON.stringify(result));
    return result;
  };
  try {
    await Promise.race([
      once(child.stdout, "data"),
      once(child, "exit").then(() => {
        throw Error("Relay failed to start");
      }),
    ]);
    assert.equal(
      (await api("connect", { host: "localhost" })).name,
      "FixtureGamertag",
    );
    const status = await api("status");
    assert.equal(status.signedIn, true);
    assert(!JSON.stringify(status).includes("TEST-ONLY"));
    assert(status.trace.some((t) => t.includes("id=1")));
    assert.deepEqual((await api("action", { name: "interact" })).data, {
      action: "interact",
      path: "/bots/FixtureGamertag/instruction",
    });
    for (const name of ["attackEntity", "interactWithEntity"]) {
      assert.deepEqual((await api("action", { name, entityRuntimeID: 20 })).data, {
        action: name, path: "/bots/FixtureGamertag/instruction",
      });
    }
    await api("disconnect");
    assert.equal((await api("status")).signedIn, true);
    await api("connect", { host: "localhost" });
    assert((await api("status")).trace.some((t) => t.includes("id=2")));
    await api("signout");
    assert.equal((await api("status")).signedIn, false);
  } finally {
    if (child.exitCode === null) {
      const ended = once(child, "exit");
      child.kill();
      await ended;
    }
    await rm(dir, { recursive: true, force: true });
  }
});
