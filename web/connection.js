export const localClientURL = "http://127.0.0.1:8080";
export function isPages(url) {
  return new URL(url).hostname.endsWith(".github.io");
}
export function connectionURL(value) {
  let url;
  try { url = new URL(value); }
  catch { throw Error("Enter a full game service address, such as http://127.0.0.1:8080."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password)
    throw Error("Use an HTTP or HTTPS address without credentials.");
  if (isPages(url.href))
    throw Error("GitHub Pages hosts the launcher, not the game service. Use http://127.0.0.1:8080 on this computer.");
  return url.origin;
}
export function initialConnection(page, saved) {
  try { return connectionURL(saved || page); } catch { return localClientURL; }
}
export async function readJSON(response) {
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw Error("This address is a website, not the game service. Open the local client to play.");
  try { return await response.json(); }
  catch { throw Error("The game service sent an unreadable response. Try reconnecting."); }
}
