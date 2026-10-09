const { test } = require('node:test');
const assert = require('node:assert/strict');

// Minimal in-memory adapter for testing contract
class MemoryStorageAdapter {
  constructor() {
    this.store = new Map();
  }
  async get(key, fallback) {
    return this.store.has(key) ? this.store.get(key) : fallback;
  }
  async set(key, value) {
    this.store.set(key, JSON.parse(JSON.stringify(value)));
  }
  async remove(key) {
    this.store.delete(key);
  }
  async clear() {
    this.store.clear();
  }
}

class TestStorageService {
  constructor(adapter = new MemoryStorageAdapter()) {
    this.adapter = adapter;
    this.DEFAULT_CLOCK = {
      font: 'modern',
      size: 96,
      weight: 400,
      align: 'center',
      top: 56,
      shadow: 'none',
      showDate: true,
      showSeconds: false,
      timezone: 'auto',
    };
    this.DEFAULT_SEARCH = {
      align: 'center',
      width: 600,
      gap: 30,
      transparency: 15,
      blur: 12,
      radius: 24,
    };
    this.DEFAULT_BACKGROUND = {
      type: 'material',
      color: '#C8D8E8',
      imageId: '',
      name: 'paper',
      shade: 35,
      blur: 0,
      position: 'center',
    };
    this.DEFAULT_SHORTCUTS = [
      { id: 'github', name: 'GitHub', url: 'https://github.com/' },
    ];
  }

  async getClock() {
    return this.adapter.get('settings.clock', this.DEFAULT_CLOCK);
  }
  async setClock(clock) {
    const cur = await this.getClock();
    const updated = { ...cur, ...clock };
    await this.adapter.set('settings.clock', updated);
    return updated;
  }
  async resetClock() {
    await this.adapter.set('settings.clock', this.DEFAULT_CLOCK);
    return this.DEFAULT_CLOCK;
  }

  async getSearch() {
    return this.adapter.get('settings.search', this.DEFAULT_SEARCH);
  }
  async setSearch(search) {
    const cur = await this.getSearch();
    const updated = { ...cur, ...search };
    await this.adapter.set('settings.search', updated);
    return updated;
  }
  async resetSearch() {
    await this.adapter.set('settings.search', this.DEFAULT_SEARCH);
    return this.DEFAULT_SEARCH;
  }

  async getWidgetContent(instanceId, fallback) {
    return this.adapter.get(`widgets/${instanceId}/content`, fallback);
  }
  async setWidgetContent(instanceId, content) {
    await this.adapter.set(`widgets/${instanceId}/content`, content);
  }
  async removeWidgetContent(instanceId) {
    await this.adapter.remove(`widgets/${instanceId}/content`);
  }
}

test('StorageService initializes with default clock, search, and background values', async () => {
  const service = new TestStorageService();
  const clock = await service.getClock();
  assert.equal(clock.font, 'modern');
  assert.equal(clock.size, 96);
  assert.equal(clock.shadow, 'none');

  const search = await service.getSearch();
  assert.equal(search.width, 600);
  assert.equal(search.transparency, 15);
});

test('Custom clock appearance survives updates without polluting search or background', async () => {
  const service = new TestStorageService();
  await service.setClock({ font: 'mono', size: 120, shadow: 'soft' });
  await service.setSearch({ width: 700, blur: 16 });

  const clock = await service.getClock();
  assert.equal(clock.font, 'mono');
  assert.equal(clock.size, 120);
  assert.equal(clock.shadow, 'soft');

  const search = await service.getSearch();
  assert.equal(search.width, 700);
  assert.equal(search.blur, 16);
});

test('Resetting clock appearance preserves search, background and shortcuts', async () => {
  const service = new TestStorageService();
  await service.setClock({ font: 'serif', size: 140 });
  await service.setSearch({ width: 450, transparency: 80 });

  // Reset clock only
  await service.resetClock();

  const clock = await service.getClock();
  assert.equal(clock.font, 'modern');
  assert.equal(clock.size, 96);

  // Search remains custom
  const search = await service.getSearch();
  assert.equal(search.width, 450);
  assert.equal(search.transparency, 80);
});

test('Resetting search appearance preserves clock settings', async () => {
  const service = new TestStorageService();
  await service.setClock({ font: 'serif', size: 140 });
  await service.setSearch({ width: 450, transparency: 80 });

  // Reset search only
  await service.resetSearch();

  const search = await service.getSearch();
  assert.equal(search.width, 600);
  assert.equal(search.transparency, 15);

  // Clock remains custom
  const clock = await service.getClock();
  assert.equal(clock.font, 'serif');
  assert.equal(clock.size, 140);
});

test('Widget contents are strictly namespaced under widgets/<instanceId>/content', async () => {
  const service = new TestStorageService();
  await service.setWidgetContent('todo-1', { items: [{ id: '1', text: 'Task 1', done: false }] });
  await service.setWidgetContent('notes-1', { text: 'My draft notes' });

  const todo = await service.getWidgetContent('todo-1', null);
  const notes = await service.getWidgetContent('notes-1', null);

  assert.equal(todo.items.length, 1);
  assert.equal(todo.items[0].text, 'Task 1');
  assert.equal(notes.text, 'My draft notes');

  // Deleting one does not affect the other
  await service.removeWidgetContent('todo-1');
  assert.equal(await service.getWidgetContent('todo-1', null), null);
  assert.equal((await service.getWidgetContent('notes-1', null)).text, 'My draft notes');
});

test('Clock timezone and search radius survive updates and resets independently (T10)', async () => {
  const service = new TestStorageService();
  const initClock = await service.getClock();
  const initSearch = await service.getSearch();
  assert.equal(initClock.timezone, 'auto');
  assert.equal(initSearch.radius, 24);

  // Update both
  await service.setClock({ timezone: 'Asia/Tokyo' });
  await service.setSearch({ radius: 12 });

  const updatedClock = await service.getClock();
  const updatedSearch = await service.getSearch();
  assert.equal(updatedClock.timezone, 'Asia/Tokyo');
  assert.equal(updatedSearch.radius, 12);

  // Reset clock preserves custom search radius
  await service.resetClock();
  assert.equal((await service.getClock()).timezone, 'auto');
  assert.equal((await service.getSearch()).radius, 12);

  // Reset search preserves default clock
  await service.resetSearch();
  assert.equal((await service.getSearch()).radius, 24);
});

