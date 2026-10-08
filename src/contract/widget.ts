import { WidgetManifest, WidgetInstance } from './types';

export * from './types';

export function createWidgetInstance(manifest: WidgetManifest, instanceId?: string): WidgetInstance {
  const id = instanceId || `${manifest.typeId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const defaultSettings: Record<string, any> = {};

  if (manifest.settingsSchema) {
    manifest.settingsSchema.forEach((field) => {
      defaultSettings[field.key] = field.defaultValue;
    });
  }

  return {
    instanceId: id,
    typeId: manifest.typeId,
    settings: defaultSettings,
    visible: true,
    span: manifest.defaultSpan,
    order: 0,
  };
}
