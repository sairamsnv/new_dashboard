import { useCallback } from 'react';
import ReactGridLayout from 'react-grid-layout';
import { useDashboardStore } from '@/store/dashboardStore';
import WidgetWrapper from './WidgetWrapper';
import type { WidgetLayout } from '@/types/dashboard';

const WidthProvider = (ReactGridLayout as any).WidthProvider || ReactGridLayout;
const GridLayout = typeof WidthProvider === 'function' && WidthProvider !== ReactGridLayout
  ? WidthProvider(ReactGridLayout)
  : ReactGridLayout;

const DashboardGrid = () => {
  const { widgets, layouts, updateLayouts, selectWidget } = useDashboardStore();

  const handleLayoutChange = useCallback(
    (currentLayout: any[]) => {
      const newLayouts: WidgetLayout[] = currentLayout.map((l: any) => {
        const existing = layouts.find(el => el.i === l.i);
        return {
          i: l.i,
          x: l.x,
          y: l.y,
          w: l.w,
          h: l.h,
          minW: existing?.minW,
          minH: existing?.minH,
        };
      });
      updateLayouts(newLayouts);
    },
    [layouts, updateLayouts]
  );

  return (
    <div
      className="flex-1 overflow-auto p-4"
      onClick={() => selectWidget(null)}
    >
      <GridLayout
        className="layout"
        layout={layouts}
        cols={12}
        rowHeight={60}
        margin={[12, 12] as [number, number]}
        containerPadding={[0, 0] as [number, number]}
        isDraggable
        isResizable
        /* se = corner; e/w = change width; s = change height — easier than corner-only */
        resizeHandles={['se', 'e', 'w', 's']}
        draggableHandle=".drag-handle"
        onLayoutChange={handleLayoutChange}
        useCSSTransforms
      >
        {widgets.map(widget => (
          <div key={widget.id}>
            <WidgetWrapper widget={widget} />
          </div>
        ))}
      </GridLayout>
    </div>
  );
};

export default DashboardGrid;
