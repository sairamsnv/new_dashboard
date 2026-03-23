
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertTriangle, Target } from "lucide-react";

const PredictiveAnalytics = () => {
  const forecastData = [
    { month: 'Jun (Actual)', orders: 47, predicted: 47, confidence: 100 },
    { month: 'Jul (Forecast)', orders: null, predicted: 52, confidence: 85 },
    { month: 'Aug (Forecast)', orders: null, predicted: 48, confidence: 80 },
    { month: 'Sep (Forecast)', orders: null, predicted: 56, confidence: 75 },
    { month: 'Oct (Forecast)', orders: null, predicted: 61, confidence: 70 },
    { month: 'Nov (Forecast)', orders: null, predicted: 58, confidence: 65 }
  ];

  const insights = [
    {
      type: "prediction",
      title: "Peak Season Forecast",
      description: "Order volume expected to increase 23% in Q4",
      impact: "high",
      icon: TrendingUp,
      recommendation: "Consider hiring 2-3 temporary staff"
    },
    {
      type: "warning",
      title: "Capacity Alert",
      description: "Current picking capacity may be insufficient for Oct-Nov",
      impact: "medium",
      icon: AlertTriangle,
      recommendation: "Optimize picking routes or extend operating hours"
    },
    {
      type: "opportunity",
      title: "Efficiency Improvement",
      description: "Automation could reduce processing time by 30%",
      impact: "high",
      icon: Target,
      recommendation: "Evaluate automated sorting system ROI"
    }
  ];

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Forecast Chart */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Order Volume Forecast</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecastData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis 
                  dataKey="month" 
                  stroke="#64748b"
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis stroke="#64748b" fontSize={12} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="orders" 
                  stroke="#10b981" 
                  strokeWidth={3}
                  name="Actual Orders"
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 6 }}
                  connectNulls={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="predicted" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Predicted Orders"
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                />
                <ReferenceLine x="Jun (Actual)" stroke="#ef4444" strokeDasharray="2 2" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Insights and Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {insights.map((insight, index) => {
          const IconComponent = insight.icon;
          return (
            <Card key={index} className="shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start space-x-3">
                  <div className={`p-2 rounded-lg ${
                    insight.type === 'prediction' ? 'bg-blue-100 text-blue-600' :
                    insight.type === 'warning' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-green-100 text-green-600'
                  }`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold text-gray-900">{insight.title}</h3>
                      <Badge className={getImpactColor(insight.impact)}>
                        {insight.impact.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{insight.description}</p>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs font-medium text-gray-700 mb-1">Recommendation:</p>
                      <p className="text-xs text-gray-600">{insight.recommendation}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default PredictiveAnalytics;
