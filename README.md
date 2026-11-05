# Bedrock Web

An experimental open-source browser client built on [go-test-bds](https://github.com/smell-of-curry/go-test-bds). A server-first launcher, a real Three.js Bedrock renderer, and a personal relay that translates browser actions into Bedrock client actions.

**Status: live public-server connection and transfer verified; still an experimental client, not a complete Minecraft replacement.** On 2026-11-05 the client signed in through Microsoft, joined `play.pokebedrock.com:19132`, downloaded its resources, and rendered the hub, players, terrain and HUD. Browser keyboard movement and looking changed the live player's position and rotation; releasing controls stopped movement. Hotbar icons and custom NPC models now render, camera pitch follows Bedrock aim, and both browser mouse buttons opened Black's NPC join confirmation. The Server Navigator and its confirmation worked; selecting Black (US) transferred the same authenticated session, downloaded the destination packs, and reached its welcome/tutorial menu. The target reported protocol 2225 / Bedrock 1.26.60, matching the client. The tutorial was not started. Survival gameplay remains unverified, and large destination scenes can render slowly or incompletely.

The server initially rejected this test network under its VPN/proxy policy; the account owner used the server's supported Discord-linking flow. A subsequent resource-pack stall was fixed by capping the client's RakNet MTU at 1200 (the test route's MTU was 1300). No server authentication or network protections were changed. A real transport regression test now verifies a 64 KiB payload across a simulated 1300-byte tunnel.

The upstream client sends each item interaction once. The relay selects the upstream inventory-transaction transport for the verified Dragonfly hub and auth-input transport for other destinations, including BDS. Server-issued transfers reuse the authenticated client, reject private-network destinations, pin checked IP addresses, and stop after eight redirects.

`play.pokebedrock.com:19132` is the primary compatibility target. Public-server entries are experimental. The GitHub repository builds successfully and the launcher is live at https://smell-of-curry.github.io/bedrock-web/. The separate personal relay is still required to play.

## Run locally

Requires Node.js 22+, Go 1.26+, Git, and a WebGL-capable desktop browser.

```sh
git clone --recurse-submodules https://github.com/smell-of-curry/bedrock-web.git
cd bedrock-web
npm run build
npm start
```

Open `http://127.0.0.1:8080`. The local client connects automatically; no access key is needed on this computer. Choose **Play → PokéBedrock → Sign in & join**, or **Add server** for another address. The GitHub Pages launcher also opens this local client when you choose a server; GitHub Pages itself cannot run the game service. Microsoft/Xbox sign-in is the default. Choose PokéBedrock or add a public server, press **Sign in & join**, then complete the displayed device-code flow on Microsoft’s website with your Minecraft account. The game uses your authenticated Xbox gamertag; the player-name setting is used only for offline test identities. For private tests only, select **Offline** in Settings and use a compatible BDS that already accepts unauthenticated clients. Do not disable production authentication.

Sign-in access/refresh tokens travel over private child-process pipes and remain only in the personal relay’s memory. They are never persisted or returned to the browser. Reconnecting within the same relay session reuses sign-in; **Sign out** or restarting the relay clears it. The home screen shows sign-in status; Sign out appears only while an account is signed in. Remote services require an access key. Local automatic pairing requires a same-origin request to a loopback-bound service, with an exact loopback Host check.

The first connection downloads the upstream vanilla resource baseline into `.cache/`; packs supplied by the server are accepted. This can take time. No proprietary game assets are committed to this repository.

## What is implemented

- Original voxel landscape, main menu and server-only Play screen.
- Add/remove custom servers, persisted locally; player and relay settings.
- A sample public-server directory led by PokéBedrock, with Microsoft device-code authentication.
- Pinned upstream renderer: live chunks, entities, textures, HUD and resource packs. Hotbar icons resolve through the pack item atlas; NPC skins survive removal from the player list until despawn. Server boss-bar state is retained and displayed when sent.
- Personal relay: real Go client startup, readiness polling, disconnect and process cleanup.
- Interactive server menus, yes/no dialogs, and custom forms (text, toggle, slider, dropdown and step-slider fields), with resource-pack language support for RawText labels and descriptions.
- Keyboard/mouse controls routed through the upstream instruction API: WASD, mouse look (arrow-key fallback), Space jump, Shift sneak, 1–9 hotbar, F use held item, T chat, left click attack/break and right click interact/use/place.
- Authenticated server transfers and browser scene reload when the new world becomes ready.
- Automatic same-origin loopback pairing, access-key authentication for remote services, same-origin write checks, bounded request bodies and restricted instruction names.
- GitHub Pages deployment workflow; Node tests and a reproducible build.

## Architecture and hosting

The browser cannot speak Bedrock's UDP/RakNet protocol. GitHub Pages serves static files and cannot run the Go process. The Pages site is the launcher; joining opens the configured relay as a top-level page, avoiding mixed-origin asset requests and third-party session cookies. The relay serves the same UI, starts one isolated go-test-bds process, proxies its SSE world stream and asset routes, and forwards control requests. Renderer output is actual server state, not a generated demo world.

One relay supports **one player/session at a time**. It is a personal service, not a public multi-user gateway. It binds to loopback by default. For remote use, deploy on a machine that can reach the target Bedrock server over UDP, terminate HTTPS with a reverse proxy, set a strong `RELAY_TOKEN`, and pass the original Host and `X-Forwarded-Proto: https`. Only trusted users should possess that key: it authorizes connecting to addresses reachable from the relay. Do not expose an anonymous relay or the upstream viewer/control ports.

Configuration: `HOST` (default `127.0.0.1`), `PORT` (8080), `VIEWER_PORT` (8081), `CONTROL_PORT` (8082), `RELAY_TOKEN` (random on each launch when omitted). The last two ports remain bound to loopback. The key is kept in browser session storage; the relay sets an HttpOnly session cookie for world assets. Transfer from the Pages launcher uses a URL fragment that the destination clears immediately.

GitHub Pages deployment uses `.github/workflows/pages.yml`. Select **GitHub Actions** as the Pages build source. Pages hosts only the frontend; run the relay separately using the instructions above.

The game header reports loaded server-resource file counts. The hub pack contains NPC models and menu artwork, not a custom HUD layout; its queue bar is sent only while queued. Boss-bar packet handling is regression-tested; the live test did not enter a queue.

## Controls and current limitations

Click inside the world to lock the pointer. Escape releases it. If the browser refuses pointer lock, keyboard mode enables WASD movement and arrow-key looking; Escape pauses it. Disconnect ends the Go process. The relay stays connected if you close the tab; use **Resume connection** on the home screen to return, or restart the relay to clear an abandoned session. Disconnect also cancels pending sign-in.

This is not feature parity with Bedrock. Remaining work includes:

- Broader public-server compatibility tests beyond the verified PokéBedrock hub; optional secure remembered sign-in across relay restarts.
- Full survival/creative inventory interaction, crafting, combat and container screens.
- Pixel-faithful native form hit-testing. Menu, modal and custom forms currently use a separate accessible interaction panel over the upstream renderer.
- Touch/gamepad input, sound, accessibility and rendering/performance parity.
- Continuous input delivery tied to server ticks rather than request latency, latency prediction/reconciliation.
- Live integration tests covering joining, chunk streaming, movement, block break/place, inventory, death, respawn and server transfer.
- Multi-user isolation, quotas, disconnect expiry and target/network policy before offering a shared public relay.
- A maintained and verified featured-server catalog. The sample directory is not the full current Bedrock featured list.

The underlying renderer also has its own limitations; consult `upstream/viewer/PLAN.md`. This repository does not claim that every upstream rendering feature is complete or that every server is compatible.

## Development

```sh
npm test
npm run test:network
npm run build
npm start
```

`scripts/build-runner.mjs` copies upstream runner source into ignored `.build/runner/` and injects the authentication/transport hook plus `relay/session.go.txt` for transfers. It builds against the unmodified upstream module. Both injection anchors are checked and fail if an upstream change requires review. Upstream source is not modified or committed here. `npm run test:network` exercises real small-MTU transport, hub interaction encoding, and transfer destination checks.

`upstream/` is a Git submodule pinned to `aa3c56f`. Local uncommitted changes in another checkout are not included. Update the pin deliberately, then rebuild and retest the protocol, renderer and control API together. Build outputs, cache, logs and credentials are ignored.

The pinned upstream build currently reports three high-severity development-dependency audit findings (Vite, nanoid and source-map-js). These are not dependencies of the Node relay; the hosted frontend is a static production bundle. Do not expose the upstream Vite development server. Updating the upstream build-tool pin and rerunning its suite remains outstanding.

## License and attribution

Original code is MIT licensed; upstream remains governed by its own licensing metadata (its npm package declares ISC). Dependencies and downloaded resources retain their own terms. Review upstream licensing coverage before redistributing modified upstream source or binaries. Minecraft, Bedrock and server names belong to their respective owners. This independent project is not affiliated with Mojang or Microsoft and does not distribute Minecraft artwork or the game itself.
