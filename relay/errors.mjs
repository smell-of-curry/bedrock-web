/** Return the final structured failure, never the log containing a sign-in code. */
export function connectionError(log) {
  const errors = [...String(log).matchAll(/\berror=("(?:\\.|[^"\\])*")/g)];
  if (!errors.length)
    return "The connection process stopped before joining. Check the server address and relay configuration.";
  let message;
  try {
    message = JSON.parse(errors[errors.length - 1][1]);
  } catch {
    return "The server connection failed.";
  }
  message = message.replace(/§./g, "").replaceAll("<new-line>", "\n");
  const blocked = message.indexOf("VPN/Proxy connections are not allowed");
  if (blocked >= 0) return message.slice(blocked);
  return message;
}
