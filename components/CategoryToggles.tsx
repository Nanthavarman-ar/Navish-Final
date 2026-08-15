import React from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import { ChevronDown, ChevronRight, Settings, Filter } from 'lucide-react';

interface CategoryInfo {
  name: string;
  count: number;
  activeCount: number;
  color: string;
  priority: number;
  description?: string;
}

interface CategoryTogglesProps {
  categories: Record<string, CategoryInfo>;
  visibleCategories: Record<string, boolean>;
  onCategoryToggle: (category: string) => void;
  onToggleAll: (visible: boolean) => void;
  onFilterByPriority: (priority: number) => void;
  activeFilter?: number;
  layout: 'expanded' | 'compact' | 'minimal';
}

const CategoryToggles: React.FC<CategoryTogglesProps> = ({
  categories,
  visibleCategories,
  onCategoryToggle,
  onToggleAll,
  onFilterByPriority,
  activeFilter,
  layout = 'expanded'
}) => {
  const allVisible = Object.values(visibleCategories).every(Boolean);
  const noneVisible = Object.values(visibleCategories).every(v => !v);

  const getCategoryColor = (color: string) => {
    const colors = {
      blue: 'border-blue-500 bg-blue-500/10',
      green: 'border-green-500 bg-green-500/10',
      purple: 'border-purple-500 bg-purple-500/10',
      orange: 'border-orange-500 bg-orange-500/10',
      pink: 'border-pink-500 bg-pink-500/10',
      cyan: 'border-cyan-500 bg-cyan-500/10',
      teal: 'border-teal-500 bg-teal-500/10',
      gray: 'border-gray-500 bg-gray-500/10',
      slate: 'border-slate-500 bg-slate-500/10'
    };
    return colors[color as keyof typeof colors] || colors.gray;
  };

  const CategoryButton: React.FC<{ categoryKey: string; category: CategoryInfo }> = ({
    categoryKey,
    category
  }) => {
    const isVisible = visibleCategories[categoryKey];
    const hasActiveFeatures = category.activeCount > 0;

    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Button
          type="button"
          variant={isVisible ? "default" : "outline"}
          size="sm"
          onClick={() => onCategoryToggle(categoryKey)}
          className={`h-auto p-3 flex flex-col items-center space-y-1 relative ${
            isVisible
              ? `bg-${category.color}-600 hover:bg-${category.color}-700 text-white`
              : `bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 ${getCategoryColor(category.color)}`
          }`}
        >
          <div className="flex items-center space-x-1">
            {isVisible ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <span className="text-xs font-medium">{category.name}</span>
          </div>

          <div className="flex items-center space-x-1">
            <Badge
              variant="secondary"
              className={`text-xs px-1 py-0 ${hasActiveFeatures ? 'bg-green-600' : ''}`}
            >
              {category.activeCount}/{category.count}
            </Badge>
          </div>

          {/* Priority indicator */}
          {category.priority <= 3 && (
            <div className="absolute top-1 right-1 w-2 h-2 bg-yellow-500 rounded-full" />
          )}
        </Button>
      </motion.div>
    );
  };

  if (layout === 'minimal') {
    return (
      <div className="flex flex-wrap gap-1 p-2">
        {Object.entries(categories).map(([key, category]) => (
          <CategoryButton key={key} categoryKey={key} category={category} />
        ))}
      </div>
    );
  }

  if (layout === 'compact') {
    return (
      <Card className="bg-gray-800 border-gray-600">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-white">Categories</h3>
            <div className="flex space-x-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleAll(!allVisible); }}
                className="text-xs"
              >
                {allVisible ? 'Hide All' : 'Show All'}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {Object.entries(categories).map(([key, category]) => (
              <CategoryButton key={key} categoryKey={key} category={category} />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Expanded layout
  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Feature Categories</h2>
        <div className="flex items-center space-x-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleAll(!allVisible); }}
            className="text-xs"
          >
            {allVisible ? 'Collapse All' : 'Expand All'}
          </Button>

          <div className="flex space-x-1">
            {[1, 2, 3].map(priority => (
              <Button
                type="button"
                key={priority}
                size="sm"
                variant={activeFilter === priority ? "default" : "outline"}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFilterByPriority(priority); }}
                className="text-xs px-2"
              >
                P{priority}
              </Button>
            ))}
            <Button
              type="button"
              size="sm"
              variant={activeFilter === undefined || activeFilter === 0 ? "default" : "outline"}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFilterByPriority(0); }}
              className="text-xs px-2"
            >
              All
            </Button>
          </div>
        </div>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-3 gap-3">
        {Object.entries(categories)
          .filter(([_, category]) => activeFilter === undefined || activeFilter === 0 || category.priority === activeFilter)
          .map(([key, category]) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className={`bg-gray-800 border-gray-600 ${getCategoryColor(category.color)}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-medium text-white">{category.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        P{category.priority}
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onCategoryToggle(key)}
                      className="p-1 h-auto"
                    >
                      {visibleCategories[key] ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>Features</span>
                      <span>{category.activeCount}/{category.count} active</span>
                    </div>

                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${category.color === 'blue' ? 'bg-blue-500' :
                          category.color === 'green' ? 'bg-green-500' :
                          category.color === 'purple' ? 'bg-purple-500' :
                          'bg-gray-500'}`}
                        style={{ width: `${(category.activeCount / category.count) * 100}%` }}
                      />
                    </div>

                    {category.description && (
                      <p className="text-xs text-gray-400 mt-2">{category.description}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
      </div>

      {/* Summary Stats */}
      <Card className="bg-gray-800 border-gray-600">
        <CardContent className="p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">
                {Object.values(categories).reduce((sum, cat) => sum + cat.count, 0)}
              </div>
              <div className="text-xs text-gray-400">Total Features</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-500">
                {Object.values(categories).reduce((sum, cat) => sum + cat.activeCount, 0)}
              </div>
              <div className="text-xs text-gray-400">Active</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-500">
                {Object.keys(categories).length}
              </div>
              <div className="text-xs text-gray-400">Categories</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-500">
                {Object.values(categories).filter(cat => cat.priority <= 3).length}
              </div>
              <div className="text-xs text-gray-400">Priority</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CategoryToggles;
