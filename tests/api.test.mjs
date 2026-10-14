import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import fs from 'node:fs';
import vm from 'node:vm';
function client(fetch) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync('lib/api.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(source, { exports, fetch, Intl, Error, Promise, JSON });
  return exports;
}
const response = (status, data, message = 'OK') => ({ ok: status < 400, status, json: async () => ({ success: status < 400, data, message }) });
test('expired access token refreshes once for concurrent requests and retries with the new token', async () => {
  let refreshes = 0; const calls = [];
  const c = client(async (path, init) => {
    calls.push({path, init});
    if (path.endsWith('/auth/refresh')) { refreshes++; await new Promise(resolve => setTimeout(resolve, 10)); return response(200, { accessToken: 'fresh' }); }
    if (init.headers.Authorization === 'Bearer expired') return response(401, null, 'Expired');
    return response(200, { value: 42 });
  });
  c.setToken('expired');
  const result = await Promise.all([c.api('/dashboard/overview'), c.api('/outlets')]);
  assert.equal(refreshes, 1); assert.equal(result[0].value, 42);
  assert.equal(calls.filter(x=>x.init.headers.Authorization === 'Bearer fresh').length, 2);
  assert.ok(calls.every(x=>x.init.credentials === 'same-origin' && x.init.cache === 'no-store'));
});
test('authorization and backend validation errors remain visible without a refresh loop', async () => {
  let calls = 0;
  const c = client(async () => { calls++; return response(403, null, 'Tidak memiliki akses'); });
  await assert.rejects(c.api('/dashboard/overview'), { message: 'Tidak memiliki akses', status: 403 });
  assert.equal(calls, 1);
});
test('logout token clearing prevents an in-flight refresh from restoring credentials', async () => {
  let finish; const observed = [];
  const c = client(async (path, init) => {
    if (path.endsWith('/auth/refresh')) return new Promise(resolve => { finish = () => resolve(response(200, { accessToken: 'old-session' })); });
    observed.push(init.headers.Authorization); return response(200, {});
  });
  c.setToken('initial'); const pending = c.refresh(); c.setToken(null); finish(); await pending;
  await c.api('/outlets'); assert.equal(observed[0], undefined);
});
test('JSON checkout payload and idempotency key survive the authenticated retry', async () => {
  const bodies = []; const c = client(async (path, init) => {
    if (path.endsWith('/auth/refresh')) return response(200, { accessToken: 'new' });
    bodies.push(init.body); return response(bodies.length === 1 ? 401 : 200, {});
  });
  c.setToken('expired'); await c.post('/pos/transactions/checkout', { requestId: 'stable-id', items: [] });
  assert.equal(bodies[0], bodies[1]); assert.equal(JSON.parse(bodies[1]).requestId, 'stable-id');
});


test('subscription denial notifies the access gate without retrying as authentication',async()=>{
 let calls=0,blocked=0;
 const c=client(async()=>{calls++;return {ok:false,status:403,json:async()=>({success:false,code:'SUBSCRIPTION_EXPIRED',message:'Langganan berakhir'})};});
 const unsubscribe=c.onSubscriptionRequired(()=>blocked++);
 await assert.rejects(c.api('/outlets'),{status:403,code:'SUBSCRIPTION_EXPIRED'});
 assert.equal(calls,1);assert.equal(blocked,1);
 unsubscribe();await assert.rejects(c.api('/outlets'));assert.equal(blocked,1);
});
test('ordinary permission failures do not trigger the subscription gate',async()=>{
 const c=client(async()=>response(403,null,'Owner only'));let blocked=0;c.onSubscriptionRequired(()=>blocked++);
 await assert.rejects(c.api('/cashiers'));assert.equal(blocked,0);
});
