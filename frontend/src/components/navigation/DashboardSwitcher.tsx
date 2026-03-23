import { useLocation, useNavigate } from "react-router-dom";
import { Warehouse, Truck, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const DASHBOARDS = [
  { path: "/wms_dashboard", label: "WMS Dashboard", icon: Warehouse },
  { path: "/dr_dashboard", label: "Delivery Routing", icon: Truck },
] as const;

export default function DashboardSwitcher() {
  const location = useLocation();
  const navigate = useNavigate();

  const current = DASHBOARDS.find((d) => d.path === location.pathname) ?? DASHBOARDS[0];
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center justify-center rounded-lg bg-blue-800/80 p-2 text-white focus:outline-none focus:ring-2 focus:ring-white/50 active:scale-[0.98]"
              aria-label="Switch dashboard"
            >
              <CurrentIcon className="h-5 w-5 text-blue-200" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="bg-slate-900 text-white border-slate-700">
          <p className="font-medium">{current.label}</p>
          <p className="text-xs text-slate-400">Click to switch dashboard</p>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="min-w-[220px]"
      >
        {DASHBOARDS.map((d) => {
          const Icon = d.icon;
          const isActive = location.pathname === d.path;
          return (
            <DropdownMenuItem
              key={d.path}
              onClick={() => {
                if (!isActive) navigate(d.path);
              }}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Icon className="h-4 w-4 text-slate-500" />
              <span className="flex-1">{d.label}</span>
              {isActive && <Check className="h-4 w-4 text-blue-600" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
