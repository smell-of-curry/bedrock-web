import { connectionError } from "./errors.mjs";
import http from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { tmpdir } from "node:os";
import { target, actions } from "./validation.mjs";
const root = resolve(import.meta.dirname, ".."),
  port = Number(process.env.PORT || 8080),
  host = process.env.HOST || "127.0.0.1";
const token = process.env.RELAY_TOKEN || randomBytes(24).toString("hex");
const viewerPort = Number(process.env.VIEWER_PORT || 8081),
  controlPort = Number(process.env.CONTROL_PORT || 8082);
let cachedAccountToken = null;
let session = null,
  connecting = false;
const cookies = new Set();
const equal = (a, b) =>
  typeof a === "string" &&
  a.length === b.length &&
  timingSafeEqual(Buffer.from(a), Buffer.from(b));
const json = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
};
async function body(req) {
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 16384) throw Error("Request too large");
  }
  return JSON.parse(data || "{}");
}
async function stop() {
  const s = session;
  session = null;
  if (s) {
    s.child.kill("SIGTERM");
    await Promise.race([s.exited, new Promise((r) => setTimeout(r, 3000))]);
    if (s.child.exitCode === null) s.child.kill("SIGKILL");
    await s.exited;
    await rm(s.dir, { recursive: true, force: true });
  }
}
function proxy(req, res, upstream) {
  const p = http.request(
    upstream,
    { method: req.method, headers: { "Content-Type": "application/json" } },
    (r) => {
      res.writeHead(r.statusCode, r.headers);
      r.pipe(res);
    },
  );
  p.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end("Relay process unavailable");
  });
  req.on("aborted", () => p.destroy());
  res.on("close", () => p.destroy());
  req.pipe(p);
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    const auth =
      equal(req.headers.authorization?.replace(/^Bearer /, ""), token) ||
      cookies.has(
        (req.headers.cookie || "")
          .split("; ")
          .find((x) => x.startsWith("bedrock="))
          ?.slice(8),
      );
    if (
      req.method !== "GET" &&
      req.headers.origin &&
      req.headers.origin !==
        `${req.headers["x-forwarded-proto"] === "https" ? "https" : "http"}://${req.headers.host}`
    )
      return json(res, 403, { error: "Cross-origin writes are disabled" });
    if (url.pathname === "/api/health")
      return json(res, 200, { relay: true, connected: !!session });
    if (url.pathname.startsWith("/api/") && !auth)
      return json(res, 401, {
        error: "Enter your relay access key in Settings.",
      });
    if (url.pathname === "/api/status")
      return json(res, 200, {
        connecting,
        connected: !!session && !connecting,
        challenge: session?.challenge || null,
        trace: session?.trace || [],
        signedIn: !!cachedAccountToken,
      });
    if (url.pathname === "/api/signout" && req.method === "POST") {
      await stop();
      cachedAccountToken = null;
      cookies.clear();
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/api/resume" && req.method === "POST") {
      if (!session || connecting)
        return json(res, 409, {
          error: connecting
            ? "Sign-in or connection is still in progress."
            : "No session to resume.",
        });
      const cookie = randomBytes(24).toString("hex");
      cookies.clear();
      cookies.add(cookie);
      res.setHeader(
        "Set-Cookie",
        `bedrock=${cookie}; HttpOnly; SameSite=Strict; Path=/${req.headers["x-forwarded-proto"] === "https" ? "; Secure" : ""}`,
      );
      return json(res, 200, { name: session.name });
    }
    if (url.pathname === "/api/connect" && req.method === "POST") {
      if (connecting || session)
        return json(res, 409, {
          error: "This personal relay already has a session. Disconnect first.",
        });
      const t = target(await body(req));
      connecting = true;
      try {
        const dir = await mkdtemp(resolve(tmpdir(), "bedrock-web-"));
        const args = [
          "--address",
          t.address,
          "--name",
          t.name,
          "--bots",
          "1",
          "--viewer",
          "--viewer-address",
          `127.0.0.1:${viewerPort}`,
          "--control",
          `127.0.0.1:${controlPort}`,
          "--viewer-cache",
          resolve(root, ".cache"),
          "--viewer-artifacts",
          dir,
          "--viewer-packs",
        ];
        const child = spawn(resolve(root, ".build/gotestbds"), args, {
          cwd: dir,
          stdio: ["pipe", "pipe", "pipe", "pipe"],
          env: {
            ...process.env,
            GOTESTBDS_CONTROL_TOKEN: "",
            BEDROCK_WEB_AUTH: t.authentication,
          },
        });
        child.stdin.on("error", () => {});
        child.stdin.end(
          JSON.stringify(
            t.authentication === "xbox" ? cachedAccountToken : null,
          ),
        );
        let tokenBuffer = "";
        child.stdio[3].on("data", (b) => {
          tokenBuffer += b;
          if (tokenBuffer.length > 65536) {
            child.kill("SIGTERM");
            tokenBuffer = "";
            return;
          }
          let newline;
          while ((newline = tokenBuffer.indexOf("\n")) !== -1) {
            const line = tokenBuffer.slice(0, newline);
            tokenBuffer = tokenBuffer.slice(newline + 1);
            try {
              const token = JSON.parse(line);
              if (
                typeof token.access_token === "string" &&
                session?.child === child
              )
                cachedAccountToken = token;
            } catch {
              child.kill("SIGTERM");
            }
          }
        });
        let log = "",
          failure = "";
        for (const s of [child.stdout, child.stderr])
          s.on("data", (b) => {
            log = (log + b).slice(-6000);
            if (session?.child === child)
              session.trace = log
                .split("\n")
                .filter((line) => line.startsWith("[BEDROCK_PACKET]"))
                .slice(-40);
            const match = log.match(
              /Authenticate at (https:\/\/[^\s]+) using the code ([A-Z0-9-]+)\./,
            );
            if (match && session?.child === child) {
              const uri = new URL(match[1]);
              if (
                [
                  "www.microsoft.com",
                  "microsoft.com",
                  "login.live.com",
                  "aka.ms",
                ].includes(uri.hostname)
              )
                session.challenge = { url: uri.href, code: match[2] };
            }
            if (
              log.includes("Authentication successful.") &&
              session?.child === child
            )
              session.challenge = null;
          });
        const exited = new Promise((r) => {
          child.on("exit", r);
          child.on("error", (e) => {
            failure = e.message;
            r();
          });
        });
        session = { child, dir, exited, name: t.name };
        const ownedSession = session;
        exited.then(async () => {
          if (session === ownedSession) {
            session = null;
            cookies.clear();
            await rm(dir, { recursive: true, force: true });
          }
        });
        let ready = false;
        for (let i = 0; i < (t.authentication === "xbox" ? 1200 : 240); i++) {
          if (failure || child.exitCode !== null || session !== ownedSession)
            throw Error(failure || connectionError(log));
          try {
            const data = await (
              await fetch(`http://127.0.0.1:${controlPort}/bots`, {
                signal: AbortSignal.timeout(500),
              })
            ).json();
            const online = data.bots?.find((b) => b.online);
            if (online) {
              session.name = online.name;
              ready = true;
              break;
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 500));
        }
        if (!ready)
          throw Error(
            "Server did not accept the connection before the connection deadline. Check address, protocol version and server authentication.",
          );
        const cookie = randomBytes(24).toString("hex");
        cookies.clear();
        cookies.add(cookie);
        res.setHeader(
          "Set-Cookie",
          `bedrock=${cookie}; HttpOnly; SameSite=Strict; Path=/${req.headers["x-forwarded-proto"] === "https" ? "; Secure" : ""}`,
        );
        return json(res, 200, { name: session.name });
      } catch (e) {
        await stop();
        throw e;
      } finally {
        connecting = false;
      }
    }
    if (url.pathname === "/api/disconnect" && req.method === "POST") {
      await stop();
      cookies.clear();
      return json(res, 200, { ok: true });
    }
    if (url.pathname === "/api/action" && req.method === "POST") {
      if (!session) return json(res, 409, { error: "No active session" });
      const data = await body(req);
      if (!actions.has(data.name))
        return json(res, 400, { error: "Unsupported action" });
      const response = await fetch(
        `http://127.0.0.1:${controlPort}/bots/${encodeURIComponent(session.name)}/instruction`,
        {
          method: "POST",
          body: JSON.stringify({ ...data, timeoutMs: 5000 }),
          signal: AbortSignal.timeout(6000),
        },
      );
      return json(res, response.status, await response.json());
    }
    if (
      /^\/(stream|bots|packs|pack|asset|skin|font|viewer.json|extensions)(\/|$)/.test(
        url.pathname,
      )
    ) {
      if (!auth || !session)
        return json(res, 401, { error: "No authorized session" });
      return proxy(req, res, `http://127.0.0.1:${viewerPort}${req.url}`);
    }
    if (req.method !== "GET") return json(res, 404, { error: "Not found" });
    const path = resolve(
      root,
      "dist",
      "." +
        decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (!path.startsWith(resolve(root, "dist") + "/"))
      return json(res, 403, { error: "Forbidden" });
    const types = {
      ".html": "text/html",
      ".css": "text/css",
      ".js": "text/javascript",
      ".json": "application/json",
      ".png": "image/png",
      ".svg": "image/svg+xml",
    };
    try {
      const data = await readFile(path);
      res.writeHead(200, {
        "Content-Type": types[extname(path)] || "application/octet-stream",
      });
      res.end(data);
    } catch {
      return json(res, 404, {
        error: "File not found. Run npm run build first.",
      });
    }
  } catch (e) {
    json(res, 400, { error: e.message });
  }
});
server.listen(port, host, () => {
  console.log(`Bedrock Web: http://${host}:${port}`);
  if (!process.env.RELAY_TOKEN) console.log(`Temporary relay key: ${token}`);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await stop();
    server.close();
    process.exit();
  });
