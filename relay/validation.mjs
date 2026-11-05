export function target(value) {
  const {
    host,
    port = 19132,
    name = "WebPlayer",
    authentication = "xbox",
  } = value ?? {};
  if (
    typeof host !== "string" ||
    host.length > 253 ||
    !/^[a-zA-Z0-9:][a-zA-Z0-9.:-]*$/.test(host)
  )
    throw Error("Enter a hostname or IP address without a URL or path.");
  if (
    !Number.isInteger(Number(port)) ||
    Number(port) < 1 ||
    Number(port) > 65535
  )
    throw Error("Port must be between 1 and 65535.");
  if (typeof name !== "string" || !/^[a-zA-Z0-9_ ]{1,16}$/.test(name))
    throw Error(
      "Player name must contain 1–16 letters, numbers, spaces or underscores.",
    );
  if (!["xbox", "offline"].includes(authentication))
    throw Error("Invalid authentication mode");
  return {
    authentication,
    host,
    port: Number(port),
    name,
    address: `${host.includes(":") ? "[" + host + "]" : host}:${port}`,
  };
}
export const actions = new Set([
  "moveRawInput",
  "jump",
  "setHeldSlot",
  "chat",
  "breakBlock",
  "interactWithBlock",
  "getState",
  "getInventory",
  "getForm",
  "clickFormButton",
  "customFormRespond",
  "modalFormRespond",
  "dismissForm",
]);
