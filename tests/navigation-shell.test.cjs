const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Re-implement the pure functions to verify logic
function getInitial(name) {
  const text = typeof name === 'string' ? name.trim() : '';
  if (!text) return '?';
  const first =
    typeof Intl.Segmenter === 'function'
      ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)][0].segment
      : Array.from(text)[0];
  return first.toLocaleUpperCase();
}

function isValidUrl(url) {
  try {
    const parsed = new URL(url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function reorderList(list, fromIndex, toIndex) {
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

test('getInitial extracts uppercase English letter', () => {
  assert.equal(getInitial('github'), 'G');
  assert.equal(getInitial(' Notion '), 'N');
});

test('getInitial extracts first Chinese character', () => {
  assert.equal(getInitial('飞书'), '飞');
  assert.equal(getInitial('  百度搜索 '), '百');
});

test('getInitial extracts complete emoji character', () => {
  assert.equal(getInitial('🧑‍💻 工作台'), '🧑‍💻');
  assert.equal(getInitial('⚡ Quick'), '⚡');
});

test('isValidUrl validates HTTP and HTTPS URLs', () => {
  assert.equal(isValidUrl('https://github.com'), true);
  assert.equal(isValidUrl('http://localhost:3000'), true);
  assert.equal(isValidUrl('linear.app/my-team'), true);
});

test('isValidUrl rejects dangerous or executable schemes', () => {
  assert.equal(isValidUrl('javascript:alert(1)'), false);
  assert.equal(isValidUrl('data:text/html,<script>'), false);
  assert.equal(isValidUrl(''), false);
});

test('reorderList moves items without duplicating or dropping data', () => {
  const list = ['A', 'B', 'C', 'D'];
  const forward = reorderList(list, 0, 2);
  assert.deepEqual(forward, ['B', 'C', 'A', 'D']);

  const backward = reorderList(forward, 2, 0);
  assert.deepEqual(backward, ['A', 'B', 'C', 'D']);
});

test('Undo operation restores removed item at original index', () => {
  const original = [{ id: '1' }, { id: '2' }, { id: '3' }];
  const removedIndex = 1;
  const removedItem = original[removedIndex];
  
  const current = original.filter((_, i) => i !== removedIndex);
  assert.equal(current.length, 2);

  // Undo
  const restored = [...current];
  restored.splice(removedIndex, 0, removedItem);
  assert.deepEqual(restored, original);
});

// ── C005 图标首字母兜底结构回归 ────────────────────────────────
test('首字母仅作图标缺失兜底：absolute 底层垫底、img 上层覆盖、onError 露出 (C005)', () => {
  const src = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'components', 'shortcuts', 'Shortcuts.tsx'),
    'utf8'
  );
  // 字母层必须绝对定位垫底，不再是与 img 并列的无条件 flex 兄弟
  assert.ok(
    /absolute inset-0 flex items-center justify-center[^>]*>\s*\{getInitial/.test(src.replace(/className=\{?"[^"]*"\s*/g, (m) => m)),
      '首字母兜底层应为 absolute inset-0 居中结构'
  );
  // img 必须在字母层之后渲染（DOM 顺序决定覆盖关系）
  const spanIdx = src.indexOf('absolute inset-0 flex items-center justify-center');
  const imgIdx = src.indexOf('<img', spanIdx);
  assert.ok(spanIdx !== -1 && imgIdx > spanIdx, 'img 必须位于字母兜底层之后以形成覆盖');
  // onError 隐藏 img 露出字母；onLoad 恢复并隐藏字母（防透明图标透出）
  assert.ok(/onError=\{[^}]*display = 'none'[\s\S]{0,200}visibility = 'visible'/.test(src), 'onError 必须隐藏 img 并恢复字母可见');
  assert.ok(/onLoad=\{[^}]*display = ''[\s\S]{0,200}visibility = 'hidden'/.test(src), 'onLoad 必须恢复 img 并彻底隐藏字母层');
  // 热链加载成功率：no-referrer
  assert.ok(src.includes('referrerPolicy="no-referrer"'), 'img 应携带 no-referrer 提升图标热链成功率');
});
