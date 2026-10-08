import { WidgetManifest, WidgetComponent, HostContext, WidgetInstance } from './types';
import { storageService, StorageService } from '../services/storage';

export interface WidgetRegistration {
  manifest: WidgetManifest;
  component: WidgetComponent;
}

export class WidgetRegistry {
  private static instance: WidgetRegistry;
  private registrations = new Map<string, WidgetRegistration>();

  public static getInstance(): WidgetRegistry {
    if (!WidgetRegistry.instance) {
      WidgetRegistry.instance = new WidgetRegistry();
    }
    return WidgetRegistry.instance;
  }

  register(manifest: WidgetManifest, component: WidgetComponent): void {
    if (this.registrations.has(manifest.typeId)) {
      console.warn(`[WidgetRegistry] Overwriting registration for ${manifest.typeId}`);
    }
    this.registrations.set(manifest.typeId, { manifest, component });
  }

  getRegistration(typeId: string): WidgetRegistration | undefined {
    return this.registrations.get(typeId);
  }

  getManifest(typeId: string): WidgetManifest | undefined {
    return this.registrations.get(typeId)?.manifest;
  }

  getComponent(typeId: string): WidgetComponent | undefined {
    return this.registrations.get(typeId)?.component;
  }

  getAllManifests(): WidgetManifest[] {
    return Array.from(this.registrations.values()).map((r) => r.manifest);
  }

  hasType(typeId: string): boolean {
    return this.registrations.has(typeId);
  }

  createHostContext(instance: WidgetInstance, storage: StorageService = storageService): HostContext {
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
        getContent: <T>(fallback: T) => storage.getWidgetContent<T>(instance.instanceId, fallback),
        setContent: <T>(content: T) => storage.setWidgetContent<T>(instance.instanceId, content),
      },
      scheduler: manifest.capabilities.tick
        ? {
            subscribe: (listener: () => void) => {
              const intervalMs =
                manifest.capabilities.tick === 'second'
                  ? 1000
                  : manifest.capabilities.tick === 'minute'
                  ? 60000
                  : 86400000;
              const timer = setInterval(listener, intervalMs);
              return () => clearInterval(timer);
            },
          }
        : undefined,
      notify: manifest.capabilities.notify
        ? {
            send: async (title: string, message: string) => {
              if (typeof chrome !== 'undefined' && chrome.notifications) {
                chrome.notifications.create({
                  type: 'basic',
                  iconUrl: 'icon-48.png',
                  title,
                  message,
                });
              } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification(title, { body: message });
              } else {
                console.log(`[Notification] ${title}: ${message}`);
              }
            },
          }
        : undefined,
    };
  }
}

export const widgetRegistry = WidgetRegistry.getInstance();
