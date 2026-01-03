import React, { useEffect } from 'react';
import {
  X,
  Settings,
  Tags,
  Target,
  Shield,
  Calendar,
  ChevronRight,
  Receipt,
} from 'lucide-react';
import { View } from '../types';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentView: View;
  onNavigate: (view: View) => void;
}

const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  currentView,
  onNavigate,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const drawerItems: Array<{
    view: View;
    icon: React.ReactNode;
    label: string;
    gradient: string;
  }> = [
    {
      view: 'bills',
      icon: <Receipt size={20} />,
      label: 'Bills & Debts',
      gradient: 'from-emerald-400 to-teal-600'
    },
    {
      view: 'categories',
      icon: <Tags size={20} />,
      label: 'Categories',
      gradient: 'from-yellow-400 to-orange-500'
    },
    {
      view: 'calendar',
      icon: <Calendar size={20} />,
      label: 'Calendar',
      gradient: 'from-purple-400 to-purple-600'
    },
    {
      view: 'planning',
      icon: <Target size={20} />,
      label: 'Planning',
      gradient: 'from-blue-400 to-blue-600'
    },
    {
      view: 'warranties',
      icon: <Shield size={20} />,
      label: 'Warranties',
      gradient: 'from-slate-700 to-slate-900'
    },
  ];

  const handleItemClick = (view: View) => {
    onNavigate(view);
    onClose();
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleBackdropClick}
      />

      {/* Drawer */}
      <div
        className={`fixed left-0 top-0 bottom-0 w-64 bg-white shadow-2xl z-50 transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Header with Close Button */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-800">Menu</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Menu Items - Gradient Pills */}
        <div className="p-4 space-y-3 flex-1">
          {drawerItems.map((item) => (
            <button
              key={item.view}
              onClick={() => handleItemClick(item.view)}
              className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-full transition-all transform hover:scale-105 active:scale-95 shadow-md bg-gradient-to-r ${item.gradient} text-white`}
            >
              <div className="flex-shrink-0">
                {item.icon}
              </div>
              <span className="font-bold text-sm flex-1 text-left">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Settings Button - Bottom Teal Pill */}
        <div className="p-4 border-t border-slate-100">
          <button
            onClick={() => handleItemClick('settings')}
            className="w-full flex items-center gap-3 px-5 py-3.5 rounded-full transition-all transform hover:scale-105 active:scale-95 shadow-md bg-gradient-to-r from-brand-500 to-brand-700 text-white"
          >
            <Settings size={20} />
            <span className="font-bold text-sm flex-1 text-left">Settings</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default NavigationDrawer;
