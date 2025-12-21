import React, { useState } from 'react';
import { X, Save, Trash2, Tag, ShoppingBag, Utensils, Car, Zap, Film, Heart, Briefcase, Home, Smartphone, Plane, Coffee, Gift, Music, Gamepad2, BookOpen, GraduationCap, Baby, Dog, Wrench, Wifi, Fuel } from 'lucide-react';
import { Category } from '../types';

const ICON_LIB: Record<string, any> = {
  Tag, ShoppingBag, Utensils, Car, Zap, Film, Heart,
  Briefcase, Home, Smartphone, Plane, Coffee, Gift,
  Music, Gamepad2, BookOpen, GraduationCap, Baby, Dog,
  Wrench, Wifi, Fuel
};

const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef',
  '#f43f5e', '#64748b', '#78716c', '#000000'
];

interface CategoryEditModalProps {
  category: Category | null; // null = create mode
  baseCurrency: string;
  onSave: (category: Partial<Category>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const CategoryEditModal: React.FC<CategoryEditModalProps> = ({
  category,
  baseCurrency,
  onSave,
  onDelete,
  onClose,
}) => {
  const [name, setName] = useState(category?.name || '');
  const [icon, setIcon] = useState(category?.icon || 'Tag');
  const [color, setColor] = useState(category?.color || DEFAULT_COLORS[0]);
  const [monthlyBudget, setMonthlyBudget] = useState(category?.monthlyBudget?.toString() || '');

  const handleSave = () => {
    if (!name.trim()) return;

    onSave({
      id: category?.id,
      name: name.trim(),
      icon,
      color,
      monthlyBudget: monthlyBudget ? parseFloat(monthlyBudget) : undefined,
    });
    onClose();
  };

  const handleDelete = () => {
    if (onDelete && window.confirm(`Delete category "${category?.name}"?`)) {
      onDelete();
      onClose();
    }
  };

  const renderIcon = (iconName: string) => {
    const IconComp = ICON_LIB[iconName] || Tag;
    return <IconComp size={20} />;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto pointer-events-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
            <h2 className="text-xl font-bold text-slate-800">
              {category ? 'Edit Category' : 'New Category'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Category Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                placeholder="e.g., Groceries"
                autoFocus
              />
            </div>

            {/* Icon Picker */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Icon
              </label>
              <div className="grid grid-cols-6 gap-2">
                {Object.keys(ICON_LIB).map((iconName) => (
                  <button
                    key={iconName}
                    onClick={() => setIcon(iconName)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      icon === iconName
                        ? 'border-brand-600 bg-brand-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-center text-slate-600">
                      {renderIcon(iconName)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Color
              </label>
              <div className="grid grid-cols-7 gap-2">
                {DEFAULT_COLORS.map((clr) => (
                  <button
                    key={clr}
                    onClick={() => setColor(clr)}
                    className={`w-10 h-10 rounded-full border-4 transition-all ${
                      color === clr ? 'border-slate-800 scale-110' : 'border-white'
                    }`}
                    style={{ backgroundColor: clr }}
                  />
                ))}
              </div>
            </div>

            {/* Monthly Budget */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Monthly Budget (Optional)
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">
                  {baseCurrency}
                </span>
                <input
                  type="number"
                  value={monthlyBudget}
                  onChange={(e) => setMonthlyBudget(e.target.value)}
                  className="w-full pl-20 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3">
            {category && onDelete && (
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
              >
                <Trash2 size={18} />
                Delete
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save size={18} />
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default CategoryEditModal;
