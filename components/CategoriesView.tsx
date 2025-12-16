import React, { useState, useMemo } from 'react';
import { AppSettings, Category, Transaction, TransactionType } from '../types';
import { 
  Plus, Trash2, Tag, Edit3, Check, X, Palette, 
  ShoppingBag, Utensils, Car, Zap, Film, Heart, 
  Briefcase, ArrowRightLeft, MoreHorizontal, Home,
  Smartphone, Plane, Coffee, Gift, Music, Gamepad2,
  BookOpen, GraduationCap, Baby, Dog, Wrench, Wifi, Fuel
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface CategoriesViewProps {
  settings: AppSettings;
  transactions: Transaction[];
  onUpdateSettings: (settings: AppSettings) => void;
}

const DEFAULT_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', 
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', 
  '#f43f5e', '#64748b', '#78716c', '#000000'
];

// Map of available icons for the library
const ICON_LIB: Record<string, any> = {
  Utensils, ShoppingBag, Car, Zap, Film, Heart,
  Briefcase, ArrowRightLeft, MoreHorizontal, Home,
  Smartphone, Plane, Coffee, Gift, Music, Gamepad2,
  BookOpen, GraduationCap, Baby, Dog, Wrench, Wifi, Fuel, Tag
};

const CategoriesView: React.FC<CategoriesViewProps> = ({ settings, transactions, onUpdateSettings }) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Budget Editing State
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [tempBudget, setTempBudget] = useState('');

  // Category Editing State (Name, Color, Icon)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Calculate spending per category for the current month
  const categoryStats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-indexed (0 = Jan)
    const currentYear = now.getFullYear();
    
    const stats: Record<string, number> = {};
    
    transactions.forEach(t => {
      if (t.type === TransactionType.EXPENSE) {
        // Parse date manually (YYYY-MM-DD) to avoid timezone shifts causing off-by-one month errors
        const [yStr, mStr] = t.date.split('-');
        const tYear = parseInt(yStr);
        const tMonth = parseInt(mStr) - 1; // Convert 1-12 to 0-11
        
        if (tYear === currentYear && tMonth === currentMonth) {
          stats[t.category] = (stats[t.category] || 0) + t.amount;
        }
      }
    });
    
    return stats;
  }, [transactions]);

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const newCategory: Category = {
      id: uuidv4(),
      name: newCategoryName.trim(),
      color: DEFAULT_COLORS[settings.categories.length % DEFAULT_COLORS.length],
      icon: 'Tag'
    };
    onUpdateSettings({ ...settings, categories: [...settings.categories, newCategory] });
    setNewCategoryName('');
  };

  const handleDeleteCategory = (id: string) => {
    if (window.confirm("Delete this category? Transactions will remain but category metadata might be lost.")) {
      onUpdateSettings({ ...settings, categories: settings.categories.filter(c => c.id !== id) });
    }
  };

  // --- Budget Handlers ---
  const startEditingBudget = (cat: Category) => {
    setEditingBudgetId(cat.id);
    setTempBudget(cat.monthlyBudget ? cat.monthlyBudget.toString() : '');
  };

  const saveBudget = (catId: string) => {
    const updatedCategories = settings.categories.map(c => {
      if (c.id === catId) {
        return { ...c, monthlyBudget: tempBudget ? parseFloat(tempBudget) : undefined };
      }
      return c;
    });
    onUpdateSettings({ ...settings, categories: updatedCategories });
    setEditingBudgetId(null);
  };

  // --- Category Edit Handlers ---
  const startEditingCategory = (cat: Category) => {
    setEditingCategory({ ...cat });
    // Close other edits
    setEditingBudgetId(null); 
  };

  const saveCategoryEdit = () => {
    if (!editingCategory || !editingCategory.name.trim()) return;

    const updatedCategories = settings.categories.map(c => {
      if (c.id === editingCategory.id) {
        return editingCategory;
      }
      return c;
    });

    onUpdateSettings({ ...settings, categories: updatedCategories });
    setEditingCategory(null);
  };

  const renderIcon = (iconName: string | undefined, size: number = 18) => {
     const IconComp = ICON_LIB[iconName || 'Tag'] || Tag;
     return <IconComp size={size} />;
  };

  // Helper for current month display
  const currentMonthName = new Date().toLocaleString('default', { month: 'long' });

  return (
    <div className="h-full flex flex-col pb-24 bg-slate-50">
      <div className="px-6 py-4 bg-white border-b border-slate-100 sticky top-0 z-10 flex justify-between items-center">
         <div>
            <h2 className="text-2xl font-bold text-slate-800">Categories</h2>
            <p className="text-xs text-slate-400 mt-1">{currentMonthName} Spending & Budgets</p>
         </div>
      </div>

      <div className="p-6 flex-1 overflow-y-auto space-y-6">
        
        {/* Add New */}
        <div className="bg-white rounded-xl p-2 shadow-sm border border-slate-200 flex gap-2">
           <input 
              type="text" 
              placeholder="New Category Name..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button 
              onClick={handleAddCategory}
              disabled={!newCategoryName.trim()}
              className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors shadow-lg shadow-brand-500/30"
            >
              <Plus size={20} />
            </button>
        </div>

        {/* List */}
        <div className="space-y-4">
           {settings.categories.map(cat => {
             // Check if this category is being edited
             const isEditing = editingCategory?.id === cat.id;

             if (isEditing) {
                return (
                  <div key={cat.id} className="bg-white p-4 rounded-xl shadow-lg border border-brand-200 animate-in zoom-in-95 duration-200 space-y-4 relative z-10">
                     <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Name</label>
                        <input 
                          type="text" 
                          value={editingCategory.name}
                          onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                          className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold focus:ring-2 focus:ring-brand-500 outline-none"
                        />
                     </div>

                     {/* Icon Picker */}
                     <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                           Icon
                        </label>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-100">
                           {Object.keys(ICON_LIB).map(iconKey => {
                              const IconComp = ICON_LIB[iconKey];
                              return (
                                <button
                                  key={iconKey}
                                  onClick={() => setEditingCategory({ ...editingCategory, icon: iconKey })}
                                  className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                                    editingCategory.icon === iconKey 
                                      ? 'bg-brand-100 text-brand-600 ring-2 ring-brand-500' 
                                      : 'bg-white text-slate-400 hover:bg-slate-200'
                                  }`}
                                  title={iconKey}
                                >
                                  <IconComp size={18} />
                                </button>
                              );
                           })}
                        </div>
                     </div>
                     
                     <div>
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                           <Palette size={12} /> Color
                        </label>
                        <div className="flex flex-wrap gap-2">
                           {DEFAULT_COLORS.map(c => (
                             <button
                               key={c}
                               onClick={() => setEditingCategory({ ...editingCategory, color: c })}
                               className={`w-8 h-8 rounded-full border-2 transition-transform ${editingCategory.color === c ? 'border-slate-600 scale-110' : 'border-transparent'}`}
                               style={{ backgroundColor: c }}
                             />
                           ))}
                        </div>
                     </div>

                     <div className="flex gap-2 pt-2 border-t border-slate-100 mt-2">
                        <button 
                          onClick={() => setEditingCategory(null)}
                          className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold text-sm hover:bg-slate-200"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={saveCategoryEdit}
                          className="flex-1 py-3 bg-brand-600 text-white rounded-xl font-semibold text-sm hover:bg-brand-700 shadow-md"
                        >
                          Save Changes
                        </button>
                     </div>
                  </div>
                );
             }

             // Standard View
             const spent = categoryStats[cat.name] || 0;
             const budget = cat.monthlyBudget || 0;
             const percentage = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
             const isOverBudget = budget > 0 && spent > budget;

             return (
               <div key={cat.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 relative group transition-all hover:shadow-md">
                  <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                         <div 
                           className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold shadow-sm transition-transform active:scale-95 cursor-pointer" 
                           style={{ backgroundColor: cat.color }}
                           onClick={() => startEditingCategory(cat)}
                           title="Click to edit icon/color"
                         >
                           {renderIcon(cat.icon, 20)}
                         </div>
                         <div>
                            <div className="font-bold text-slate-800 flex items-center gap-2">
                               {cat.name}
                               <button 
                                 onClick={() => startEditingCategory(cat)} 
                                 className="text-slate-300 hover:text-brand-600 transition-colors p-1.5 hover:bg-slate-50 rounded-full"
                               >
                                  <Edit3 size={14} />
                               </button>
                            </div>
                            <div className="text-xs text-slate-400 font-medium">
                               Spent: {settings.baseCurrency} {spent.toFixed(2)}
                            </div>
                         </div>
                      </div>

                      {/* Budget Edit Section */}
                      <div className="text-right">
                         {editingBudgetId === cat.id ? (
                           <div className="flex items-center gap-1 justify-end animate-in fade-in duration-200">
                              <span className="text-xs font-bold text-slate-400">$</span>
                              <input 
                                type="number" 
                                autoFocus
                                value={tempBudget}
                                onChange={(e) => setTempBudget(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && saveBudget(cat.id)}
                                onBlur={() => saveBudget(cat.id)}
                                className="w-20 p-1 text-sm border border-slate-300 rounded bg-slate-50 text-right focus:ring-2 focus:ring-brand-500 outline-none"
                                placeholder="Budget"
                              />
                           </div>
                         ) : (
                           <div 
                             onClick={() => startEditingBudget(cat)}
                             className="text-xs text-slate-400 cursor-pointer hover:text-brand-600 flex items-center justify-end gap-1 p-1 hover:bg-slate-50 rounded transition-colors"
                           >
                             {budget > 0 ? `Budget: ${budget}` : 'Set Budget'}
                             <Edit3 size={10} />
                           </div>
                         )}
                         
                         {isOverBudget && (
                            <div className="text-[10px] text-red-500 font-bold mt-1 bg-red-50 px-1.5 py-0.5 rounded inline-block">Over Limit!</div>
                         )}
                      </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mt-3 relative">
                     {budget > 0 ? (
                       <div 
                         className={`h-full rounded-full transition-all duration-500 ${isOverBudget ? 'bg-red-500' : 'bg-brand-500'}`} 
                         style={{ width: `${percentage}%` }}
                       />
                     ) : (
                       // If no budget, show a generic progress bar if there is spending to show activity
                       spent > 0 && <div className="h-full bg-slate-200 w-full opacity-50" />
                     )}
                  </div>

                  {/* Delete Action (Absolute) */}
                  {!cat.isDefault && (
                    <button 
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="absolute -top-2 -right-2 bg-white border border-slate-200 shadow-sm p-1.5 rounded-full text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Delete Category"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
               </div>
             );
           })}
        </div>
      </div>
    </div>
  );
};

export default CategoriesView;