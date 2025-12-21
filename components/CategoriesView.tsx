import React, { useState, useMemo } from 'react';
import { AppSettings, Category, Transaction, TransactionType } from '../types';
import {
  Tag, ShoppingBag, Utensils, Car, Zap, Film, Heart,
  Briefcase, ArrowRightLeft, MoreHorizontal, Home,
  Smartphone, Plane, Coffee, Gift, Music, Gamepad2,
  BookOpen, GraduationCap, Baby, Dog, Wrench, Wifi, Fuel, Calendar, ChevronLeft, ChevronRight, Plus, X
} from 'lucide-react';
import { useHoldGesture } from '../hooks/useHoldGesture';
import { useDoubleTapGesture } from '../hooks/useDoubleTapGesture';
import CircularProgress from './CircularProgress';
import CategorySummaryModal from './CategorySummaryModal';
import CategoryEditModal from './CategoryEditModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

interface SortableCategoryItemProps {
  cat: Category;
  spent: number;
  budget: number;
  percentage: number;
  isOverBudget: boolean;
  baseCurrency: string;
  isEditMode: boolean;
  onEdit: (cat: Category) => void;
  onDelete: (id: string) => void;
  onAnalytics: (cat: Category) => void;
  renderIcon: (iconName: string | undefined, size: number) => JSX.Element;
  onHold: () => void;
}

const SortableCategoryItem: React.FC<SortableCategoryItemProps> = ({
  cat,
  spent,
  budget,
  percentage,
  isOverBudget,
  baseCurrency,
  isEditMode,
  onEdit,
  onDelete,
  onAnalytics,
  renderIcon,
  onHold,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const { handlers: holdHandlers, isActiveHold } = useHoldGesture({
    onHold,
    holdDuration: 3000,
    movementThreshold: 10
  });

  const { handlers: doubleTapHandlers } = useDoubleTapGesture({
    onDoubleTap: () => !isEditMode && onAnalytics(cat),
  });

  const combinedHandlers = {
    ...holdHandlers,
    onClick: (e: React.MouseEvent) => {
      if (isEditMode) {
        onEdit(cat);
        return;
      }
      holdHandlers.onMouseDown?.(e);
      doubleTapHandlers.onClick?.(e);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (isEditMode) return;
      holdHandlers.onTouchEnd?.(e);
      doubleTapHandlers.onTouchEnd?.(e);
    },
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isEditMode ? listeners : {})}
      className={`rounded-xl p-3 flex flex-col items-center gap-2 transition-all relative ${
        isActiveHold ? 'scale-95 opacity-80' : 'hover:shadow-md'
      } ${isEditMode ? 'animate-wiggle' : ''} ${
        isDragging ? 'shadow-2xl scale-110 z-50 opacity-50' : ''
      }`}
      {...combinedHandlers}
      onMouseMove={holdHandlers.onMouseMove}
      onMouseUp={holdHandlers.onMouseUp}
      onTouchStart={holdHandlers.onTouchStart}
      onTouchMove={holdHandlers.onTouchMove}
    >
      {/* Delete Badge in Edit Mode */}
      {isEditMode && (
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = settings.categories.findIndex((cat) => cat.id === active.id);
      const newIndex = settings.categories.findIndex((cat) => cat.id === over.id);

      const reorderedCategories = arrayMove(settings.categories, oldIndex, newIndex);
      onUpdateSettings({ ...settings, categories: reorderedCategories });
    }
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

  return (
    <div className="h-full flex flex-col pb-24 bg-slate-50">
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

        {/* 3-Column Grid Layout with Drag & Drop */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={settings.categories.map(cat => cat.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-3 gap-4">
              {settings.categories.map(cat => {
                const spent = categoryStats[cat.name] || 0;
                const budget = cat.monthlyBudget || 0;
                const percentage = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
                const isOverBudget = budget > 0 && spent > budget;

                return (
                  <SortableCategoryItem
                    key={cat.id}
                    cat={cat}
                    spent={spent}
                    budget={budget}
                    percentage={percentage}
                    isOverBudget={isOverBudget}
                    baseCurrency={settings.baseCurrency}
                    isEditMode={isEditMode}
                    onEdit={setEditingCategory}
                    onDelete={handleDeleteCategory}
                    onAnalytics={setAnalyticsCategory}
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
          </SortableContext>
        </DndContext>

        {/* Done Button (in edit mode) */}
        {isEditMode && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20">
            <button
              onClick={() => setIsEditMode(false)}
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