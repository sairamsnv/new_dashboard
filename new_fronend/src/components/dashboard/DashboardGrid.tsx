import React, { useCallback, useRef, useState, useEffect } from 'react';
import ReactGridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { useDashboardStore } from '@/store/dashboardStore';
import WidgetWrapper from './WidgetWrapper';
import type { WidgetLayout } from '@/types/dashboard';
import { BarChart3, Upload, Sparkles } from 'lucide-react';

const EmptyDashboard = ({ hasDataset }: { hasDataset: boolean }) => (
  <div className="flex flex-1 flex-col items-center justify-center gap-6 p-12 text-center">
    <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
      <BarChart3 className="h-10 w-10 text-primary/60" />
    </div>
    <div className="max-w-sm space-y-2">
      <h2 className="text-lg font-semibold">No widgets yet</h2>
      {hasDataset ? (
        <p className="text-sm text-muted-foreground">
          Go to the <span className="font-medium text-foreground">Charts</span> tab to let AI suggest
          visualizations from your dataset, then click <strong>Add</strong> to pin them here.
          <br /><br />
          Or use the <span className="font-medium text-foreground">+ Widget</span> toolbar button to add one manually.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Start by uploading a CSV or Excel file in the{' '}
          <span className="font-medium text-foreground">Upload</span> tab.
          <br />
          AI will analyze your data and suggest charts automatically.
        </p>
      )}
    </div>
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      {!hasDataset && (
        <div className="flex items-center gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          Upload data
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5" />
        Get AI suggestions
      </div>
      <div className="flex items-center gap-1.5">
        <BarChart3 className="h-3.5 w-3.5" />
        Build dashboard
      </div>
    </div>
  </div>
);

const DashboardGrid = () => {
  const { widgets, layouts, updateLayouts, selectWidget, activeDatasetSlug } = useDashboardStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    setWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

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
      ref={containerRef}
      className="flex flex-1 flex-col overflow-auto p-4"
      onClick={() => selectWidget(null)}
    >
      {widgets.length === 0 ? (
        <EmptyDashboard hasDataset={Boolean(activeDatasetSlug)} />
      ) : (
        React.createElement(ReactGridLayout as any, {
          className: "layout",
          layout: layouts,
          cols: 12,
          rowHeight: 60,
          width: width,
          margin: [12, 12],
          containerPadding: [0, 0],
          isDraggable: true,
          isResizable: true,
          resizeHandles: ['se', 'e', 's', 'w', 'n', 'sw', 'nw', 'ne'],
          draggableHandle: ".drag-handle",
          onLayoutChange: handleLayoutChange,
          useCSSTransforms: true,
        }, widgets.map(widget => (
          <div key={widget.id}>
            <WidgetWrapper widget={widget} />
          </div>
        )))
      )}
    </div>
  );
};

export default DashboardGrid;
