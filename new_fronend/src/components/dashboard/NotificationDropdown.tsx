import { useState } from 'react';
import { Bell, CheckCheck, Upload, Cpu, AlertTriangle, TrendingUp, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type NotifType = 'upload' | 'ai' | 'warning' | 'insight';

interface Notification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const ICON_MAP: Record<NotifType, React.ElementType> = {
  upload: Upload,
  ai: Cpu,
  warning: AlertTriangle,
  insight: TrendingUp,
};

const COLOR_MAP: Record<NotifType, string> = {
  upload:  'text-emerald-400 bg-emerald-400/10',
  ai:      'text-[#6C63FF] bg-[#6C63FF]/10',
  warning: 'text-amber-400 bg-amber-400/10',
  insight: 'text-sky-400 bg-sky-400/10',
};

const INITIAL: Notification[] = [
  {
    id: '1',
    type: 'upload',
    title: 'Dataset ready',
    message: 'sales_data_Q1.csv has been processed and is ready to explore.',
    time: '2 min ago',
    read: false,
  },
  {
    id: '2',
    type: 'ai',
    title: 'AI insights generated',
    message: '5 new insights discovered in your latest dataset.',
    time: '10 min ago',
    read: false,
  },
  {
    id: '3',
    type: 'insight',
    title: 'Trend detected',
    message: 'Revenue shows a 12% upward trend over the last 30 days.',
    time: '1 hr ago',
    read: true,
  },
  {
    id: '4',
    type: 'warning',
    title: 'Missing values detected',
    message: '3 columns in inventory.xlsx have >20% missing values.',
    time: '3 hr ago',
    read: true,
  },
];

export default function NotificationDropdown() {
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const dismiss = (id: string) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  const markRead = (id: string) =>
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-150"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#6C63FF] text-[9px] font-bold text-white shadow shadow-[#6C63FF]/50">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-80 p-0 bg-card border border-white/[0.08] shadow-xl shadow-black/30 rounded-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-[#6C63FF]" />
            <span className="text-xs font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-[#6C63FF]/15 border border-[#6C63FF]/25 px-1.5 py-0.5 text-[10px] font-medium text-[#6C63FF]">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-[#6C63FF] transition-colors"
            >
              <CheckCheck className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Bell className="h-8 w-8 opacity-20" />
              <p className="text-xs">No notifications</p>
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = ICON_MAP[n.type];
              return (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={cn(
                    'relative flex gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-white/[0.03]',
                    !n.read && 'bg-[#6C63FF]/[0.03]',
                  )}
                >
                  {/* Unread dot */}
                  {!n.read && (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-[#6C63FF]" />
                  )}

                  {/* Icon */}
                  <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg', COLOR_MAP[n.type])}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-medium leading-tight', n.read ? 'text-muted-foreground' : 'text-foreground')}>
                      {n.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                      {n.message}
                    </p>
                    <p className="text-[9px] text-muted-foreground/60 mt-1">{n.time}</p>
                  </div>

                  {/* Dismiss */}
                  <button
                    onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                    className="shrink-0 mt-0.5 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-white/[0.06] px-4 py-2.5 text-center">
            <button
              onClick={() => setNotifications([])}
              className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear all notifications
            </button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
