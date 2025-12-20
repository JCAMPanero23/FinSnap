# Category UI Enhancements & AI Receipt Splitting
**Date:** 2025-12-21
**Status:** Design Complete - Ready for Implementation

## Overview
This design enhances the Categories view with improved UI/UX, gesture-based interactions, and adds AI-powered receipt splitting functionality for transaction management.

## Problems Being Solved
1. Category budget progress bars not visible
2. Category names truncating/clipping
3. White background cluttering category view
4. No ability to edit/reorder categories in main UI
5. Cannot edit parsed transactions before importing
6. No way to split receipts into multiple categorized transactions

## Design Decisions

### 1. Category View UI Fixes

#### Remove White Background
- **Current:** Cards have `bg-gradient-to-br from-white to-slate-50`
- **New:** Remove card backgrounds, categories float on `bg-slate-50` page background
- **Rationale:** Cleaner, less visual clutter

#### Change Icons to Circular
- **Current:** Square icons with `rounded-lg`
- **New:** Circular icons with `rounded-full`
- **Rationale:** Perfect fit for 360° circular progress rings

#### Fix Circular Progress Bars
**Issues:**
- Progress bars exist but not visible
- Low contrast with background
- Stroke too thin

**Solutions:**
- Increase `strokeWidth` from 3 to 4
- Ensure proper color contrast
- Add glow effect for over-budget categories
- Progress color: `category.color` (normal) or `#ef4444` (over budget)

#### Fix Text Clipping
- **Current:** `truncate` class → "Home an...", "Car expe..."
- **New:** `line-clamp-2 leading-tight min-h-[2rem]`
- **Fallback:** If still clipping, reduce to `text-[10px]`
- **Rationale:** Show full category names, consistent card heights

### 2. Gesture System

#### Double-Tap Gesture (Analytics)
**Hook:** `hooks/useDoubleTapGesture.ts`
- Detects two taps within 300ms
- Position threshold: 20px (allows slight finger movement)
- **Action:** Opens CategorySummaryModal (read-only analytics)

**Implementation:**
```typescript
interface UseDoubleTapOptions {
  onDoubleTap: () => void;
  tapWindow?: number; // default 300ms
  positionThreshold?: number; // default 20px
}
```

#### 3-Second Hold Gesture (Edit Mode)
**Hook:** Modify existing `useHoldGesture.ts`
- Increase duration from 2000ms to 3000ms
- **Action:** Triggers global category edit mode

### 3. Global Category Edit Mode

#### Visual State Changes
When user holds any category for 3 seconds:
- All category cards enter wiggle animation
- Drag handle (⋮⋮) appears on each card
- Delete badge (X) appears on top-right corner
- "Add New Category" card appears at end of grid
- "Done" floating button at bottom

#### Interactions
- **Drag & Drop:** Reorder categories (react-beautiful-dnd or custom)
- **Tap category:** Opens CategoryEditModal
- **Tap X badge:** Delete category (with confirmation)
- **Tap "Add Category":** Opens CategoryCreateModal
- **Tap "Done":** Exit edit mode, persist new order

#### Category Edit/Create Modal
**Fields:**
- Category Name (text input, required)
- Icon Picker (grid of icons from ICON_LIB)
- Color Picker (grid of DEFAULT_COLORS)
- Monthly Budget (number input, optional, shows currency)

**Actions:**
- Save → Updates settings, syncs to Supabase
- Cancel → Discards changes
- Delete (edit only) → Confirms and removes category

### 4. Transaction Review Mode Enhancements

#### Hybrid Editing Approach
**Inline Editing (Quick):**
- Tap **Amount** → Inline number input
- Tap **Category** → Dropdown select
- Tap **Merchant** → Inline text input
- Changes saved to preview state (not DB until "Import All")

**Full Edit Modal:**
- Tap **pencil icon** → Opens EditTransactionModal
- All fields editable
- Can delete transaction
- Can trigger "Split with Receipt"

#### UI Layout
```
┌─────────────────────────────────────┐
│  [Edit 🖊] Merchant Name      [X]   │
│  Category Badge                      │
│  -AED 123.45                        │
│  Date • Account                      │
│  [📄 Split with Receipt]            │
└─────────────────────────────────────┘
```

### 5. AI Receipt Splitting Feature

#### Service Architecture
**File:** `services/receiptSplitService.ts`

**Function:** `parseReceiptLineItems(imageBase64: string, mimeType: string)`

**Gemini API Schema:**
```typescript
{
  lineItems: [
    {
      description: string,      // "Organic Bananas"
      amount: number,           // 12.50
      quantity?: string,        // "2 lbs"
      suggestedCategory: string // "Groceries"
    }
  ],
  totalAmount: number,         // Receipt total for validation
  merchant?: string,           // Detected merchant name
  date?: string               // Detected date (YYYY-MM-DD)
}
```

#### Grouping Approach
**Key Insight:** Allow grouping line items by category → each group = one transaction

**Example:**
- AI parses: Milk (Groceries), Eggs (Groceries), Netflix Card (Entertainment)
- Auto-groups:
  - Group 1 "Groceries": Milk + Eggs = AED 134.50
  - Group 2 "Entertainment": Netflix = AED 55.00
- Creates 2 transactions instead of 3

#### Split Editor Modal UI
```
┌─────────────────────────────────────────┐
│  Split Transaction - Whole Foods        │
│  Original: AED 234.50                    │
├─────────────────────────────────────────┤
│  📦 GROCERIES Group          AED 179.50  │
│  ├─ ✓ Milk & Dairy       45.00     [×]  │
│  ├─ ✓ Chicken Breast     89.50     [×]  │
│  └─ ✓ Organic Bananas    45.00     [×]  │
│                                          │
│  📦 ENTERTAINMENT Group      AED 55.00   │
│  └─ ✓ Netflix Gift Card  55.00     [×]  │
│                                          │
│  [+ New Group]                           │
├─────────────────────────────────────────┤
│  Total: AED 234.50 ✓ Matches             │
│  [Cancel]  [Create 2 Transactions]       │
└─────────────────────────────────────────┘
```

#### User Interactions
- **Toggle checkbox:** Include/exclude line items
- **Edit description:** Inline tap to edit
- **Edit amount:** Inline tap to edit
- **Change category:** Tap group header, select from dropdown
- **Drag line items:** Move between groups
- **Remove item:** Tap [×] button
- **Add group:** Tap "+ New Group" for manual items
- **Balance validation:** Shows remaining amount if totals don't match

#### Generated Transactions
Each group becomes one transaction:
```typescript
{
  id: uuid(),
  groupId: "shared-uuid", // Links all splits
  merchant: "Whole Foods - Groceries",
  amount: 179.50,
  category: "Groceries",
  date: "2025-12-21",
  receiptImage: "base64...", // Shared across all
  accountId: originalAccountId,
  // ... other fields
}
```

#### Integration Points

**1. AddTransaction Review Mode**
- Add "Split with Receipt" button to each preview card
- If receipt already uploaded → use it
- Else → prompt upload
- Opens SplitEditorModal
- After split → replaces original transaction with multiple grouped transactions

**2. EditTransactionModal**
- Add "Split with Receipt" button in footer
- Works on existing transactions
- If transaction has `receiptImage` → use it, else prompt
- After split:
  - DELETE original transaction
  - CREATE new grouped transactions
  - Close modal
  - Show split transactions in list with 🔗 badge

#### Viewing Split Transactions
**Visual Indicator:**
- Badge: "🔗 Split (2/3)" = transaction 2 of 3 in group
- Tap badge → Mini-modal showing all related transactions

**Query:**
```typescript
const splitTransactions = transactions.filter(t => t.groupId === selectedGroupId);
```

## Technical Considerations

### State Management
- Category order stored in `AppSettings.categories` array (index = order)
- Drag-drop updates array order, syncs to Supabase
- Split transactions linked by `groupId` (UUID)

### Performance
- Double-tap: Debounce to prevent accidental rapid taps
- Drag-drop: Use CSS transforms for smooth animation
- AI parsing: Show loading state, timeout after 30s

### Data Persistence
- Category edits sync to Supabase `categories` table
- Split transactions stored with `groupId` in `transactions` table
- Receipt images stored as base64 in transaction records (consider Supabase Storage for optimization)

### Error Handling
- AI parse failure → Show error, allow manual entry
- Total mismatch → Warn but allow override
- Network errors → Retry with exponential backoff

## Success Metrics
- Category names fully visible (no truncation)
- Circular progress bars clearly visible for budgets
- Users can reorder categories intuitively
- Split transactions reduce duplicate entries
- Receipt parsing accuracy > 90%

## Future Enhancements
- OCR improvement with custom training data
- Automatic receipt capture from email/SMS
- Bulk split operations for multiple receipts
- Smart category suggestions based on merchant history
