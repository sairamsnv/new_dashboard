import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, RotateCcw, Users, MapPin, ShoppingCart, TrendingUp, TrendingDown, ArrowUpRight, Activity } from "lucide-react";
import { useState, useEffect } from "react";
import axios from "axios";
import { getApiUrl } from "@/lib/api";

interface DRKPI {
  title: string;
  value: number | string;
  icon: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

interface DRKPICardsProps {
  timeframe?: string;
  onKPIClick?: (title: string) => void;
}

const DRKPICards = ({ timeframe = "Today", onKPIClick }: DRKPICardsProps) => {
  const [kpis, setKpis] = useState<DRKPI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = getApiUrl(`api/dr/kpis/?timeframe=${timeframe.toLowerCase()}`);
    
    axios
      .get(url)
      .then((res) => {
        setKpis(res.data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch DR KPIs!", err);
        setKpis([]);
        setLoading(false);
      });
  }, [timeframe]);

  const getIcon = (iconName: string) => {
    const iconProps = { className: "h-5 w-5" };
    
    switch (iconName) {
      case "Package":
        return <Package {...iconProps} />;
      case "RotateCcw":
        return <RotateCcw {...iconProps} />;
      case "Users":
        return <Users {...iconProps} />;
      case "MapPin":
        return <MapPin {...iconProps} />;
      case "ShoppingCart":
        return <ShoppingCart {...iconProps} />;
      default:
        return <Package {...iconProps} />;
    }
  };

  const handleKPIClick = (title: string) => {
    // Don't make "Top Delivered Location" clickable
    if (title === "Top Delivered Location") {
      return;
    }
    
    if (onKPIClick) {
      onKPIClick(title);
    }
  };

  const getCardConfig = (title: string) => {
    switch (title) {
      case "Total Assigned Orders":
        return {
          gradient: "from-blue-600 via-blue-700 to-blue-800",
          iconBg: "bg-white/30 backdrop-blur-md",
          iconColor: "text-white",
          valueColor: "text-white",
          accent: "from-blue-400 to-blue-600",
          glow: "shadow-blue-500/40",
          border: "border-white/20",
          shadow: "shadow-2xl shadow-blue-500/20",
          glass: "bg-gradient-to-br from-white/10 to-transparent",
          innerGlow: "shadow-inner shadow-white/20"
        };
      case "Total Return Orders":
        return {
          gradient: "from-red-600 via-red-700 to-red-800",
          iconBg: "bg-white/30 backdrop-blur-md",
          iconColor: "text-white",
          valueColor: "text-white",
          accent: "from-red-400 to-red-600",
          glow: "shadow-red-500/40",
          border: "border-white/20",
          shadow: "shadow-2xl shadow-red-500/20",
          glass: "bg-gradient-to-br from-white/10 to-transparent",
          innerGlow: "shadow-inner shadow-white/20"
        };
      case "Sales Orders Ship To Not Fulfilled":
        return {
          gradient: "from-orange-600 via-orange-700 to-orange-800",
          iconBg: "bg-white/30 backdrop-blur-md",
          iconColor: "text-white",
          valueColor: "text-white",
          accent: "from-orange-400 to-orange-600",
          glow: "shadow-orange-500/40",
          border: "border-white/20",
          shadow: "shadow-2xl shadow-orange-500/20",
          glass: "bg-gradient-to-br from-white/10 to-transparent",
          innerGlow: "shadow-inner shadow-white/20"
        };
      case "Active Drivers":
        return {
          gradient: "from-emerald-600 via-emerald-700 to-emerald-800",
          iconBg: "bg-white/30 backdrop-blur-md",
          iconColor: "text-white",
          valueColor: "text-white",
          accent: "from-emerald-400 to-emerald-600",
          glow: "shadow-emerald-500/40",
          border: "border-white/20",
          shadow: "shadow-2xl shadow-emerald-500/20",
          glass: "bg-gradient-to-br from-white/10 to-transparent",
          innerGlow: "shadow-inner shadow-white/20"
        };
      case "Top Delivered Location":
        return {
          gradient: "from-purple-600 via-purple-700 to-purple-800",
          iconBg: "bg-white/30 backdrop-blur-md",
          iconColor: "text-white",
          valueColor: "text-white",
          accent: "from-purple-400 to-purple-600",
          glow: "shadow-purple-500/40",
          border: "border-white/20",
          shadow: "shadow-2xl shadow-purple-500/20",
          glass: "bg-gradient-to-br from-white/10 to-transparent",
          innerGlow: "shadow-inner shadow-white/20"
        };
      default:
        return {
          gradient: "from-gray-600 via-gray-700 to-gray-800",
          iconBg: "bg-white/30 backdrop-blur-md",
          iconColor: "text-white",
          valueColor: "text-white",
          accent: "from-gray-400 to-gray-600",
          glow: "shadow-gray-500/40",
          border: "border-white/20",
          shadow: "shadow-2xl shadow-gray-500/20",
          glass: "bg-gradient-to-br from-white/10 to-transparent",
          innerGlow: "shadow-inner shadow-white/20"
        };
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-gray-400 to-gray-600 rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
            <div className="relative bg-white/90 backdrop-blur-xl rounded-3xl p-4 h-28 shadow-2xl border border-white/20">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-3 bg-gray-200/60 animate-pulse rounded-lg w-24 backdrop-blur-sm"></div>
                  <div className="h-8 w-8 bg-gray-200/60 animate-pulse rounded-lg backdrop-blur-sm"></div>
                </div>
                <div className="h-6 bg-gray-200/60 animate-pulse rounded-lg backdrop-blur-sm"></div>
                <div className="h-3 bg-gray-200/60 animate-pulse rounded w-20 backdrop-blur-sm"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
      {kpis.map((kpi, index) => {
        const config = getCardConfig(kpi.title);
        return (
          <div key={index} className="relative group">
            {/* Glow effect - only for clickable cards */}
            {kpi.title !== "Top Delivered Location" && (
              <div className={`absolute -inset-0.5 bg-gradient-to-r ${config.accent} rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 ${config.glow} shadow-xl`}></div>
            )}
            
            {/* Main card */}
            <div 
              className={`relative bg-white/90 backdrop-blur-xl rounded-3xl overflow-hidden ${config.shadow} border ${config.border} transition-all duration-700 ${
                kpi.title === "Top Delivered Location"
                  ? "cursor-default hover:shadow-3xl hover:scale-[1.02]" 
                  : "group-hover:shadow-3xl group-hover:scale-105 cursor-pointer"
              }`}
              onClick={() => handleKPIClick(kpi.title)}
            >
              {/* Gradient background with glass effect */}
              <div className={`bg-gradient-to-br ${config.gradient} p-4 relative overflow-hidden`}>
                {/* Glass overlay */}
                <div className={`absolute inset-0 ${config.glass} ${config.innerGlow}`}></div>
                
                {/* Animated glossy elements */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-white/20 rounded-full -translate-y-12 translate-x-12 animate-pulse blur-sm"></div>
                <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full translate-y-10 -translate-x-10 blur-sm"></div>
                <div className="absolute top-1/2 left-1/2 w-32 h-32 bg-white/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
                
                {/* Shimmer effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                
                {/* Content */}
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white/95 text-xs font-medium uppercase tracking-wide drop-shadow-md">
                      {kpi.title}
                    </h3>
                    <div className={`p-2 rounded-lg ${config.iconBg} backdrop-blur-lg border border-white/30 shadow-md`}>
                      <div className={`${config.iconColor} drop-shadow-sm`}>
                        {getIcon(kpi.icon)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className={`text-2xl font-bold ${config.valueColor} tracking-tight drop-shadow-lg`}>
                      {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
                    </div>
                    
                    {kpi.trend && (
                      <div className="flex items-center space-x-3">
                        <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${kpi.trend.isPositive ? 'bg-emerald-500/40' : 'bg-red-500/40'} backdrop-blur-md border border-white/30 shadow-lg`}>
                          {kpi.trend.isPositive ? (
                            <TrendingUp className="h-4 w-4 text-emerald-100" />
                          ) : (
                            <TrendingDown className="h-4 w-4 text-red-100" />
                          )}
                          <span className={`text-sm font-bold ${kpi.trend.isPositive ? 'text-emerald-50' : 'text-red-50'}`}>
                            {kpi.trend.value}%
                          </span>
                        </div>
                        <span className="text-white/80 text-sm font-medium drop-shadow-sm">vs last period</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DRKPICards;
