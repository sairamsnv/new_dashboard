
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle, TrendingUp, Users, Package } from "lucide-react";

const SummaryInsights = () => {
  const keyMetrics = {
    totalOrders: 7,
    completionRate: 85.7,
    avgProcessingTime: 2.4,
    topPerformer: "David Scott",
    criticalIssues: 1,
    improvements: 3
  };

  const statusItems = [
    {
      category: "Order Processing",
      status: "good",
      message: "85.7% of orders completed on time",
      icon: CheckCircle,
      color: "text-emerald-600"
    },
    {
      category: "Inventory Management", 
      status: "warning",
      message: "Some items approaching low stock levels",
      icon: AlertCircle,
      color: "text-yellow-600"
    },
    {
      category: "Staff Performance",
      status: "excellent",
      message: "Team exceeding productivity targets",
      icon: Users,
      color: "text-emerald-600"
    },
    {
      category: "System Health",
      status: "good",
      message: "All systems operational",
      icon: Package,
      color: "text-emerald-600"
    }
  ];

  const recommendations = [
    {
      priority: "high",
      title: "Staff Scheduling Optimization",
      description: "Peak hours analysis suggests redistributing staff for better coverage",
      impact: "15% efficiency improvement"
    },
    {
      priority: "medium", 
      title: "Inventory Reorder Points",
      description: "Adjust reorder points for faster-moving items to prevent stockouts",
      impact: "Reduce stockout risk by 40%"
    },
    {
      priority: "low",
      title: "Process Documentation",
      description: "Update picking procedures documentation based on recent optimizations",
      impact: "Improved training efficiency"
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'excellent':
        return <Badge className="bg-emerald-100 text-emerald-800">Excellent</Badge>;
      case 'good':
        return <Badge className="bg-blue-100 text-blue-800">Good</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">Attention</Badge>;
      case 'critical':
        return <Badge className="bg-red-100 text-red-800">Critical</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">Unknown</Badge>;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500 bg-red-50';
      case 'medium': return 'border-l-yellow-500 bg-yellow-50';
      case 'low': return 'border-l-green-500 bg-green-50';
      default: return 'border-l-gray-500 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics Summary */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <span>Today's Performance Summary</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">{keyMetrics.totalOrders}</div>
              <div className="text-sm text-gray-600">Total Orders</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-600">{keyMetrics.completionRate}%</div>
              <div className="text-sm text-gray-600">Completion Rate</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-600">{keyMetrics.avgProcessingTime}h</div>
              <div className="text-sm text-gray-600">Avg Processing</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-600">{keyMetrics.topPerformer}</div>
              <div className="text-sm text-gray-600">Top Performer</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{keyMetrics.criticalIssues}</div>
              <div className="text-sm text-gray-600">Critical Issues</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{keyMetrics.improvements}</div>
              <div className="text-sm text-gray-600">Improvements</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>System Status Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {statusItems.map((item, index) => {
              const IconComponent = item.icon;
              return (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <IconComponent className={`h-5 w-5 ${item.color}`} />
                    <div>
                      <div className="font-medium text-gray-900">{item.category}</div>
                      <div className="text-sm text-gray-600">{item.message}</div>
                    </div>
                  </div>
                  {getStatusBadge(item.status)}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Action Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recommendations.map((rec, index) => (
              <div key={index} className={`border-l-4 p-4 rounded-r-lg ${getPriorityColor(rec.priority)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold text-gray-900">{rec.title}</h3>
                      <Badge variant="outline" className={
                        rec.priority === 'high' ? 'border-red-500 text-red-700' :
                        rec.priority === 'medium' ? 'border-yellow-500 text-yellow-700' :
                        'border-green-500 text-green-700'
                      }>
                        {rec.priority.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
                    <p className="text-xs font-medium text-gray-700">Expected Impact: {rec.impact}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SummaryInsights;
