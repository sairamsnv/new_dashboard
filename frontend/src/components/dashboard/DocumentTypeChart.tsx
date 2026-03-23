import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { useState, useEffect } from "react";
import axios from "axios";
import { getApiUrl } from "@/lib/api";
import { FileText, Filter } from "lucide-react";

interface DocumentTypeData {
  documentType: string;
  count: number;
}

interface DocumentTypeChartProps {
  timeframe?: string;
}

// Function to map document type prefixes to full names
const getDocumentTypeName = (prefix: string): string => {
  const prefixMap: { [key: string]: string } = {
    'IF': 'Item Fulfillment',
    'P': 'Purchase Order', 
    'PO': 'Purchase Order',
    'SO': 'Sales Order',
    'RO': 'Return Order',
    'R': 'Return Order',
    'WO': 'Work Order',
    'INV': 'Invoice',
    'EST': 'Estimate',
    'QUO': 'Quote'
  };
  
  return prefixMap[prefix.toUpperCase()] || prefix;
};

const DocumentTypeChart = ({ timeframe = "Today" }: DocumentTypeChartProps) => {
  const [data, setData] = useState<DocumentTypeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    fetchData();
  }, [timeframe, filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const url = getApiUrl(`api/dr/document-types/?timeframe=${timeframe.toLowerCase()}&filter=${encodeURIComponent(filter)}`);
      console.log('🔍 Document Types API Call:', { timeframe, filter, url });
      const response = await axios.get(url);
      console.log('🔍 Document Types Response:', response.data);
      console.log('🔍 Filter applied:', filter, 'Results count:', response.data?.length || 0);
      
      // Transform the data to match the expected format and map prefixes to full names
      const transformedData = (response.data || []).map((item: any) => ({
        documentType: getDocumentTypeName(item.name),
        count: item.count
      }));
      
      setData(transformedData);
    } catch (error) {
      console.error("Failed to fetch document type data:", error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const getDocumentTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'item fulfillment':
        return '#1e40af'; // Dark Blue
      case 'purchase order':
      case 'purchase orders':
        return '#8b5cf6'; // Purple
      case 'sales order':
      case 'sales orders':
        return '#10b981'; // Green
      case 'return order':
      case 'return orders':
        return '#ef4444'; // Red
      case 'work order':
        return '#f59e0b'; // Orange
      case 'invoice':
        return '#06b6d4'; // Cyan
      case 'estimate':
        return '#84cc16'; // Lime
      case 'quote':
        return '#ec4899'; // Pink
      default:
        return '#6b7280'; // Gray
    }
  };

  const filterOptions = [
    { value: "All", label: "All" },
    { value: "Item Fulfillment", label: "Item Fulfillment" },
    { value: "Purchase Orders", label: "Purchase Orders" },
    { value: "Return Orders", label: "Return Authorization" },
    { value: "Other", label: "Other" }
  ];

  if (loading) {
    return (
      <Card className="bg-white/90 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border-0">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
          <CardTitle className="flex items-center space-x-2 text-blue-800">
            <FileText className="h-5 w-5 text-blue-600" />
            <span>Document Types - {timeframe}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Loading document types...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/90 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-300 border-0">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-blue-200">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2 text-blue-800">
            <FileText className="h-5 w-5 text-blue-600" />
            <span>Document Types - {timeframe}</span>
            {filter !== 'All' && (
              <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">
                Filtered: {filter}
              </span>
            )}
          </CardTitle>
          
          {/* Filter Dropdown */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-blue-600" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1 border border-blue-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {filterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {filter !== 'All' && (
              <button
                onClick={() => setFilter('All')}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
                title="Clear filter"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No document types found for {timeframe}</p>
            </div>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="documentType" 
                  tick={{ fontSize: 12, fill: '#666' }}
                  axisLine={{ stroke: '#e0e0e0' }}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#666' }}
                  axisLine={{ stroke: '#e0e0e0' }}
                  domain={[0, 'dataMax + 5']}
                />
                <Tooltip 
                  formatter={(value: number) => [value, 'Count']}
                  labelFormatter={(label: string) => `Document Type: ${label}`}
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e0e0e0',
                    borderRadius: '6px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="count" 
                  name="Document Count"
                  radius={[4, 4, 0, 0]}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getDocumentTypeColor(entry.documentType)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DocumentTypeChart;
