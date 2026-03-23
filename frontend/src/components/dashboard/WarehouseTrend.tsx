
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend } from 'recharts';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl, logApiConfig } from "@/lib/api";

const WarehouseTrend = ({ selectedYear = "2025" }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const url = getApiUrl(`api/warehouse-trend/?year=${selectedYear}`);
    logApiConfig(`api/warehouse-trend/?year=${selectedYear}`);
    axios
      .get(url)
      .then((res) => {
        // Ensure we have an array
        const dataArray = Array.isArray(res.data) ? res.data : [];
        setData(dataArray);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch warehouse trend', err);
        setData([]);
        setLoading(false);
      });
  }, [selectedYear]);

  if (loading) {
    return (
      <div className="h-80 bg-gray-100 animate-pulse rounded"></div>
    );
  }

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="month" 
            stroke="#64748b"
            fontSize={12}
          />
          <YAxis stroke="#64748b" fontSize={12} />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="picked" 
            stroke="#10b981" 
            strokeWidth={3}
            name="Picked Orders"
            dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
          />
          <Line 
            type="monotone" 
            dataKey="packed" 
            stroke="#8b5cf6" 
            strokeWidth={3}
            name="Packed Orders"
            dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
          />
          <Line 
            type="monotone" 
            dataKey="received" 
            stroke="#ef4444" 
            strokeWidth={3}
            name="Received Orders"
            dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default WarehouseTrend;
