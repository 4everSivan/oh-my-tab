const test = require('node:test');
const assert = require('node:assert/strict');
require('./helpers/load-ts.cjs');

// ── C033 纯日期订阅时间按本地日历日显示，不随时区偏移到前一天 ──────────────

const { formatRelativeTime } = require('../src/services/feed/feedParser.ts');

const ZONES = ['Asia/Shanghai', 'UTC', 'America/New_York', 'America/Los_Angeles', 'Pacific/Auckland'];

test('C033: 纯日期 YYYY-MM-DD 在东西半球时区均显示原日期', (t) => {
  const originalTz = process.env.TZ;
  t.after(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });
  for (const tz of ZONES) {
    process.env.TZ = tz;
    assert.equal(formatRelativeTime('2025-01-01').formatted, '2025-01-01', `时区 ${tz}`);
    assert.equal(formatRelativeTime(' 2024-02-29 ').formatted, '2024-02-29', `时区 ${tz}（含首尾空白）`);
  }
});

test('C033: 带时间与时区的完整时间戳仍按原生语义解析', () => {
  const iso = '2025-01-01T12:00:00Z';
  assert.equal(formatRelativeTime(iso).timestamp, Date.parse(iso));
  const rfc822 = 'Wed, 01 Jan 2025 12:00:00 GMT';
  assert.equal(formatRelativeTime(rfc822).timestamp, Date.parse(rfc822));
});

test('C033: 相对时间分支不受影响', () => {
  const now = Date.now();
  assert.equal(formatRelativeTime(now - 30 * 1000).formatted, '刚刚');
  assert.equal(formatRelativeTime(now - 3 * 3600 * 1000).formatted, '3 小时前');
  assert.equal(formatRelativeTime(undefined).formatted, '近期');
});
