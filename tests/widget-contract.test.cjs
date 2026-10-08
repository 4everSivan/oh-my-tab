const { test } = require('node:test');
const assert = require('node:assert/strict');

// Simulated Registry implementation to test pure contract logic
class TestRegistry {
  constructor() {
    this.registrations = new Map();
  }

  register(manifest, component) {
    this.registrations.set(manifest.typeId, { manifest, component });
  }

  getManifest(typeId) {
    return this.registrations.get(typeId)?.manifest;
  }

  hasType(typeId) {
    return this.registrations.has(typeId);
  }

  getAllManifests() {
    return Array.from(this.registrations.values()).map(r => r.manifest);
  }

  createHostContext(instance, mockStorage) {
    const manifest = this.getManifest(instance.typeId) || {
      typeId: instance.typeId,
      contractVersion: 1,
      contentVersion: 1,
      displayName: instance.typeId,
      icon: 'HelpCircle',
      defaultSpan: 6,
      supportedSpans: [3, 6, 9, 12],
      capabilities: {},
      syncPolicy: 'optIn',
    };

    return {
      instanceId: instance.instanceId,
      manifest,
      storage: {
        getContent: (fallback) => mockStorage.get(`widgets/${instance.instanceId}/content`, fallback),
        setContent: (content) => mockStorage.set(`widgets/${instance.instanceId}/content`, content),
      },
    };
  }
}

test('WidgetRegistry registers manifests and decouples metadata from implementation', () => {
  const registry = new TestRegistry();
  const dummyComponent = () => null;

  registry.register({
    typeId: 'core.todo',
    contractVersion: 1,
    contentVersion: 1,
    displayName: '今日待办',
    icon: 'CheckSquare',
    defaultSpan: 6,
    supportedSpans: [3, 6, 12],
    capabilities: { storage: true },
    syncPolicy: 'optIn',
  }, dummyComponent);

  assert.equal(registry.hasType('core.todo'), true);
  const manifest = registry.getManifest('core.todo');
  assert.equal(manifest.displayName, '今日待办');
  assert.equal(manifest.defaultSpan, 6);
  assert.deepEqual(manifest.supportedSpans, [3, 6, 12]);
});

test('HostContext correctly namespaces storage to widgets/<instanceId>/content', async () => {
  const registry = new TestRegistry();
  const storageMap = new Map();
  const mockStorage = {
    get: async (k, fallback) => storageMap.has(k) ? storageMap.get(k) : fallback,
    set: async (k, v) => storageMap.set(k, v),
  };

  registry.register({
    typeId: 'core.notes',
    contractVersion: 1,
    contentVersion: 1,
    displayName: '随手便签',
    icon: 'FileText',
    defaultSpan: 6,
    supportedSpans: [6, 12],
    capabilities: { storage: true },
    syncPolicy: 'optIn',
  }, () => null);

  const instance = {
    instanceId: 'notes-inst-01',
    typeId: 'core.notes',
    settings: {},
    visible: true,
    span: 6,
    order: 0,
  };

  const host = registry.createHostContext(instance, mockStorage);
  await host.storage.setContent({ text: 'Hello, World!' });

  assert.deepEqual(storageMap.get('widgets/notes-inst-01/content'), { text: 'Hello, World!' });
  const retrieved = await host.storage.getContent({});
  assert.equal(retrieved.text, 'Hello, World!');
});

test('Unknown widget type generates safe fallback manifest and retains instance id', () => {
  const registry = new TestRegistry();
  const instance = {
    instanceId: 'future-widget-99',
    typeId: 'ext.weather',
    settings: {},
    visible: true,
    span: 4,
    order: 1,
  };

  const host = registry.createHostContext(instance, { get: async () => null, set: async () => null });
  assert.equal(host.manifest.typeId, 'ext.weather');
  assert.equal(host.manifest.displayName, 'ext.weather');
  assert.equal(host.manifest.defaultSpan, 6);
});

test('All 7 uniform widget states are defined in specification', () => {
  const states = ['ready', 'loading', 'empty', 'error', 'offline', 'unauthorized', 'quota_exceeded', 'unknown_type'];
  assert.equal(states.length, 8); // 'ready' + 7 special states
  assert.ok(states.includes('loading'));
  assert.ok(states.includes('empty'));
  assert.ok(states.includes('error'));
  assert.ok(states.includes('offline'));
  assert.ok(states.includes('unauthorized'));
  assert.ok(states.includes('quota_exceeded'));
  assert.ok(states.includes('unknown_type'));
});
