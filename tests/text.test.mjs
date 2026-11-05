import test from "node:test";
import assert from "node:assert/strict";
import { parseLanguage, translateText } from "../web/text.js";

test("server rawtext resolves nested translations and positional arguments", () => {
  const language = parseLanguage("welcome=Welcome %1$s, %s!\nname=Trainer\npercent=Lost %s%%\nlines=First~LINEBREAK~Second\\nThird\t## comment");
  assert.equal(translateText(JSON.stringify({ rawtext: [{ translate: "welcome", with: { rawtext: [{ translate: "name" }, { text: "hello" }] } }] }), language), "Welcome Trainer, hello!");
  assert.equal(translateText({translate:"percent",with:["20"]},language),"Lost 20%");
  assert.equal(translateText("lines",language),"First\nSecond\nThird");
});
test("unknown and literal server labels remain text", () => {
  assert.equal(translateText("ordinary label"), "ordinary label");
  assert.equal(translateText('{"other":"data"}'), '{"other":"data"}');
  assert.equal(translateText({rawtext:[{text:"<script>literal</script>"}]}), "<script>literal</script>");
  const language = parseLanguage("__proto__=label\nconstructor=other");
  assert.equal(translateText("__proto__",language),"label");
  assert.equal({}.label, undefined);
});
