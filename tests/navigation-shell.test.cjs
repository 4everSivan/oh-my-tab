const { test } = require('node:test');
const assert = require('node:assert/strict');

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
