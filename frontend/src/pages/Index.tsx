
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, BarChart3, Package, Truck, CheckCircle, Clock, TrendingUp, Brain, Construction, AlertCircle, Users, Filter, LayoutDashboard } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import Logo from "@/components/ui/logo";
import DashboardSwitcher from "@/components/navigation/DashboardSwitcher";
import KPICards from "@/components/dashboard/KPICards";
import WarehouseTrend from "@/components/dashboard/WarehouseTrend";
import EmployeePerformance from "@/components/dashboard/EmployeePerformance";
import OrdersOverview from "@/components/dashboard/OrdersOverview";
import SalesAndPurchase from "@/components/dashboard/SalesAndPurchase";
import MonthlyOrderTrends from "@/components/dashboard/MonthlyOrderTrends";
import AnalyticsOverview from "@/components/dashboard/AnalyticsOverview";
import InsightsDashboard from "@/components/dashboard/InsightsDashboard";
import PendingApprovalInventoryAdjustments from "@/components/dashboard/PendingApprovalInventoryAdjustments";
import ReOrderItems from "@/components/dashboard/ReOrderItems";
import ChatBotView from "@/components/dashboard/ChatBotView";

const Index = () => {
  const [selectedYear, setSelectedYear] = useState("2025");
  const [selectedTimeframe, setSelectedTimeframe] = useState("Today");
  const [activeTab, setActiveTab] = useState("overview");
  const [ordersOverviewFilter, setOrdersOverviewFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"classic" | "smart">("classic");

  const isInsightsTab = activeTab === "insights";

  const handleKPIClick = (filter: string) => {
    // Switch to overview tab
    setActiveTab("overview");
    // Set the filter for Orders Overview
    setOrdersOverviewFilter(filter);
    // Scroll to Orders Overview section after a brief delay
    setTimeout(() => {
      const ordersSection = document.getElementById('orders-overview-section');
      if (ordersSection) {
        ordersSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      {/* Header - Fixed on Scroll */}
      <div className="sticky top-0 z-50 bg-blue-900 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <Logo size="lg" />
            <DashboardSwitcher />
            <div className="flex flex-col">
              <h1 className="text-2xl font-bold">Warehouse Management System</h1>
              <p className="text-blue-200 text-sm">Real-time Analytics & Reporting Engine</p>
            </div>
          </div>
          {/* Right Controls - icon-only, names on hover */}
          <div className="flex items-center gap-2 justify-end">
            {/* Classic / Smart View Toggle - icons only */}
            <div className="flex items-center bg-blue-800 rounded-lg p-1 gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setViewMode("classic")}
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
                    onClick={() => setViewMode("smart")}
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

            {/* Timeframe filter - normal: icon + dropdown (same for WMS) */}
            {viewMode === "classic" && (
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-blue-200 opacity-90" />
                <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
                  <SelectTrigger className="w-40 bg-blue-800 border-blue-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Today">Today</SelectItem>
                    <SelectItem value="Yesterday">Yesterday</SelectItem>
                    <SelectItem value="Week">This Week</SelectItem>
                    <SelectItem value="Last Week">Last Week</SelectItem>
                    <SelectItem value="Month">This Month</SelectItem>
                    <SelectItem value="Last Month">Last Month</SelectItem>
                    <SelectItem value="Year">This Year</SelectItem>
                    <SelectItem value="Last Year">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Smart View — Chatbot */}
      {viewMode === "smart" && (
        <div className="max-w-7xl mx-auto p-6">
          <ChatBotView />
        </div>
      )}

      {/* Classic View — Full Dashboard */}
      {viewMode === "classic" && (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* KPI Cards - Hidden on Insights Tab */}
        {!isInsightsTab && <KPICards timeframe={selectedTimeframe} onKPIClick={handleKPIClick} />}

        {/* Analytics Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="sticky top-[88px] z-40 bg-gradient-to-br from-blue-50 to-slate-100 pb-2">
            <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Insights</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Performance</span>
            </TabsTrigger>
            <TabsTrigger value="predictive" className="flex items-center space-x-2">
              <Brain className="h-4 w-4" />
              <span>Predictive</span>
            </TabsTrigger>
          </TabsList>
          </div>

          <TabsContent value="overview" className="space-y-6">
            {/* Main Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Employee Performance */}
              <Card className="shadow-lg border-0 bg-white/90 backdrop-blur">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                  <CardTitle className="flex items-center space-x-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    <span>Warehouse User Summary</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <EmployeePerformance timeframe={selectedTimeframe} />
                </CardContent>
              </Card>

              {/* Warehouse Trend */}
              <Card className="shadow-lg border-0 bg-white/90 backdrop-blur">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center space-x-2">
                      <Calendar className="h-5 w-5 text-blue-600" />
                      <span>Warehouse Trend</span>
                    </CardTitle>
                    <div className="flex items-center space-x-2">
                      <Filter className="h-5 w-5 opacity-70" />
                      <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2024">2024</SelectItem>
                          <SelectItem value="2025">2025</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <WarehouseTrend selectedYear={selectedYear} />
                </CardContent>
              </Card>
            </div>

            {/* Orders and Sales Section */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Orders Overview */}
              <Card id="orders-overview-section" className="shadow-lg border-0 bg-white/90 backdrop-blur">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                  <CardTitle className="flex items-center space-x-2">
                    <Truck className="h-5 w-5 text-blue-600" />
                    <span>Orders Overview</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <OrdersOverview timeframe={selectedTimeframe} initialFilter={ordersOverviewFilter} />
                </CardContent>
              </Card>

              {/* Sales and Purchase */}
              <Card className="shadow-lg border-0 bg-white/90 backdrop-blur">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                  <CardTitle className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <span>Sales and Purchase Order</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <SalesAndPurchase timeframe={selectedTimeframe} />
                </CardContent>
              </Card>
            </div>

            {/* Inventory Management Section */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Pending Approval Inventory Adjustments */}
              <Card className="shadow-lg border-0 bg-white/90 backdrop-blur">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                  <CardTitle className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                    <span>Pending Approval Inventory Adjustments</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <PendingApprovalInventoryAdjustments timeframe={selectedTimeframe} />
                </CardContent>
              </Card>

              {/* Reorder Items */}
              <Card className="shadow-lg border-0 bg-white/90 backdrop-blur">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                  <CardTitle className="flex items-center space-x-2">
                    <Package className="h-5 w-5 text-purple-600" />
                    <span>Reorder Items</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <ReOrderItems timeframe={selectedTimeframe} />
                </CardContent>
              </Card>
            </div>

            {/* Monthly Trends - Moved to Last Position */}
            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <span>Monthly Order Trends</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <MonthlyOrderTrends timeframe={selectedTimeframe} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <span>Performance Analytics</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Construction className="h-24 w-24 text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">Under Process</h3>
                  <p className="text-gray-500">Performance analytics features are currently being developed.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="predictive" className="space-y-6">
            <Card className="shadow-lg border-0 bg-white/90 backdrop-blur">
              <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
                <CardTitle className="flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                  <span>Predictive Analytics & Forecasting</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Construction className="h-24 w-24 text-gray-400 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600 mb-2">Under Process</h3>
                  <p className="text-gray-500">Predictive analytics features are currently being developed.</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <InsightsDashboard timeframe={selectedTimeframe} />
          </TabsContent>
        </Tabs>
      </div>
      )}
    </div>
  );
};

export default Index; 
