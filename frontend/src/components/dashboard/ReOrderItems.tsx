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

// Badge color utility for reorder status
const getReorderStatus = (quantityAvailable: number, reorderPoint: number) => {
  if (quantityAvailable === null || reorderPoint === null) {
    return { color: "bg-gray-100 text-gray-800", text: "N/A" };
  }
  if (quantityAvailable <= reorderPoint) {
    return { color: "bg-red-100 text-red-800", text: "Reorder Needed" };
  }
  if (quantityAvailable <= reorderPoint * 1.5) {
    return { color: "bg-yellow-100 text-yellow-800", text: "Low Stock" };
  }
  return { color: "bg-green-100 text-green-800", text: "In Stock" };
};

const ReOrderItems = ({ timeframe = "Today" }) => {
  const [items, setItems] = useState<any[]>([]);
  const [itemName, setItemName] = useState("");
  const [open, setOpen] = useState(false);
  const [nextPage, setNextPage] = useState<string | null>(null);
  const [prevPage, setPreviousPage] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchItems = async (url?: string) => {
    const itemNameParam = encodeURIComponent(itemName);
    const apiUrl = url || getApiUrl(
      `api/reorder-items/?itemName=${itemNameParam}&timeframe=${timeframe.toLowerCase()}`
    );
    
    try {
      logApiConfig(`api/reorder-items/?itemName=${itemNameParam}&timeframe=${timeframe.toLowerCase()}`);
      const res = await axios.get(apiUrl);
      
      const itemsArray = Array.isArray(res.data?.results) ? res.data.results : [];
      setItems(itemsArray);
      setTotalCount(res.data?.count || 0);
      setNextPage(res.data?.next || null);
      setPreviousPage(res.data?.previous || null);

      const usedUrl = new URL(res.config.url || apiUrl, window.location.origin);
      const pageParam = usedUrl.searchParams.get("page");
      const pageNum = pageParam ? parseInt(pageParam) : 1;
      setCurrentPage(pageNum);

      setTotalPages(Math.ceil((res.data?.count || 0) / 10));
    } catch (err) {
      console.error("Failed to fetch reorder items!", err);
      setItems([]);
      setTotalCount(0);
      setNextPage(null);
      setPreviousPage(null);
      setCurrentPage(1);
      setTotalPages(1);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [itemName, timeframe]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="Item Name..."
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          className="p-1 border rounded text-sm"
        />
      </div>

      {/* Preview Table */}
      <div className="border rounded shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">Item Name</TableHead>
              <TableHead className="whitespace-nowrap">Description</TableHead>
              <TableHead className="whitespace-nowrap">Reorder Point</TableHead>
              <TableHead className="whitespace-nowrap">Quantity Available</TableHead>
              <TableHead className="whitespace-nowrap">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length > 0 ? (
              items.slice(0, 5).map((item, index) => {
                const status = getReorderStatus(item.quantityAvailable, item.reorderPoint);
                return (
                  <TableRow key={item.id || index}>
                    <TableCell className="font-medium">{item.itemName || "-"}</TableCell>
                    <TableCell>{item.description || "-"}</TableCell>
                    <TableCell>{item.reorderPoint ?? "-"}</TableCell>
                    <TableCell>{item.quantityAvailable ?? "-"}</TableCell>
                    <TableCell>
                      <Badge className={status.color}>
                        {status.text}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
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
          <h2 className="font-semibold text-lg">Reorder Items</h2>
          <span className="text-blue-600 font-semibold">View All</span>
        </div>
        <p>{totalCount} items currently</p>
      </div>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>All Reorder Items</DialogTitle>
          </DialogHeader>

          {/* Scrollable Table */}
          <div className="overflow-y-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reorder Point</TableHead>
                  <TableHead>Quantity Available</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length > 0 ? (
                  items.map((item, index) => {
                    const status = getReorderStatus(item.quantityAvailable, item.reorderPoint);
                    return (
                      <TableRow key={item.id || index}>
                        <TableCell className="font-medium">{item.itemName || "-"}</TableCell>
                        <TableCell>{item.description || "-"}</TableCell>
                        <TableCell>{item.reorderPoint ?? "-"}</TableCell>
                        <TableCell>{item.quantityAvailable ?? "-"}</TableCell>
                        <TableCell>
                          <Badge className={status.color}>
                            {status.text}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
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
            <Button disabled={!prevPage} onClick={() => prevPage && fetchItems(prevPage)}>
              Previous
            </Button>

            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>

            <Button disabled={!nextPage} onClick={() => nextPage && fetchItems(nextPage)}>
              Next
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReOrderItems;







