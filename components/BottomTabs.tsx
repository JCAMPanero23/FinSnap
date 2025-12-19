import React from 'react';
import {
  Plus,
  LayoutDashboard,
  Wallet,
  History,
  ChevronRight,
} from 'lucide-react';
import { View } from '../types';
import { useDragGesture } from '../hooks/useDragGesture';

interface BottomTabsProps {
  currentView: View;
  onNavigate: (view: View) => void;
  onAdd: () => void;
  onDrawerOpen: () => void;
}

interface TabButtonProps {
  view: View;
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({
  view,
  icon,
  label,
  isActive,
  onClick,
}) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center gap-1 transition-all ${
      isActive ? 'text-brand-600' : 'text-slate-400 hover:text-brand-500 hover:scale-105'
    }`}
  >
    <div className="flex-shrink-0">{icon}</div>
    <span className="text-[10px] font-bold">{label}</span>
  </button>
);

const BottomTabs: React.FC<BottomTabsProps> = ({
  currentView,
  onNavigate,
  onAdd,
  onDrawerOpen,
}) => {
  // Drag gesture for drawer button
  const { handlers: dragHandlers, isDragging } = useDragGesture({
    onDragRight: onDrawerOpen,
    onTap: onAdd,
    dragThreshold: 40,
    swipeThreshold: 10,
  });

  return (
    <div className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-slate-200 z-30 max-w-md mx-auto">
      <div className="flex items-center justify-between px-6 h-full relative">
        {/* Drawer Button (Lower Left, Above Home) */}
        <div className="absolute bottom-20 left-6">
          <button
            {...dragHandlers}
            className={`w-12 h-12 rounded-full bg-brand-600 text-white shadow-lg flex items-center justify-center transition-all duration-200 ease-out active:scale-95 ${
              isDragging ? 'scale-125 shadow-2xl' : 'hover:scale-105'
            }`}
            title="Tap to add transaction, drag right to open menu"
          >
            <Plus size={24} />
          </button>

          {/* Visual hint for drag capability with animation */}
          <div
            className={`absolute -right-1 -top-1 w-4 h-4 bg-slate-700 rounded-full flex items-center justify-center transition-all duration-200 ${
              isDragging ? 'opacity-0 translate-x-4' : 'opacity-100'
            }`}
            title="Drag right to open menu"
          >
            <ChevronRight size={10} className="text-white" />
          </div>
        </div>

        {/* Tab 1: Home (Dashboard) */}
        <TabButton
          view="dashboard"
          icon={<LayoutDashboard size={24} />}
          label="Home"
          isActive={currentView === 'dashboard'}
          onClick={() => onNavigate('dashboard')}
        />

        {/* Tab 2: Accounts */}
        <TabButton
          view="accounts"
          icon={<Wallet size={24} />}
          label="Accounts"
          isActive={currentView === 'accounts'}
          onClick={() => onNavigate('accounts')}
        />

        {/* Tab 3: History */}
        <TabButton
          view="history"
          icon={<History size={24} />}
          label="History"
          isActive={currentView === 'history'}
          onClick={() => onNavigate('history')}
        />
      </div>
    </div>
  );
};

export default BottomTabs;
