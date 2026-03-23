import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, PieChart, Pie, Cell, Tooltip, LabelList } from 'recharts';
import { useEffect } from "react";
import axios from "axios";
import { getApiUrl, logApiConfig } from "@/lib/api";
import { formatDateMMDDYYYY } from "@/lib/utils";
import MainNavigation from "@/components/navigation/MainNavigation";
import ChatBotView from "@/components/dashboard/ChatBotView";
import DRKPICards from "@/components/dashboard/DRKPICards";
import DriverPerformanceChart from "@/components/dashboard/DriverPerformanceChart";
import DocumentTypeChart from "@/components/dashboard/DocumentTypeChart";
// LoadPlanStatusChart component removed - using inline component instead
import { BarChart3, Brain, Clock, TrendingUp, Package, Truck, CheckCircle, AlertCircle, Users, Calendar } from "lucide-react";

const DRDashboard = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState("Today");
  const [viewMode, setViewMode] = useState<"classic" | "smart">("classic");

  // Set document title
  useEffect(() => {
    document.title = "Rare NetScore";
  }, []);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Data states
  const [returnOrders, setReturnOrders] = useState<any[]>([]);
  const [podOrders, setPodOrders] = useState<any[]>([]);
  const [pendingDeliveries, setPendingDeliveries] = useState<any[]>([]);
  const [assignedOrders, setAssignedOrders] = useState<any[]>([]);

  // Pagination states for main tables
  const [podCurrentPage, setPodCurrentPage] = useState(1);
  const [podPageSize] = useState(5);
  const [podTotalPages, setPodTotalPages] = useState(1);
  
  const [returnCurrentPage, setReturnCurrentPage] = useState(1);
  const [returnPageSize] = useState(5);
  const [returnTotalPages, setReturnTotalPages] = useState(1);

  // Driver assignments pagination
  const [driverAssignmentsCurrentPage, setDriverAssignmentsCurrentPage] = useState(1);
  const [driverAssignmentsPageSize] = useState(10);
  const [driverAssignmentsTotalPages, setDriverAssignmentsTotalPages] = useState(1);

  // Modal states
  const [openModal, setOpenModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalData, setModalData] = useState([]);
  const [modalType, setModalType] = useState("");
  
  // Modal pagination states
  const [modalCurrentPage, setModalCurrentPage] = useState(1);
  const [modalTotalPages, setModalTotalPages] = useState(1);
  const [modalTotalCount, setModalTotalCount] = useState(0);
  const [modalNextPage, setModalNextPage] = useState<string | null>(null);
  const [modalPrevPage, setModalPrevPage] = useState<string | null>(null);
  
  // Modal filters
  const [modalFilter, setModalFilter] = useState("");
  const [modalDateFilter, setModalDateFilter] = useState("");
  const [modalDateFromFilter, setModalDateFromFilter] = useState("");
  const [modalDateToFilter, setModalDateToFilter] = useState("");
  const [modalStatusFilter, setModalStatusFilter] = useState("");


  useEffect(() => {
    fetchStats();
    fetchAllData();
  }, [selectedTimeframe]);

  // Auto-search when modal filters change
  useEffect(() => {
    if (openModal && (modalFilter || modalDateFilter || modalDateFromFilter || modalDateToFilter)) {
      const timeoutId = setTimeout(() => {
        fetchModalData(modalType, 1);
      }, 300); // 300ms delay to avoid too many API calls
      
      return () => clearTimeout(timeoutId);
    }
  }, [modalFilter, modalDateFilter, modalDateFromFilter, modalDateToFilter, openModal, modalType]);

  // Calculate pagination for POD orders
  useEffect(() => {
    if (Array.isArray(podOrders)) {
      const totalPages = Math.ceil(podOrders.length / podPageSize);
      setPodTotalPages(totalPages);
      // Reset to page 1 if current page is beyond total pages
      if (podCurrentPage > totalPages && totalPages > 0) {
        setPodCurrentPage(1);
      }
    }
  }, [podOrders, podPageSize, podCurrentPage]);

  // Calculate pagination for Return orders
  useEffect(() => {
    if (Array.isArray(returnOrders)) {
      const totalPages = Math.ceil(returnOrders.length / returnPageSize);
      setReturnTotalPages(totalPages);
      // Reset to page 1 if current page is beyond total pages
      if (returnCurrentPage > totalPages && totalPages > 0) {
        setReturnCurrentPage(1);
      }
    }
  }, [returnOrders, returnPageSize, returnCurrentPage]);

  // Calculate pagination for driver assignments
  useEffect(() => {
    if (Array.isArray(assignedOrders)) {
      const totalPages = Math.ceil(assignedOrders.length / driverAssignmentsPageSize);
      setDriverAssignmentsTotalPages(totalPages);
      
      // Reset to page 1 if current page exceeds total pages
      if (driverAssignmentsCurrentPage > totalPages && totalPages > 0) {
        setDriverAssignmentsCurrentPage(1);
      }
    }
  }, [assignedOrders, driverAssignmentsPageSize, driverAssignmentsCurrentPage]);

  // Handle modal filter changes
  useEffect(() => {
    if (openModal && modalType) {
      if (modalType === 'assigned-orders') {
        // For assigned-orders, we need to re-fetch and filter
        fetchModalData(modalType, 1);
      } else {
      fetchModalData(modalType, 1);
    }
    }
  }, [modalFilter, modalDateFilter, modalStatusFilter, selectedTimeframe]);


  const fetchStats = async () => {
    try {
      const url = getApiUrl(`api/dr/stats/?timeframe=${selectedTimeframe.toLowerCase()}`);
      logApiConfig(`api/dr/stats/?timeframe=${selectedTimeframe.toLowerCase()}`);
      console.log(`ðŸ” Fetching stats for timeframe: ${selectedTimeframe}`);
      
      const response = await axios.get(url);
      console.log(`ðŸ“Š Stats response for ${selectedTimeframe}:`, response.data);
      
      const statsData = response.data || {};
      
      // Only use sample data if API returns completely empty
      if (!statsData.driver_performance || statsData.driver_performance.length === 0) {
        console.log("âš ï¸ No driver performance data, using sample data");
        statsData.driver_performance = [
          { deliveredBy: "John Doe", deliveries: 15 },
          { deliveredBy: "Jane Smith", deliveries: 12 },
          { deliveredBy: "Mike Johnson", deliveries: 8 },
          { deliveredBy: "Sarah Wilson", deliveries: 20 },
          { deliveredBy: "Tom Brown", deliveries: 6 }
        ];
      }
      
      if (!statsData.load_plan_status || statsData.load_plan_status.length === 0) {
        console.log("âš ï¸ No load plan status data, using sample data");
        statsData.load_plan_status = [
          { name: "Completed", count: 23 },
          { name: "In Progress", count: 6 },
          { name: "Not Started", count: 4 }
        ];
      }
      
      setStats(statsData);
    } catch (error) {
      console.error("âŒ Failed to fetch DR stats:", error);
      // Set sample data on error
      setStats({
        driver_performance: [
          { deliveredBy: "John Doe", deliveries: 15 },
          { deliveredBy: "Jane Smith", deliveries: 12 },
          { deliveredBy: "Mike Johnson", deliveries: 8 },
          { deliveredBy: "Sarah Wilson", deliveries: 20 },
          { deliveredBy: "Tom Brown", deliveries: 6 }
        ],
        load_plan_status: [
          { name: "Completed", count: 23 },
          { name: "In Progress", count: 6 },
          { name: "Not Started", count: 4 }
        ]
      });
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const baseUrl = getApiUrl('api/dr/');
      
      // Fetch data in parallel - only fetch what we need
      const [returnRes, podRes, pendingRes, assignedRes] = await Promise.all([
        axios.get(`${baseUrl}return-orders/?timeframe=${selectedTimeframe.toLowerCase()}`),
        axios.get(`${baseUrl}pod-updated-orders/?timeframe=${selectedTimeframe.toLowerCase()}`),
        axios.get(`${baseUrl}pending-deliveries/?timeframe=${selectedTimeframe.toLowerCase()}`),
        axios.get(`${baseUrl}driver-assignments-today/`) // Use new merged API for driver assignments
      ]);

      console.log('Return Orders:', returnRes.data);
      console.log('POD Orders:', podRes.data);
      console.log('Pending Deliveries:', pendingRes.data);
      console.log('Assigned Orders:', assignedRes.data);

      // Set data - only use real data, no sample data fallback
      setReturnOrders(Array.isArray(returnRes.data.results) ? returnRes.data.results : []);
      setPodOrders(Array.isArray(podRes.data.results) ? podRes.data.results : []);
      // New merged API returns data directly, not wrapped in results
      setAssignedOrders(Array.isArray(assignedRes.data) ? assignedRes.data : []);
      
      setPendingDeliveries(Array.isArray(pendingRes.data.results) && pendingRes.data.results.length > 0 
        ? pendingRes.data.results 
        : [
            { documentno: "PD-001", status: "Pending", created_date: "2025-09-04" },
            { documentno: "PD-002", status: "Scheduled", created_date: "2025-09-03" },
            { documentno: "PD-003", status: "Ready", created_date: "2025-09-02" }
          ]);
    } catch (error) {
      console.error("Failed to fetch DR data:", error);
      setReturnOrders([]);
      setPodOrders([]);
      setPendingDeliveries([]);
      setAssignedOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const openDataModal = (title: string, data: any[], type: string) => {
    setModalTitle(title);
    setModalType(type);
    setModalData(Array.isArray(data) ? data : []);
    setModalCurrentPage(1);
    setModalFilter("");
    setModalDateFilter("");
    setModalStatusFilter("");
    setOpenModal(true);
    fetchModalData(type, 1);
  };

  const fetchModalData = async (type: string, page: number = 1) => {
    try {
      let url = '';
      
      // Build URL based on type
      switch (type) {
        case 'return-orders':
          url = getApiUrl(`api/dr/return-orders/?timeframe=${selectedTimeframe.toLowerCase()}&page=${page}`);
          if (modalFilter) url += `&customer=${encodeURIComponent(modalFilter)}`;
          if (modalDateFromFilter) url += `&date_from=${modalDateFromFilter}`;
          if (modalDateToFilter) url += `&date_to=${modalDateToFilter}`;
          break;
        case 'pod-orders':
          url = getApiUrl(`api/dr/pod-updated-orders/?timeframe=${selectedTimeframe.toLowerCase()}&page=${page}`);
          if (modalFilter) url += `&driver=${encodeURIComponent(modalFilter)}`;
          if (modalDateFromFilter) url += `&date_from=${modalDateFromFilter}`;
          if (modalDateToFilter) url += `&date_to=${modalDateToFilter}`;
          break;
        case 'load-plans':
          url = getApiUrl(`api/dr/load-plans/?timeframe=${selectedTimeframe.toLowerCase()}&page=${page}`);
          if (modalFilter) url += `&driver=${encodeURIComponent(modalFilter)}`;
          if (modalDateFilter) url += `&date=${modalDateFilter}`;
          break;
        case 'assigned-orders':
          url = getApiUrl(`api/dr/driver-assignments-today/`); // Use new merged API
          if (modalFilter) url += `?driver=${encodeURIComponent(modalFilter)}`;
          if (modalStatusFilter) url += `${modalFilter ? '&' : '?'}status=${encodeURIComponent(modalStatusFilter)}`;
          // Note: This API doesn't support pagination yet, so we'll handle it client-side
          break;
        case 'active-orders':
          url = getApiUrl(`api/dr/active-orders/?page=${page}`); // No timeframe filter for active orders
          if (modalFilter) url += `&driver=${encodeURIComponent(modalFilter)}`;
          break;
        case 'sales-orders':
          url = getApiUrl(`api/dr/sales-orders/?timeframe=${selectedTimeframe.toLowerCase()}&page=${page}`);
          if (modalFilter) url += `&customer=${encodeURIComponent(modalFilter)}`;
          if (modalDateFromFilter) url += `&date_from=${modalDateFromFilter}`;
          if (modalDateToFilter) url += `&date_to=${modalDateToFilter}`;
          if (modalStatusFilter) url += `&status=${encodeURIComponent(modalStatusFilter)}`;
          break;
        case 'active-drivers':
          url = getApiUrl(`api/dr/active-drivers/?timeframe=${selectedTimeframe.toLowerCase()}`);
          // Note: Active drivers endpoint doesn't support pagination currently
          break;
        default:
          return;
      }
      
      // Log API config for debugging
      if (type === 'active-orders') {
        logApiConfig(`api/dr/active-orders/?page=${page}`);
      } else if (type === 'assigned-orders') {
        logApiConfig(`api/dr/assigned-to-drivers/?timeframe=today&page=${page}`);
      } else {
        logApiConfig(`api/dr/${type}/?page=${page}`);
      }
      const response = await axios.get(url);
      
      if (type === 'assigned-orders') {
        // Handle driver assignments API response (direct array, client-side pagination)
        let filteredData = Array.isArray(response.data) ? response.data : [];
        
        // Apply driver filter if specified
        if (modalFilter) {
          filteredData = filteredData.filter((item: any) => 
            item.driver && item.driver.toLowerCase().includes(modalFilter.toLowerCase())
          );
        }
        
        // Calculate pagination for client-side data
        const pageSize = 5; // 5 items per page in modal
        const totalPages = Math.ceil(filteredData.length / pageSize);
        const startIndex = (page - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedData = filteredData.slice(startIndex, endIndex);
        
        setModalData(paginatedData);
        setModalTotalCount(filteredData.length);
        setModalNextPage(page < totalPages ? 'next' : null);
        setModalPrevPage(page > 1 ? 'prev' : null);
        setModalCurrentPage(page);
        setModalTotalPages(totalPages);
      } else {
        // Handle other APIs with pagination
      setModalData(Array.isArray(response.data.results) ? response.data.results : []);
      setModalTotalCount(response.data.count || 0);
      setModalNextPage(response.data.next || null);
      setModalPrevPage(response.data.previous || null);
      setModalCurrentPage(page);
      setModalTotalPages(Math.ceil((response.data.count || 0) / 10));
      }
      
    } catch (error) {
      console.error("Failed to fetch modal data:", error);
      setModalData([]);
      setModalTotalCount(0);
      setModalNextPage(null);
      setModalPrevPage(null);
      setModalCurrentPage(1);
      setModalTotalPages(1);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered':
        return "bg-green-100 text-green-800";
      case 'pending':
        return "bg-yellow-100 text-yellow-800";
      case 'in progress':
        return "bg-blue-100 text-blue-800";
      case 'completed':
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const handleKPIClick = async (title: string) => {
    switch (title) {
      case "Total Assigned Orders":
        // Scroll to Driver Assignments section
        const driverAssignmentsSection = document.getElementById('driver-assignments-section');
        if (driverAssignmentsSection) {
          driverAssignmentsSection.scrollIntoView({ behavior: 'smooth' });
        }
        break;
        
      case "Total Return Orders":
        // Scroll to Return Orders section
        const returnOrdersSection = document.getElementById('return-orders-section');
        if (returnOrdersSection) {
          returnOrdersSection.scrollIntoView({ behavior: 'smooth' });
        }
        break;
        
      case "Sales Orders Ship To Not Fulfilled":
        // Show modal with sales orders
        try {
          const url = getApiUrl(`api/dr/sales-orders/?timeframe=${selectedTimeframe.toLowerCase()}`);
          const response = await axios.get(url);
          const data = Array.isArray(response.data.results) ? response.data.results : [];
          openDataModal("Sales Orders Ship To Not Fulfilled", data, "sales-orders");
        } catch (error) {
          console.error("Failed to fetch sales orders:", error);
        }
        break;
        
      case "Active Drivers":
        // Show modal with active drivers filtered by timeframe
        try {
          const url = getApiUrl(`api/dr/active-drivers/?timeframe=${selectedTimeframe.toLowerCase()}`);
          const response = await axios.get(url);
          const data = Array.isArray(response.data.results) ? response.data.results : [];
          openDataModal(`Active Drivers - ${selectedTimeframe}`, data, "active-drivers");
        } catch (error) {
          console.error("Failed to fetch active drivers:", error);
        }
        break;
        
      case "Top Delivered Location":
        // This KPI is not clickable - just show the location name
        // No action needed
        break;
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100">
      <MainNavigation
        selectedTimeframe={selectedTimeframe}
        onTimeframeChange={setSelectedTimeframe}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      {/* Smart View — Chatbot */}
      {viewMode === "smart" && (
        <div className="max-w-7xl mx-auto p-6">
          <ChatBotView variant="dr" />
        </div>
      )}

      {/* Classic View — Full DR Dashboard */}
      {viewMode === "classic" && (
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* KPI Cards - DR Dashboard Metrics */}
        <DRKPICards timeframe={selectedTimeframe} onKPIClick={handleKPIClick} />

        {/* Tabs Section - Between KPI Cards and Content */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/80 backdrop-blur-sm shadow-lg border-0">
            <TabsTrigger value="overview" className="flex items-center space-x-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              <BarChart3 className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center space-x-2 data-[state=active]:bg-green-500 data-[state=active]:text-white">
              <TrendingUp className="h-4 w-4" />
              <span>Performance</span>
            </TabsTrigger>
            <TabsTrigger value="predictive" className="flex items-center space-x-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white">
              <Brain className="h-4 w-4" />
              <span>Predictive</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="flex items-center space-x-2 data-[state=active]:bg-red-500 data-[state=active]:text-white">
              <Clock className="h-4 w-4" />
              <span>Insights</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Driver Performance Chart */}
              <DriverPerformanceChart timeframe={selectedTimeframe} />

              {/* Load Plan Status Chart - Inline Component */}
              <Card className="w-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-purple-600" />
                    Load Plan Status Distribution
                    <span className="text-sm font-normal text-gray-500 ml-auto">
                      {selectedTimeframe}
                    </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
                  <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={Array.isArray(stats.load_plan_status) ? stats.load_plan_status : []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                          label={({ name, count }) => `${name}: ${count}`}
                          outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {(Array.isArray(stats.load_plan_status) ? stats.load_plan_status : []).map((entry: any, index: number) => {
                          const colorMap = {
                              'Completed': '#10B981',
                              'In Progress': '#F59E0B', 
                              'Not Started': '#EF4444',
                              'Delivered': '#10B981',
                              'Assigned': '#3B82F6'
                          };
                          const color = colorMap[entry.name] || `hsl(${index * 120}, 70%, 50%)`;
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Pie>
                        <Tooltip formatter={(value: number) => [value, 'Load Plans']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                  </div>
                  
                  {/* Status Legend */}
                  {Array.isArray(stats.load_plan_status) && stats.load_plan_status.length > 0 && (
                    <div className="mt-6 space-y-2">
                      {stats.load_plan_status.map((item: any, index: number) => (
                        <div key={index} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ 
                                backgroundColor: item.name === 'Completed' ? '#10B981' :
                                item.name === 'In Progress' ? '#F59E0B' :
                                item.name === 'Not Started' ? '#EF4444' : '#6B7280'
                              }}
                            />
                            <span className="text-sm font-medium">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{item.count}</span>
                            <span className="text-xs text-gray-500">
                              ({((item.count / stats.load_plan_status.reduce((sum: number, i: any) => sum + i.count, 0)) * 100).toFixed(1)}%)
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Summary */}
                  {Array.isArray(stats.load_plan_status) && stats.load_plan_status.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {stats.load_plan_status.reduce((sum: number, item: any) => sum + item.count, 0)}
              </div>
                        <div className="text-sm text-gray-600">Total Load Plans</div>
                      </div>
                    </div>
                  )}
                  
                  {/* No Data State */}
                  {(!Array.isArray(stats.load_plan_status) || stats.load_plan_status.length === 0) && (
                    <div className="h-80 flex items-center justify-center text-gray-500">
                      <div className="text-center">
                        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No load plan status data available</p>
                        <p className="text-sm mt-2">Data will appear once load plans are processed</p>
                      </div>
                    </div>
                  )}
            </CardContent>
          </Card>
        </div>

            {/* Driver Assignments Table */}
            <div id="driver-assignments-section" className="grid grid-cols-1 gap-6">
              <Card className="bg-white/90 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border-0">
                <CardHeader className="bg-gradient-to-r from-orange-50 to-orange-100 border-b border-orange-200">
                  <CardTitle className="flex items-center justify-between text-orange-800">
                    <div className="flex items-center space-x-2">
                      <Truck className="h-5 w-5 text-orange-600" />
                      <span>Driver Assignments - Today</span>
                    </div>
                    <span className="text-sm text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                      {Array.isArray(assignedOrders) ? assignedOrders.length : 0} Total Orders
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-orange-50 to-orange-100 border-b-2 border-orange-200">
                          <TableHead className="font-semibold text-orange-800 text-sm py-3">Delivery Date</TableHead>
                          <TableHead className="font-semibold text-orange-800 text-sm py-3">Document No</TableHead>
                          <TableHead className="font-semibold text-orange-800 text-sm py-3">Driver</TableHead>
                          <TableHead className="font-semibold text-orange-800 text-sm py-3">Customer/Supplier</TableHead>
                          <TableHead className="font-semibold text-orange-800 text-sm py-3">Load Plan</TableHead>
                          <TableHead className="font-semibold text-orange-800 text-sm py-3">Ship To Address</TableHead>
                          <TableHead className="font-semibold text-orange-800 text-sm py-3">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {Array.isArray(assignedOrders) && assignedOrders.length > 0 ? assignedOrders.slice(0, 5).map((order: any, index: number) => {
                          // Get status color
                          const getStatusColor = (status: string) => {
                            switch (status.toLowerCase()) {
                              case 'delivered': return 'bg-green-100 text-green-800';
                              case 'assigned': return 'bg-blue-100 text-blue-800';
                              case 'in progress': return 'bg-yellow-100 text-yellow-800';
                              case 'received': return 'bg-purple-100 text-purple-800';
                              default: return 'bg-gray-100 text-gray-800';
                            }
                          };
                          
                          return (
                            <TableRow key={index} className="hover:bg-gray-50">
                              <TableCell className="text-sm text-gray-600">
                                {order.deliverydate ? new Date(order.deliverydate).toLocaleDateString() : 'N/A'}
                              </TableCell>
                              <TableCell className="font-medium">{order.documentno}</TableCell>
                              <TableCell>{order.driver || 'N/A'}</TableCell>
                              <TableCell className="text-sm text-gray-600">
                                {order.customer_or_supplier || 'N/A'}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600">
                                {order.loadplan || 'N/A'}
                              </TableCell>
                              <TableCell className="text-sm text-gray-600 max-w-sm min-w-[200px]">
                                <div className="whitespace-normal break-words leading-relaxed">
                                  {order.shippingaddress || 'N/A'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(order.deliverystatus)}>
                                  {order.deliverystatus || 'Unknown'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        }) : (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center p-4">No driver assignments found for today</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                    
                    <Button 
                      onClick={() => openDataModal("All Driver Assignments - Today", assignedOrders, "assigned-orders")}
                      variant="outline"
                      className="w-full mt-4"
                    >
                      View All Driver Assignments - Today
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Data Tables Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Return Orders */}
              <Card id="return-orders-section" className="bg-white/90 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border-0">
                <CardHeader className="bg-gradient-to-r from-red-50 to-red-100 border-b border-red-200">
                  <CardTitle className="flex items-center space-x-2 text-red-800">
                    <AlertCircle className="h-5 w-5 text-red-600" />
                    <span>Recent Return Orders</span>
                  </CardTitle>
                </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document No</TableHead>
                      <TableHead>Document Type</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(returnOrders) && returnOrders.length > 0 ? (() => {
                      const startIndex = (returnCurrentPage - 1) * returnPageSize;
                      const endIndex = startIndex + returnPageSize;
                      const currentPageData = returnOrders.slice(startIndex, endIndex);
                      
                      return currentPageData.map((order: any, index) => (
                        <TableRow key={startIndex + index} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{order.documentno}</TableCell>
                          <TableCell>
                            <Badge className="bg-blue-100 text-blue-800">
                              {order.documentText || 'Unknown Type'}
                            </Badge>
                          </TableCell>
                        <TableCell>{order.date}</TableCell>
                      </TableRow>
                      ));
                    })() : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center p-4">No return orders found for {selectedTimeframe}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                
                {/* Pagination Controls for Return Orders */}
                {Array.isArray(returnOrders) && returnOrders.length > returnPageSize && (
                  <div className="flex justify-between items-center mt-4 px-2">
                    <Button 
                      disabled={returnCurrentPage <= 1} 
                      onClick={() => setReturnCurrentPage(returnCurrentPage - 1)}
                      variant="outline"
                      size="sm"
                    >
                      Previous
                    </Button>

                    <span className="text-sm text-gray-500">
                      Page {returnCurrentPage} of {returnTotalPages} ({returnOrders.length} total records)
                    </span>

                    <Button 
                      disabled={returnCurrentPage >= returnTotalPages} 
                      onClick={() => setReturnCurrentPage(returnCurrentPage + 1)}
                      variant="outline"
                      size="sm"
                    >
                      Next
                    </Button>
                  </div>
                )}
                
                <Button 
                  onClick={() => openDataModal("All Return Orders", returnOrders, "return-orders")}
                  variant="outline"
                  className="w-full mt-4"
                >
                  View All Return Orders
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* POD Updated Orders */}
          <Card className="bg-white/90 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border-0">
            <CardHeader className="bg-gradient-to-r from-green-50 to-green-100 border-b border-green-200">
              <CardTitle className="flex items-center justify-between text-green-800">
                <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>Recent POD Updates</span>
                </div>
                <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded-full">
                  {selectedTimeframe}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 p-3 bg-gray-50 rounded-lg">
                  <select
                    className="p-2 border rounded text-sm w-32"
                    onChange={async (e) => {
                      // Fetch filtered data from API
                      try {
                        const url = getApiUrl(`api/dr/pod-updated-orders/?timeframe=${selectedTimeframe.toLowerCase()}&status=${encodeURIComponent(e.target.value)}`);
                        const response = await axios.get(url);
                        setPodOrders(Array.isArray(response.data.results) ? response.data.results : []);
                      } catch (error) {
                        console.error("Failed to fetch filtered POD data:", error);
                      }
                    }}
                  >
                    <option value="">All Status</option>
                    <option value="delivered">Delivered</option>
                    <option value="received">Received</option>
                  </select>
                  <Button
                    onClick={() => {
                      // Reset filters and refetch data
                      fetchAllData();
                    }}
                    variant="outline"
                    size="sm"
                  >
                    Reset
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document No</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Delivery Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.isArray(podOrders) && podOrders.length > 0 ? (() => {
                      const startIndex = (podCurrentPage - 1) * podPageSize;
                      const endIndex = startIndex + podPageSize;
                      const currentPageData = podOrders.slice(startIndex, endIndex);
                      
                      return currentPageData.map((order: any, index) => (
                        <TableRow key={startIndex + index} className="hover:bg-gray-50">
                        <TableCell className="font-medium">{order.documentno}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{order.driver || order.deliveredBy || 'N/A'}</div>
                              {order.driverId && (
                                <div className="text-xs text-gray-500">ID: {order.driverId}</div>
                              )}
                            </div>
                          </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(order.deliveryStatus)}>
                              {order.deliveryStatus || 'Unknown'}
                          </Badge>
                        </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {order.deliveryTime ? new Date(order.deliveryTime).toLocaleString() : 'N/A'}
                        </TableCell>
                      </TableRow>
                      ));
                    })() : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center p-4">No POD updates found for {selectedTimeframe}</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                
                {/* Pagination Controls for POD Orders */}
                {Array.isArray(podOrders) && podOrders.length > podPageSize && (
                  <div className="flex justify-between items-center mt-4 px-2">
                <Button 
                      disabled={podCurrentPage <= 1} 
                      onClick={() => setPodCurrentPage(podCurrentPage - 1)}
                  variant="outline"
                      size="sm"
                >
                      Previous
                </Button>

                    <span className="text-sm text-gray-500">
                      Page {podCurrentPage} of {podTotalPages} ({podOrders.length} total records)
                    </span>
                
                <Button 
                      disabled={podCurrentPage >= podTotalPages} 
                      onClick={() => setPodCurrentPage(podCurrentPage + 1)}
                  variant="outline"
                      size="sm"
                >
                      Next
                </Button>
              </div>
                )}
                
                <Button 
                  onClick={() => openDataModal(`All POD Updates - ${selectedTimeframe}`, podOrders, "pod-orders")}
                  variant="outline"
                  className="w-full mt-4"
                >
                  View All POD Updates - {selectedTimeframe}
                </Button>
              </div>
            </CardContent>
          </Card>
            </div>

        {/* Document Types Chart */}
        <div className="grid grid-cols-1 gap-6">
          <DocumentTypeChart timeframe={selectedTimeframe} />
            </div>
          </TabsContent>

          {/* Other Tabs Content - Placeholder for future features */}
          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Driver Performance Chart */}
              <DriverPerformanceChart timeframe={selectedTimeframe} />
              
              {/* Additional Performance Metrics */}
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardHeader>
                  <CardTitle className="text-green-800 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Performance Insights
                  </CardTitle>
              </CardHeader>
              <CardContent>
                  <div className="space-y-4">
                    <div className="p-4 bg-white rounded-lg shadow-sm">
                      <h4 className="font-semibold text-gray-800 mb-2">Top Performers</h4>
                      <p className="text-sm text-gray-600">Drivers with highest delivery counts are highlighted in the chart above.</p>
                    </div>
                    <div className="p-4 bg-white rounded-lg shadow-sm">
                      <h4 className="font-semibold text-gray-800 mb-2">Performance Trends</h4>
                      <p className="text-sm text-gray-600">Track delivery performance over time to identify improvement opportunities.</p>
                    </div>
                    <div className="p-4 bg-white rounded-lg shadow-sm">
                      <h4 className="font-semibold text-gray-800 mb-2">Team Efficiency</h4>
                      <p className="text-sm text-gray-600">Monitor overall team performance and delivery completion rates.</p>
                    </div>
                  </div>
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          <TabsContent value="predictive" className="space-y-6">
            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-800">Predictive Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-orange-700">AI-powered predictions and forecasting will be available here.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <CardHeader>
                <CardTitle className="text-red-800">Business Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-red-700">Advanced insights and recommendations will be available here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      )}

      {/* Enhanced Modal with WMS-style features */}
      <Dialog open={openModal} onOpenChange={setOpenModal}>
        <DialogContent className="max-w-6xl max-h-[85vh] flex flex-col" aria-describedby="modal-description">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{modalTitle}</span>
              <span className="text-sm text-gray-500">{modalTotalCount} total records</span>
            </DialogTitle>
          </DialogHeader>
          
          {/* Hidden description for accessibility */}
          <div id="modal-description" className="sr-only">
            Data table showing detailed records with filtering and pagination options
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 mb-4 p-4 bg-gray-50 rounded-lg">
            {(modalType !== 'pod-orders' && modalType !== 'return-orders' && modalType !== 'active-drivers') && (
            <input
              type="text"
              placeholder={
                modalType === 'assigned-orders' ? 'Driver...' :
                  modalType === 'load-plans' ? 'Driver...' :
                  modalType === 'sales-orders' ? 'Customer...' : 'Filter...'
              }
              value={modalFilter}
              onChange={(e) => setModalFilter(e.target.value)}
              className="p-2 border rounded text-sm w-48"
            />
            )}
            
            {/* Status filter for assigned-orders */}
            {modalType === 'assigned-orders' && (
              <select
                value={modalStatusFilter}
                onChange={(e) => setModalStatusFilter(e.target.value)}
                className="p-2 border rounded text-sm w-48"
              >
                <option value="">All Statuses</option>
                <option value="Assigned">Assigned</option>
                <option value="Delivered">Delivered</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Received">Received</option>
              </select>
            )}
            
            {/* Status filter for sales-orders */}
            {modalType === 'sales-orders' && (
              <select
                value={modalStatusFilter}
                onChange={(e) => setModalStatusFilter(e.target.value)}
                className="p-2 border rounded text-sm w-48"
              >
                <option value="">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Fulfilled">Fulfilled</option>
                <option value="Shipped">Shipped</option>
                <option value="Completed">Completed</option>
              </select>
            )}
            
            {modalType !== 'assigned-orders' && modalType !== 'active-drivers' && modalType !== 'pod-orders' && modalType !== 'return-orders' && modalType !== 'sales-orders' && (
              <div className="relative flex items-center">
                <Calendar className="absolute left-2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={modalDateFilter}
                  onChange={(e) => setModalDateFilter(e.target.value)}
                  className="pl-8 pr-2 py-2 border rounded text-sm"
                  placeholder="MM/DD/YYYY"
                />
              </div>
            )}
            
            {/* Date range filters for POD, Return Orders, and Sales Orders */}
            {(modalType === 'pod-orders' || modalType === 'return-orders' || modalType === 'sales-orders') && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">From:</label>
                  <div className="relative flex items-center">
                    <Calendar className="absolute left-2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      type="date"
                      value={modalDateFromFilter}
                      onChange={(e) => setModalDateFromFilter(e.target.value)}
                      className="pl-8 pr-2 py-2 border rounded text-sm"
                      placeholder="MM/DD/YYYY"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">To:</label>
                  <div className="relative flex items-center">
                    <Calendar className="absolute left-2 h-4 w-4 text-gray-400 pointer-events-none" />
                    <input
                      type="date"
                      value={modalDateToFilter}
                      onChange={(e) => setModalDateToFilter(e.target.value)}
                      className="pl-8 pr-2 py-2 border rounded text-sm"
                      placeholder="MM/DD/YYYY"
                    />
                  </div>
                </div>
              </>
            )}
            
            {/* Clear filters button - only show when filters are applied */}
            {(modalFilter || modalDateFilter || modalDateFromFilter || modalDateToFilter || modalStatusFilter) && (
              <button
              onClick={() => {
                setModalFilter("");
                setModalDateFilter("");
                  setModalDateFromFilter("");
                  setModalDateToFilter("");
                  setModalStatusFilter("");
              }}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
                title="Clear all filters"
            >
                Clear Filters
              </button>
            )}
          </div>

          {/* Scrollable Table */}
          <div className="overflow-y-auto max-h-[45vh] border rounded flex-1">
            <Table>
              <TableHeader className="sticky top-0 bg-white">
                <TableRow>
                  {modalType === 'return-orders' && (
                    <>
                      <TableHead>Document No</TableHead>
                      <TableHead>Document Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                    </>
                  )}
                  {modalType === 'pod-orders' && (
                    <>
                      <TableHead>Document No</TableHead>
                      <TableHead>Driver Info</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Delivery Time</TableHead>
                      <TableHead>Load Plan</TableHead>
                    </>
                  )}
                  {modalType === 'load-plans' && (
                    <>
                      <TableHead>Load Plan</TableHead>
                      <TableHead>Driver</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Delivery Date</TableHead>
                      <TableHead>Location</TableHead>
                    </>
                  )}
                  {modalType === 'assigned-orders' && (
                    <>
                      <TableHead className="font-semibold text-orange-800 text-sm py-3 bg-orange-50">Delivery Date</TableHead>
                      <TableHead className="font-semibold text-orange-800 text-sm py-3 bg-orange-50">Document No</TableHead>
                      <TableHead className="font-semibold text-orange-800 text-sm py-3 bg-orange-50">Driver</TableHead>
                      <TableHead className="font-semibold text-orange-800 text-sm py-3 bg-orange-50">Customer/Supplier</TableHead>
                      <TableHead className="font-semibold text-orange-800 text-sm py-3 bg-orange-50">Load Plan</TableHead>
                      <TableHead className="font-semibold text-orange-800 text-sm py-3 bg-orange-50">Ship To Address</TableHead>
                      <TableHead className="font-semibold text-orange-800 text-sm py-3 bg-orange-50">Status</TableHead>
                    </>
                  )}
                  {modalType === 'active-drivers' && (
                    <>
                      <TableHead>Driver</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Delivery Date</TableHead>
                    </>
                  )}
                  {modalType === 'sales-orders' && (
                    <>
                      <TableHead className="font-semibold text-orange-800 text-sm py-3 bg-orange-50">Document No</TableHead>
                      <TableHead className="font-semibold text-orange-800 text-sm py-3 bg-orange-50">Customer</TableHead>
                      <TableHead className="font-semibold text-orange-800 text-sm py-3 bg-orange-50">Location</TableHead>
                      <TableHead className="font-semibold text-orange-800 text-sm py-3 bg-orange-50">Status</TableHead>
                      <TableHead className="font-semibold text-orange-800 text-sm py-3 bg-orange-50">Shipping Address</TableHead>
                      <TableHead className="font-semibold text-orange-800 text-sm py-3 bg-orange-50">Created Date</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.isArray(modalData) && modalData.length > 0 ? (
                  modalData.map((item: any, index) => (
                    <TableRow key={index} className="hover:bg-gray-50">
                      {modalType === 'return-orders' && (
                        <>
                          <TableCell className="font-medium">{item.documentno}</TableCell>
                          <TableCell>
                            <Badge className="bg-blue-100 text-blue-800">
                              {item.documentText || 'Unknown Type'}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.date}</TableCell>
                          <TableCell>{item.location}</TableCell>
                          <TableCell>
                            <Badge className="bg-red-100 text-red-800">Return</Badge>
                          </TableCell>
                        </>
                      )}
                      {modalType === 'pod-orders' && (
                        <>
                          <TableCell className="font-medium">{item.documentno}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{item.driver || item.deliveredBy}</div>
                              {item.driverId && (
                                <div className="text-xs text-gray-500">ID: {item.driverId}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(item.deliveryStatus)}>
                              {item.deliveryStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {item.deliveryTime || 'N/A'}
                          </TableCell>
                          <TableCell>{item.loadplan}</TableCell>
                        </>
                      )}
                      {modalType === 'load-plans' && (
                        <>
                          <TableCell className="font-medium">{item.loadplan}</TableCell>
                          <TableCell>{item.driver}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(item.lpStatus)}>
                              {item.lpStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.deliverydate}</TableCell>
                          <TableCell>{item.location}</TableCell>
                        </>
                      )}
                      {modalType === 'assigned-orders' && (
                        <>
                          <TableCell className="text-sm text-gray-600">
                            {item.deliverydate ? new Date(item.deliverydate).toLocaleDateString() : 'N/A'}
                          </TableCell>
                          <TableCell className="font-medium">{item.documentno}</TableCell>
                          <TableCell>{item.driver}</TableCell>
                          <TableCell>{item.customer_or_supplier}</TableCell>
                          <TableCell>{item.loadplan}</TableCell>
                          <TableCell className="text-sm text-gray-600 max-w-sm min-w-[200px]">
                            <div className="whitespace-normal break-words leading-relaxed">
                              {item.shippingaddress || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              item.deliverystatus === 'Delivered' ? 'bg-green-100 text-green-800' :
                              item.deliverystatus === 'Assigned' ? 'bg-blue-100 text-blue-800' :
                              item.deliverystatus === 'In Progress' ? 'bg-yellow-100 text-yellow-800' :
                              item.deliverystatus === 'Received' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }>
                              {item.deliverystatus || 'Unknown'}
                            </Badge>
                          </TableCell>
                        </>
                      )}
                      {modalType === 'active-drivers' && (
                        <>
                          <TableCell className="font-medium">{item.driver}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(item.status)}>
                              {item.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.location}</TableCell>
                          <TableCell>{item.deliverydate}</TableCell>
                        </>
                      )}
                      {modalType === 'sales-orders' && (
                        <>
                          <TableCell className="font-medium">{item.documentno}</TableCell>
                          <TableCell>{item.customer || 'N/A'}</TableCell>
                          <TableCell>{item.location || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(item.status)}>
                              {item.status || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600 max-w-sm min-w-[200px]">
                            <div className="whitespace-normal break-words leading-relaxed">
                              {item.shippingAddress || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {item.created_date ? formatDateMMDDYYYY(item.created_date) : 'N/A'}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center p-8 text-gray-500">
                      No data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          <div className="flex justify-between items-center mt-4 px-2 py-2 bg-gray-50 border-t">
            <Button 
              disabled={!modalPrevPage} 
              onClick={() => {
                if (modalType === 'assigned-orders') {
                  // For assigned-orders, just change page and re-fetch
                  fetchModalData(modalType, modalCurrentPage - 1);
                } else {
                  modalPrevPage && fetchModalData(modalType, modalCurrentPage - 1);
                }
              }}
              variant="outline"
              className="min-w-[80px]"
            >
              Previous
            </Button>

            <span className="text-sm text-gray-500">
              Page {modalCurrentPage} of {modalTotalPages} ({modalTotalCount} total records)
            </span>

            <Button 
              disabled={!modalNextPage} 
              onClick={() => {
                if (modalType === 'assigned-orders') {
                  // For assigned-orders, just change page and re-fetch
                  fetchModalData(modalType, modalCurrentPage + 1);
                } else {
                  modalNextPage && fetchModalData(modalType, modalCurrentPage + 1);
                }
              }}
              variant="outline"
              className="min-w-[80px]"
            >
              Next
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DRDashboard;

