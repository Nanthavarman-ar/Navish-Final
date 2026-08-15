import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Progress } from './ui/progress';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Calendar,
  DollarSign,
  ShoppingCart,
  Trash2,
  Leaf,
  Target,
  Clock,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';

interface AnalyticsData {
  totalItems: number;
  expiringSoon: number;
  expired: number;
  consumed: number;
  wasted: number;
  totalValue: number;
  wasteValue: number;
  consumptionRate: number;
  wasteRate: number;
  categoryBreakdown: Array<{
    category: string;
    count: number;
    value: number;
    wasteCount: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    added: number;
    consumed: number;
    wasted: number;
    value: number;
  }>;
  expiryPredictions: Array<{
    itemName: string;
    predictedDays: number;
    confidence: number;
    category: string;
  }>;
  shoppingRecommendations: Array<{
    item: string;
    reason: string;
    frequency: number;
    avgConsumption: number;
  }>;
}

interface AnalyticsDashboardProps {
  isActive: boolean;
  onClose: () => void;
  data?: AnalyticsData;
  onRefresh?: () => void;
  onExport?: (format: 'csv' | 'pdf' | 'json') => void;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  isActive,
  onClose,
  data,
  onRefresh,
  onExport
}) => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);

  // Mock data for demonstration - in real app, this would come from props or API
  const mockData: AnalyticsData = {
    totalItems: 156,
    expiringSoon: 12,
    expired: 5,
    consumed: 89,
    wasted: 8,
    totalValue: 1247.50,
    wasteValue: 67.30,
    consumptionRate: 2.8,
    wasteRate: 8.2,
    categoryBreakdown: [
      { category: 'Dairy', count: 23, value: 156.80, wasteCount: 2 },
      { category: 'Vegetables', count: 34, value: 89.60, wasteCount: 1 },
      { category: 'Fruits', count: 28, value: 134.20, wasteCount: 3 },
      { category: 'Meat', count: 15, value: 234.50, wasteCount: 1 },
      { category: 'Grains', count: 31, value: 98.40, wasteCount: 0 },
      { category: 'Other', count: 25, value: 534.00, wasteCount: 1 }
    ],
    monthlyTrends: [
      { month: 'Jan', added: 45, consumed: 38, wasted: 3, value: 320.50 },
      { month: 'Feb', added: 52, consumed: 41, wasted: 4, value: 378.20 },
      { month: 'Mar', added: 48, consumed: 44, wasted: 2, value: 412.30 },
      { month: 'Apr', added: 56, consumed: 49, wasted: 5, value: 445.80 }
    ],
    expiryPredictions: [
      { itemName: 'Milk (2L)', predictedDays: 3, confidence: 0.85, category: 'Dairy' },
      { itemName: 'Chicken Breast', predictedDays: 2, confidence: 0.92, category: 'Meat' },
      { itemName: 'Spinach', predictedDays: 1, confidence: 0.78, category: 'Vegetables' },
      { itemName: 'Apples', predictedDays: 5, confidence: 0.71, category: 'Fruits' }
    ],
    shoppingRecommendations: [
      { item: 'Bananas', reason: 'Frequently consumed, running low', frequency: 3, avgConsumption: 6 },
      { item: 'Bread', reason: 'High consumption rate', frequency: 4, avgConsumption: 8 },
      { item: 'Eggs', reason: 'Consistent weekly purchase', frequency: 2, avgConsumption: 12 },
      { item: 'Yogurt', reason: 'Popular healthy option', frequency: 2, avgConsumption: 4 }
    ]
  };

  const currentData = data || mockData;

  const handleRefresh = async () => {
    setIsLoading(true);
    if (onRefresh) {
      await onRefresh();
    }
    setTimeout(() => setIsLoading(false), 1000);
  };

  const handleExport = (format: 'csv' | 'pdf' | 'json') => {
    if (onExport) {
      onExport(format);
    }
  };

  const filteredCategories = selectedCategory === 'all'
    ? currentData.categoryBreakdown
    : currentData.categoryBreakdown.filter(cat => cat.category === selectedCategory);

  const wastePercentage = (currentData.wasted / (currentData.consumed + currentData.wasted)) * 100;
  const efficiencyScore = Math.max(0, 100 - wastePercentage - (currentData.expired / currentData.totalItems) * 100);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-7xl max-h-[95vh] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <BarChart3 className="w-6 h-6 text-blue-500" />
              Food Analytics Dashboard
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>

              <Button size="sm" variant="outline" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              <Button size="sm" variant="ghost" onClick={onClose}>
                <AlertTriangle className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 overflow-y-auto max-h-[calc(95vh-120px)]">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {currentData.totalItems}
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-400">Total Items</div>
                </div>
                <ShoppingCart className="w-8 h-8 text-blue-500" />
              </div>
            </div>

            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {currentData.expiringSoon}
                  </div>
                  <div className="text-sm text-orange-600 dark:text-orange-400">Expiring Soon</div>
                </div>
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
            </div>

            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {currentData.expired}
                  </div>
                  <div className="text-sm text-red-600 dark:text-red-400">Expired</div>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>

            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {currentData.consumed}
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-400">Consumed</div>
                </div>
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
            </div>

            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    ${currentData.totalValue.toFixed(2)}
                  </div>
                  <div className="text-sm text-purple-600 dark:text-purple-400">Total Value</div>
                </div>
                <DollarSign className="w-8 h-8 text-purple-500" />
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-600 dark:text-gray-400">
                    {efficiencyScore.toFixed(0)}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Efficiency</div>
                </div>
                <Target className="w-8 h-8 text-gray-500" />
              </div>
            </div>
          </div>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
              <TabsTrigger value="predictions">Predictions</TabsTrigger>
              <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Category Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Category Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {filteredCategories.map((category) => (
                        <div key={category.category} className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">{category.category}</span>
                            <div className="flex gap-2">
                              <Badge variant="outline">{category.count} items</Badge>
                              <Badge variant={category.wasteCount > 0 ? 'destructive' : 'default'}>
                                {category.wasteCount} wasted
                              </Badge>
                            </div>
                          </div>
                          <Progress
                            value={(category.count / currentData.totalItems) * 100}
                            className="h-2"
                          />
                          <div className="text-sm text-slate-500">
                            Value: ${category.value.toFixed(2)} • Waste Rate: {((category.wasteCount / category.count) * 100).toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Waste Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Total Waste</span>
                        <span className="font-bold text-red-600">
                          {wastePercentage.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={wastePercentage} className="h-3" />

                      <div className="grid grid-cols-2 gap-4 pt-4">
                        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <Trash2 className="w-8 h-8 mx-auto mb-2 text-red-500" />
                          <div className="text-lg font-bold text-red-600">
                            {currentData.wasted}
                          </div>
                          <div className="text-sm text-red-600">Items Wasted</div>
                        </div>

                        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <DollarSign className="w-8 h-8 mx-auto mb-2 text-red-500" />
                          <div className="text-lg font-bold text-red-600">
                            ${currentData.wasteValue.toFixed(2)}
                          </div>
                          <div className="text-sm text-red-600">Value Lost</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="trends" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Monthly Trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {currentData.monthlyTrends.map((month) => (
                      <div key={month.month} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-center mb-3">
                          <span className="font-semibold">{month.month} 2024</span>
                          <span className="text-sm text-slate-500">
                            Value: ${month.value.toFixed(2)}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div className="text-center">
                            <div className="font-bold text-green-600">{month.added}</div>
                            <div className="text-slate-500">Added</div>
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-blue-600">{month.consumed}</div>
                            <div className="text-slate-500">Consumed</div>
                          </div>
                          <div className="text-center">
                            <div className="font-bold text-red-600">{month.wasted}</div>
                            <div className="text-slate-500">Wasted</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="predictions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Expiry Predictions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {currentData.expiryPredictions.map((prediction, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">{prediction.itemName}</div>
                          <div className="text-sm text-slate-500">{prediction.category}</div>
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-orange-600">
                            {prediction.predictedDays} days
                          </div>
                          <div className="text-sm text-slate-500">
                            {Math.round(prediction.confidence * 100)}% confidence
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Smart Shopping Recommendations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {currentData.shoppingRecommendations.map((rec, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div className="font-semibold text-lg">{rec.item}</div>
                          <Badge variant="outline">
                            {rec.frequency}x/week
                          </Badge>
                        </div>

                        <p className="text-slate-600 dark:text-slate-400 mb-3">
                          {rec.reason}
                        </p>

                        <div className="flex justify-between text-sm">
                          <span>Average consumption: {rec.avgConsumption} units</span>
                          <span className="font-medium text-green-600">
                            Recommended: {Math.ceil(rec.avgConsumption / rec.frequency)} units
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Export Options */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('pdf')}>
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport('json')}>
                <Download className="w-4 h-4 mr-2" />
                Export JSON
              </Button>
            </div>

            <div className="text-sm text-slate-500">
              Last updated: {new Date().toLocaleString()}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;
