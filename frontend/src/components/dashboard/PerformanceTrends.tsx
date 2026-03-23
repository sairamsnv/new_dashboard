
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';

const PerformanceTrends = () => {
  const data = [
    { 
      month: 'Jan', 
      efficiency: 82, 
      throughput: 450, 
      accuracy: 96.5,
      costPerOrder: 12.30
    },
    { 
      month: 'Feb', 
      efficiency: 85, 
      throughput: 480, 
      accuracy: 97.1,
      costPerOrder: 11.80
    },
    { 
      month: 'Mar', 
      efficiency: 83, 
      throughput: 465, 
      accuracy: 96.8,
      costPerOrder: 12.10
    },
    { 
      month: 'Apr', 
      efficiency: 88, 
      throughput: 520, 
      accuracy: 97.5,
      costPerOrder: 11.20
    },
    { 
      month: 'May', 
      efficiency: 90, 
      throughput: 580, 
      accuracy: 98.2,
      costPerOrder: 10.90
    },
    { 
      month: 'Jun', 
      efficiency: 87, 
      throughput: 540, 
      accuracy: 97.8,
      costPerOrder: 11.40
    }
  ];

  return (
    <div className="space-y-6">
      {/* Efficiency and Throughput Trends */}
      <div className="h-80">
        <h3 className="text-lg font-semibold mb-4">Efficiency & Throughput Trends</h3>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="efficiency" 
              stackId="1"
              stroke="#10b981" 
              fill="#10b981"
              fillOpacity={0.3}
              name="Efficiency (%)"
            />
            <Area 
              type="monotone" 
              dataKey="throughput" 
              stackId="2"
              stroke="#3b82f6" 
              fill="#3b82f6"
              fillOpacity={0.3}
              name="Throughput (Orders)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Accuracy and Cost Trends */}
      <div className="h-80">
        <h3 className="text-lg font-semibold mb-4">Accuracy & Cost Per Order</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
            <YAxis stroke="#64748b" fontSize={12} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="accuracy" 
              stroke="#8b5cf6" 
              strokeWidth={3}
              name="Accuracy (%)"
              dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
            />
            <Line 
              type="monotone" 
              dataKey="costPerOrder" 
              stroke="#ef4444" 
              strokeWidth={3}
              name="Cost Per Order ($)"
              dot={{ fill: '#ef4444', strokeWidth: 2, r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PerformanceTrends;
