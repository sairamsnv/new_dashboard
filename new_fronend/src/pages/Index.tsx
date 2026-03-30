import { useState } from 'react';
import {
  Save,
  RotateCcw,
  PanelRightClose,
  PanelRightOpen,
  LayoutDashboard,
  Moon,
  Sun,
  Sparkles,
  Upload,
  Table2,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import DashboardGrid from '@/components/dashboard/DashboardGrid';
import WidgetToolbar from '@/components/dashboard/WidgetToolbar';
import WidgetInspector from '@/components/dashboard/WidgetInspector';
import ChatWidgetBuilder from '@/components/dashboard/ChatWidgetBuilder';
import UploadSection from '@/components/dashboard/UploadSection';
import DataPreviewTable from '@/components/dashboard/DataPreviewTable';
import InsightsPanel from '@/components/dashboard/InsightsPanel';
import GraphSuggestionsPanel from '@/components/dashboard/GraphSuggestionsPanel';
import NotificationDropdown from '@/components/dashboard/NotificationDropdown';
import UserMenu from '@/components/dashboard/UserMenu';
import DatasetSwitcher from '@/components/dashboard/DatasetSwitcher';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

const TABS = [
  { value: 'upload',    label: 'Upload',    icon: Upload },
  { value: 'preview',   label: 'Preview',   icon: Table2 },
  { value: 'insights',  label: 'Insights',  icon: TrendingUp },
  { value: 'graphs',    label: 'Charts',    icon: BarChart3 },
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
] as const;

type TabValue = typeof TABS[number]['value'];

const Index = () => {
  const { isDirty, saveDashboard, resetDashboard, activeDatasetSlug, setActiveDataset } =
    useDashboardStore();
  const [showInspector, setShowInspector] = useState(true);
  const [showChatBuilder, setShowChatBuilder] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [activeTab, setActiveTab] = useState<TabValue>('upload');

  const handleSave = async () => {
    await saveDashboard();
    toast.success('Dashboard saved');
  };

  const handleReset = () => {
    resetDashboard();
    toast.info('Dashboard cleared');
  };

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle('dark');
  };

  const handleDatasetReady = (slug: string) => {
    setActiveDataset(slug);
    setActiveTab('preview');
    toast.success(`Dataset "${slug}" is ready!`);
  };

  useState(() => {
    document.documentElement.classList.add('dark');
  });

  const isDashboardTab = activeTab === 'dashboard';

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">

      {/* ── Top Bar (glass) ── */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] glass-strong px-5 z-30">
        {/* Left: Logo + dataset badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            {/* Logo icon with purple glow */}
            <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#6C63FF] to-indigo-700 shadow-lg shadow-[#6C63FF]/30">
              <LayoutDashboard className="h-4 w-4 text-white" />
            </div>
            <div className="leading-none">
              <h1 className="text-sm font-bold tracking-tight text-foreground">Analytics Dashboard</h1>
              <p className="text-[10px] text-muted-foreground">Upload · Analyze · Build</p>
            </div>
          </div>

          {activeDatasetSlug && (
            <DatasetSwitcher
              activeSlug={activeDatasetSlug}
              onSelect={(slug) => {
                setActiveDataset(slug);
                setActiveTab('preview');
              }}
            />
          )}

          {isDirty && (
            <span className="rounded-full bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 text-[10px] font-medium text-amber-400">
              Unsaved changes
            </span>
          )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5">
          {isDashboardTab && <WidgetToolbar />}

          <Button
            size="sm"
            variant="outline"
            className="gap-2 h-8 text-xs border-[#6C63FF]/30 text-[#6C63FF] hover:bg-[#6C63FF]/10 hover:text-[#6C63FF] hover:border-[#6C63FF]/50 transition-all duration-200"
            onClick={() => setShowChatBuilder(true)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Ask AI
          </Button>

          <Separator orientation="vertical" className="h-5 mx-0.5 bg-white/8" />

          {/* Notifications */}
          <NotificationDropdown />

          {/* Theme toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-150"
            onClick={toggleTheme}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {isDashboardTab && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
                onClick={handleReset}
                title="Reset dashboard"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
                onClick={() => setShowInspector(!showInspector)}
                title="Toggle inspector"
              >
                {showInspector ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs font-semibold bg-[#6C63FF] hover:bg-[#5b52e8] border-0 shadow-md shadow-[#6C63FF]/25 transition-all duration-200 hover:shadow-[#6C63FF]/40 hover:shadow-lg"
                onClick={handleSave}
                disabled={!isDirty}
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            </>
          )}

          <Separator orientation="vertical" className="h-5 mx-0.5 bg-white/8" />

          {/* User avatar + dropdown (logout / settings) */}
          <UserMenu />
        </div>
      </header>

      {/* ── Tab Navigation ── */}
      <div className="flex shrink-0 items-center gap-0.5 border-b border-white/[0.06] bg-card/40 backdrop-blur-xl px-4 h-11 z-20">
        {TABS.map(({ value, label, icon: Icon }) => {
          const isActive = activeTab === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value as TabValue)}
              className={[
                'relative flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
                isActive
                  ? 'text-[#6C63FF] bg-[#6C63FF]/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
              ].join(' ')}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {value === 'preview' && activeDatasetSlug && (
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/60" />
              )}
              {/* Active underline indicator */}
              {isActive && (
                <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#6C63FF]" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <main className="flex flex-1 min-h-0 overflow-hidden">
        {activeTab === 'upload' && (
          <div className="flex-1 overflow-auto">
            <UploadSection onDatasetReady={handleDatasetReady} activeDatasetSlug={activeDatasetSlug || undefined} />
          </div>
        )}
        {activeTab === 'preview' && (
          <div className="flex-1 overflow-auto">
            <DataPreviewTable datasetSlug={activeDatasetSlug || ''} />
          </div>
        )}
        {activeTab === 'insights' && (
          <div className="flex-1 overflow-auto">
            <InsightsPanel datasetSlug={activeDatasetSlug || ''} />
          </div>
        )}
        {activeTab === 'graphs' && (
          <div className="flex-1 overflow-auto">
            <GraphSuggestionsPanel datasetSlug={activeDatasetSlug || ''} />
          </div>
        )}
        {activeTab === 'dashboard' && (
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <DashboardGrid />
            {showInspector && (
              <aside className="w-72 shrink-0 overflow-hidden border-l border-white/[0.06] glass-strong">
                <WidgetInspector />
              </aside>
            )}
          </div>
        )}
      </main>

      {/* ── AI Chat Drawer ── */}
      <ChatWidgetBuilder
        open={showChatBuilder}
        onOpenChange={setShowChatBuilder}
        activeDatasetSlug={activeDatasetSlug || undefined}
      />
    </div>
  );
};

export default Index;
