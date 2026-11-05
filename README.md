# Bedrock Web

An experimental open-source browser client built on [go-test-bds](https://github.com/smell-of-curry/go-test-bds). A server-first launcher, a real Three.js Bedrock renderer, and a personal relay that translates browser actions into Bedrock client actions.

**Status: early playable-client integration, not a complete Minecraft replacement.** The shell and relay have automated checks; gameplay has not yet been verified against a live Bedrock server. Featured-server authentication is not implemented. Directory entries are explicitly disabled rather than pretending to connect.

## Run locally

Requires Node.js 22+, Go 1.26+, Git, and a WebGL-capable desktop browser.

```sh
git clone --recurse-submodules https://github.com/smell-of-curry/bedrock-web.git
cd bedrock-web
npm run build
npm start
```

Open `http://127.0.0.1:8080`. Copy the temporary relay key printed in the terminal into **Settings**, set your player name, then **Play → Add server**. Use a dedicated test BDS with `online-mode=false` and a protocol version compatible with the pinned upstream client. Do not disable authentication on a production server to use this preview.

The first connection downloads the upstream vanilla resource baseline into `.cache/`; packs supplied by the server are accepted. This can take time. No proprietary game assets are committed to this repository.

## What is implemented

- Original voxel landscape, main menu and server-only Play screen.
- Add/remove custom servers, persisted locally; player and relay settings.
- A sample public-server directory, with honest Xbox-authentication gating.
- Pinned upstream renderer: live chunks, entities, textures, HUD and resource packs.
- Personal relay: real Go client startup, readiness polling, disconnect and process cleanup.
- Keyboard/mouse controls routed through the upstream instruction API: WASD, mouse look, Space jump, Shift sneak, 1–9 hotbar, T chat, left click break and right click use/place.
- Access-key authentication, same-origin write checks, bounded request bodies and restricted instruction names.
- GitHub Pages deployment workflow; Node tests and a reproducible build.

## Architecture and hosting

The browser cannot speak Bedrock's UDP/RakNet protocol. GitHub Pages serves static files and cannot run the Go process. The Pages site is the launcher; joining opens the configured relay as a top-level page, avoiding mixed-origin asset requests and third-party session cookies. The relay serves the same UI, starts one isolated go-test-bds process, proxies its SSE world stream and asset routes, and forwards control requests. Renderer output is actual server state, not a generated demo world.

One relay supports **one player/session at a time**. It is a personal service, not a public multi-user gateway. It binds to loopback by default. For remote use, deploy on a machine that can reach the target Bedrock server over UDP, terminate HTTPS with a reverse proxy, set a strong `RELAY_TOKEN`, and pass the original Host and `X-Forwarded-Proto: https`. Only trusted users should possess that key: it authorizes connecting to addresses reachable from the relay. Do not expose an anonymous relay or the upstream viewer/control ports.

Configuration: `HOST` (default `127.0.0.1`), `PORT` (8080), `VIEWER_PORT` (8081), `CONTROL_PORT` (8082), `RELAY_TOKEN` (random on each launch when omitted). The last two ports remain bound to loopback. The key is kept in browser session storage; the relay sets an HttpOnly session cookie for world assets. Transfer from the Pages launcher uses a URL fragment that the destination clears immediately.

GitHub Pages deployment uses `.github/workflows/pages.yml`. Select **GitHub Actions** as the Pages build source. Pages hosts only the frontend; run the relay separately using the instructions above.

## Controls and current limitations

Click inside the world to lock the pointer. Escape releases it. Disconnect ends the Go process. The relay stays connected if you close the tab; reopen it with your access key to disconnect, or restart the relay.

This is not feature parity with Bedrock. Remaining work includes:

- Xbox/Microsoft device sign-in, per-user token lifecycle, and real featured-server compatibility tests.
- Full survival/creative inventory interaction, crafting, combat, container screens and interactive server forms.
- Touch/gamepad input, sound, accessibility and rendering/performance parity.
- Continuous input delivery tied to server ticks rather than request latency, pitch limits, and latency prediction/reconciliation.
- Live integration tests covering joining, chunk streaming, movement, block break/place, inventory, death, respawn and server transfer.
- Multi-user isolation, quotas, disconnect expiry and target/network policy before offering a shared public relay.
- A maintained and verified featured-server catalog. The sample directory is not the full current Bedrock featured list.

The underlying renderer also has its own limitations; consult `upstream/viewer/PLAN.md`. This repository does not claim that every upstream rendering feature is complete or that every server is compatible.

## Development

```sh
npm test
npm run build
npm start
```

`upstream/` is a Git submodule pinned to `2484855c74e36076317beaf511982a922162ae1b`. Local uncommitted changes in another checkout are not included. Update the pin deliberately, then rebuild and retest the protocol, renderer and control API together. Build outputs, cache, logs and credentials are ignored.

## License and attribution

Original code is MIT licensed; upstream remains governed by its own licensing metadata (its npm package declares ISC). Dependencies and downloaded resources retain their own terms. Review upstream licensing coverage before redistributing modified upstream source or binaries. Minecraft, Bedrock and server names belong to their respective owners. This independent project is not affiliated with Mojang or Microsoft and does not distribute Minecraft artwork or the game itself.
