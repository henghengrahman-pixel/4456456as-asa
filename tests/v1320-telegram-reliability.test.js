import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TelegramClient } from '../src/telegram.js';

const bridge=fs.readFileSync(new URL('../src/human-bridge.js',import.meta.url),'utf8');

test('v1.32 Telegram callback ACK uses Bot API answerCallbackQuery with valid payload', async()=>{
  const original=globalThis.fetch;
  let seen=null;
  globalThis.fetch=async(url,opts)=>{
    seen={url:String(url),body:JSON.parse(opts.body)};
    return {ok:true,status:200,json:async()=>({ok:true,result:true})};
  };
  try{
    const tg=new TelegramClient('123456:ABCDEFGHIJKLMNOPQRSTUVWXYZabcd');
    const out=await tg.answerCallbackQuery('cb-123','Sedang diproses…');
    assert.equal(out,true);
    assert.match(seen.url,/\/answerCallbackQuery$/);
    assert.equal(seen.body.callback_query_id,'cb-123');
    assert.equal(seen.body.text,'Sedang diproses…');
  }finally{ globalThis.fetch=original; }
});

test('v1.32 callback fast path retries ACK before handing batch to update workers',()=>{
  assert.match(bridge,/for\(let attempt=0;attempt<2;attempt\+\+\)/);
  const marker=bridge.indexOf('ULTRA-FAST CALLBACK ACK');
  const ack=bridge.indexOf("answerCallbackQuery(q.id,allowed?'Sedang diproses…':'Akun Telegram ini belum diizinkan.')",marker);
  const workers=bridge.indexOf('handleUpdatesConcurrent(updates,livechat,8)',marker);
  assert.ok(marker>=0 && ack>marker && workers>ack);
});

test('v1.32 failed Telegram update holds durable offset for retry',()=>{
  assert.match(bridge,/const safeMax=failed\.length\?Math\.min\(max,failed\[0\]-1\):max/);
  assert.match(bridge,/failedUpdateIds\.push\(Number\(updateId\)\)/);
  assert.match(bridge,/telegram_processed_updates/);
});

test('v1.32 deterministic incomplete reset reply is acknowledged without poisoning offset',()=>{
  assert.match(bridge,/terminalOperatorError=.*RESET_REPLY_INCOMPLETE/);
  assert.match(bridge,/if\(!terminalOperatorError\) throw e/);
});
