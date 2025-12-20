# Category UI Enhancements & AI Receipt Splitting Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance category management UI with gesture controls, fix visual issues, and implement AI-powered receipt splitting for multi-category transactions.

**Architecture:** Gesture-based interactions (double-tap analytics, 3-sec hold edit mode), circular progress indicators wrapped around category icons, AI receipt parsing service with smart grouping by category, hybrid inline/modal editing in transaction review.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, Google Gemini 2.5 Flash API, react-beautiful-dnd (drag-drop)

---

## Task 1: Fix Category View UI Issues

**Files:**
- Modify: `components/CategoriesView.tsx:212-272`
- Modify: `components/CircularProgress.tsx:12-19`

**Step 1: Change category icons from square to circular**

In `components/CategoriesView.tsx`, find the icon container div (around line 243):

```tsx
// OLD (line 243-246)
<div
  className="w-12 h-12 rounded-lg flex items-center justify-center text-white"
  style={{ backgroundColor: cat.color }}
>

// NEW
<div
  className="w-12 h-12 rounded-full flex items-center justify-center text-white"
  style={{ backgroundColor: cat.color }}
>
```

**Step 2: Remove white background from category cards**

In `components/CategoriesView.tsx`, find the category card container (around line 227):

```tsx
// OLD (line 227-232)
<div
  key={cat.id}
  className={`bg-gradient-to-br from-white to-slate-50 rounded-xl p-3 shadow-sm flex flex-col items-center gap-2 transition-all border border-slate-100 ${
    isActiveHold ? 'scale-95 opacity-80' : 'hover:shadow-md'
  }`}

// NEW
<div
  key={cat.id}
  className={`rounded-xl p-3 flex flex-col items-center gap-2 transition-all ${
    isActiveHold ? 'scale-95 opacity-80' : 'hover:shadow-md'
  }`}
```

**Step 3: Fix text clipping with line-clamp-2**

In `components/CategoriesView.tsx`, find the category name div (around line 252):

```tsx
// OLD (line 252-254)
<div className="text-xs font-bold text-slate-800 text-center truncate w-full">
  {cat.name}
</div>

// NEW
<div className="text-xs font-bold text-slate-800 text-center line-clamp-2 w-full px-1 leading-tight min-h-[2rem]">
  {cat.name}
</div>
```

**Step 4: Increase CircularProgress stroke width for visibility**

In `components/CircularProgress.tsx`, change strokeWidth default:

```tsx
// OLD (line 15)
strokeWidth = 3,

// NEW
strokeWidth = 4,
```

**Step 5: Test visual changes**

Run: `npm run dev`
Navigate to Categories view
Verify:
- Icons are circular (not square rounded)
- No white card backgrounds
- Category names show 2 lines without clipping
- Progress rings are thicker and more visible

**Step 6: Commit UI fixes**

```bash
cd .worktrees/category-ui-enhancements
git add components/CategoriesView.tsx components/CircularProgress.tsx
git commit -m "fix: category UI improvements (circular icons, no bg, text clipping)

- Changed category icons from rounded-lg to rounded-full
- Removed white background gradient from category cards
- Fixed text clipping with line-clamp-2 and min-height
- Increased CircularProgress strokeWidth from 3 to 4 for better visibility"
```

---

## Task 2: Create Double-Tap Gesture Hook

**Files:**
- Create: `hooks/useDoubleTapGesture.ts`

**Step 1: Create the double-tap gesture hook file**

```typescript
import { useRef, useCallback } from 'react';

interface UseDoubleTapOptions {
  onDoubleTap: () => void;
  tapWindow?: number; // Time window for second tap (ms)
  positionThreshold?: number; // Max distance between taps (px)
}

export const useDoubleTapGesture = ({
  onDoubleTap,
  tapWindow = 300,
  positionThreshold = 20,
}: UseDoubleTapOptions) => {
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null);

  const handleTap = useCallback(
    (clientX: number, clientY: number) => {
      const now = Date.now();
      const lastTap = lastTapRef.current;

      if (lastTap) {
        const timeDiff = now - lastTap.time;
        const dx = clientX - lastTap.x;
        const dy = clientY - lastTap.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (timeDiff <= tapWindow && distance <= positionThreshold) {
          // Double tap detected!
          onDoubleTap();
          lastTapRef.current = null; // Reset
          return;
        }
      }

      // First tap or too slow/far for double tap
      lastTapRef.current = { time: now, x: clientX, y: clientY };
    },
    [onDoubleTap, tapWindow, positionThreshold]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      handleTap(e.clientX, e.clientY);
    },
    [handleTap]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.changedTouches[0];
      if (touch) {
        handleTap(touch.clientX, touch.clientY);
      }
    },
    [handleTap]
  );

  return {
    handlers: {
      onClick: handleClick,
      onTouchEnd: handleTouchEnd,
    },
  };
};
```

**Step 2: Commit double-tap hook**

```bash
git add hooks/useDoubleTapGesture.ts
git commit -m "feat: add double-tap gesture detection hook

- Detects two taps within 300ms (configurable)
- Position threshold of 20px for slight movement tolerance
- Supports both mouse and touch events"
```

---

## Task 3: Integrate Double-Tap for Category Analytics

**Files:**
- Modify: `components/CategoriesView.tsx:59-60,220-233`

**Step 1: Import the double-tap hook**

At top of `components/CategoriesView.tsx`:

```typescript
// Add to existing imports (around line 9)
import { useDoubleTapGesture } from '../hooks/useDoubleTapGesture';
```

**Step 2: Add state for analytics modal**

In `CategoriesView` component (around line 60):

```typescript
// Add after holdingCategory state
const [analyticsCategory, setAnalyticsCategory] = useState<Category | null>(null);
```

**Step 3: Integrate double-tap and hold gestures in category card**

In the category map function (around line 220-233), update gesture handling:

```tsx
// Inside the map function
const { handlers: holdHandlers, isActiveHold } = useHoldGesture({
  onHold: () => {
    // TODO: Will trigger global edit mode in next task
    console.log('Hold detected - edit mode coming soon');
  },
  holdDuration: 3000, // Changed from 2000
  movementThreshold: 10
});

const { handlers: doubleTapHandlers } = useDoubleTapGesture({
  onDoubleTap: () => setAnalyticsCategory(cat),
});

// Merge handlers
const combinedHandlers = {
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
    key={cat.id}
    className={/*...*/}
    {...combinedHandlers}
    onMouseMove={holdHandlers.onMouseMove}
    onMouseUp={holdHandlers.onMouseUp}
    onTouchStart={holdHandlers.onTouchStart}
    onTouchMove={holdHandlers.onTouchMove}
  >
```

**Step 4: Update CategorySummaryModal to use analyticsCategory**

Replace the existing holdingCategory modal (around line 275):

```tsx
{/* Category Summary Modal - triggered by double-tap */}
{analyticsCategory && (
  <CategorySummaryModal
    category={analyticsCategory}
    transactions={transactions.filter(t => t.category === analyticsCategory.name)}
    baseCurrency={settings.baseCurrency}
    onClose={() => setAnalyticsCategory(null)}
  />
)}
```

**Step 5: Remove old holdingCategory modal** (should be around line 275-282)

Delete the old modal code that used `holdingCategory`.

**Step 6: Test double-tap analytics**

Run: `npm run dev`
Navigate to Categories view
Action: Double-tap any category icon quickly
Expected: CategorySummaryModal opens showing analytics
Action: Single tap
Expected: Nothing happens
Action: Hold for 3 seconds
Expected: Console log "Hold detected - edit mode coming soon"

**Step 7: Commit double-tap integration**

```bash
git add components/CategoriesView.tsx
git commit -m "feat: add double-tap to open category analytics modal

- Replaced hold gesture with double-tap for CategorySummaryModal
- Increased hold duration to 3 seconds (prep for edit mode)
- Combined double-tap and hold gesture handlers on category cards"
```

---

## Task 4: Create Category Edit Modal Component

**Files:**
- Create: `components/CategoryEditModal.tsx`

**Step 1: Create CategoryEditModal component**

```typescript
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
```

**Step 2: Commit CategoryEditModal**

```bash
git add components/CategoryEditModal.tsx
git commit -m "feat: add CategoryEditModal for creating/editing categories

- Full CRUD interface for categories
- Icon picker grid with all available icons
- Color picker grid with default colors
- Monthly budget input with currency display
- Delete confirmation for existing categories"
```

---

## Task 5: Implement Global Category Edit Mode

**Files:**
- Modify: `components/CategoriesView.tsx`
- Install: `react-beautiful-dnd` for drag-drop

**Step 1: Install drag-drop library**

```bash
cd .worktrees/category-ui-enhancements
npm install react-beautiful-dnd
npm install --save-dev @types/react-beautiful-dnd
```

**Step 2: Add edit mode state and imports**

In `components/CategoriesView.tsx`:

```typescript
// Add imports
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Plus } from 'lucide-react';
import CategoryEditModal from './CategoryEditModal';

// Add state (after analyticsCategory)
const [isEditMode, setIsEditMode] = useState(false);
const [editingCategory, setEditingCategory] = useState<Category | null>(null);
const [isCreatingCategory, setIsCreatingCategory] = useState(false);
```

**Step 3: Update hold gesture to trigger edit mode**

Replace the console.log in hold handler:

```typescript
const { handlers: holdHandlers, isActiveHold } = useHoldGesture({
  onHold: () => setIsEditMode(true),
  holdDuration: 3000,
  movementThreshold: 10
});
```

**Step 4: Implement category reordering handler**

Add function before the return statement:

```typescript
const handleDragEnd = (result: DropResult) => {
  if (!result.destination) return;

  const items = Array.from(settings.categories);
  const [reorderedItem] = items.splice(result.source.index, 1);
  items.splice(result.destination.index, 0, reorderedItem);

  onUpdateSettings({ ...settings, categories: items });
};
```

**Step 5: Implement category save/delete handlers**

```typescript
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
      id: Date.now().toString(), // Simple ID generation
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
```

**Step 6: Wrap category grid with drag-drop context**

Replace the existing grid (around line 212) with:

```tsx
{/* Category Grid with Drag & Drop */}
<DragDropContext onDragEnd={handleDragEnd}>
  <Droppable droppableId="categories" direction="horizontal">
    {(provided) => (
      <div
        ref={provided.innerRef}
        {...provided.droppableProps}
        className="grid grid-cols-3 gap-4"
      >
        {settings.categories.map((cat, index) => {
          const spent = categoryStats[cat.name] || 0;
          const budget = cat.monthlyBudget || 0;
          const percentage = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
          const isOverBudget = budget > 0 && spent > budget;

          const { handlers: holdHandlers, isActiveHold } = useHoldGesture({
            onHold: () => setIsEditMode(true),
            holdDuration: 3000,
            movementThreshold: 10
          });

          const { handlers: doubleTapHandlers } = useDoubleTapGesture({
            onDoubleTap: () => !isEditMode && setAnalyticsCategory(cat),
          });

          const combinedHandlers = {
            ...holdHandlers,
            onClick: (e: React.MouseEvent) => {
              if (isEditMode) {
                setEditingCategory(cat);
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
            <Draggable
              key={cat.id}
              draggableId={cat.id}
              index={index}
              isDragDisabled={!isEditMode}
            >
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.draggableProps}
                  {...provided.dragHandleProps}
                  className={`rounded-xl p-3 flex flex-col items-center gap-2 transition-all relative ${
                    isActiveHold ? 'scale-95 opacity-80' : 'hover:shadow-md'
                  } ${isEditMode ? 'animate-wiggle' : ''} ${
                    snapshot.isDragging ? 'shadow-2xl scale-110 z-50' : ''
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
                        handleDeleteCategory(cat.id);
                      }}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors z-10"
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
                    {settings.baseCurrency} {spent.toFixed(2)}
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
              )}
            </Draggable>
          );
        })}
        {provided.placeholder}

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
    )}
  </Droppable>
</DragDropContext>

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

{/* Modals */}
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
```

**Step 7: Add wiggle animation to Tailwind config**

In `tailwind.config.js`, add to theme.extend.animation:

```javascript
animation: {
  'wiggle': 'wiggle 0.3s ease-in-out infinite',
},
keyframes: {
  wiggle: {
    '0%, 100%': { transform: 'rotate(-1deg)' },
    '50%': { transform: 'rotate(1deg)' },
  },
},
```

**Step 8: Test edit mode**

Run: `npm run dev`
Navigate to Categories view

Test sequence:
1. Hold any category for 3 seconds → edit mode activates
2. Verify: Cards wiggle, X badges appear, "Add Category" card shows, "Done" button at bottom
3. Tap any category → CategoryEditModal opens for editing
4. Drag a category → reorders in grid
5. Tap X badge → deletes category (with confirmation)
6. Tap "Add Category" → modal opens for creating new
7. Tap "Done" → exits edit mode

**Step 9: Commit edit mode implementation**

```bash
git add components/CategoriesView.tsx tailwind.config.js package.json package-lock.json
git commit -m "feat: implement global category edit mode with drag-drop

- 3-second hold triggers global edit mode
- Drag & drop reordering with react-beautiful-dnd
- Tap category to edit (name, icon, color, budget)
- Delete badge on each category in edit mode
- Add new category card in edit mode
- Wiggle animation for visual feedback
- Done button to exit edit mode"
```

---

## Task 6: Create AI Receipt Splitting Service

**Files:**
- Create: `services/receiptSplitService.ts`

**Step 1: Create receipt split service with Gemini API**

```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppSettings } from '../types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export interface ReceiptLineItem {
  description: string;
  amount: number;
  quantity?: string;
  suggestedCategory: string;
}

export interface ReceiptParseResult {
  lineItems: ReceiptLineItem[];
  totalAmount: number;
  merchant?: string;
  date?: string;
}

export async function parseReceiptLineItems(
  imageBase64: string,
  mimeType: string,
  settings: AppSettings
): Promise<ReceiptParseResult> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          lineItems: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                amount: { type: 'number' },
                quantity: { type: 'string' },
                suggestedCategory: { type: 'string' },
              },
              required: ['description', 'amount', 'suggestedCategory'],
            },
          },
          totalAmount: { type: 'number' },
          merchant: { type: 'string' },
          date: { type: 'string' },
        },
        required: ['lineItems', 'totalAmount'],
      },
    },
  });

  const categoryList = settings.categories.map(c => c.name).join(', ');

  const prompt = `Parse this receipt image and extract all line items.

Available categories: ${categoryList}

For each line item, provide:
- description: Item name/description
- amount: Price (number only, no currency symbols)
- quantity: Optional quantity/unit (e.g., "2 lbs", "3x")
- suggestedCategory: Best matching category from the list

Also extract:
- totalAmount: Total on receipt
- merchant: Store/merchant name
- date: Transaction date (YYYY-MM-DD format)

Group similar items intelligently. For example, "Milk 2.50" and "Eggs 3.00" can be separate items but both under "Groceries" category.`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType,
      },
    },
  ]);

  const response = result.response;
  const text = response.text();
  const parsed: ReceiptParseResult = JSON.parse(text);

  return parsed;
}
```

**Step 2: Commit receipt split service**

```bash
git add services/receiptSplitService.ts
git commit -m "feat: add AI receipt line item parsing service

- Uses Gemini 2.0 Flash with structured JSON schema
- Extracts line items with description, amount, quantity
- Suggests categories based on app settings
- Returns merchant, date, and total amount
- Intelligent grouping of similar items"
```

---

## Task 7: Create Split Editor Modal Component

**Files:**
- Create: `components/SplitEditorModal.tsx`

**Step 1: Create the split editor modal** (Part 1 - Structure)

```typescript
import React, { useState, useEffect } from 'react';
import { X, Plus, GripVertical, Trash2 } from 'lucide-react';
import { ReceiptLineItem } from '../services/receiptSplitService';
import { AppSettings, TransactionType } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface LineItemWithId extends ReceiptLineItem {
  id: string;
  checked: boolean;
}

interface ItemGroup {
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
```

**Step 2: Commit split editor modal**

```bash
git add components/SplitEditorModal.tsx
git commit -m "feat: add SplitEditorModal for grouping receipt line items

- Auto-groups line items by suggested category
- Editable group categories with dropdown
- Toggle, edit, and remove individual line items
- Add new items to groups manually
- Create new groups for custom categorization
- Balance validation against original amount
- Shows total and remaining amount"
```

---

## Task 8: Integrate Receipt Split in AddTransaction Review

**Files:**
- Modify: `components/AddTransaction.tsx`

**Step 1: Add imports and state**

At top of `AddTransaction.tsx`:

```typescript
import { parseReceiptLineItems } from '../services/receiptSplitService';
import SplitEditorModal from './SplitEditorModal';
```

Add state (after existing state declarations around line 26):

```typescript
const [splittingTransaction, setSplittingTransaction] = useState<Transaction | null>(null);
const [splitLineItems, setSplitLineItems] = useState<ReceiptLineItem[] | null>(null);
const [isSplitLoading, setIsSplitLoading] = useState(false);
```

**Step 2: Add split handler function**

Before the return statement:

```typescript
const handleSplitTransaction = async (transaction: Transaction) => {
  // Check if receipt image exists
  if (!transaction.receiptImage && !receiptImage) {
    alert('Please upload a receipt image first');
    return;
  }

  setSplittingTransaction(transaction);
  setIsSplitLoading(true);

  try {
    const imageToUse = transaction.receiptImage || receiptImage;
    const [mimeType, base64Data] = imageToUse!.split(',');
    const cleanMimeType = mimeType.match(/:(.*?);/)?.[1] || 'image/jpeg';

    const result = await parseReceiptLineItems(
      base64Data,
      cleanMimeType,
      settings
    );

    setSplitLineItems(result.lineItems);
  } catch (error) {
    console.error('Split parse error:', error);
    alert('Failed to parse receipt. Please try again.');
    setSplittingTransaction(null);
  } finally {
    setIsSplitLoading(false);
  }
};

const handleConfirmSplit = (groups: ItemGroup[]) => {
  if (!splittingTransaction) return;

  const groupId = uuidv4();
  const splitTransactions: Transaction[] = [];

  groups.forEach((group) => {
    const groupAmount = group.items.reduce((sum, item) => sum + item.amount, 0);
    const groupDescription = group.items.map((i) => i.description).join(', ');

    splitTransactions.push({
      ...splittingTransaction,
      id: uuidv4(),
      groupId,
      amount: groupAmount,
      merchant: `${splittingTransaction.merchant} - ${groupDescription}`,
      category: group.category,
      receiptImage: splittingTransaction.receiptImage || receiptImage,
    });
  });

  // Replace original transaction with split transactions in preview
  if (previewData) {
    const updated = previewData.filter((t) => t.id !== splittingTransaction.id);
    setPreviewData([...updated, ...splitTransactions]);
  }

  setSplittingTransaction(null);
  setSplitLineItems(null);
};
```

**Step 3: Add split button to preview cards**

In the preview section (around line 205-236), add the split button after the transaction details:

```tsx
<div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 relative group">
  {/* Existing content... */}

  {/* Add this before the closing div */}
  <button
    onClick={() => handleSplitTransaction(t)}
    disabled={isSplitLoading && splittingTransaction?.id === t.id}
    className="mt-3 w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2"
  >
    {isSplitLoading && splittingTransaction?.id === t.id ? (
      <>
        <Loader2 className="animate-spin" size={14} />
        Analyzing Receipt...
      </>
    ) : (
      <>
        📄 Split with Receipt
      </>
    )}
  </button>
</div>
```

**Step 4: Add SplitEditorModal rendering**

At the end of the component, before the closing tag:

```tsx
{/* Split Editor Modal */}
{splittingTransaction && splitLineItems && (
  <SplitEditorModal
    originalAmount={splittingTransaction.amount}
    merchant={splittingTransaction.merchant}
    date={splittingTransaction.date}
    accountId={splittingTransaction.accountId}
    lineItems={splitLineItems}
    settings={settings}
    baseCurrency={settings.baseCurrency}
    onConfirm={handleConfirmSplit}
    onCancel={() => {
      setSplittingTransaction(null);
      setSplitLineItems(null);
    }}
  />
)}
```

**Step 5: Test split in review mode**

Run: `npm run dev`

Test sequence:
1. Go to Add Transaction
2. Upload receipt image OR paste transaction text
3. Tap "Analyze"
4. In preview, tap "Split with Receipt" on any transaction
5. Wait for AI to parse receipt
6. SplitEditorModal opens with grouped line items
7. Edit groups, amounts, categories
8. Tap "Create X Transactions"
9. Verify: Original transaction replaced with multiple grouped transactions
10. Tap "Import All" to save

**Step 6: Commit split integration in review**

```bash
git add components/AddTransaction.tsx
git commit -m "feat: integrate receipt splitting in transaction review mode

- Added 'Split with Receipt' button to preview cards
- AI parses receipt image into line items
- SplitEditorModal for grouping and editing
- Replaces original transaction with split group transactions
- All split transactions share groupId and receipt image"
```

---

## Task 9: Add Receipt Split to EditTransactionModal

**Files:**
- Modify: `components/EditTransactionModal.tsx`

**Step 1: Add imports and state**

At top of `EditTransactionModal.tsx`:

```typescript
import { parseReceiptLineItems, ReceiptLineItem } from '../services/receiptSplitService';
import SplitEditorModal from './SplitEditorModal';
```

Add state after existing state declarations:

```typescript
const [showSplitEditor, setShowSplitEditor] = useState(false);
const [splitLineItems, setSplitLineItems] = useState<ReceiptLineItem[] | null>(null);
const [isSplitLoading, setIsSplitLoading] = useState(false);
```

**Step 2: Add split handler**

Before the return statement:

```typescript
const handleSplitTransaction = async () => {
  if (!localTransaction.receiptImage) {
    alert('Please upload a receipt image first');
    return;
  }

  setIsSplitLoading(true);

  try {
    const [mimeType, base64Data] = localTransaction.receiptImage.split(',');
    const cleanMimeType = mimeType.match(/:(.*?);/)?.[1] || 'image/jpeg';

    const result = await parseReceiptLineItems(
      base64Data,
      cleanMimeType,
      settings
    );

    setSplitLineItems(result.lineItems);
    setShowSplitEditor(true);
  } catch (error) {
    console.error('Split parse error:', error);
    alert('Failed to parse receipt. Please try again.');
  } finally {
    setIsSplitLoading(false);
  }
};

const handleConfirmSplit = (groups: ItemGroup[]) => {
  const groupId = uuidv4();
  const splitTransactions: Transaction[] = [];

  groups.forEach((group) => {
    const groupAmount = group.items.reduce((sum, item) => sum + item.amount, 0);
    const groupDescription = group.items.map((i) => i.description).join(', ');

    splitTransactions.push({
      ...localTransaction,
      id: uuidv4(),
      groupId,
      amount: groupAmount,
      merchant: `${localTransaction.merchant} - ${groupDescription}`,
      category: group.category,
    });
  });

  // Delete original, create new split transactions
  onDelete(); // Delete original

  // Note: This assumes onSave can handle multiple transactions
  // If not, we need to call onSave for each or refactor
  splitTransactions.forEach((tx) => {
    onSave(tx); // Save each split transaction
  });

  onClose();
};
```

**Step 3: Add split button to modal footer**

Find the footer section (around the Delete/Save buttons) and add the split button:

```tsx
{/* Footer - updated */}
<div className="px-6 py-4 border-t border-slate-100 flex gap-3">
  {onDelete && (
    <button
      onClick={() => {
        if (window.confirm('Delete this transaction?')) {
          onDelete();
          onClose();
        }
      }}
      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
    >
      <Trash2 size={18} />
      Delete
    </button>
  )}

  {/* Split Button */}
  <button
    onClick={handleSplitTransaction}
    disabled={isSplitLoading || !localTransaction.receiptImage}
    className="px-4 py-2 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {isSplitLoading ? (
      <>
        <Loader2 className="animate-spin" size={18} />
        Analyzing...
      </>
    ) : (
      <>
        📄 Split
      </>
    )}
  </button>

  <div className="flex-1" />

  <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
    Cancel
  </button>

  <button
    onClick={handleSave}
    className="px-4 py-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors flex items-center gap-2"
  >
    <Save size={18} />
    Save
  </button>
</div>
```

**Step 4: Add SplitEditorModal rendering**

At the end of the component:

```tsx
{/* Split Editor Modal */}
{showSplitEditor && splitLineItems && (
  <SplitEditorModal
    originalAmount={localTransaction.amount}
    merchant={localTransaction.merchant}
    date={localTransaction.date}
    accountId={localTransaction.accountId}
    lineItems={splitLineItems}
    settings={settings}
    baseCurrency={settings.baseCurrency}
    onConfirm={handleConfirmSplit}
    onCancel={() => {
      setShowSplitEditor(false);
      setSplitLineItems(null);
    }}
  />
)}
```

**Step 5: Test split in edit modal**

Run: `npm run dev`

Test sequence:
1. Go to Transaction List/History
2. Tap any transaction to edit
3. If no receipt, upload one first
4. Tap "Split" button
5. Wait for AI parsing
6. SplitEditorModal opens
7. Edit groups and confirm
8. Verify: Original deleted, multiple new transactions created

**Step 6: Commit split in edit modal**

```bash
git add components/EditTransactionModal.tsx
git commit -m "feat: add receipt splitting to EditTransactionModal

- Split button in modal footer
- Parses attached receipt image
- Opens SplitEditorModal for grouping
- Deletes original transaction
- Creates multiple grouped transactions
- Disabled when no receipt image attached"
```

---

## Task 10: Add Split Transaction Badge Indicator

**Files:**
- Modify: `components/TransactionList.tsx`
- Create: `components/SplitTransactionsModal.tsx`

**Step 1: Create SplitTransactionsModal to show linked splits**

```typescript
import React from 'react';
import { X } from 'lucide-react';
import { Transaction } from '../types';

interface SplitTransactionsModalProps {
  transactions: Transaction[];
  baseCurrency: string;
  onClose: () => void;
}

const SplitTransactionsModal: React.FC<SplitTransactionsModalProps> = ({
  transactions,
  baseCurrency,
  onClose,
}) => {
  const total = transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm" />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col pointer-events-auto">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Split Transactions</h2>
              <p className="text-sm text-slate-500">{transactions.length} linked transactions</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {transactions.map((t, index) => (
              <div key={t.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-400">
                    {index + 1}/{transactions.length}
                  </span>
                  <span className="font-bold text-slate-800">
                    {baseCurrency} {t.amount.toFixed(2)}
                  </span>
                </div>
                <div className="font-medium text-slate-800">{t.merchant}</div>
                <div className="text-sm text-slate-500 mt-1">
                  {t.category} • {t.date}
                </div>
              </div>
            ))}
          </div>

          <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between font-bold">
              <span className="text-slate-700">Total:</span>
              <span className="text-slate-800">{baseCurrency} {total.toFixed(2)}</span>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-slate-200">
            <button
              onClick={onClose}
              className="w-full py-2 px-4 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SplitTransactionsModal;
```

**Step 2: Add split badge to TransactionList**

In `components/TransactionList.tsx`, add imports:

```typescript
import SplitTransactionsModal from './SplitTransactionsModal';
```

Add state:

```typescript
const [viewingSplitGroup, setViewingSplitGroup] = useState<string | null>(null);
```

In the transaction map, add badge after category display:

```tsx
<div className="text-xs text-slate-500">{t.date} • {t.category}</div>

{/* Add split badge */}
{t.groupId && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      setViewingSplitGroup(t.groupId);
    }}
    className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-brand-50 text-brand-600 rounded text-xs font-medium hover:bg-brand-100 transition-colors"
  >
    🔗 Split ({transactions.filter(tx => tx.groupId === t.groupId).length})
  </button>
)}
```

Add modal at end:

```tsx
{viewingSplitGroup && (
  <SplitTransactionsModal
    transactions={transactions.filter(t => t.groupId === viewingSplitGroup)}
    baseCurrency={baseCurrency}
    onClose={() => setViewingSplitGroup(null)}
  />
)}
```

**Step 3: Test split badges**

Run: `npm run dev`

Test:
1. Create a split transaction (from review or edit)
2. Go to Transaction List
3. Verify: Split transactions show "🔗 Split (X)" badge
4. Tap badge → SplitTransactionsModal opens
5. Verify: Shows all linked transactions with total

**Step 4: Commit split badges**

```bash
git add components/SplitTransactionsModal.tsx components/TransactionList.tsx
git commit -m "feat: add split transaction badge and viewer

- Split badge shows linked transaction count
- Tap badge to view all transactions in group
- SplitTransactionsModal displays all linked splits
- Shows individual amounts and total"
```

---

## Task 11: Final Testing & Documentation

**Step 1: Comprehensive manual testing**

Test checklist:
- [ ] Category icons are circular
- [ ] No white card backgrounds
- [ ] Category names show 2 lines without truncation
- [ ] Budget progress rings visible around icons
- [ ] Double-tap opens analytics modal
- [ ] 3-second hold enters edit mode
- [ ] Drag-drop reordering works
- [ ] Can edit category (name, icon, color, budget)
- [ ] Can delete category
- [ ] Can add new category
- [ ] Receipt split works in review mode
- [ ] Receipt split works in edit modal
- [ ] Split transactions show badge
- [ ] Badge opens linked transactions modal

**Step 2: Update CLAUDE.md with new features**

Add to CLAUDE.md:

```markdown
## Category Management

### Gesture Controls
- **Double-Tap**: Opens CategorySummaryModal (analytics, read-only)
- **3-Second Hold**: Enters global edit mode
  - Drag & drop to reorder categories
  - Tap category to edit (name, icon, color, budget)
  - Delete badge (X) to remove category
  - "Add Category" card to create new
  - "Done" button to exit edit mode

### UI Enhancements
- Circular category icons (not square)
- 360° budget progress rings around icons
- No white card backgrounds (cleaner design)
- 2-line category names with line-clamp

## AI Receipt Splitting

### Feature
Split single receipts into multiple transactions grouped by category.

### Usage
1. **In Review Mode**: Tap "Split with Receipt" on any parsed transaction
2. **In Edit Mode**: Tap "Split" button in EditTransactionModal

### Flow
- AI parses receipt image into line items
- Auto-groups by category (e.g., Groceries, Entertainment)
- User can:
  - Edit item descriptions and amounts
  - Drag items between groups
  - Change group categories
  - Add new groups or items
  - Remove items
- Creates multiple transactions with shared `groupId`
- All splits share the same receipt image

### Split Transaction Display
- Badge: "🔗 Split (X)" shows linked count
- Tap badge to view all transactions in group
- SplitTransactionsModal shows individual + total amounts

## Implementation Files
- `hooks/useDoubleTapGesture.ts` - Double-tap detection
- `hooks/useHoldGesture.ts` - 3-second hold for edit mode
- `components/CategoryEditModal.tsx` - Create/edit categories
- `services/receiptSplitService.ts` - AI receipt line item parsing
- `components/SplitEditorModal.tsx` - Grouping and editing line items
- `components/SplitTransactionsModal.tsx` - View linked split transactions
```

**Step 3: Commit documentation**

```bash
git add CLAUDE.md
git commit -m "docs: document category UI enhancements and receipt splitting

- Added gesture controls documentation
- Documented UI visual improvements
- Added receipt splitting feature guide
- Listed implementation files"
```

**Step 4: Final commit & push**

```bash
git log --oneline -15  # Review commits
git push origin feature/category-ui-enhancements
```

---

## Implementation Complete

All tasks completed:
✅ Category UI fixes (circular icons, progress bars, text clipping)
✅ Double-tap gesture for analytics
✅ 3-second hold for global edit mode
✅ Drag-drop category reordering
✅ Category CRUD with modal
✅ AI receipt splitting service
✅ Split editor with grouping
✅ Split integration in review mode
✅ Split integration in edit modal
✅ Split transaction badges and viewer
✅ Documentation updated

**Next Steps:**
1. Create pull request from `feature/category-ui-enhancements` to `main`
2. Code review
3. Merge to main
4. Clean up worktree with @superpowers:finishing-a-development-branch
