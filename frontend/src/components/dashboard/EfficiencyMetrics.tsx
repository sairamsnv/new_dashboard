
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

const EfficiencyMetrics = () => {
  const metrics = [
    {
      category: "Picking Efficiency",
      current: 87,
      target: 90,
      items: [
        { name: "Items per Hour", value: 145, target: 160, unit: "items/hr" },
        { name: "Pick Accuracy", value: 98.2, target: 99, unit: "%" },
        { name: "Travel Time", value: 12, target: 10, unit: "min/pick", inverse: true }
      ]
    },
    {
      category: "Packing Efficiency", 
      current: 82,
      target: 85,
      items: [
        { name: "Packages per Hour", value: 85, target: 95, unit: "pkg/hr" },
        { name: "Packing Accuracy", value: 97.8, target: 98.5, unit: "%" },
        { name: "Material Usage", value: 92, target: 95, unit: "%" }
      ]
    },
    {
      category: "Receiving Efficiency",
      current: 91,
      target: 88,
      items: [
        { name: "Unload Speed", value: 95, target: 90, unit: "items/hr" },
        { name: "Processing Time", value: 1.8, target: 2.0, unit: "hrs", inverse: true },
        { name: "Quality Check", value: 99.1, target: 98, unit: "%" }
      ]
    }
  ];

  const getProgressColor = (current: number, target: number, inverse = false) => {
    const ratio = inverse ? target / current : current / target;
    if (ratio >= 1) return "bg-emerald-500";
    if (ratio >= 0.9) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getStatusBadge = (current: number, target: number, inverse = false) => {
    const ratio = inverse ? target / current : current / target;
    if (ratio >= 1) return <Badge className="bg-emerald-100 text-emerald-800">On Target</Badge>;
    if (ratio >= 0.9) return <Badge className="bg-yellow-100 text-yellow-800">Close</Badge>;
    return <Badge className="bg-red-100 text-red-800">Below Target</Badge>;
  };

  return (
    <div className="space-y-6">
      {metrics.map((category, index) => (
        <Card key={index} className="shadow-lg">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{category.category}</CardTitle>
              {getStatusBadge(category.current, category.target)}
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Overall Score: {category.current}%</span>
                <span>Target: {category.target}%</span>
              </div>
              <Progress 
                value={category.current} 
                className="h-2"
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {category.items.map((item, itemIndex) => (
              <div key={itemIndex} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-sm text-gray-600">
                      {item.value}{item.unit} / {item.target}{item.unit}
                    </span>
                  </div>
                  <Progress 
                    value={item.inverse ? (item.target / item.value) * 100 : (item.value / item.target) * 100}
                    className="h-1.5"
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default EfficiencyMetrics;
