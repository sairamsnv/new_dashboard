import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Bell,
  Shield,
  Palette,
  Key,
  Mail,
  CheckCircle2,
  Moon,
  Sun,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─────────────────────────────────────────────────────────────────────────────
// Sidebar tabs
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'profile',       label: 'Profile',       icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'appearance',    label: 'Appearance',    icon: Palette },
  { id: 'security',      label: 'Security',      icon: Shield },
] as const;

type TabId = typeof TABS[number]['id'];

// ─────────────────────────────────────────────────────────────────────────────
// Notification toggle row
// ─────────────────────────────────────────────────────────────────────────────
interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

const ToggleRow = ({ label, description, checked, onChange }: ToggleRowProps) => (
  <div className="flex items-center justify-between py-3">
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
        checked ? 'bg-[#6C63FF]' : 'bg-white/10',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-200',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main SettingsPage
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, logout, forgotPassword } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>(
    (searchParams.get('tab') as TabId) || 'profile',
  );
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains('dark'),
  );

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState({
    datasetReady:   true,
    aiInsights:     true,
    weeklyReport:   false,
    securityAlerts: true,
  });

  // Sync tab from URL
  useEffect(() => {
    const t = searchParams.get('tab') as TabId;
    if (t && TABS.some((tab) => tab.id === t)) setActiveTab(t);
  }, [searchParams]);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const toggleTheme = () => {
    const dark = !isDark;
    setIsDark(dark);
    document.documentElement.classList.toggle('dark', dark);
    toast.success(dark ? 'Dark mode enabled' : 'Light mode enabled');
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    const result = await forgotPassword(user.email);
    if (result.success) {
      toast.success('Password reset email sent', {
        description: `Check ${user.email} for instructions.`,
      });
    } else {
      toast.error('Failed to send reset email', { description: result.error });
    }
  };

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
      user.username?.[0]?.toUpperCase() ||
      'U'
    : 'U';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Top bar ── */}
      <header className="flex h-14 items-center justify-between border-b border-white/[0.06] glass-strong px-5 z-30">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#6C63FF] to-indigo-700">
              <LayoutDashboard className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight">Settings</span>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="gap-2 h-8 text-xs text-red-400 hover:text-red-400 hover:bg-red-500/10"
          onClick={handleLogout}
        >
          <LogOut className="h-3.5 w-3.5" />
          Log out
        </Button>
      </header>

      {/* ── Body ── */}
      <div className="mx-auto max-w-4xl px-4 py-8 flex gap-6">

        {/* ── Sidebar ── */}
        <aside className="w-48 shrink-0">
          {/* User card */}
          <div className="mb-4 rounded-xl border border-white/[0.06] bg-card p-3 flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6C63FF] to-indigo-700 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">
                {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : user?.username}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex flex-col gap-0.5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150 text-left',
                  activeTab === id
                    ? 'bg-[#6C63FF]/10 text-[#6C63FF]'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── Content panel ── */}
        <main className="flex-1 rounded-xl border border-white/[0.06] bg-card p-6">

          {/* ─── PROFILE ─── */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold">Profile</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your account information from Keycloak.
                </p>
              </div>
              <Separator className="bg-white/[0.06]" />

              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#6C63FF] to-indigo-700 text-xl font-bold text-white shadow-lg shadow-[#6C63FF]/25">
                  {initials}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : user?.username}
                  </p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {user?.roles
                      ?.filter((r) => !['offline_access', 'uma_authorization'].includes(r))
                      .map((role) => (
                        <span
                          key={role}
                          className="rounded-full bg-[#6C63FF]/10 border border-[#6C63FF]/20 px-2 py-0.5 text-[10px] font-medium text-[#6C63FF]"
                        >
                          {role}
                        </span>
                      ))}
                  </div>
                </div>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* Read-only fields */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'First Name',   value: user?.firstName },
                  { label: 'Last Name',    value: user?.lastName },
                  { label: 'Username',     value: user?.username },
                  { label: 'Email',        value: user?.email },
                ].map(({ label, value }) => (
                  <div key={label} className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <Input
                      value={value || '—'}
                      readOnly
                      className="h-8 text-xs bg-white/[0.02] border-white/[0.08] text-foreground cursor-default"
                    />
                  </div>
                ))}
              </div>

              {/* Email verified badge */}
              <div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                {user?.emailVerified ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span className="text-xs text-emerald-400 font-medium">Email verified</span>
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-xs text-amber-400 font-medium">Email not verified</span>
                    <span className="text-xs text-muted-foreground ml-1">— check your inbox</span>
                  </>
                )}
              </div>

              <p className="text-[10px] text-muted-foreground">
                Profile details are managed by Keycloak. To update your name or email, contact your administrator.
              </p>
            </div>
          )}

          {/* ─── NOTIFICATIONS ─── */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold">Notifications</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Choose what alerts you receive in the dashboard.
                </p>
              </div>
              <Separator className="bg-white/[0.06]" />

              <div className="divide-y divide-white/[0.04]">
                <ToggleRow
                  label="Dataset ready"
                  description="Get notified when an uploaded file finishes processing."
                  checked={notifPrefs.datasetReady}
                  onChange={(v) => setNotifPrefs((p) => ({ ...p, datasetReady: v }))}
                />
                <ToggleRow
                  label="AI insights"
                  description="Alert when new AI-generated insights are available."
                  checked={notifPrefs.aiInsights}
                  onChange={(v) => setNotifPrefs((p) => ({ ...p, aiInsights: v }))}
                />
                <ToggleRow
                  label="Weekly report"
                  description="Receive a weekly summary of your dashboard activity."
                  checked={notifPrefs.weeklyReport}
                  onChange={(v) => setNotifPrefs((p) => ({ ...p, weeklyReport: v }))}
                />
                <ToggleRow
                  label="Security alerts"
                  description="Be notified of new logins and account changes."
                  checked={notifPrefs.securityAlerts}
                  onChange={(v) => setNotifPrefs((p) => ({ ...p, securityAlerts: v }))}
                />
              </div>

              <Button
                size="sm"
                className="h-8 text-xs bg-[#6C63FF] hover:bg-[#5b52e8] border-0"
                onClick={() => toast.success('Notification preferences saved')}
              >
                Save preferences
              </Button>
            </div>
          )}

          {/* ─── APPEARANCE ─── */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold">Appearance</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Customise the look and feel of the dashboard.
                </p>
              </div>
              <Separator className="bg-white/[0.06]" />

              <div>
                <p className="text-sm font-medium mb-3">Theme</p>
                <div className="grid grid-cols-2 gap-3">
                  {/* Dark */}
                  <button
                    onClick={() => { if (!isDark) toggleTheme(); }}
                    className={cn(
                      'flex flex-col items-center gap-2.5 rounded-xl border p-4 transition-all duration-150',
                      isDark
                        ? 'border-[#6C63FF]/50 bg-[#6C63FF]/10'
                        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20',
                    )}
                  >
                    <div className="flex h-12 w-full rounded-lg bg-zinc-900 items-center justify-center">
                      <Moon className="h-5 w-5 text-zinc-400" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">Dark</span>
                      {isDark && <CheckCircle2 className="h-3.5 w-3.5 text-[#6C63FF]" />}
                    </div>
                  </button>

                  {/* Light */}
                  <button
                    onClick={() => { if (isDark) toggleTheme(); }}
                    className={cn(
                      'flex flex-col items-center gap-2.5 rounded-xl border p-4 transition-all duration-150',
                      !isDark
                        ? 'border-[#6C63FF]/50 bg-[#6C63FF]/10'
                        : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20',
                    )}
                  >
                    <div className="flex h-12 w-full rounded-lg bg-gray-100 items-center justify-center">
                      <Sun className="h-5 w-5 text-yellow-500" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium">Light</span>
                      {!isDark && <CheckCircle2 className="h-3.5 w-3.5 text-[#6C63FF]" />}
                    </div>
                  </button>
                </div>
              </div>

              <Separator className="bg-white/[0.06]" />

              {/* Accent colour preview */}
              <div>
                <p className="text-sm font-medium mb-3">Accent colour</p>
                <div className="flex items-center gap-2">
                  {['#6C63FF', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b'].map((color) => (
                    <button
                      key={color}
                      title={color}
                      className={cn(
                        'h-7 w-7 rounded-full border-2 transition-transform hover:scale-110',
                        color === '#6C63FF' ? 'border-white scale-110' : 'border-transparent',
                      )}
                      style={{ background: color }}
                    />
                  ))}
                  <span className="text-[10px] text-muted-foreground ml-1">(coming soon)</span>
                </div>
              </div>
            </div>
          )}

          {/* ─── SECURITY ─── */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold">Security</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Manage your password and session security.
                </p>
              </div>
              <Separator className="bg-white/[0.06]" />

              {/* Auth provider info */}
              <div className="flex items-start gap-3 rounded-xl border border-[#6C63FF]/20 bg-[#6C63FF]/5 p-4">
                <Shield className="h-5 w-5 text-[#6C63FF] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-[#6C63FF]">Secured by Keycloak SSO</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Your identity is managed by Keycloak. Password changes are handled securely via email.
                  </p>
                </div>
              </div>

              {/* Change password */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Key className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Change Password</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  We'll send a secure password-reset link to{' '}
                  <span className="text-foreground font-medium">{user?.email}</span>.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-white/[0.10] hover:bg-white/5"
                  onClick={handlePasswordReset}
                >
                  <Mail className="h-3.5 w-3.5 mr-1.5" />
                  Send reset email
                </Button>
              </div>

              {/* Active session */}
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
                <p className="text-sm font-medium">Active Session</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Current device</span>
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 inline-block" />
                    Active now
                  </span>
                </div>
                <Separator className="bg-white/[0.06]" />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-red-400 hover:text-red-400 hover:bg-red-500/10 gap-1.5"
                  onClick={handleLogout}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign out of this session
                </Button>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
