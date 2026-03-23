import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Users, Package, CheckCircle, Clock } from 'lucide-react';
import { getApiUrl } from '@/lib/api';

interface DriverPerformanceData {
  driver: string;
  completed: number;
  inProgress: number;
  notStarted: number;
  total: number;
}

interface DriverPerformanceChartProps {
  timeframe: string;
}

const DriverPerformanceChart: React.FC<DriverPerformanceChartProps> = ({ timeframe }) => {
  const [data, setData] = useState<DriverPerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDriverPerformance();
  }, [timeframe]);

  const fetchDriverPerformance = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const url = getApiUrl(`api/dr/stats/?timeframe=${timeframe.toLowerCase()}`);
      console.log('🔍 Fetching driver performance from:', url);
      console.log('🔍 Timeframe being used:', timeframe);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch driver performance data');
      }
      
      const result = await response.json();
      console.log('📊 Driver performance data received:', result);
      
      // Transform snake_case to camelCase
      const transformedData = (result.driver_performance || []).map((item: any) => ({
        driver: item.driver || item.deliveredBy || '',
        completed: item.completed || 0,
        inProgress: item.in_progress || item.inProgress || 0,
        notStarted: item.not_started || item.notStarted || 0,
        total: item.total || 0
      }));
      
      setData(transformedData);
    } catch (err) {
      console.error('Error fetching driver performance:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  // Color palette for bars
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
    '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'
  ];

  const getBarColor = (index: number) => colors[index % colors.length];

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Driver Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse space-y-4 w-full">
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-2/3"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Driver Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-red-500">
            <div className="text-center">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Failed to load driver performance data</p>
              <button 
                onClick={fetchDriverPerformance}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Retry
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Driver Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No driver performance data available</p>
              <p className="text-sm mt-2">Data will appear once POD orders are processed</p>
              <button 
                onClick={fetchDriverPerformance}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Refresh Data
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          Driver Performance
          <span className="text-sm font-normal text-gray-500">
            ({data.length} drivers)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 60,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis 
                dataKey="driver" 
                angle={-45}
                textAnchor="end"
                height={80}
                fontSize={12}
                interval={0}
              />
              <YAxis 
                label={{ value: 'Load Plans', angle: -90, position: 'insideLeft' }}
                fontSize={12}
              />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  value, 
                  name === 'completed' ? 'Completed' : 
                  name === 'in_progress' ? 'In Progress' : 
                  name === 'not_started' ? 'Not Started' : name
                ]}
                labelFormatter={(label: string) => `Driver: ${label}`}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <Legend />
              <Bar 
                dataKey="completed" 
                name="Completed"
                fill="#10B981"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="inProgress" 
                name="In Progress"
                fill="#F59E0B"
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="notStarted" 
                name="Not Started"
                fill="#EF4444"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-5 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {data.length}
            </div>
            <div className="text-sm text-gray-600">Total Drivers</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {data.reduce((sum, item) => sum + item.completed, 0)}
            </div>
            <div className="text-sm text-gray-600">Completed Load Plans</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">
              {data.reduce((sum, item) => sum + item.in_progress, 0)}
            </div>
            <div className="text-sm text-gray-600">In Progress</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {data.reduce((sum, item) => sum + item.not_started, 0)}
            </div>
            <div className="text-sm text-gray-600">Not Started</div>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {data.reduce((sum, item) => sum + item.total, 0)}
            </div>
            <div className="text-sm text-gray-600">Total Load Plans</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DriverPerformanceChart;
