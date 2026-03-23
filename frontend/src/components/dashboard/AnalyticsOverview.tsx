
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, Clock, Package, Users, DollarSign, Activity } from "lucide-react";

const AnalyticsOverview = () => {
  const analytics = [
    {
      title: "Total Orders",
      value: "1,247",
      change: "+12.5%",
      trend: "up",
      description: "vs last month",
      icon: Package,
      color: "text-blue-600"
    },
    {
      title: "Active Users",
      value: "89",
      change: "+8.2%",
      trend: "up",
      description: "vs last month",
      icon: Users,
      color: "text-green-600"
    },
    {
      title: "Revenue Growth",
      value: "$45.2K",
      change: "+18.7%",
      trend: "up",
      description: "vs last month",
      icon: DollarSign,
      color: "text-purple-600"
    },
    {
      title: "System Uptime",
      value: "99.8%",
      change: "+0.3%",
      trend: "up",
      description: "reliability",
      icon: Activity,
      color: "text-orange-600"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {(analytics || []).map((item, index) => {
        const IconComponent = item.icon;
        const isPositive = item.trend === "up";
        
        return (
          <Card key={index} className="hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg bg-gray-100 ${item.color}`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">{item.title}</p>
                    <p className="text-2xl font-bold text-gray-900">{item.value}</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center space-x-2">
                <span className={`text-sm font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
                  {item.change}
                </span>
                <span className="text-sm text-gray-500">{item.description}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AnalyticsOverview;
