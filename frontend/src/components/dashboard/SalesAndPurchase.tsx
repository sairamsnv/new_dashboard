
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl, logApiConfig } from "@/lib/api";
import { formatDateMMDDYYYY } from "@/lib/utils";

const SalesAndPurchase = ({ timeframe = "Today" }) => {
  const [orders, setOrders] = useState([]);
  const [orderType, setOrderType] = useState('all');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [prevPage, setPreviousPage] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchOrders = async (url?: string) => {
    setLoading(true);
    const apiUrl = url || getApiUrl(`api/sales-purchase/?type=${orderType}&timeframe=${timeframe.toLowerCase()}`);
    
    try {
      logApiConfig(`api/sales-purchase/?type=${orderType}&timeframe=${timeframe.toLowerCase()}`);
      const res = await axios.get(apiUrl);
      
      console.log('Sales/Purchase API Response:', res.data);
      
      // Handle paginated response
      const ordersArray = Array.isArray(res.data?.results) ? res.data.results : (Array.isArray(res.data) ? res.data : []);
      setOrders(ordersArray);
      setTotalCount(res.data?.count || ordersArray.length);
      setNextPage(res.data?.next || null);
      setPreviousPage(res.data?.previous || null);

      const usedUrl = new URL(res.config.url || apiUrl, window.location.origin);
      const pageParam = usedUrl.searchParams.get("page");
      const pageNum = pageParam ? parseInt(pageParam) : 1;
      setCurrentPage(pageNum);

      setTotalPages(Math.ceil((res.data?.count || ordersArray.length) / 10));
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch sales/purchase orders', err);
      setOrders([]);
      setTotalCount(0);
      setNextPage(null);
      setPreviousPage(null);
      setCurrentPage(1);
      setTotalPages(1);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [orderType, timeframe]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex space-x-4 items-center">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Type:</span>
          <Select value={orderType} onValueChange={setOrderType}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="po">PO</SelectItem>
              <SelectItem value="so">SO</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Preview Table */}
      <div className="border rounded shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-4">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-4 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="whitespace-nowrap">Tran No</TableHead>
                <TableHead className="whitespace-nowrap">Type</TableHead>
                <TableHead className="whitespace-nowrap">Location</TableHead>
                <TableHead className="whitespace-nowrap">Vendor/Customer</TableHead>
                <TableHead className="whitespace-nowrap">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.length > 0 ? (
                orders.slice(0, 5).map((order, index) => (
                  <TableRow key={index} className="hover:bg-gray-50">
                    <TableCell className="font-medium text-blue-600">{order.tranNo}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{order.type}</Badge>
                    </TableCell>
                    <TableCell className="text-blue-600">{order.location}</TableCell>
                    <TableCell>{order.vendor}</TableCell>
                    <TableCell>
                      {order.date ? formatDateMMDDYYYY(order.date) : '-'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center p-4">No data</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Summary Card */}
      <div
        onClick={() => setOpen(true)}
        className="p-4 border rounded shadow-md hover:shadow-lg transition cursor-pointer"
      >
        <div className="flex justify-between">
          <h2 className="font-semibold text-lg">Sales and Purchase Order</h2>
          <span className="text-blue-600 font-semibold">View All</span>
        </div>
        <p>{totalCount} orders currently</p>
      </div>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>All Sales and Purchase Orders</DialogTitle>
          </DialogHeader>

          {/* Scrollable Table */}
          <div className="overflow-y-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Tran No</TableHead>
                  <TableHead className="whitespace-nowrap">Type</TableHead>
                  <TableHead className="whitespace-nowrap">Location</TableHead>
                  <TableHead className="whitespace-nowrap">Vendor/Customer</TableHead>
                  <TableHead className="whitespace-nowrap">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.length > 0 ? (
                  orders.map((order, index) => (
                    <TableRow key={index} className="hover:bg-gray-50">
                      <TableCell className="font-medium text-blue-600">{order.tranNo}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{order.type}</Badge>
                      </TableCell>
                      <TableCell className="text-blue-600">{order.location}</TableCell>
                      <TableCell>{order.vendor}</TableCell>
                      <TableCell>
                        {order.date ? formatDateMMDDYYYY(order.date) : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center p-4">No data</TableCell>
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

export default SalesAndPurchase;
