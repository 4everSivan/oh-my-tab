const { test } = require('node:test');
const assert = require('node:assert/strict');

function filterVisibleAndSort(items) {
  return [...items].filter(i => i.visible).sort((a, b) => a.order - b.order);
}

function handleAddWidget(layout, manifest) {
  const existingIndex = layout.findIndex(item => item.typeId === manifest.typeId);
  if (existingIndex !== -1) {
    const updated = [...layout];
    updated[existingIndex] = { ...updated[existingIndex], visible: true };
    return updated;
  }
  return [...layout, {
    instanceId: `${manifest.typeId}-${Date.now()}`,
    typeId: manifest.typeId,
    settings: {},
    visible: true,
    span: manifest.defaultSpan,
    order: layout.length,
  }];
}

function handleRemoveWidget(layout, instanceId) {
  return layout.map(item => item.instanceId === instanceId ? { ...item, visible: false } : item);
}

test('Grid layout filters out hidden items and sorts by order', () => {
  const layout = [
    { instanceId: 'w2', typeId: 'notes', order: 2, visible: true },
    { instanceId: 'w1', typeId: 'todo', order: 1, visible: false },
    { instanceId: 'w0', typeId: 'focus', order: 0, visible: true },
  ];

  const visible = filterVisibleAndSort(layout);
  assert.equal(visible.length, 2);
  assert.equal(visible[0].instanceId, 'w0');
  assert.equal(visible[1].instanceId, 'w2');
});

test('Adding widget re-activates existing hidden instance rather than duplicating', () => {
  const layout = [
    { instanceId: 'inst-todo-1', typeId: 'core.todo', order: 0, visible: false },
  ];

  const manifest = { typeId: 'core.todo', defaultSpan: 6 };
  const updated = handleAddWidget(layout, manifest);

  assert.equal(updated.length, 1);
  assert.equal(updated[0].instanceId, 'inst-todo-1');
  assert.equal(updated[0].visible, true);
});

test('Adding a new widget type appends new instance', () => {
  const layout = [
    { instanceId: 'inst-todo-1', typeId: 'core.todo', order: 0, visible: true },
  ];

  const manifest = { typeId: 'core.notes', defaultSpan: 6 };
  const updated = handleAddWidget(layout, manifest);

  assert.equal(updated.length, 2);
  assert.equal(updated[1].typeId, 'core.notes');
  assert.equal(updated[1].visible, true);
});

test('Removing widget marks visible as false without deleting data entry', () => {
  const layout = [
    { instanceId: 'inst-1', typeId: 'core.todo', order: 0, visible: true },
    { instanceId: 'inst-2', typeId: 'core.notes', order: 1, visible: true },
  ];

  const updated = handleRemoveWidget(layout, 'inst-1');
  assert.equal(updated.length, 2);
  assert.equal(updated[0].visible, false);
  assert.equal(updated[1].visible, true);
});
