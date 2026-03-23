
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { getApiUrl, logApiConfig } from "@/lib/api";

const EmployeePerformance = ({ timeframe = "Today" }) => {
  const [barData, setBarData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    
    const url = getApiUrl(`api/employee-performance/?timeframe=${timeframe.toLowerCase()}`);
    logApiConfig(`api/employee-performance/?timeframe=${timeframe.toLowerCase()}`);
    
    axios
      .get(url)
      .then((res) => {
        console.log('🔍 Employee performance response:', res.data);
        console.log('🔍 Response status:', res.status);
        console.log('🔍 Response headers:', res.headers);
        console.log('🔍 Full response object:', res);
        
        // Transform snake_case API response to camelCase
        const barDataArray = Array.isArray(res.data?.bar_data) 
          ? res.data.bar_data.map((item: any) => ({
              name: item.name || '',
              picked: item.picked || 0,
              packed: item.packed || 0,
              received: item.received || 0
            }))
          : [];
        
        console.log('🔍 Processed bar data:', barDataArray);
        console.log('🔍 Bar data length:', barDataArray.length);
        
        setBarData(barDataArray);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch employee performance', err);
        console.error('Error response:', err.response?.data);
        console.error('Error status:', err.response?.status);
        console.error('Error URL:', url);
        setBarData([]);
        setLoading(false);
      });
  }, [timeframe]);

  if (loading) {
    return (
      <div className="h-80 bg-gray-100 animate-pulse rounded"></div>
    );
  }

  // Calculate number of users
  const userCount = barData.length;

  return (
    <div className="space-y-4">
      {/* User Count Display */}
      <div className="flex justify-end">
        <div className="text-sm font-medium text-gray-600">
          {userCount} {userCount === 1 ? 'user' : 'users'}
        </div>
      </div>

      {/* Bar Chart */}
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={barData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey="name" 
              stroke="#64748b"
              fontSize={12}
              angle={-45}
              textAnchor="end"
              height={80}
              interval={0}
            />
            <YAxis stroke="#64748b" fontSize={12} />
            <Legend wrapperStyle={{ paddingTop: '20px' }} />
            <Bar dataKey="picked" name="Picked" fill="#10b981" radius={[2, 2, 0, 0]}>
              <LabelList dataKey="picked" position="top" fontSize={10} fill="#10b981" />
            </Bar>
            <Bar dataKey="packed" name="Packed" fill="#8b5cf6" radius={[2, 2, 0, 0]}>
              <LabelList dataKey="packed" position="top" fontSize={10} fill="#8b5cf6" />
            </Bar>
            <Bar dataKey="received" name="Received" fill="#f97316" radius={[2, 2, 0, 0]}>
              <LabelList dataKey="received" position="top" fontSize={10} fill="#f97316" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default EmployeePerformance;
