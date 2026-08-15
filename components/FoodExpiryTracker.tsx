import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import {
  Plus,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Search,
  Filter,
  Package,
  Refrigerator,
  Utensils,
  ShoppingCart
} from 'lucide-react';
import { format, differenceInDays, isAfter, isBefore, addDays } from 'date-fns';

interface FoodItem {
  id: string;
  name: string;
  category: 'dairy' | 'meat' | 'vegetables' | 'fruits' | 'grains' | 'beverages' | 'other';
  quantity: number;
  unit: 'pieces' | 'kg' | 'grams' | 'liters' | 'ml';
  purchaseDate: string;
  expiryDate: string;
  storageLocation: 'fridge' | 'freezer' | 'pantry' | 'counter';
  notes?: string;
  status: 'fresh' | 'expiring_soon' | 'expired' | 'consumed';
  createdAt: string;
  updatedAt: string;
}

interface FoodExpiryTrackerProps {
  isActive: boolean;
  onClose: () => void;
}

const FoodExpiryTracker: React.FC<FoodExpiryTrackerProps> = ({ isActive, onClose }) => {
  const [foodItems, setFoodItems] = useState<FoodItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<FoodItem[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expiringSoonDays, setExpiringSoonDays] = useState(3);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'other' as FoodItem['category'],
    quantity: 1,
    unit: 'pieces' as FoodItem['unit'],
    purchaseDate: format(new Date(), 'yyyy-MM-dd'),
    expiryDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    storageLocation: 'pantry' as FoodItem['storageLocation'],
    notes: ''
  });

  // Load food items from localStorage on component mount
  useEffect(() => {
    if (isActive) {
      loadFoodItems();
    }
  }, [isActive]);

  // Filter items based on search and filters
  useEffect(() => {
    let filtered = foodItems;

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.notes?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category === categoryFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.status === statusFilter);
    }

    setFilteredItems(filtered);
  }, [foodItems, searchTerm, categoryFilter, statusFilter]);

  const loadFoodItems = () => {
    const saved = localStorage.getItem('foodExpiryItems');
    if (saved) {
      const items = JSON.parse(saved);
      setFoodItems(items);
    }
  };

  const saveFoodItems = (items: FoodItem[]) => {
    localStorage.setItem('foodExpiryItems', JSON.stringify(items));
    setFoodItems(items);
  };

  const getItemStatus = (item: FoodItem): FoodItem['status'] => {
    const today = new Date();
    const expiryDate = new Date(item.expiryDate);

    if (item.status === 'consumed') return 'consumed';

    if (isBefore(expiryDate, today)) return 'expired';

    const daysUntilExpiry = differenceInDays(expiryDate, today);
    if (daysUntilExpiry <= expiringSoonDays) return 'expiring_soon';

    return 'fresh';
  };

  const updateItemStatuses = useCallback(() => {
    setFoodItems(prevItems =>
      prevItems.map(item => ({
        ...item,
        status: getItemStatus(item)
      }))
    );
  }, [expiringSoonDays]);

  // Update statuses periodically
  useEffect(() => {
    updateItemStatuses();
    const interval = setInterval(updateItemStatuses, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [updateItemStatuses]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const now = new Date().toISOString();
    const newItem: FoodItem = {
      id: editingItem?.id || `food_${Date.now()}`,
      ...formData,
      status: getItemStatus({
        ...formData,
        id: '',
        status: 'fresh',
        createdAt: now,
        updatedAt: now
      } as FoodItem),
      createdAt: editingItem?.createdAt || now,
      updatedAt: now
    };

    if (editingItem) {
      setFoodItems(prev => prev.map(item =>
        item.id === editingItem.id ? newItem : item
      ));
    } else {
      setFoodItems(prev => [...prev, newItem]);
    }

    // Reset form
    setFormData({
      name: '',
      category: 'other',
      quantity: 1,
      unit: 'pieces',
      purchaseDate: format(new Date(), 'yyyy-MM-dd'),
      expiryDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      storageLocation: 'pantry',
      notes: ''
    });
    setIsAddingItem(false);
    setEditingItem(null);
  };

  const handleEdit = (item: FoodItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      purchaseDate: item.purchaseDate,
      expiryDate: item.expiryDate,
      storageLocation: item.storageLocation,
      notes: item.notes || ''
    });
    setIsAddingItem(true);
  };

  const handleDelete = (id: string) => {
    setFoodItems(prev => prev.filter(item => item.id !== id));
  };

  const handleStatusChange = (id: string, status: FoodItem['status']) => {
    setFoodItems(prev => prev.map(item =>
      item.id === id
        ? { ...item, status, updatedAt: new Date().toISOString() }
        : item
    ));
  };

  const getStatusColor = (status: FoodItem['status']) => {
    switch (status) {
      case 'fresh': return 'bg-green-500';
      case 'expiring_soon': return 'bg-yellow-500';
      case 'expired': return 'bg-red-500';
      case 'consumed': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: FoodItem['status']) => {
    switch (status) {
      case 'fresh': return <CheckCircle className="w-4 h-4" />;
      case 'expiring_soon': return <AlertTriangle className="w-4 h-4" />;
      case 'expired': return <XCircle className="w-4 h-4" />;
      case 'consumed': return <CheckCircle className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getCategoryIcon = (category: FoodItem['category']) => {
    switch (category) {
      case 'dairy': return <Refrigerator className="w-4 h-4" />;
      case 'meat': return <Utensils className="w-4 h-4" />;
      case 'vegetables':
      case 'fruits': return <Package className="w-4 h-4" />;
      case 'beverages': return <ShoppingCart className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getStorageIcon = (location: FoodItem['storageLocation']) => {
    switch (location) {
      case 'fridge': return <Refrigerator className="w-4 h-4" />;
      case 'freezer': return <Refrigerator className="w-4 h-4" />;
      case 'pantry': return <Package className="w-4 h-4" />;
      case 'counter': return <Package className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getExpiringSoonCount = () => {
    return foodItems.filter(item => getItemStatus(item) === 'expiring_soon').length;
  };

  const getExpiredCount = () => {
    return foodItems.filter(item => getItemStatus(item) === 'expired').length;
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Package className="w-6 h-6 text-blue-500" />
              Food Expiry Tracker
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddingItem(true)}
                className="flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </Button>
              <Button size="sm" variant="ghost" onClick={onClose}>
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4 mt-4">
            <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {foodItems.filter(item => getItemStatus(item) === 'fresh').length}
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">Fresh</div>
            </div>
            <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {getExpiringSoonCount()}
              </div>
              <div className="text-sm text-yellow-600 dark:text-yellow-400">Expiring Soon</div>
            </div>
            <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {getExpiredCount()}
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">Expired</div>
            </div>
            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {foodItems.length}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">Total Items</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  id="search"
                  placeholder="Search food items..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="min-w-[150px]">
              <Label htmlFor="category">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="dairy">Dairy</SelectItem>
                  <SelectItem value="meat">Meat</SelectItem>
                  <SelectItem value="vegetables">Vegetables</SelectItem>
                  <SelectItem value="fruits">Fruits</SelectItem>
                  <SelectItem value="grains">Grains</SelectItem>
                  <SelectItem value="beverages">Beverages</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[150px]">
              <Label htmlFor="status">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="fresh">Fresh</SelectItem>
                  <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="consumed">Consumed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="min-w-[150px]">
              <Label htmlFor="expiringDays">Expiring Soon (days)</Label>
              <Input
                id="expiringDays"
                type="number"
                min="1"
                max="30"
                value={expiringSoonDays}
                onChange={(e) => setExpiringSoonDays(parseInt(e.target.value) || 3)}
              />
            </div>
          </div>

          {/* Food Items Grid */}
          <ScrollArea className="h-[400px]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <Card key={item.id} className="relative">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(item.category)}
                        <h3 className="font-semibold text-sm">{item.name}</h3>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`${getStatusColor(item.status)} text-white flex items-center gap-1`}
                      >
                        {getStatusIcon(item.status)}
                        {item.status.replace('_', ' ')}
                      </Badge>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>Quantity:</span>
                        <span>{item.quantity} {item.unit}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Category:</span>
                        <span className="capitalize">{item.category}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Storage:</span>
                        <span className="flex items-center gap-1 capitalize">
                          {getStorageIcon(item.storageLocation)}
                          {item.storageLocation}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Expires:</span>
                        <span className={getItemStatus(item) === 'expired' ? 'text-red-500 font-medium' : ''}>
                          {format(new Date(item.expiryDate), 'MMM dd, yyyy')}
                        </span>
                      </div>
                      {item.notes && (
                        <div className="mt-2 p-2 bg-slate-50 dark:bg-slate-800 rounded text-xs">
                          {item.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-4">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(item)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(item.id)}
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>

                      <div className="flex gap-1">
                        {item.status !== 'consumed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(item.id, 'consumed')}
                            className="h-8 px-2 text-xs"
                          >
                            Mark Consumed
                          </Button>
                        )}
                        {item.status === 'consumed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStatusChange(item.id, 'fresh')}
                            className="h-8 px-2 text-xs"
                          >
                            Mark Fresh
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {filteredItems.length === 0 && (
              <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No food items found matching your criteria.</p>
                <Button
                  variant="outline"
                  onClick={() => setIsAddingItem(true)}
                  className="mt-4"
                >
                  Add Your First Item
                </Button>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Add/Edit Item Modal */}
      {isAddingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-white dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                {editingItem ? 'Edit Food Item' : 'Add Food Item'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Food Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value: FoodItem['category']) =>
                        setFormData(prev => ({ ...prev, category: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dairy">Dairy</SelectItem>
                        <SelectItem value="meat">Meat</SelectItem>
                        <SelectItem value="vegetables">Vegetables</SelectItem>
                        <SelectItem value="fruits">Fruits</SelectItem>
                        <SelectItem value="grains">Grains</SelectItem>
                        <SelectItem value="beverages">Beverages</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
                      step="0.1"
                      value={formData.quantity}
                      onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseFloat(e.target.value) || 0 }))}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Select
                    value={formData.unit}
                    onValueChange={(value: FoodItem['unit']) =>
                      setFormData(prev => ({ ...prev, unit: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pieces">Pieces</SelectItem>
                      <SelectItem value="kg">Kilograms</SelectItem>
                      <SelectItem value="grams">Grams</SelectItem>
                      <SelectItem value="liters">Liters</SelectItem>
                      <SelectItem value="ml">Milliliters</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="purchaseDate">Purchase Date</Label>
                    <Input
                      id="purchaseDate"
                      type="date"
                      value={formData.purchaseDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, purchaseDate: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label htmlFor="expiryDate">Expiry Date</Label>
                    <Input
                      id="expiryDate"
                      type="date"
                      value={formData.expiryDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="storageLocation">Storage Location</Label>
                  <Select
                    value={formData.storageLocation}
                    onValueChange={(value: FoodItem['storageLocation']) =>
                      setFormData(prev => ({ ...prev, storageLocation: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fridge">Refrigerator</SelectItem>
                      <SelectItem value="freezer">Freezer</SelectItem>
                      <SelectItem value="pantry">Pantry</SelectItem>
                      <SelectItem value="counter">Counter</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any additional notes..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" className="flex-1">
                    {editingItem ? 'Update Item' : 'Add Item'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddingItem(false);
                      setEditingItem(null);
                      setFormData({
                        name: '',
                        category: 'other',
                        quantity: 1,
                        unit: 'pieces',
                        purchaseDate: format(new Date(), 'yyyy-MM-dd'),
                        expiryDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
                        storageLocation: 'pantry',
                        notes: ''
                      });
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default FoodExpiryTracker;
