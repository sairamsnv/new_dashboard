import { useNavigate } from 'react-router-dom';
import { LogOut, Settings, User, ChevronDown, Shield } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const initials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
      user.username?.[0]?.toUpperCase() ||
      'U'
    : 'U';

  const isAdmin = user?.roles?.some((r) =>
    ['admin', 'super_admin'].includes(r.toLowerCase()),
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 px-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-150"
        >
          {/* Avatar circle */}
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#6C63FF] to-indigo-700 text-[10px] font-bold text-white shadow-sm shadow-[#6C63FF]/40">
            {initials}
          </div>
          <span className="hidden sm:block text-xs font-medium max-w-[80px] truncate">
            {user?.firstName || user?.username || 'User'}
          </span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-56 bg-card border border-white/[0.08] shadow-xl shadow-black/30 rounded-xl"
      >
        {/* User info header */}
        <DropdownMenuLabel className="px-3 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#6C63FF] to-indigo-700 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {user?.firstName && user?.lastName
                  ? `${user.firstName} ${user.lastName}`
                  : user?.username}
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          {isAdmin && (
            <div className="mt-2 flex items-center gap-1 rounded-md bg-[#6C63FF]/10 border border-[#6C63FF]/20 px-2 py-0.5 w-fit">
              <Shield className="h-3 w-3 text-[#6C63FF]" />
              <span className="text-[10px] font-medium text-[#6C63FF]">Admin</span>
            </div>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-white/[0.06]" />

        <DropdownMenuItem
          onClick={() => navigate('/settings')}
          className="gap-2.5 px-3 py-2 text-xs cursor-pointer rounded-lg mx-1 focus:bg-white/5 focus:text-foreground"
        >
          <Settings className="h-3.5 w-3.5 text-muted-foreground" />
          Settings
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => navigate('/settings?tab=profile')}
          className="gap-2.5 px-3 py-2 text-xs cursor-pointer rounded-lg mx-1 focus:bg-white/5 focus:text-foreground"
        >
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          Profile
        </DropdownMenuItem>

        <DropdownMenuSeparator className="bg-white/[0.06]" />

        <DropdownMenuItem
          onClick={handleLogout}
          className="gap-2.5 px-3 py-2 text-xs cursor-pointer rounded-lg mx-1 mb-1 text-red-400 focus:bg-red-500/10 focus:text-red-400"
        >
          <LogOut className="h-3.5 w-3.5" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
