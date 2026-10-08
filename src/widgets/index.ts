import { widgetRegistry } from '../contract/registry';
import { todoManifest, TodoWidget } from './todo';
import { notesManifest, NotesWidget } from './notes';
import { focusManifest, FocusTimerWidget } from './focus-timer';

export function registerBuiltinWidgets(): void {
  widgetRegistry.register(todoManifest, TodoWidget);
  widgetRegistry.register(notesManifest, NotesWidget);
  widgetRegistry.register(focusManifest, FocusTimerWidget);
}

export * from './todo';
export * from './notes';
export * from './focus-timer';
