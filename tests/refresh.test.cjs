const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const source = html.slice(html.indexOf('async function fetchShared('), html.indexOf('function renderAll()'));

function harness() {
  const requests = [], messages = [];
  let renders = 0, now = 100000;
  const context = vm.createContext({
    session: {user: {id: 'alice'}}, authGeneration: 0,
    books: [], loans: [], libraryOwnerId: null, BOOKS: 'books', LOANS: 'loans',
    Date: {now: () => now},
    msg: (...args) => messages.push(args), renderAll: () => renders++,
    restoreReviewDraft: async () => {}, renderBatch() {}, reviewStatus: (...args) => messages.push(args),
    requestAnimationFrame: fn => fn(), updatePageControls() {},
    sb: {from(table) {
      const order = [];
      return {select() {return this}, order(...args) {order.push(args); return this},
        range(first, last) {return new Promise((resolve, reject) => requests.push({table, first, last, order, resolve, reject}))}};
    }},
  });
  vm.runInContext(source + ';globalThis.reload = reloadAll;', context);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  function complete(start, label = 'snapshot') {
    for (const r of requests.slice(start)) r.resolve({data: [{record_id: label, id: label}], error: null});
  }
  return {context, requests, messages, flush, complete, reload: opts => context.reload(opts),
    advance: ms => now += ms, renders: () => renders};
}

test('passive refreshes share in-flight reads and skip fresh snapshots for 30 seconds', async () => {
  const h = harness();
  const first = h.reload();
  const second = h.reload({background: true});
  assert.equal(h.requests.length, 2);
  h.complete(0); await Promise.all([first, second]);
  await h.reload({background: true});
  assert.equal(h.requests.length, 2);
  h.advance(30000);
  const third = h.reload({background: true});
  assert.equal(h.requests.length, 4);
  h.complete(2); await third;
  assert.equal(h.renders(), 2);
});

test('reload after a mutation waits for a fresh snapshot and coalesces repeated requests', async () => {
  const h = harness();
  const first = h.reload();
  const mutation = h.reload();
  const another = h.reload();
  assert.equal(h.requests.length, 2);
  h.complete(0, 'old'); await h.flush();
  assert.equal(h.requests.length, 4);
  assert.equal(h.renders(), 0, 'do not publish the stale pre-mutation snapshot');
  h.complete(2, 'new'); await Promise.all([first, mutation, another]);
  assert.equal(h.context.books[0].record_id, 'new');
  assert.equal(h.renders(), 1);
  const manual = h.reload();
  assert.equal(h.requests.length, 6, 'manual reload bypasses freshness window');
  h.complete(4); await manual;
});

test('account changes isolate data, suppress stale errors, and keep the new job active', async () => {
  const h = harness();
  const old = h.reload();
  h.context.session = {user: {id: 'bob'}}; h.context.authGeneration++;
  const next = h.reload();
  h.requests[0].reject(new Error('old account error'));
  h.requests[1].resolve({data: [], error: null});
  await old;
  const passive = h.reload({background: true});
  assert.equal(h.requests.length, 4);
  assert.ok(!h.messages.some(m => m[0].includes('old account error')));
  h.complete(2, 'bob'); await Promise.all([next, passive]);
  assert.equal(h.context.books[0].record_id, 'bob');
});

test('failed refresh retains existing data and retries without freshness suppression', async () => {
  const h = harness(); h.context.books = [{record_id: 'existing'}];
  const first = h.reload();
  h.requests[0].reject(new Error('offline'));
  await h.flush();
  const retry = h.reload();
  assert.equal(h.requests.length, 2, 'wait for the other table before retrying');
  h.requests[1].resolve({data: [], error: null}); await h.flush();
  assert.equal(h.requests.length, 4);
  h.requests[2].resolve({error: new Error('still offline')});
  h.requests[3].resolve({data: [], error: null}); await Promise.all([first, retry]);
  assert.equal(h.context.books[0].record_id, 'existing');
  assert.equal(h.renders(), 0);
  const recovered = h.reload({background: true});
  assert.equal(h.requests.length, 6);
  h.complete(4); await recovered;
});

test('signed-out pagination stops before requesting another page', async () => {
  const h = harness(); const pending = h.reload();
  h.context.session = null; h.context.authGeneration++;
  for (const r of h.requests) r.resolve({data: Array.from({length: 1000}, (_, i) => ({id: i})), error: null});
  await pending;
  assert.equal(h.requests.length, 2);
  assert.equal(h.renders(), 0);
});

test('paged reads use unique tie breakers and request subsequent pages', async () => {
  const h = harness(); const pending = h.reload();
  assert.equal(h.requests[0].order[1][0], 'record_id');
  assert.equal(h.requests[1].order[1][0], 'id');
  h.requests[0].resolve({data: Array.from({length: 1000}, (_, i) => ({record_id: i})), error: null});
  h.requests[1].resolve({data: [], error: null}); await h.flush();
  assert.equal(h.requests[2].first, 1000);
  h.requests[2].resolve({data: [{record_id: 1000}], error: null}); await pending;
  assert.equal(h.context.books.length, 1001);
});

test('inventory becomes usable while Review is still pending', async () => {
  const h=harness(); let finish;
  h.context.restoreReviewDraft=()=>new Promise(resolve=>{finish=resolve});
  const pending=h.reload();h.complete(0);await pending;
  assert.equal(h.renders(),1);
  assert.equal(typeof finish,'function');
  const next=h.reload();assert.equal(h.requests.length,4);
  h.complete(2);await next;finish();
});

test('review failure does not erase inventory or masquerade as library failure',async()=>{
 const h=harness();h.context.restoreReviewDraft=async()=>{throw Error('Review offline')};
 const pending=h.reload();h.complete(0);await pending;await h.flush();
 assert.equal(h.renders(),1);assert.equal(h.context.books.length,1);
 assert.ok(h.messages.some(m=>m[0].includes('Review could not be restored')));
 assert.ok(!h.messages.some(m=>m[0].startsWith('Could not load shared library')));
});
