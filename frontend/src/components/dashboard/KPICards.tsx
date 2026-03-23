import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import axios from "axios";
import { getApiUrl, logApiConfig } from "@/lib/api";

interface KPICardsProps {
  timeframe?: string;
  onKPIClick?: (filter: string) => void;
}

const KPICards = ({ timeframe = "Today", onKPIClick }: KPICardsProps) => {
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    
    const url = getApiUrl(`api/kpis/?timeframe=${timeframe.toLowerCase()}`);
    logApiConfig(`api/kpis/?timeframe=${timeframe.toLowerCase()}`);
    
    axios
      .get(url)
      .then((res) => {
        console.log('KPI API Response:', res.data); // Debug log
        
        // Handle different response structures
        let kpiData = [];
        if (Array.isArray(res.data)) {
          kpiData = res.data;
        } else if (res.data && Array.isArray(res.data.results)) {
          kpiData = res.data.results;
        } else if (res.data && Array.isArray(res.data.data)) {
          kpiData = res.data.data;
        } else if (res.data && typeof res.data === 'object') {
          // If it's an object, try to extract array from it
          const values = Object.values(res.data);
          if (values.length > 0 && Array.isArray(values[0])) {
            kpiData = values[0];
          }
        }
        
        console.log('Processed KPI data:', kpiData); // Debug log
        setKpis(kpiData);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch kpis", err);
        // Fallback to hardcoded data if API fails
        const fallbackKpis = [
          {"title": "Total", "value": 100},
          {"title": "Picked", "value": 45},
          {"title": "Packed", "value": 30},
          {"title": "Received", "value": 85},
        ];
        setKpis(fallbackKpis);
        setLoading(false);
      }); 
  }, [timeframe]);

  // Ensure kpis is always an array and has content
  const safeKpis = Array.isArray(kpis) ? kpis : [];
  
  // Helper function to find KPI value by title
  const getKpiValue = (title: string) => {
    const kpi = safeKpis.find((k: any) => k.title?.toLowerCase() === title.toLowerCase());
    return kpi?.value || 0;
  };
  
  // Extract values
  const pickedValue = getKpiValue("Picked");
  const packedValue = getKpiValue("Packed");
  const receivedValue = getKpiValue("Received");
  
  // Calculate new values
  const totalValue = pickedValue + receivedValue;
  const readyToPackValue = Math.max(0, pickedValue - packedValue); // Ensure non-negative
  
  // Define cards with new structure
  const newKpiCards = [
    {
      title: "Total",
      value: totalValue,
      color: "bg-blue-500",
      filter: null // No specific filter for Total
    },
    {
      title: "Pick/Pack",
      value: `${pickedValue}/${packedValue}`,
      color: "bg-emerald-500",
      filter: "Picked" // Navigate to Picked tab
    },
    {
      title: "Ready to Pack",
      value: readyToPackValue,
      color: "bg-purple-500",
      filter: "Picked" // Navigate to Picked tab (since ready to pack = picked - packed)
    },
    {
      title: "Received",
      value: receivedValue,
      color: "bg-orange-500", // Changed from red to orange
      filter: "Received" // Navigate to Received tab
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-0 shadow-lg animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded mb-2"></div>
              <div className="h-8 bg-gray-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const handleCardClick = (filter: string | null) => {
    if (filter && onKPIClick) {
      onKPIClick(filter);
    }
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {newKpiCards.map((kpi, index) => (
        <Card
          key={index}
          onClick={() => handleCardClick(kpi.filter)}
          className={`${kpi.color} border-0 shadow-lg transform hover:scale-105 transition-transform duration-200 text-center p-6 ${
            kpi.filter ? 'cursor-pointer' : ''
          }`}
        >
          <div className="opacity-90 text-sm font-semibold mb-2">
            {kpi.title}:
          </div>
          <div className="text-3xl font-bold">
            {kpi.value}
          </div>
        </Card>
      ))}
    </div>
  )
}

export default KPICards;


