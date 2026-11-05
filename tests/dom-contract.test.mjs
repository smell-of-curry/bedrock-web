import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('launcher markup contains every required controller hook',async()=>{
 const js=await readFile(new URL('../web/app.js',import.meta.url),'utf8');
 const html=await readFile(new URL('../web/index.html',import.meta.url),'utf8');
 const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
 for(const match of js.matchAll(/\$\("([^"]+)"\)/g))assert(ids.has(match[1]),`Missing #${match[1]} prevents launcher startup`);
});
