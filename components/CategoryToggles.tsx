import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

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
  // No longer surfaced in the UI (the old P1/P2/P3 priority tabs and per-category
  // progress-bar/stats card added a lot of visual noise without helping anyone
  // actually find and click the tool they wanted) - kept optional so existing callers
  // don't need to change.
  onFilterByPriority?: (priority: number) => void;
  activeFilter?: number;
  layout?: 'expanded' | 'compact' | 'minimal';
}

// A plain accordion: one row per category, tap to expand/collapse. Replaces the old
// three-variant layout (grid of stat cards with progress bars, a "Summary Stats" card
// totalling every feature in the app, P1/P2/P3 priority filter tabs) that buried the
// actual tool list under a lot of numbers nobody using this as a working tool needed.
const CategoryToggles: React.FC<CategoryTogglesProps> = ({
  categories,
  visibleCategories,
  onCategoryToggle,
  onToggleAll
}) => {
  const entries = Object.entries(categories);
  const allVisible = entries.length > 0 && entries.every(([key]) => visibleCategories[key]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-300">Tool Categories</h2>
        <button
          type="button"
          onClick={() => onToggleAll(!allVisible)}
          className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 -mr-2"
        >
          {allVisible ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      <div className="space-y-1.5">
        {entries.map(([key, category]) => {
          const expanded = !!visibleCategories[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => onCategoryToggle(key)}
              aria-expanded={expanded}
              className="w-full min-h-[48px] flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-gray-800/70 hover:bg-gray-800 active:bg-gray-700 border border-gray-700 text-left transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0">
                {expanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                )}
                <span className="min-w-0">
                  <span className="block text-sm text-white truncate">{category.name}</span>
                  {category.description && (
                    <span className="block text-xs text-gray-500 truncate">{category.description}</span>
                  )}
                </span>
              </span>
              {category.activeCount > 0 && (
                <span className="shrink-0 text-xs font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-2 py-0.5">
                  {category.activeCount} on
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CategoryToggles;
