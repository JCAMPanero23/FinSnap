import React, { useState, useMemo } from 'react';
import { AppSettings, Category, Transaction, TransactionType } from '../types';
import {
  Tag, ShoppingBag, Utensils, Car, Zap, Film, Heart,
  Briefcase, ArrowRightLeft, MoreHorizontal, Home,
  Smartphone, Plane, Coffee, Gift, Music, Gamepad2,
  BookOpen, GraduationCap, Baby, Dog, Wrench, Wifi, Fuel, Calendar, ChevronLeft, ChevronRight, Plus, X, Pencil, ArrowLeftRight
} from 'lucide-react';
import { useHoldGesture } from '../hooks/useHoldGesture';
import { useDoubleTapGesture } from '../hooks/useDoubleTapGesture';
import CircularProgress from './CircularProgress';
import CategorySummaryModal from './CategorySummaryModal';
import CategoryEditModal from './CategoryEditModal';

interface CategoriesViewProps {
  settings: AppSettings;
  transactions: Transaction[];
  onUpdateSettings: (settings: AppSettings) => void;
  dateFilter: 'month' | 'year' | 'week' | 'custom' | 'all';
  onDateFilterChange: (filter: 'month' | 'year' | 'week' | 'custom' | 'all') => void;
  customStartDate: string;
  customEndDate: string;
  onCustomStartDateChange: (date: string) => void;
  onCustomEndDateChange: (date: string) => void;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
  currentPeriodLabel: string;
}

const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef',
  '#f43f5e', '#64748b', '#78716c', '#000000'
];

const DATE_FILTER_TYPES: Array<'month' | 'year' | 'week' | 'custom' | 'all'> =
  ['month', 'year', 'week', 'custom', 'all'];

// Map of available icons for the library
const ICON_LIB: Record<string, any> = {
  Utensils, ShoppingBag, Car, Zap, Film, Heart,
  Briefcase, ArrowRightLeft, MoreHorizontal, Home,
  Smartphone, Plane, Coffee, Gift, Music, Gamepad2,
  BookOpen, GraduationCap, Baby, Dog, Wrench, Wifi, Fuel, Tag
};

interface CategoryItemProps {
  cat: Category;
  spent: number;
  budget: number;
  percentage: number;
  isOverBudget: boolean;
  baseCurrency: string;
  isEditMode: boolean;
  isSelected: boolean;
  onEdit: (cat: Category) => void;
  onDelete: (id: string) => void;
  onAnalytics: (cat: Category) => void;
  onToggleSelect: (id: string) => void;
  renderIcon: (iconName: string | undefined, size: number) => JSX.Element;
  onHold: () => void;
}

const CategoryItem: React.FC<CategoryItemProps> = ({
  cat,
  spent,
  budget,
  percentage,
  isOverBudget,
  baseCurrency,
  isEditMode,
  isSelected,
  onEdit,
  onDelete,
  onAnalytics,
  onToggleSelect,
  renderIcon,
  onHold,
}) => {

  const { handlers: holdHandlers, isActiveHold } = useHoldGesture({
    onHold,
    holdDuration: 3000,
    movementThreshold: 10
  });

  const { handlers: doubleTapHandlers } = useDoubleTapGesture({
    onDoubleTap: () => !isEditMode && onAnalytics(cat),
  });

  const combinedHandlers = isEditMode ? {
    onClick: (e: React.MouseEvent) => {
      onEdit(cat);
    },
  } : {
    ...holdHandlers,
    onClick: (e: React.MouseEvent) => {
      holdHandlers.onMouseDown?.(e);
      doubleTapHandlers.onClick?.(e);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      holdHandlers.onTouchEnd?.(e);
      doubleTapHandlers.onTouchEnd?.(e);
    },
  };

  return (
    <div
      className={`rounded-xl p-3 flex flex-col items-center gap-2 transition-all relative bg-white shadow-sm border-2 ${
        isSelected ? 'border-brand-500 shadow-lg scale-105' : 'border-slate-100'
      } ${isActiveHold ? 'scale-95 opacity-80' : 'hover:shadow-md'} ${
        isEditMode ? 'animate-wiggle' : ''
      }`}
      {...(!isEditMode && {
        ...combinedHandlers,
        onMouseMove: holdHandlers.onMouseMove,
        onMouseUp: holdHandlers.onMouseUp,
        onTouchStart: holdHandlers.onTouchStart,
        onTouchMove: holdHandlers.onTouchMove,
      })}
    >
      {/* Edit Mode Buttons */}
      {isEditMode && (
        <>
          {/* Pencil Icon - Edit Button (top-left) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(cat);
            }}
            className="absolute -top-2 -left-2 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors z-10 shadow-md"
          >
            <Pencil size={12} />
          </button>

          {/* Delete Badge (top-right) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Delete category "${cat.name}"?`)) {
                onDelete(cat.id);
              }
            }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-10 shadow-md"
          >
            <X size={14} />
          </button>
        </>
      )}

      {/* Circular Progress with Icon */}
      <CircularProgress
        percentage={percentage}
        size={56}
        strokeWidth={4}
        color={isOverBudget ? '#ef4444' : (budget > 0 ? cat.color : '#cbd5e1')}
        backgroundColor="#f1f5f9"
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: cat.color }}
        >
          {renderIcon(cat.icon, 20)}
        </div>
      </CircularProgress>

      {/* Category Name */}
      <div className="text-xs font-bold text-slate-800 text-center line-clamp-2 w-full px-1 leading-tight min-h-[2rem]">
        {cat.name}
      </div>

      {/* Spent Amount */}
      <div className="text-[10px] text-slate-500 font-medium">
        {baseCurrency} {spent.toFixed(2)}
      </div>

      {/* Budget Badge */}
      {budget > 0 && (
        <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
          isOverBudget ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand-600'
        }`}>
          {isOverBudget ? 'Over!' : `${percentage.toFixed(0)}%`}
        </div>
      )}

      {/* Swap Button (bottom) - Only in Edit Mode */}
      {isEditMode && (
        <button
          onClick={(e) => {
            console.log('🖱️ Swap button clicked for category:', cat.name, 'ID:', cat.id);
            e.stopPropagation();
            onToggleSelect(cat.id);
          }}
          className={`absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-6 rounded-full flex items-center justify-center transition-colors z-10 shadow-md ${
            isSelected
              ? 'bg-brand-500 text-white hover:bg-brand-600'
              : 'bg-slate-600 text-white hover:bg-slate-700'
          }`}
        >
          <ArrowLeftRight size={14} />
        </button>
      )}
    </div>
  );
};

const CategoriesView: React.FC<CategoriesViewProps> = ({
  settings,
  transactions,
  onUpdateSettings,
  dateFilter,
  onDateFilterChange,
  customStartDate,
  customEndDate,
  onCustomStartDateChange,
  onCustomEndDateChange,
  onPreviousPeriod,
  onNextPeriod,
  currentPeriodLabel
}) => {
  const [analyticsCategory, setAnalyticsCategory] = useState<Category | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Date Filter Type Navigation
  const handlePreviousFilterType = () => {
    const currentIndex = DATE_FILTER_TYPES.indexOf(dateFilter);
    const previousIndex = currentIndex === 0 ? DATE_FILTER_TYPES.length - 1 : currentIndex - 1;
    onDateFilterChange(DATE_FILTER_TYPES[previousIndex]);
  };

  const handleNextFilterType = () => {
    const currentIndex = DATE_FILTER_TYPES.indexOf(dateFilter);
    const nextIndex = (currentIndex + 1) % DATE_FILTER_TYPES.length;
    onDateFilterChange(DATE_FILTER_TYPES[nextIndex]);
  };

  const getFilterTypeLabel = () => {
    const labels: Record<typeof dateFilter, string> = {
      month: 'Month',
      year: 'Year',
      week: 'Week',
      custom: 'Custom',
      all: 'All Time'
    };
    return labels[dateFilter] || 'Month';
  };

  // Calculate spending per category (transactions are already filtered by date in App.tsx)
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};

    (transactions || []).forEach(t => {
      if (t.type === TransactionType.EXPENSE) {
        stats[t.category] = (stats[t.category] || 0) + t.amount;
      }
    });

    return stats;
  }, [transactions]);


  const renderIcon = (iconName: string | undefined, size: number = 18) => {
     const IconComp = ICON_LIB[iconName || 'Tag'] || Tag;
     return <IconComp size={size} />;
  };

  const handleToggleSelect = (categoryId: string) => {
    console.log('🔄 handleToggleSelect called with categoryId:', categoryId);

    setSelectedCategories(prev => {
      console.log('📋 Current selection state:', prev);
      console.log('📊 Selection length:', prev.length);

      // If already selected, deselect
      if (prev.includes(categoryId)) {
        console.log('❌ Deselecting category:', categoryId);
        return prev.filter(id => id !== categoryId);
      }

      // If this is the second selection, perform swap
      if (prev.length === 1) {
        console.log('🔀 SWAPPING - Second selection detected');
        const firstId = prev[0];
        console.log('1️⃣ First category ID:', firstId);
        console.log('2️⃣ Second category ID:', categoryId);

        const firstIndex = settings.categories.findIndex(cat => cat.id === firstId);
        const secondIndex = settings.categories.findIndex(cat => cat.id === categoryId);
        console.log('📍 First index:', firstIndex, 'Second index:', secondIndex);

        console.log('📦 Current categories order:', settings.categories.map(c => c.name));

        // Swap positions
        const newCategories = [...settings.categories];
        [newCategories[firstIndex], newCategories[secondIndex]] =
          [newCategories[secondIndex], newCategories[firstIndex]];

        // Assign order values to all categories to preserve custom ordering
        const categoriesWithOrder = newCategories.map((cat, index) => ({
          ...cat,
          order: index
        }));

        console.log('📦 New categories order:', categoriesWithOrder.map(c => `${c.name}(${c.order})`));
        console.log('✅ Calling onUpdateSettings with new category order');
        onUpdateSettings({ ...settings, categories: categoriesWithOrder });

        // Clear selection after swap
        console.log('🧹 Clearing selection');
        return [];
      }

      // Add to selection (first selection)
      console.log('➕ Adding to selection (first category):', categoryId);
      return [...prev, categoryId];
    });
  };

  const handleSaveCategory = (categoryData: Partial<Category>) => {
    if (categoryData.id) {
      // Edit existing
      const updated = settings.categories.map(c =>
        c.id === categoryData.id ? { ...c, ...categoryData } : c
      );
      onUpdateSettings({ ...settings, categories: updated });
    } else {
      // Create new
      const newCat: Category = {
        id: Date.now().toString(),
        name: categoryData.name!,
        icon: categoryData.icon,
        color: categoryData.color!,
        monthlyBudget: categoryData.monthlyBudget,
      };
      onUpdateSettings({ ...settings, categories: [...settings.categories, newCat] });
    }
  };

  const handleDeleteCategory = (categoryId: string) => {
    const updated = settings.categories.filter(c => c.id !== categoryId);
    onUpdateSettings({ ...settings, categories: updated });
  };

  const handleExitEditMode = () => {
    setIsEditMode(false);
    setSelectedCategories([]); // Clear selection when exiting edit mode
  };

  return (
    <div className="h-full flex flex-col pb-24">
      <div className="px-6 py-4 bg-white border-b border-slate-100 sticky top-0 z-10 flex justify-between items-center">
         <div>
            <h2 className="text-2xl font-bold text-slate-800">Categories</h2>
            <p className="text-xs text-slate-400 mt-1">{currentPeriodLabel} Spending & Budgets</p>
         </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto space-y-6">

        {/* Compact Month Selector Pill */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-500 rounded-full px-4 py-3 text-white shadow-md">
          <div className="flex items-center justify-between">
            {dateFilter !== 'all' ? (
              <>
                <button
                  onClick={onPreviousPeriod}
                  className="p-1 hover:bg-white/20 rounded-full transition-all active:scale-95"
                  title="Previous period"
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="text-center flex-1 px-3">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={handlePreviousFilterType}
                      className="p-0.5 hover:bg-white/20 rounded transition-all active:scale-95"
                      title="Previous filter type"
                    >
                      <ChevronLeft size={12} />
                    </button>
                    <div className="text-xs font-bold uppercase tracking-wide opacity-90 min-w-[60px] text-center">
                      {getFilterTypeLabel()}
                    </div>
                    <button
                      onClick={handleNextFilterType}
                      className="p-0.5 hover:bg-white/20 rounded transition-all active:scale-95"
                      title="Next filter type"
                    >
                      <ChevronRight size={12} />
                    </button>
                  </div>
                  <div className="font-semibold text-sm mt-1.5">{currentPeriodLabel}</div>
                </div>
                <button
                  onClick={onNextPeriod}
                  className="p-1 hover:bg-white/20 rounded-full transition-all active:scale-95"
                  title="Next period"
                >
                  <ChevronRight size={18} />
                </button>
              </>
            ) : (
              <div className="text-center flex-1 px-3">
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={handlePreviousFilterType}
                    className="p-0.5 hover:bg-white/20 rounded transition-all active:scale-95"
                    title="Previous filter type"
                  >
                    <ChevronLeft size={12} />
                  </button>
                  <div className="text-xs font-bold uppercase tracking-wide opacity-90 min-w-[60px] text-center">
                    {getFilterTypeLabel()}
                  </div>
                  <button
                    onClick={handleNextFilterType}
                    className="p-0.5 hover:bg-white/20 rounded transition-all active:scale-95"
                    title="Next filter type"
                  >
                    <ChevronRight size={12} />
                  </button>
                </div>
                <div className="font-semibold text-sm mt-1.5">All Transactions</div>
              </div>
            )}
          </div>
        </div>

        {/* Custom Date Range Inputs */}
        {dateFilter === 'custom' && (
          <div className="bg-white rounded-xl p-4 shadow-md border border-slate-100">
            <div className="flex gap-3 text-sm">
              <div className="flex-1">
                <label className="text-slate-600 text-xs font-medium mb-1.5 block">From Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => onCustomStartDateChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors"
                />
              </div>
              <div className="flex-1">
                <label className="text-slate-600 text-xs font-medium mb-1.5 block">To Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => onCustomEndDateChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors"
                />
              </div>
            </div>
          </div>
        )}

        {/* 3-Column Grid Layout with Swap Selection */}
        <div className="grid grid-cols-3 gap-4">
          {settings.categories.map(cat => {
            const spent = categoryStats[cat.name] || 0;
            const budget = cat.monthlyBudget || 0;
            const percentage = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
            const isOverBudget = budget > 0 && spent > budget;

            return (
              <CategoryItem
                key={cat.id}
                cat={cat}
                spent={spent}
                budget={budget}
                percentage={percentage}
                isOverBudget={isOverBudget}
                baseCurrency={settings.baseCurrency}
                isEditMode={isEditMode}
                isSelected={selectedCategories.includes(cat.id)}
                onEdit={setEditingCategory}
                onDelete={handleDeleteCategory}
                onAnalytics={setAnalyticsCategory}
                onToggleSelect={handleToggleSelect}
                renderIcon={renderIcon}
                onHold={() => setIsEditMode(true)}
              />
            );
          })}

          {/* Add Category Card (in edit mode) */}
          {isEditMode && (
            <button
              onClick={() => setIsCreatingCategory(true)}
              className="rounded-xl p-3 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-brand-500 hover:bg-brand-50 transition-all min-h-[140px]"
            >
              <div className="w-12 h-12 rounded-full bg-brand-500 text-white flex items-center justify-center">
                <Plus size={24} />
              </div>
              <div className="text-xs font-bold text-slate-600">Add Category</div>
            </button>
          )}
        </div>

        {/* Done Button (in edit mode) */}
        {isEditMode && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={handleExitEditMode}
              className="px-8 py-3 bg-brand-600 text-white rounded-full shadow-lg hover:bg-brand-700 transition-colors font-bold"
            >
              Done
            </button>
          </div>
        )}

        {/* Category Summary Modal - triggered by double-tap */}
        {analyticsCategory && (
          <CategorySummaryModal
            category={analyticsCategory}
            transactions={transactions.filter(t => t.category === analyticsCategory.name)}
            baseCurrency={settings.baseCurrency}
            onClose={() => setAnalyticsCategory(null)}
          />
        )}

        {/* Category Edit Modals */}
        {editingCategory && (
          <CategoryEditModal
            category={editingCategory}
            baseCurrency={settings.baseCurrency}
            onSave={handleSaveCategory}
            onDelete={() => handleDeleteCategory(editingCategory.id)}
            onClose={() => setEditingCategory(null)}
          />
        )}

        {isCreatingCategory && (
          <CategoryEditModal
            category={null}
            baseCurrency={settings.baseCurrency}
            onSave={handleSaveCategory}
            onClose={() => setIsCreatingCategory(false)}
          />
        )}
      </div>
    </div>
  );
};

export default CategoriesView;