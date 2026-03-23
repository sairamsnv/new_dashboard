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
import axios from "axios";
import { getApiUrl, logApiConfig } from "@/lib/api";
import { formatDateMMDDYYYY } from "@/lib/utils";

// Badge color utility
const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "approved":
      return "bg-green-100 text-green-800";
    case "rejected":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const PendingApprovalInventoryAdjustments = ({ timeframe = "Today" }) => {
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [prevPage, setPreviousPage] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchAdjustments = async (url?: string) => {
    const apiUrl = url || getApiUrl(
      `api/pending-approval-inventory-adjustments/`
    );
    
    try {
      logApiConfig(`api/pending-approval-inventory-adjustments/`);
      const res = await axios.get(apiUrl);
      
      const adjustmentsArray = Array.isArray(res.data?.results) ? res.data.results : [];
      setAdjustments(adjustmentsArray);
      setTotalCount(res.data?.count || 0);
      setNextPage(res.data?.next || null);
      setPreviousPage(res.data?.previous || null);

      const usedUrl = new URL(res.config.url || apiUrl, window.location.origin);
      const pageParam = usedUrl.searchParams.get("page");
      const pageNum = pageParam ? parseInt(pageParam) : 1;
      setCurrentPage(pageNum);

      setTotalPages(Math.ceil((res.data?.count || 0) / 10));
    } catch (err) {
      console.error("Failed to fetch pending approval inventory adjustments!", err);
      setAdjustments([]);
      setTotalCount(0);
      setNextPage(null);
      setPreviousPage(null);
      setCurrentPage(1);
      setTotalPages(1);
    }
  };

  useEffect(() => {
    fetchAdjustments();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    try {
      return formatDateMMDDYYYY(dateString);
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-4">
      {/* Preview Table */}
      <div className="border rounded shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Location</TableHead>
              <TableHead className="whitespace-nowrap">Account</TableHead>
              <TableHead className="whitespace-nowrap">Created By</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
              <TableHead className="whitespace-nowrap">Date Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {adjustments.length > 0 ? (
              adjustments.slice(0, 5).map((adjustment, index) => (
                <TableRow key={adjustment.id || index}>
                  <TableCell>{adjustment.location || "-"}</TableCell>
                  <TableCell>{adjustment.account || "-"}</TableCell>
                  <TableCell>{adjustment.createdBy || "-"}</TableCell>
                  <TableCell>
                    <Badge className={`${getStatusColor(adjustment.status)} hover:bg-blue-200 hover:text-blue-900 transition-colors`}>
                      {adjustment.status || "-"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(adjustment.dateCreated)}</TableCell>
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

      {/* Summary Card */}
      <div
        onClick={() => setOpen(true)}
        className="p-4 border rounded shadow-md hover:shadow-lg transition cursor-pointer"
      >
        <div className="flex justify-between">
          <h2 className="font-semibold text-lg">Pending Approval Inventory Adjustments</h2>
          <span className="text-blue-600 font-semibold">View All</span>
        </div>
        <p>{totalCount} adjustments currently</p>
      </div>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>All Pending Approval Inventory Adjustments</DialogTitle>
          </DialogHeader>

          {/* Scrollable Table */}
          <div className="overflow-y-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Location</TableHead>
                  <TableHead className="whitespace-nowrap">Account</TableHead>
                  <TableHead className="whitespace-nowrap">Created By</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="whitespace-nowrap">Date Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.length > 0 ? (
                  adjustments.map((adjustment, index) => (
                    <TableRow key={adjustment.id || index}>
                      <TableCell>{adjustment.location || "-"}</TableCell>
                      <TableCell>{adjustment.account || "-"}</TableCell>
                      <TableCell>{adjustment.createdBy || "-"}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(adjustment.status)}>
                          {adjustment.status || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(adjustment.dateCreated)}</TableCell>
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
            <Button disabled={!prevPage} onClick={() => prevPage && fetchAdjustments(prevPage)}>
              Previous
            </Button>

            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>

            <Button disabled={!nextPage} onClick={() => nextPage && fetchAdjustments(nextPage)}>
              Next
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PendingApprovalInventoryAdjustments;







