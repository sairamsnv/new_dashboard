import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TrendingUp,
  TrendingDown,
  Package,
  Users,
  Target,
  CheckCircle,
  AlertCircle,
  Info,
  ArrowUp,
  ArrowDown,
  Minus,
  Brain,
  Sparkles,
} from "lucide-react";
import axios from "axios";
import { getApiUrl } from "@/lib/api";

interface InsightsDashboardProps {
  timeframe?: string;
}

interface StaffMember {
  name: string;
  pickerCount: number;
  pickerPrevious: number;
  pickerChange: string;
  pickerPercentage: number | null;
  packerCount: number;
  packerPrevious: number;
  packerChange: string;
  packerPercentage: number | null;
  receivedCount: number;
  receivedPrevious: number;
  receivedChange: string;
  receivedPercentage: number | null;
  totalCount: number;
  totalPrevious: number;
  totalChange: string;
  totalPercentage: number | null;
}

interface Recommendation {
  type: 'warning' | 'info' | 'success';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  impact: string;
}

interface InsightsData {
  period: string;
  dateRange: {
    current: { start: string; end: string };
    previous: { start: string; end: string };
  };
  totalTransaction?: {
    total: { count: number; change: string };
    purchaseFulfilments: { count: number; change: string };
    salesFulfilments: { count: number; change: string };
  };
  orderMetrics: {
    total: { count: number; change: string };
    purchaseOrders: { count: number; change: string };
    salesOrders: { count: number; change: string };
  };
  topPerformer: {
    name: string;
    count: number;
    change: string;
  };
  inventoryOperations?: {
    binTransfer: { count: number; change: string };
    inventoryAdjustments: { count: number; change: string };
    inventoryCounts: { count: number; change: string };
  };
  topMovingItems?: {
    topSellingItem: { name: string; quantity: number };
    topReceivingItem: { name: string; quantity: number };
  };
  topCustomer: {
    name: string;
    count: number;
    change: string;
  };
  topVendor: {
    name: string;
    count: number;
    change: string;
  };
  completionRates: {
    salesOrders: {
      rate: number;
      completed: number;
      total: number;
      change: string;
    };
    purchaseOrders: {
      rate: number;
      completed: number;
      total: number;
      change: string;
    };
  };
  staffInvolvement: StaffMember[];
  recommendations: Recommendation[];
  summary: string;
}

const InsightsDashboard = ({ timeframe = "Month" }: InsightsDashboardProps) => {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Convert global filter timeframe to Insights API period format
  const getInsightsPeriod = (timeframe: string): string => {
    const mapping: { [key: string]: string } = {
      "Today": "today",
      "Yesterday": "yesterday",
      "Week": "this week",
      "Last Week": "last week",
      "Month": "this month",
      "Last Month": "last month",
      "Year": "this year",
      "Last Year": "last year"
    };
    return mapping[timeframe] || "this month";
  };

  const selectedPeriod = getInsightsPeriod(timeframe);

  useEffect(() => {
    fetchInsights();
  }, [selectedPeriod]);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const url = getApiUrl(`api/insights/?period=${selectedPeriod}`);
      const response = await axios.get(url);
      setData(response.data);
    } catch (error) {
      console.error("Failed to fetch insights:", error);
    } finally {
      setLoading(false);
    }
  };

  const getChangeIcon = (change: string) => {
    if (change.includes("increased")) {
      return <ArrowUp className="h-3 w-3 text-green-600" />;
    } else if (change.includes("decreased")) {
      return <ArrowDown className="h-3 w-3 text-red-600" />;
    }
    return <Minus className="h-3 w-3 text-gray-400" />;
  };

  const getChangeColor = (change: string) => {
    if (change.includes("increased")) {
      return "text-green-600";
    } else if (change.includes("decreased")) {
      return "text-red-600";
    }
    return "text-gray-600";
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      case "medium":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "low":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getRecommendationIcon = (type: string) => {
    switch (type) {
      case "warning":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case "info":
        return <Info className="h-5 w-5 text-blue-600" />;
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      default:
        return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  const filteredStaff = data?.staffInvolvement.filter((staff) =>
    staff.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const formatCountWithChange = (
    current: number,
    previous: number,
    percentage: number | null,
    isTotal: boolean = false
  ) => {
    const currentFormatted = current.toLocaleString();
    const previousFormatted = previous.toLocaleString();
    
    // Calculate percentage if not provided
    const pct = percentage !== null ? percentage : (previous === 0 ? null : ((current - previous) / previous) * 100);
    
    // Determine change indicator
    let changeIndicator: React.ReactNode = null;
    if (previous === 0 && current === 0) {
      changeIndicator = <span className="text-gray-500">—</span>;
    } else if (previous === 0 && current > 0) {
      changeIndicator = <span className="text-green-600">new</span>;
    } else if (pct === 0 || pct === null) {
      changeIndicator = <span className="text-gray-500">—</span>;
    } else {
      const isIncrease = pct > 0;
      const pctFormatted = `${isIncrease ? '+' : ''}${pct.toFixed(0)}%`;
      const colorClass = isIncrease ? 'text-green-600' : 'text-red-600';
      const ArrowIcon = isIncrease ? ArrowUp : ArrowDown;
      changeIndicator = (
        <span className={`inline-flex items-center gap-1 ${colorClass}`}>
          <ArrowIcon className="h-3 w-3" />
          {pctFormatted}
        </span>
      );
    }
    
    // Get period labels based on timeframe - show the same timeframe name for comparison
    const periodLabel = timeframe === "Today" ? "Yesterday" : 
                       timeframe === "Yesterday" ? "Yesterday" :
                       timeframe === "Week" ? "Week" :
                       timeframe === "Last Week" ? "Last Week" :
                       timeframe === "Month" ? "Month" :
                       timeframe === "Last Month" ? "Last Month" :
                       timeframe === "Year" ? "Year" :
                       timeframe === "Last Year" ? "Last Year" : "Previous Period";
    
    const countDisplay = (
      <span className={isTotal ? "font-semibold text-blue-600 cursor-help" : "text-gray-700 cursor-help"}>
        {currentFormatted}/{previousFormatted}{' '}
        {changeIndicator}
      </span>
    );
    
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {countDisplay}
        </TooltipTrigger>
        <TooltipContent className="bg-gray-900 text-white border-gray-700">
          <div className="space-y-1">
            <div className="font-semibold">Count Details</div>
            <div className="text-sm">
              <div>Present: <span className="font-semibold text-blue-300">{currentFormatted}</span></div>
              <div>Previous ({periodLabel}): <span className="font-semibold text-gray-300">{previousFormatted}</span></div>
              {pct !== null && pct !== 0 && (
                <div className="mt-1 pt-1 border-t border-gray-700">
                  Change: <span className={`font-semibold ${pct > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-16 text-gray-500">
        No insights data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Performance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Orders */}
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Orders</p>
                <p className="text-3xl font-bold text-gray-900">
                  {data.totalTransaction?.total.count.toLocaleString() || data.orderMetrics.total.count.toLocaleString()}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  {getChangeIcon(data.totalTransaction?.total.change || data.orderMetrics.total.change)}
                  <span className={`text-xs font-medium ${getChangeColor(data.totalTransaction?.total.change || data.orderMetrics.total.change)}`}>
                    {data.totalTransaction?.total.change || data.orderMetrics.total.change}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-blue-200 rounded-lg">
                <Package className="h-6 w-6 text-blue-700" />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-blue-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Item Receipts</span>
                <span className="font-semibold text-gray-900">
                  {data.totalTransaction?.purchaseFulfilments.count.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-600">Item Fulfillments</span>
                <span className="font-semibold text-gray-900">
                  {data.totalTransaction?.salesFulfilments.count.toLocaleString() || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Performer */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Top Performer</p>
                <p className="text-xl font-bold text-gray-900 truncate max-w-[140px]">
                  {data.topPerformer.name}
                </p>
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  <span className={`text-xs font-medium ${getChangeColor(data.topPerformer.change)} flex items-center gap-1`}>
                    {(() => {
                      const changeText = data.topPerformer.change || '';
                      const arrowIcon = getChangeIcon(changeText);
                      // Insert arrow after "by" in the change text
                      if (changeText.includes(' by ')) {
                        const parts = changeText.split(' by ');
                        return (
                          <>
                            <span>{data.topPerformer.count} actions {parts[0]} by</span>
                            <span className="inline-flex items-center">{arrowIcon}</span>
                            <span>{parts[1]}</span>
                          </>
                        );
                      }
                      // Fallback if format doesn't match
                      return (
                        <>
                          <span className="inline-flex items-center">{arrowIcon}</span>
                          <span>{data.topPerformer.count} actions {changeText}</span>
                        </>
                      );
                    })()}
                  </span>
                </div>
              </div>
              <div className="p-3 bg-purple-200 rounded-lg">
                <Target className="h-6 w-6 text-purple-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inventory Operations */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Inventory Operations</p>
              </div>
              <div className="p-3 bg-green-200 rounded-lg">
                <Package className="h-6 w-6 text-green-700" />
              </div>
            </div>
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Bin Transfer</span>
                <span className="font-semibold text-gray-900">
                  {data.inventoryOperations?.binTransfer.count.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Inventory Adjustments</span>
                <span className="font-semibold text-gray-900">
                  {data.inventoryOperations?.inventoryAdjustments.count.toLocaleString() || 0}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Inventory Counts</span>
                <span className="font-semibold text-gray-900">
                  {data.inventoryOperations?.inventoryCounts.count.toLocaleString() || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Moving Items */}
        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Top Moving Items</p>
              </div>
              <div className="p-3 bg-orange-200 rounded-lg">
                <Package className="h-6 w-6 text-orange-700" />
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">TOP SELLING ITEM</p>
                <p className="text-base font-bold text-gray-900 truncate max-w-[180px]">
                  {data.topMovingItems?.topSellingItem.name || '0'}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Qty: {data.topMovingItems?.topSellingItem.quantity.toLocaleString() || 0}
                </p>
              </div>
              <div className="pt-2 border-t border-orange-200">
                <p className="text-xs font-medium text-gray-500 mb-1">TOP RECEIVING ITEM</p>
                <p className="text-base font-bold text-gray-900 truncate max-w-[180px]">
                  {data.topMovingItems?.topReceivingItem.name || '0'}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  Qty: {data.topMovingItems?.topReceivingItem.quantity.toLocaleString() || 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Staff Involvement */}
      <Card className="shadow-lg border-0 bg-white/90 backdrop-blur">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
          <div className="flex items-center justify-between w-full">
            <CardTitle className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span>User Involvement</span>
            </CardTitle>
            <div className="relative">
              <input
                type="text"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
              />
              <div className="absolute left-2 top-1/2 transform -translate-y-1/2">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <TooltipProvider>
              <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="font-semibold">Name</TableHead>
                  <TableHead className="font-semibold">Picked</TableHead>
                  <TableHead className="font-semibold">Packed</TableHead>
                  <TableHead className="font-semibold">Received </TableHead>
                  <TableHead className="font-semibold">Total </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStaff.length > 0 ? (
                  filteredStaff.map((staff, index) => (
                    <TableRow key={index} className="hover:bg-gray-50">
                      <TableCell className="font-medium">{staff.name}</TableCell>
                      <TableCell>
                        {formatCountWithChange(
                          staff.pickerCount,
                          staff.pickerPrevious || 0,
                          staff.pickerPercentage,
                          false
                        )}
                      </TableCell>
                      <TableCell>
                        {formatCountWithChange(
                          staff.packerCount,
                          staff.packerPrevious || 0,
                          staff.packerPercentage,
                          false
                        )}
                      </TableCell>
                      <TableCell>
                        {formatCountWithChange(
                          staff.receivedCount,
                          staff.receivedPrevious || 0,
                          staff.receivedPercentage,
                          false
                        )}
                      </TableCell>
                      <TableCell>
                        {formatCountWithChange(
                          staff.totalCount,
                          staff.totalPrevious || 0,
                          staff.totalPercentage,
                          true
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      No staff data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Prescriptive Recommendations */}
      {data.recommendations.length > 0 && (
        <Card className="shadow-lg border-0 bg-white/90 backdrop-blur">
          <CardHeader className="bg-gradient-to-r from-slate-50 to-slate-100 border-b">
            <CardTitle className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <span>Prescriptive Recommendations</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {data.recommendations.map((rec, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${
                  rec.type === "warning"
                    ? "bg-red-50 border-red-200"
                    : rec.type === "info"
                    ? "bg-blue-50 border-blue-200"
                    : "bg-green-50 border-green-200"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className={`p-2 rounded-lg ${
                      rec.type === "warning"
                        ? "bg-red-100"
                        : rec.type === "info"
                        ? "bg-blue-100"
                        : "bg-green-100"
                    }`}>
                      {getRecommendationIcon(rec.type)}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{rec.title}</h3>
                      <p className="text-sm text-gray-700 mb-2">{rec.message}</p>
                      <p className="text-sm font-medium text-purple-600">{rec.impact}</p>
                    </div>
                  </div>
                  <Badge className={getPriorityBadgeColor(rec.priority)}>
                    {rec.priority.toUpperCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card className="shadow-lg border-0 bg-gradient-to-r from-purple-50 to-blue-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Action Summary</h3>
              <div className="space-y-2">
                {/* Parse and display summary with arrows */}
                {data.summary.split(':').length > 1 ? (
                  <>
                    <p className="text-gray-600 text-sm mb-2">
                      {data.summary.split(':')[0]}:
                    </p>
                    <div className="space-y-1">
                      {data.summary.split(':')[1].split(',').map((item, index) => {
                        const trimmed = item.trim();
                        
                        // Parse format: "Item Receipts 3 (increased by 50.0%)" or "Item Fulfillments 13 (decreased by 26.8%)"
                        // Also handles: "Item Receipts 3 (increased by 2.5x)" or "Item Receipts 3 (new)" or "Item Receipts 3 (no change)"
                        const match = trimmed.match(/(Item Receipts|Item Fulfillments)\s+(\d+)\s+\((.+?)\)/);
                        
                        if (match) {
                          const [, label, count, changeText] = match;
                          const isIncreased = changeText.toLowerCase().includes('increased');
                          const isDecreased = changeText.toLowerCase().includes('decreased');
                          const isNew = changeText.toLowerCase() === 'new';
                          const isNoChange = changeText.toLowerCase() === 'no change';
                          
                          // Extract percentage or multiplier from change text
                          const pctMatch = changeText.match(/([\d.]+)%/);
                          const multiplierMatch = changeText.match(/([\d.]+)x/);
                          
                          let changeDisplay = '';
                          if (multiplierMatch) {
                            changeDisplay = `${multiplierMatch[1]}x`;
                          } else if (pctMatch) {
                            const percentage = pctMatch[1];
                            const sign = isIncreased ? '+' : isDecreased ? '-' : '';
                            changeDisplay = `${sign}${percentage}%`;
                          } else if (isNew) {
                            changeDisplay = 'new';
                          } else if (isNoChange) {
                            changeDisplay = '—';
                          }
                          
                          return (
                            <div key={index} className="flex items-center gap-2">
                              {isIncreased && <ArrowUp className="h-4 w-4 text-green-600" />}
                              {isDecreased && <ArrowDown className="h-4 w-4 text-red-600" />}
                              {(isNew || isNoChange || (!isIncreased && !isDecreased)) && <Minus className="h-4 w-4 text-gray-400" />}
                              <span className={`${
                                isIncreased ? 'text-green-700' : isDecreased ? 'text-red-700' : 'text-gray-700'
                              }`}>
                                <span className="font-semibold">{label}:</span> {count}
                                {changeDisplay && (
                                  <span className={`ml-2 ${
                                    isIncreased ? 'text-green-600' : 
                                    isDecreased ? 'text-red-600' : 
                                    isNew ? 'text-blue-600' : 
                                    'text-gray-600'
                                  }`}>
                                    {changeDisplay}
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        }
                        
                        // Fallback for old format
                        const isIncreased = trimmed.toLowerCase().includes('increased');
                        const isDecreased = trimmed.toLowerCase().includes('decreased');
                        
                        return (
                          <div key={index} className="flex items-center gap-2">
                            {isIncreased && <ArrowUp className="h-4 w-4 text-green-600" />}
                            {isDecreased && <ArrowDown className="h-4 w-4 text-red-600" />}
                            {!isIncreased && !isDecreased && <Minus className="h-4 w-4 text-gray-400" />}
                            <span className={`text-gray-700 ${
                              isIncreased ? 'text-green-700' : isDecreased ? 'text-red-700' : ''
                            }`}>
                              {trimmed}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="text-gray-700">{data.summary}</p>
                )}
              </div>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg ml-4">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default InsightsDashboard;

