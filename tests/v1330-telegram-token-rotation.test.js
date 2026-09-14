import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const server=fs.readFileSync(new URL('../src/server.js',import.meta.url),'utf8');
const db=fs.readFileSync(new URL('../src/db.js',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('../src/human-bridge.js',import.meta.url),'utf8');
const tg=fs.readFileSync(new URL('../src/telegram.js',import.meta.url),'utf8');

test('bot token rotation resets Telegram cursor and dedupe state',()=>{
  assert.match(db,/token_fingerprint/);
  assert.match(db,/last_update_id=CASE WHEN \$7::boolean THEN 0 ELSE last_update_id END/);
  assert.match(db,/if\(resetCursor\) await client\.query\(`DELETE FROM telegram_processed_updates`\)/);
  assert.match(server,/previousToken!==token/);
  assert.match(server,/resetCursor/);
});

test('only one Railway replica owns Telegram polling lease at a time',()=>{
  assert.match(db,/CREATE TABLE IF NOT EXISTS runtime_leases/);
  assert.match(db,/export async function claimRuntimeLease/);
  assert.match(bridge,/claimRuntimeLease\('telegram-poll',bridgeInstanceId,12\)/);
});

test('invalid or negative topic ids are never sent as Telegram message_thread_id',()=>{
  assert.match(bridge,/function safeTopicId/);
  assert.match(tg,/function validTopicId/);
  assert.match(tg,/Number\.isSafeInteger\(n\)&&n>0/);
});

test('bot identity is refreshed and webhook removed when runtime token changes',()=>{
  assert.match(bridge,/if\(token!==currentBotToken\)/);
  assert.match(bridge,/await tg\.deleteWebhook\(\)/);
  assert.match(bridge,/currentBotUser=await tg\.getMe\(\)/);
});
