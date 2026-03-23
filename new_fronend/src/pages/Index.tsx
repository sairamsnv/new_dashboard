import { useState } from 'react';
import {
  Save,
  RotateCcw,
  PanelRightOpen,
  PanelRightClose,
  LayoutDashboard,
  Moon,
  Sun,
  Sparkles,
} from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import WidgetToolbar from '@/components/dashboard/WidgetToolbar';
import WidgetInspector from '@/components/dashboard/WidgetInspector';
import ChatWidgetBuilder from '@/components/dashboard/ChatWidgetBuilder';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

const Index = () => {
  const { isDirty, saveDashboard, resetDashboard, selectedWidgetId } = useDashboardStore();
  const [showInspector, setShowInspector] = useState(true);
  const [showChatBuilder, setShowChatBuilder] = useState(false);
  const [isDark, setIsDark] = useState(true);

  const handleSave = async () => {
    await saveDashboard();
    toast.success('Dashboard saved successfully');
  };

  const handleReset = () => {
    resetDashboard();
    toast.info('Dashboard reset to defaults');
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  // Set dark mode on initial load
  useState(() => {
    document.documentElement.classList.add('dark');
  });

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top Bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <LayoutDashboard className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight">Dashboard Builder</h1>
              <p className="text-[10px] text-muted-foreground">Drag, drop & customize</p>
            </div>
          </div>
          {isDirty && (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
              Unsaved changes
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <WidgetToolbar />
          <Button size="sm" variant="outline" className="gap-2" onClick={() => setShowChatBuilder(true)}>
            <Sparkles className="h-4 w-4" />
            Ask AI
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleTheme}>
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowInspector(!showInspector)}
          >
            {showInspector ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!isDirty} className="gap-2">
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Grid Area */}
        <DashboardGrid />

        {/* Inspector Panel */}
        {showInspector && (
          <aside className="w-72 shrink-0 overflow-hidden border-l border-border bg-card">
            <WidgetInspector />
          </aside>
        )}
      </div>

      <ChatWidgetBuilder open={showChatBuilder} onOpenChange={setShowChatBuilder} />
    </div>
  );
};

export default Index;
