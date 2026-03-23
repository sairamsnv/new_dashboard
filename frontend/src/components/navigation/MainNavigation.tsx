import { useLocation } from 'react-router-dom';
import { Warehouse, Truck, Filter, LayoutDashboard, Brain } from "lucide-react";
import Logo from "@/components/ui/logo";
import DashboardSwitcher from "@/components/navigation/DashboardSwitcher";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type ViewMode = "classic" | "smart";

interface MainNavigationProps {
  selectedTimeframe?: string;
  onTimeframeChange?: (value: string) => void;
  /** When set, shows Classic/Smart View toggle and hides timeframe in Smart View */
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

const MainNavigation = ({
  selectedTimeframe = "Today",
  onTimeframeChange,
  viewMode,
  onViewModeChange,
}: MainNavigationProps) => {
  const location = useLocation();
  const isWMS = location.pathname === '/wms_dashboard';
  const isDR = location.pathname === '/dr_dashboard';

  const dashboardIcon = isWMS ? <Warehouse className="h-6 w-6" /> : isDR ? <Truck className="h-6 w-6" /> : null;
  const dashboardTitle = isWMS ? 'WMS Dashboard' : isDR ? 'Delivery Routing Dashboard' : 'Management System';
  const showViewToggle = viewMode !== undefined && onViewModeChange;

  return (
    <div className="sticky top-0 z-50 bg-blue-900 text-white p-4 shadow-lg">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-4">
          <Logo size="lg" />
          <DashboardSwitcher />
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              {dashboardIcon}
              <h1 className="text-2xl font-bold">{dashboardTitle}</h1>
            </div>
            <p className="text-blue-200 text-sm">Management System</p>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-end">
          {/* Classic / Smart View Toggle - icons only, names on hover */}
          {showViewToggle && (
            <div className="flex items-center bg-blue-800 rounded-lg p-1 gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onViewModeChange("classic")}
                    className={`flex items-center justify-center rounded-md p-2 transition-colors ${
                      viewMode === "classic"
                        ? "bg-white text-blue-900"
                        : "text-blue-200 hover:text-white"
                    }`}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-slate-900 text-white border-slate-700">
                  Classic
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onViewModeChange("smart")}
                    className={`flex items-center justify-center rounded-md p-2 transition-colors ${
                      viewMode === "smart"
                        ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                        : "text-blue-200 hover:text-white"
                    }`}
                  >
                    <Brain className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-slate-900 text-white border-slate-700">
                  Smart View
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Timeframe filter - normal: icon + dropdown (same for DR) */}
          {(!showViewToggle || viewMode === "classic") && (
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-blue-200 opacity-90" />
              <select
                value={selectedTimeframe}
                onChange={(e) => onTimeframeChange?.(e.target.value)}
                className="w-40 bg-blue-800 border border-blue-700 text-white px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Timeframe"
              >
                <option value="Today">Today</option>
                <option value="Week">This Week</option>
                <option value="Month">This Month</option>
                <option value="Year">This Year</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MainNavigation;