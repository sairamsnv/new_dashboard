export const revenueData = [
  { month: 'Jan', revenue: 4200, profit: 2400 },
  { month: 'Feb', revenue: 3800, profit: 1398 },
  { month: 'Mar', revenue: 5100, profit: 3200 },
  { month: 'Apr', revenue: 4600, profit: 2780 },
  { month: 'May', revenue: 5900, profit: 3890 },
  { month: 'Jun', revenue: 6800, profit: 4390 },
  { month: 'Jul', revenue: 7200, profit: 4490 },
  { month: 'Aug', revenue: 6400, profit: 3800 },
  { month: 'Sep', revenue: 7800, profit: 5200 },
  { month: 'Oct', revenue: 8100, profit: 5600 },
  { month: 'Nov', revenue: 7600, profit: 4900 },
  { month: 'Dec', revenue: 9200, profit: 6100 },
];

export const userGrowthData = [
  { month: 'Jan', users: 1200, newUsers: 320 },
  { month: 'Feb', users: 1450, newUsers: 280 },
  { month: 'Mar', users: 1680, newUsers: 350 },
  { month: 'Apr', users: 1920, newUsers: 310 },
  { month: 'May', users: 2340, newUsers: 480 },
  { month: 'Jun', users: 2580, newUsers: 390 },
  { month: 'Jul', users: 2847, newUsers: 420 },
  { month: 'Aug', users: 3100, newUsers: 380 },
  { month: 'Sep', users: 3420, newUsers: 450 },
  { month: 'Oct', users: 3780, newUsers: 510 },
  { month: 'Nov', users: 4100, newUsers: 470 },
  { month: 'Dec', users: 4520, newUsers: 560 },
];

export const trafficSourceData = [
  { name: 'Organic', value: 4200, fill: 'hsl(var(--chart-1))' },
  { name: 'Direct', value: 3100, fill: 'hsl(var(--chart-2))' },
  { name: 'Referral', value: 2100, fill: 'hsl(var(--chart-3))' },
  { name: 'Social', value: 1800, fill: 'hsl(var(--chart-4))' },
  { name: 'Email', value: 1200, fill: 'hsl(var(--chart-5))' },
];

export const transactionsData = [
  { id: 'TXN-001', customer: 'Alice Johnson', amount: '$1,250.00', status: 'Completed', date: '2024-03-15' },
  { id: 'TXN-002', customer: 'Bob Smith', amount: '$890.50', status: 'Pending', date: '2024-03-14' },
  { id: 'TXN-003', customer: 'Carol White', amount: '$2,100.00', status: 'Completed', date: '2024-03-14' },
  { id: 'TXN-004', customer: 'David Brown', amount: '$450.75', status: 'Failed', date: '2024-03-13' },
  { id: 'TXN-005', customer: 'Eve Davis', amount: '$3,200.00', status: 'Completed', date: '2024-03-13' },
  { id: 'TXN-006', customer: 'Frank Miller', amount: '$780.25', status: 'Pending', date: '2024-03-12' },
  { id: 'TXN-007', customer: 'Grace Wilson', amount: '$1,600.00', status: 'Completed', date: '2024-03-12' },
  { id: 'TXN-008', customer: 'Henry Taylor', amount: '$920.00', status: 'Completed', date: '2024-03-11' },
];

export const predictionTableData = [
  {
    id: 'PRED-001',
    metric: 'Inbound Volume',
    forecast: '+14%',
    confidence: '92%',
    horizon: 'Next 7 days',
    impact: 'High',
  },
  {
    id: 'PRED-002',
    metric: 'Picker Utilization',
    forecast: '-6%',
    confidence: '88%',
    horizon: 'Next 14 days',
    impact: 'Medium',
  },
  {
    id: 'PRED-003',
    metric: 'Late Shipment Risk',
    forecast: '+9%',
    confidence: '81%',
    horizon: 'This week',
    impact: 'High',
  },
  {
    id: 'PRED-004',
    metric: 'Inventory Carry Cost',
    forecast: '-4%',
    confidence: '85%',
    horizon: 'This month',
    impact: 'Low',
  },
];

export const insightsTableData = [
  {
    id: 'INS-001',
    title: 'Staff Workload Imbalance',
    category: 'Operations',
    priority: 'High',
    owner: 'David Scott',
    recommendation: 'Redistribute picking zones to reduce overload and prevent burnout.',
  },
  {
    id: 'INS-002',
    title: 'Performance Decline',
    category: 'Labor',
    priority: 'Medium',
    owner: 'David Scott',
    recommendation: 'Review training needs and shift allocation for underperforming tasks.',
  },
  {
    id: 'INS-003',
    title: 'Receiving Pattern Change',
    category: 'Receiving',
    priority: 'Medium',
    owner: 'Inbound Team',
    recommendation: 'Adjust dock scheduling and staging space for shifted SKU inflow.',
  },
  {
    id: 'INS-004',
    title: 'Demand Decline Alert',
    category: 'Inventory',
    priority: 'High',
    owner: 'Planning',
    recommendation: 'Reduce replenishment on affected SKU and review reorder rules.',
  },
];
