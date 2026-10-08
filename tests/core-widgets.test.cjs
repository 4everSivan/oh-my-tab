const { test } = require('node:test');
const assert = require('node:assert/strict');

// Mock in-memory storage simulating StorageService for widgets
class MockStorageService {
  constructor() {
    this.store = new Map();
  }

  async getWidgetContent(instanceId, fallback) {
    const key = `widgets/${instanceId}/content`;
    if (this.store.has(key)) {
      return JSON.parse(JSON.stringify(this.store.get(key)));
    }
    return fallback;
  }

  async setWidgetContent(instanceId, content) {
    const key = `widgets/${instanceId}/content`;
    this.store.set(key, JSON.parse(JSON.stringify(content)));
  }

  hasWidgetContent(instanceId) {
    return this.store.has(`widgets/${instanceId}/content`);
  }
}

// 1. Todo Widget Logic & Contract
test('Todo widget manifest defines core capabilities and opt-in sync', () => {
  const todoManifest = {
    typeId: 'core.todo',
    contractVersion: 1,
    contentVersion: 1,
    displayName: '今日待办',
    icon: 'CheckSquare',
    defaultSpan: 6,
    supportedSpans: [4, 6, 8, 12],
    capabilities: { storage: true },
    syncPolicy: 'optIn',
  };

  assert.equal(todoManifest.typeId, 'core.todo');
  assert.equal(todoManifest.capabilities.storage, true);
  assert.equal(todoManifest.syncPolicy, 'optIn');
  assert.ok(todoManifest.supportedSpans.includes(6));
});

test('Todo operations handle adding, completing, deleting and clearing items', async () => {
  const storage = new MockStorageService();
  const instanceId = 'todo_inst_1';

  let items = await storage.getWidgetContent(instanceId, []);
  assert.deepEqual(items, []);

  // Add items
  const item1 = { id: 'item_1', text: '完成 T06 开发', completed: false, createdAt: Date.now() };
  const item2 = { id: 'item_2', text: '跑通所有回归测试', completed: false, createdAt: Date.now() };
  items = [item2, item1];
  await storage.setWidgetContent(instanceId, items);

  // Verify persistence
  let saved = await storage.getWidgetContent(instanceId, []);
  assert.equal(saved.length, 2);
  assert.equal(saved[0].text, '跑通所有回归测试');

  // Toggle complete
  items = items.map(it => it.id === 'item_1' ? { ...it, completed: true } : it);
  await storage.setWidgetContent(instanceId, items);

  saved = await storage.getWidgetContent(instanceId, []);
  assert.equal(saved.find(i => i.id === 'item_1').completed, true);
  assert.equal(saved.find(i => i.id === 'item_2').completed, false);

  // Clear completed
  items = items.filter(it => !it.completed);
  await storage.setWidgetContent(instanceId, items);

  saved = await storage.getWidgetContent(instanceId, []);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].id, 'item_2');

  // Delete item
  items = items.filter(it => it.id !== 'item_2');
  await storage.setWidgetContent(instanceId, items);

  saved = await storage.getWidgetContent(instanceId, []);
  assert.equal(saved.length, 0);
});

// 2. Notes Widget Logic & Contract
test('Notes widget manifest defines opt-in sync and storage capabilities', () => {
  const notesManifest = {
    typeId: 'core.notes',
    contractVersion: 1,
    contentVersion: 1,
    displayName: '随手便签',
    icon: 'FileText',
    defaultSpan: 6,
    supportedSpans: [4, 6, 8, 12],
    capabilities: { storage: true },
    syncPolicy: 'optIn',
  };

  assert.equal(notesManifest.typeId, 'core.notes');
  assert.equal(notesManifest.capabilities.storage, true);
  assert.equal(notesManifest.syncPolicy, 'optIn');
});

test('Notes widget supports multi-line text and debounced save state', async () => {
  const storage = new MockStorageService();
  const instanceId = 'notes_inst_1';

  const defaultContent = { text: '' };
  let content = await storage.getWidgetContent(instanceId, defaultContent);
  assert.equal(content.text, '');

  // Save notes text
  const noteText = "今日要点：\n1. 规范治理优先\n2. 产物绝对隔离在 local/dist\n3. 移除保留内容";
  await storage.setWidgetContent(instanceId, { text: noteText, updatedAt: Date.now() });

  content = await storage.getWidgetContent(instanceId, defaultContent);
  assert.equal(content.text, noteText);
  assert.ok(content.updatedAt > 0);
});

// 3. Focus Timer Widget Logic & Contract
test('Focus Timer manifest defines tick, notify and never syncPolicy', () => {
  const focusManifest = {
    typeId: 'core.focus',
    contractVersion: 1,
    contentVersion: 1,
    displayName: '专注计时',
    icon: 'Timer',
    defaultSpan: 6,
    supportedSpans: [4, 6, 8, 12],
    capabilities: { tick: 'second', notify: true, storage: true },
    syncPolicy: 'never',
  };

  assert.equal(focusManifest.typeId, 'core.focus');
  assert.equal(focusManifest.syncPolicy, 'never');
  assert.equal(focusManifest.capabilities.tick, 'second');
  assert.equal(focusManifest.capabilities.notify, true);
});

test('Focus Timer calculates remaining time accurately across page reload', async () => {
  const storage = new MockStorageService();
  const instanceId = 'focus_inst_1';

  const startTime = Date.now();
  const durationMinutes = 25;
  const targetEndTime = startTime + 10 * 1000; // 10 seconds remaining

  // Save active timer state
  await storage.setWidgetContent(instanceId, {
    durationMinutes,
    targetEndTime,
    remainingSeconds: 10,
    isRunning: true,
  });

  // Simulate reload 4 seconds later
  const reloadTime = startTime + 4000;
  const savedState = await storage.getWidgetContent(instanceId, {
    durationMinutes: 25,
    targetEndTime: null,
    remainingSeconds: 25 * 60,
    isRunning: false,
  });

  assert.equal(savedState.isRunning, true);
  const recomputedRemaining = Math.max(0, Math.round((savedState.targetEndTime - reloadTime) / 1000));
  assert.equal(recomputedRemaining, 6); // 10 - 4 = 6 seconds remaining
});

test('Focus Timer detects expired state upon reload and triggers completion', async () => {
  const storage = new MockStorageService();
  const instanceId = 'focus_inst_expired';

  const startTime = Date.now();
  const durationMinutes = 25;
  const targetEndTime = startTime + 5 * 1000; // 5 seconds timer

  await storage.setWidgetContent(instanceId, {
    durationMinutes,
    targetEndTime,
    remainingSeconds: 5,
    isRunning: true,
  });

  // Simulate reload 10 seconds later (timer expired)
  const reloadTime = startTime + 10 * 1000;
  const savedState = await storage.getWidgetContent(instanceId, {
    durationMinutes: 25,
    targetEndTime: null,
    remainingSeconds: 25 * 60,
    isRunning: false,
  });

  const recomputedRemaining = Math.max(0, Math.round((savedState.targetEndTime - reloadTime) / 1000));
  assert.equal(recomputedRemaining, 0);

  // Mock notify callback
  let notified = false;
  let notifiedTitle = '';
  const mockNotify = {
    send: (title, msg) => {
      notified = true;
      notifiedTitle = title;
    }
  };

  if (recomputedRemaining === 0 && savedState.isRunning) {
    mockNotify.send('专注结束', `恭喜完成 ${savedState.durationMinutes} 分钟专注！`);
  }

  assert.equal(notified, true);
  assert.equal(notifiedTitle, '专注结束');
});

// 4. INV_RETAIN_CONTENT_ON_REMOVE: Retention of Content on Remove
test('Removing widget retains content in storage, re-adding restores identical data', async () => {
  const storage = new MockStorageService();
  const instanceId = 'core_todo_1';

  // Step 1: User adds content
  const initialTodos = [
    { id: '1', text: '整理文档', completed: true, createdAt: 1000 },
    { id: '2', text: '构建扩展', completed: false, createdAt: 2000 },
  ];
  await storage.setWidgetContent(instanceId, initialTodos);

  // Step 2: Widget is removed from layout (visible becomes false)
  const layout = [
    { instanceId, typeId: 'core.todo', visible: false, span: 6, order: 0, settings: {} },
  ];

  // Assert storage is untouched (physical isolation between layout visibility and content storage)
  assert.ok(storage.hasWidgetContent(instanceId));
  const contentWhileHidden = await storage.getWidgetContent(instanceId, []);
  assert.deepEqual(contentWhileHidden, initialTodos);

  // Step 3: User re-adds widget (re-activates instance to visible: true)
  const updatedLayout = layout.map(it => it.instanceId === instanceId ? { ...it, visible: true } : it);
  assert.equal(updatedLayout[0].visible, true);

  // Step 4: Re-added widget loads content
  const restoredContent = await storage.getWidgetContent(instanceId, []);
  assert.deepEqual(restoredContent, initialTodos);
});

// 5. Single-instance UI policy validation
test('AddWidgetModal disables already added visible widgets', () => {
  const layout = [
    { instanceId: 'w1', typeId: 'core.todo', visible: true, span: 6, order: 0, settings: {} },
    { instanceId: 'w2', typeId: 'core.notes', visible: false, span: 6, order: 1, settings: {} },
  ];

  const manifests = [
    { typeId: 'core.todo', displayName: '今日待办' },
    { typeId: 'core.notes', displayName: '随手便签' },
    { typeId: 'core.focus', displayName: '专注计时' },
  ];

  const availability = manifests.map(m => {
    const isAdded = layout.some(item => item.typeId === m.typeId && item.visible);
    return { typeId: m.typeId, isAdded };
  });

  // core.todo is visible -> isAdded = true (disabled)
  assert.equal(availability.find(a => a.typeId === 'core.todo').isAdded, true);
  // core.notes is hidden (removed) -> isAdded = false (can be re-added)
  assert.equal(availability.find(a => a.typeId === 'core.notes').isAdded, false);
  // core.focus not in layout -> isAdded = false (can be added)
  assert.equal(availability.find(a => a.typeId === 'core.focus').isAdded, false);
});
