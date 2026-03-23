import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Filter } from 'lucide-react';
import { getApiUrl, logApiConfig } from "@/lib/api";

const MonthlyOrderTrends = ({ timeframe = "Today" }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [filter, setFilter] = useState('all');  

  // Helper function to sort months chronologically
  const sortMonthsChronologically = (data: any[]) => {
    const monthOrder: { [key: string]: number } = {
      'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
      'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
    };

    return [...data].sort((a, b) => {
      // Extract month abbreviation (e.g., "Jan" from "Jan 2025")
      const monthA = a.month?.split(' ')[0] || '';
      const monthB = b.month?.split(' ')[0] || '';
      
      // Extract year (e.g., "2025" from "Jan 2025")
      const yearA = parseInt(a.month?.split(' ')[1] || '0');
      const yearB = parseInt(b.month?.split(' ')[1] || '0');
      
      // First compare by year
      if (yearA !== yearB) {
        return yearA - yearB;
      }
      
      // Then compare by month
      const monthNumA = monthOrder[monthA] || 0;
      const monthNumB = monthOrder[monthB] || 0;
      
      return monthNumA - monthNumB;
    });
  };

  useEffect(() => {
    setLoading(true);
    const url = getApiUrl(`api/sales-purchase-trends/?type=${filter}&timeframe=${timeframe.toLowerCase()}`);
    logApiConfig(`api/sales-purchase-trends/?type=${filter}&timeframe=${timeframe.toLowerCase()}`);

    axios
      .get(url)
      .then((res) => {
        // Ensure we have an array
        const dataArray = Array.isArray(res.data) ? res.data : [];
        // Sort months chronologically
        const sortedData = sortMonthsChronologically(dataArray);
        setData(sortedData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch trends!', err);
        setData([]);
        setLoading(false);
      }); 
  }, [filter, timeframe]);

  return (
    <div>
      {/* Filter placed on the right side */}
      <div className="flex justify-end items-center mb-4 gap-2">
        <Filter className="h-5 w-5 opacity-70" />
        <select
          id="filter"
          onChange={(e) => setFilter(e.target.value)}
          value={filter}
          className="p-1 border rounded"
        >
          <option value="all">All</option>
          <option value="so">Sales Orders</option>
          <option value="po">Purchase Orders</option>
        </select>
      </div>

      {/* Chart */}
      <div className="h-80">
        {loading ? (
          <div className="h-full bg-gray-100 animate-pulse rounded"></div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis 
                dataKey="month" 
                stroke="#64748b" 
                fontSize={12} 
              />
              <YAxis stroke="#64748b" fontSize={12} />
              <Legend />
              <Bar 
                dataKey="sales" 
                name="Sales Orders" 
                fill="#1e40af" 
                radius={[4, 4, 0, 0]} 
                label={{ position:'top', fill:'#000', fontSize:'12px' }}
              />
              <Bar 
                dataKey="purchases" 
                name="Purchase Orders" 
                fill="#9333ea" 
                radius={[4, 4, 0, 0]} 
                label={{ position:'top', fill:'#000', fontSize:'12px' }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
};

export default MonthlyOrderTrends;



