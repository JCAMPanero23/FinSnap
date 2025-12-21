import React, { useState, useEffect } from 'react';
import { X, Plus, GripVertical, Trash2 } from 'lucide-react';
import { ReceiptLineItem } from '../services/receiptSplitService';
import { AppSettings, TransactionType } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface LineItemWithId extends ReceiptLineItem {
  id: string;
  checked: boolean;
}

export interface ItemGroup {
  id: string;
  category: string;
  items: LineItemWithId[];
}

interface SplitEditorModalProps {
  originalAmount: number;
  merchant: string;
  date: string;
  accountId?: string;
  lineItems: ReceiptLineItem[];
  settings: AppSettings;
  baseCurrency: string;
  onConfirm: (groups: ItemGroup[]) => void;
  onCancel: () => void;
}

const SplitEditorModal: React.FC<SplitEditorModalProps> = ({
  originalAmount,
  merchant,
  date,
  accountId,
  lineItems,
  settings,
  baseCurrency,
  onConfirm,
  onCancel,
}) => {
  const [groups, setGroups] = useState<ItemGroup[]>([]);

  // Initialize groups from line items (auto-group by suggestedCategory)
  useEffect(() => {
    const groupedByCategory: Record<string, LineItemWithId[]> = {};

    lineItems.forEach((item) => {
      const itemWithId: LineItemWithId = {
        ...item,
        id: uuidv4(),
        checked: true,
      };

      if (!groupedByCategory[item.suggestedCategory]) {
        groupedByCategory[item.suggestedCategory] = [];
      }
      groupedByCategory[item.suggestedCategory].push(itemWithId);
    });

    const initialGroups: ItemGroup[] = Object.entries(groupedByCategory).map(
      ([category, items]) => ({
        id: uuidv4(),
        category,
        items,
      })
    );

    setGroups(initialGroups);
  }, [lineItems]);

  // Calculate totals
  const totalChecked = groups.reduce(
    (sum, group) =>
      sum +
      group.items
        .filter((item) => item.checked)
        .reduce((s, item) => s + item.amount, 0),
    0
  );

  const remaining = originalAmount - totalChecked;
  const isBalanced = Math.abs(remaining) < 0.01;

  const handleToggleItem = (groupId: string, itemId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              items: g.items.map((i) =>
                i.id === itemId ? { ...i, checked: !i.checked } : i
              ),
            }
          : g
      )
    );
  };

  const handleEditItemAmount = (
    groupId: string,
    itemId: string,
    newAmount: number
  ) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              items: g.items.map((i) =>
                i.id === itemId ? { ...i, amount: newAmount } : i
              ),
            }
          : g
      )
    );
  };

  const handleEditItemDescription = (
    groupId: string,
    itemId: string,
    newDescription: string
  ) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? {
              ...g,
              items: g.items.map((i) =>
                i.id === itemId ? { ...i, description: newDescription } : i
              ),
            }
          : g
      )
    );
  };

  const handleRemoveItem = (groupId: string, itemId: string) => {
    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId
          ? { ...g, items: g.items.filter((i) => i.id !== itemId) }
          : g
      )
    );
  };

  const handleChangeGroupCategory = (groupId: string, newCategory: string) => {
    setGroups((prev) =>
      prev.map((g) => (g.id === groupId ? { ...g, category: newCategory } : g))
    );
  };

  const handleAddNewGroup = () => {
    const newGroup: ItemGroup = {
      id: uuidv4(),
      category: settings.categories[0]?.name || 'Other',
      items: [],
    };
    setGroups((prev) => [...prev, newGroup]);
  };

  const handleAddItemToGroup = (groupId: string) => {
    const newItem: LineItemWithId = {
      id: uuidv4(),
      description: 'New Item',
      amount: 0,
      suggestedCategory: groups.find((g) => g.id === groupId)?.category || 'Other',
      checked: true,
    };

    setGroups((prev) =>
      prev.map((g) =>
        g.id === groupId ? { ...g, items: [...g.items, newItem] } : g
      )
    );
  };

  const handleConfirm = () => {
    const finalGroups = groups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => i.checked),
      }))
      .filter((g) => g.items.length > 0);

    onConfirm(finalGroups);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-end pointer-events-none">
        <div className="w-full bg-white rounded-t-3xl shadow-2xl max-w-md mx-auto max-h-[85vh] overflow-hidden flex flex-col pointer-events-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Split Transaction</h2>
              <p className="text-sm text-slate-500">{merchant}</p>
              <p className="text-xs text-slate-400">
                Original: {baseCurrency} {originalAmount.toFixed(2)}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body - Scrollable Groups */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {groups.map((group) => {
              const groupTotal = group.items
                .filter((i) => i.checked)
                .reduce((sum, i) => sum + i.amount, 0);

              return (
                <div
                  key={group.id}
                  className="bg-slate-50 rounded-xl p-4 space-y-3"
                >
                  {/* Group Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">📦</span>
                      <select
                        value={group.category}
                        onChange={(e) =>
                          handleChangeGroupCategory(group.id, e.target.value)
                        }
                        className="font-bold text-slate-800 bg-transparent border-none outline-none cursor-pointer"
                      >
                        {settings.categories.map((cat) => (
                          <option key={cat.id} value={cat.name}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="font-bold text-slate-800">
                      {baseCurrency} {groupTotal.toFixed(2)}
                    </div>
                  </div>

                  {/* Line Items */}
                  <div className="space-y-2">
                    {group.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 bg-white rounded-lg p-2"
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => handleToggleItem(group.id, item.id)}
                          className="w-4 h-4"
                        />
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) =>
                            handleEditItemDescription(
                              group.id,
                              item.id,
                              e.target.value
                            )
                          }
                          className="flex-1 text-sm bg-transparent border-none outline-none"
                        />
                        <input
                          type="number"
                          value={item.amount}
                          onChange={(e) =>
                            handleEditItemAmount(
                              group.id,
                              item.id,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="w-20 text-sm text-right bg-transparent border-none outline-none"
                          step="0.01"
                        />
                        <button
                          onClick={() => handleRemoveItem(group.id, item.id)}
                          className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Add Item to Group */}
                  <button
                    onClick={() => handleAddItemToGroup(group.id)}
                    className="w-full py-1.5 text-xs text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                  >
                    + Add Item
                  </button>
                </div>
              );
            })}

            {/* Add New Group Button */}
            <button
              onClick={handleAddNewGroup}
              className="w-full py-3 border-2 border-dashed border-slate-300 rounded-xl text-slate-600 hover:border-brand-500 hover:text-brand-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={18} />
              New Group
            </button>
          </div>

          {/* Footer - Summary & Actions */}
          <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 space-y-3">
            {/* Balance Summary */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Total:</span>
              <span className="font-bold text-slate-800">
                {baseCurrency} {totalChecked.toFixed(2)}
              </span>
            </div>

            {!isBalanced && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-amber-600">Remaining:</span>
                <span className="font-bold text-amber-600">
                  {baseCurrency} {Math.abs(remaining).toFixed(2)}
                </span>
              </div>
            )}

            {isBalanced && (
              <div className="text-sm text-green-600 font-medium text-center">
                ✓ Matches original amount
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 py-2 px-4 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2 px-4 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
              >
                Create {groups.filter((g) => g.items.filter((i) => i.checked).length > 0).length} Transactions
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default SplitEditorModal;
