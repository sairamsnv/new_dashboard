import { useMemo, useState } from 'react';
import { Bot, Send, Sparkles, Wand2, X } from 'lucide-react';
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

type ChatWidgetBuilderProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  content: string;
};

const starterPrompts = [
  'Build a revenue bar chart for monthly sales',
  'Create a KPI widget for total orders this week',
  'Add an insights table for warehouse alerts',
  'Make a prediction table for next month demand',
];

const initialMessages: ChatMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Tell me what widget you want to build, and I can help turn that idea into the next dashboard block.',
  },
];

const ChatWidgetBuilder = ({ open, onOpenChange }: ChatWidgetBuilderProps) => {
  const isMobile = useIsMobile();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);

  const canSend = input.trim().length > 0;

  const assistantReply = useMemo(
    () =>
      'Yes — we can build that widget. Describe the widget type, title, and what data you want to show, then the next step can wire it into the dashboard.',
    [],
  );

  const handleSend = () => {
    const value = input.trim();
    if (!value) return;

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', content: value },
      { id: crypto.randomUUID(), role: 'assistant', content: assistantReply },
    ]);
    setInput('');
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
              Ask for a chart, KPI, prediction table, or insight widget.
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
              className="h-auto whitespace-normal rounded-full px-3 py-2 text-left"
              onClick={() => setInput(prompt)}
            >
              {prompt}
            </Button>
          ))}
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1 px-4 py-4">
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
                </div>
                <p className="leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <form
        className="border-t border-border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          handleSend();
        }}
      >
        <div className="space-y-3">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Example: Create an insights table for low-stock products with severity labels"
            className="min-h-[110px] resize-none"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              This is the first UI step for prompt-to-widget creation.
            </p>
            <Button type="submit" className="gap-2" disabled={!canSend}>
              <Send className="h-4 w-4" />
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
            <DrawerDescription>Open a chat window to request new dashboard widgets.</DrawerDescription>
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
          <SheetDescription>Open a chat window to request new dashboard widgets.</SheetDescription>
        </SheetHeader>
        {panelBody}
      </SheetContent>
    </Sheet>
  );
};

export default ChatWidgetBuilder;
