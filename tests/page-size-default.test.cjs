const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');

test('inventory and history default to five records per page', () => {
  assert.match(html, /const PAGE_SIZE=5;/);
  assert.match(html, /bookPageSize=PAGE_SIZE,loanPageSize=PAGE_SIZE/);
  assert.match(html, /bookPageSize=Number\(e\.target\.value\)\|\|PAGE_SIZE/);
  assert.match(html, /loanPageSize=Number\(e\.target\.value\)\|\|PAGE_SIZE/);
});

test('inventory and history per-page selectors start at five with five-step options', () => {
  for (const id of ['bookPageSize', 'loanPageSize']) {
    const markup = html.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)<\\/select>`))?.[1];
    assert.ok(markup, `${id} selector is present`);
    const values = [...markup.matchAll(/<option value="(\d+)">/g)].map(m => Number(m[1]));
    assert.deepEqual(values.slice(0, 6), [5, 10, 15, 20, 25, 30]);
    assert.equal(values[0], 5);
  }
});

test('pagination uses selected page size on both pages', () => {
  assert.match(html, /Math\.ceil\(visible\.length\/bookPageSize\)/);
  assert.match(html, /visible\.slice\(start,start\+bookPageSize\)/);
  assert.match(html, /Math\.ceil\(visible\.length\/loanPageSize\)/);
  assert.match(html, /visible\.slice\(start,start\+loanPageSize\)/);
});
