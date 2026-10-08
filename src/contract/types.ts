import React from 'react';

export type WidgetState =
  | 'ready'
  | 'loading'
  | 'empty'
  | 'error'
  | 'offline'
  | 'unauthorized'
  | 'quota_exceeded'
  | 'unknown_type';

export type SyncPolicy = 'never' | 'optIn' | 'default';

export interface SettingField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  defaultValue: any;
  options?: { label: string; value: any }[];
  description?: string;
}

export interface WidgetCapabilities {
  storage?: boolean;
  tick?: 'second' | 'minute' | 'day';
  network?: boolean;
  notify?: boolean;
}

export interface WidgetManifest {
  typeId: string; // e.g. 'core.todo', 'core.notes', 'core.focus'
  contractVersion: number;
  contentVersion: number;
  displayName: string;
  icon: string; // Lucide icon name or svg
  defaultSpan: number; // 1 to 12
  supportedSpans: number[]; // e.g. [3, 6, 9, 12]
  minContentHeight?: number;
  capabilities: WidgetCapabilities;
  settingsSchema?: SettingField[];
  syncPolicy: SyncPolicy;
}

export interface WidgetInstance {
  instanceId: string;
  typeId: string;
  settings: Record<string, any>;
  visible: boolean;
  span: number;
  order: number;
}

export interface HostContext {
  instanceId: string;
  manifest: WidgetManifest;
  storage: {
    getContent<T>(fallback: T): Promise<T>;
    setContent<T>(content: T): Promise<void>;
  };
  scheduler?: {
    subscribe(listener: () => void): () => void;
  };
  notify?: {
    send(title: string, message: string): Promise<void>;
  };
}

export interface WidgetComponentProps {
  instance: WidgetInstance;
  host: HostContext;
  onStateChange?: (state: WidgetState, message?: string) => void;
}

export type WidgetComponent = React.ComponentType<WidgetComponentProps>;
