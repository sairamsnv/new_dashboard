import { X, GripVertical, Settings } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import WidgetRenderer from '@/components/widgets/WidgetRenderer';
import type { WidgetConfig } from '@/types/dashboard';

interface WidgetWrapperProps {
  widget: WidgetConfig;
}

const WidgetWrapper = ({ widget }: WidgetWrapperProps) => {
  const { removeWidget, selectWidget, selectedWidgetId } = useDashboardStore();
  const isSelected = selectedWidgetId === widget.id;
  const isKpi = widget.type === 'kpi-card';
  const description = typeof widget.config?.description === 'string' ? widget.config.description.trim() : '';

  return (
    <div
      className={`
        h-full rounded-lg border bg-card text-card-foreground overflow-hidden
        transition-all duration-200 group
        ${isSelected ? 'ring-2 ring-primary border-primary/50' : 'hover:border-primary/30'}
      `}
      style={{ boxShadow: 'var(--widget-shadow)' }}
      onClick={(e) => {
        e.stopPropagation();
        selectWidget(widget.id);
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <div className="drag-handle cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded hover:bg-muted transition-colors">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold truncate text-foreground">{widget.title}</h3>
            {description ? (
              <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">{description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="p-1 rounded hover:bg-muted transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              selectWidget(widget.id);
            }}
          >
            <Settings className="h-3 w-3 text-muted-foreground" />
          </button>
          <button
            className="p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              removeWidget(widget.id);
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`${isKpi ? 'p-3' : 'p-2'} h-[calc(100%-36px)]`}>
        <WidgetRenderer widget={widget} />
      </div>
    </div>
  );
};

export default WidgetWrapper;
