import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "lucide-react";
import axios from "axios";
import { getApiUrl, logApiConfig } from "@/lib/api";
import { formatDateMMDDYYYY } from "@/lib/utils";

// Badge color utility
const getStatusColor = (status: string) => {
  switch (status) {
    case "Picked":
      return "bg-emerald-100 text-emerald-800";
    case "Packed":
      return "bg-purple-100 text-purple-800";
    case "Received":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

interface OrdersOverviewProps {
  timeframe?: string;
  initialFilter?: string | null;
}

const OrdersOverview = ({ timeframe = "Today", initialFilter = null }: OrdersOverviewProps) => {
  const [activeTab, setActiveTab] = useState(initialFilter || "Picked");
  
  // Update activeTab when initialFilter changes
  useEffect(() => {
    if (initialFilter && ["Picked", "Packed", "Received"].includes(initialFilter)) {
      setActiveTab(initialFilter);
    }
  }, [initialFilter]);
  const [date, setDate] = useState("");
  const [orders, setOrders] = useState<any[]>([]);

  const [open, setOpen] = useState(false);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [prevPage, setPreviousPage] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOrders = async (url?: string) => {
    // Declare apiUrl outside try block so it's accessible in catch block
    const apiUrl = url || getApiUrl(`api/orders/?type=${activeTab.toLowerCase()}&date=${date}&timeframe=${timeframe.toLowerCase()}`);
    
    try {
      logApiConfig(`api/orders/?type=${activeTab.toLowerCase()}&date=${date}&timeframe=${timeframe.toLowerCase()}`);
      const res = await axios.get(apiUrl);
      
      console.log('Orders API Response:', res.data);
      console.log('Response status:', res.status);
      console.log('Response headers:', res.headers);
      console.log('API URL:', apiUrl);
      
      // Ensure we have arrays
      const ordersArray = Array.isArray(res.data?.results) ? res.data.results : [];
      setOrders(ordersArray);
      setTotalCount(res.data?.count || 0);
      setNextPage(res.data?.next || null);
      setPreviousPage(res.data?.previous || null);

      const usedUrl = new URL(res.config.url || apiUrl, window.location.origin);
      const pageParam = usedUrl.searchParams.get("page");
      const pageNum = pageParam ? parseInt(pageParam) : 1;
      setCurrentPage(pageNum);

      setTotalPages(Math.ceil((res.data?.count || 0) / 10));
    } catch (err) {
      console.error("Failed to fetch orders!", err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      console.error('Error URL:', apiUrl);
      setOrders([]);
      setTotalCount(0);
      setNextPage(null);
      setPreviousPage(null);
      setCurrentPage(1);
      setTotalPages(1);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [activeTab, date, timeframe]);

  return (
    <div className="space-y-4">
      {/* Tabs and Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {["Picked", "Packed", "Received"].map((tab) => (
          <Button
            key={tab}
            variant={activeTab === tab ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            {tab}
          </Button>
        ))}

        <div className="relative flex items-center">
          <Calendar className="absolute left-2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="pl-8 pr-2 py-1 border rounded text-sm"
            placeholder="MM/DD/YYYY"
          />
        </div>
      </div>

      {/* Preview Table */}
      <div className="border rounded shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tran No</TableHead>
              <TableHead>{activeTab === "Received" ? "Received By" : "Picker/Packer"}</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length > 0 ? (
              orders.slice(0, 5).map((order, index) => (
                <TableRow key={index}>
                  <TableCell>
                    {activeTab === "Received" ? order.tranId : order.documentNumber}
                  </TableCell>
                  <TableCell>
                    {activeTab === "Received" 
                      ? (order.receivedBy || "-") 
                      : (order.picker || order.packer || "-")
                    }
                  </TableCell>
                  <TableCell>
                    {activeTab === "Received" 
                      ? formatDateMMDDYYYY(order.createdDate)
                      : formatDateMMDDYYYY(order.dateCreated)
                    }
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center p-4">No data</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Summary Card */}
      <div
        onClick={() => setOpen(true)}
        className="p-4 border rounded shadow-md hover:shadow-lg transition cursor-pointer"
      >
        <div className="flex justify-between">
          <h2 className="font-semibold text-lg">Orders Overview</h2>
          <span className="text-blue-600 font-semibold">View All</span>
        </div>
        <p>{totalCount} orders currently</p>
      </div>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>All {activeTab} Orders</DialogTitle>
          </DialogHeader>

          {/* Scrollable Table */}
          <div className="overflow-y-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tran No</TableHead>
                  <TableHead>{activeTab === "Received" ? "Received By" : "Picker/Packer"}</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length > 0 ? (
                  orders.map((order, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {activeTab === "Received" ? order.tranId : order.documentNumber}
                      </TableCell>
                      <TableCell>
                        {activeTab === "Received" 
                          ? (order.receivedBy || "-") 
                          : (order.picker || order.packer || "-")
                        }
                      </TableCell>
                      <TableCell>
                        {activeTab === "Received" 
                          ? formatDateMMDDYYYY(order.createdDate)
                          : formatDateMMDDYYYY(order.dateCreated)
                        }
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(activeTab)}>
                          {activeTab}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center p-4">No data</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls */}
          <div className="flex justify-between items-center mt-4 px-2">
            <Button disabled={!prevPage} onClick={() => prevPage && fetchOrders(prevPage)}>
              Previous
            </Button>

            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>

            <Button disabled={!nextPage} onClick={() => nextPage && fetchOrders(nextPage)}>
              Next
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersOverview;












