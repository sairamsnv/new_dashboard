import { useRef, useState } from 'react';
import { Bot, CheckCircle2, Loader2, Send, Sparkles, Wand2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { buildWidget } from '@/lib/schemaApi';
import { useDashboardStore } from '@/store/dashboardStore';

type ChatWidgetBuilderProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeDatasetSlug?: string;
};

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  widgetAdded?: boolean;
};

const starterPrompts = [
  'Build a revenue bar chart for monthly sales',
  'Create a KPI widget for total orders this week',
  'Show a line chart of sales over time',
  'Make a pie chart of orders by category',
];

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Tell me what widget you want to build. I\'ll generate the chart config and add it directly to your dashboard.',
  },
];

const CHART_TYPE_MAP: Record<string, 'bar-chart' | 'line-chart' | 'pie-chart' | 'table' | 'kpi-card'> = {
  bar_chart: 'bar-chart',
  line_chart: 'line-chart',
  pie_chart: 'pie-chart',
  histogram: 'bar-chart',
  scatter_plot: 'bar-chart',
  kpi_card: 'kpi-card',
  table: 'table',
};

const ChatWidgetBuilder = ({ open, onOpenChange, activeDatasetSlug }: ChatWidgetBuilderProps) => {
  const isMobile = useIsMobile();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { addWidget, updateWidget, widgets } = useDashboardStore();

  const canSend = input.trim().length > 0 && !sending;

  const handleSend = async () => {
    const value = input.trim();
    if (!value || sending) return;

    const userMsgId = crypto.randomUUID();
    const aiMsgId = crypto.randomUUID();

    setMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', content: value },
    ]);
    setInput('');
    setSending(true);

    try {
      const widgetConfig = await buildWidget(value, activeDatasetSlug);

      if (widgetConfig.error) {
        setMessages(prev => [
          ...prev,
          {
            id: aiMsgId,
            role: 'assistant',
            content: `I couldn't generate that widget: ${widgetConfig.error}. Try rephrasing your request.`,
          },
        ]);
        return;
      }

      // Map AI chart type to frontend widget type
      const widgetType = CHART_TYPE_MAP[widgetConfig.chart_type] || 'bar-chart';
      addWidget(widgetType);

      // Wire up config after widget is in store
      setTimeout(() => {
        const currentWidgets = useDashboardStore.getState().widgets;
        const newest = currentWidgets[currentWidgets.length - 1];
        if (newest) {
          updateWidget(newest.id, {
            title: widgetConfig.title || 'New Widget',
            dataSource: activeDatasetSlug ? 'schema-kpi' : newest.dataSource,
            config: {
              ...widgetConfig.config,
              datasetSlug: widgetConfig.dataset || activeDatasetSlug,
              xCol: widgetConfig.query?.x_col,
              yCols: widgetConfig.query?.y_cols,
              aggregation: widgetConfig.query?.aggregation,
            },
          });
        }
      }, 50);

      const chartLabel = widgetConfig.chart_type?.replace('_', ' ') || 'widget';
      setMessages(prev => [
        ...prev,
        {
          id: aiMsgId,
          role: 'assistant',
          content: `Done! I added a **${chartLabel}** titled "${widgetConfig.title}" to your dashboard. You can drag, resize, or configure it in the inspector.`,
          widgetAdded: true,
        },
      ]);

      toast.success(`"${widgetConfig.title}" added to dashboard`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setMessages(prev => [
        ...prev,
        {
          id: aiMsgId,
          role: 'assistant',
          content: `Sorry, I ran into an error: ${msg}. Make sure the AI backend is running (Ollama).`,
        },
      ]);
    } finally {
      setSending(false);
      // Scroll to bottom
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  };

  const panelBody = (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              Widget Builder Chat
            </div>
            <p className="text-sm text-muted-foreground">
              Describe a chart and I'll build it instantly.
              {activeDatasetSlug && (
                <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-primary">
                  {activeDatasetSlug}
                </span>
              )}
            </p>
          </div>
          {isMobile && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap gap-2">
          {starterPrompts.map((prompt) => (
            <Button
              key={prompt}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto whitespace-normal rounded-full px-3 py-2 text-left text-xs"
              onClick={() => setInput(prompt)}
              disabled={sending}
            >
              {prompt}
            </Button>
          ))}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-4 py-4" ref={scrollRef}>
        <div className="space-y-4 pb-2">
          {messages.map((message) => (
            <div
              key={message.id}
              className={message.role === 'assistant' ? 'flex justify-start' : 'flex justify-end'}
            >
              <div
                className={[
                  'max-w-[85%] rounded-2xl border px-4 py-3 text-sm shadow-sm',
                  message.role === 'assistant'
                    ? 'border-border bg-card text-card-foreground'
                    : 'border-primary/20 bg-primary/10 text-foreground',
                ].join(' ')}
              >
                <div className="mb-1 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {message.role === 'assistant' ? <Bot className="h-3.5 w-3.5" /> : <Wand2 className="h-3.5 w-3.5" />}
                  {message.role}
                  {message.widgetAdded && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  )}
                </div>
                <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-border bg-card px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  AI is building your widget…
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <form
        className="border-t border-border p-4"
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
      >
        <div className="space-y-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Example: Create a bar chart showing revenue by month"
            className="min-h-[90px] resize-none"
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Powered by Ollama · Enter to send
            </p>
            <Button type="submit" className="gap-2" disabled={!canSend}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
          </div>
        </div>
      </form>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[88vh] px-0">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Widget Builder Chat</DrawerTitle>
            <DrawerDescription>Request new dashboard widgets using natural language.</DrawerDescription>
          </DrawerHeader>
          {panelBody}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full p-0 sm:max-w-xl">
        <SheetHeader className="sr-only">
          <SheetTitle>Widget Builder Chat</SheetTitle>
          <SheetDescription>Request new dashboard widgets using natural language.</SheetDescription>
        </SheetHeader>
        {panelBody}
      </SheetContent>
    </Sheet>
  );
};

export default ChatWidgetBuilder;
