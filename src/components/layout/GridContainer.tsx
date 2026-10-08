import React from 'react';
import { LayoutItem } from '../../services/storage/types';
import { WidgetInstance } from '../../contract/types';
import { widgetRegistry } from '../../contract/registry';
import { CardShell } from '../card/CardShell';
import { storageService } from '../../services/storage';

interface GridContainerProps {
  layout: LayoutItem[];
  onRemoveWidget: (instanceId: string) => void;
  onUpdateSpan?: (instanceId: string, span: number) => void;
  onOpenWidgetSettings?: (instanceId: string) => void;
}

export const GridContainer: React.FC<GridContainerProps> = ({
  layout,
  onRemoveWidget,
  onOpenWidgetSettings,
}) => {
  // Only render visible items, ordered by order
  const visibleItems = [...layout]
    .filter((item) => item.visible)
    .sort((a, b) => a.order - b.order);

  if (visibleItems.length === 0) {
    return null;
  }

  // Convert span (1-12) to tailwind col-span class
  const getColSpanClass = (span: number) => {
    switch (span) {
      case 12:
        return 'col-span-12';
      case 9:
        return 'col-span-12 lg:col-span-9';
      case 8:
        return 'col-span-12 lg:col-span-8';
      case 6:
        return 'col-span-12 md:col-span-6';
      case 4:
        return 'col-span-12 md:col-span-6 lg:col-span-4';
      case 3:
      default:
        return 'col-span-12 md:col-span-6 lg:col-span-3';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      <div className="grid grid-cols-12 gap-5 items-start">
        {visibleItems.map((item) => {
          const manifest = widgetRegistry.getManifest(item.typeId);
          const Component = widgetRegistry.getComponent(item.typeId);
          const instance: WidgetInstance = {
            instanceId: item.instanceId,
            typeId: item.typeId,
            settings: item.settings || {},
            visible: item.visible,
            span: item.span,
            order: item.order,
          };
          const hostContext = widgetRegistry.createHostContext(instance, storageService);

          const spanClass = getColSpanClass(item.span || manifest?.defaultSpan || 6);

          if (!Component || !manifest) {
            // Forward compatibility for unknown widget types
            return (
              <div key={item.instanceId} className={spanClass}>
                <CardShell
                  instance={instance}
                  state="unknown_type"
                  onRemove={() => onRemoveWidget(item.instanceId)}
                />
              </div>
            );
          }

          return (
            <div key={item.instanceId} className={spanClass}>
              <CardShell
                instance={instance}
                manifest={manifest}
                onRemove={() => onRemoveWidget(item.instanceId)}
                onOpenSettings={() => onOpenWidgetSettings?.(item.instanceId)}
              >
                <Component instance={instance} host={hostContext} />
              </CardShell>
            </div>
          );
        })}
      </div>
    </div>
  );
};
