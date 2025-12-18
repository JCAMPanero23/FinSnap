import React, { useState, useRef, useEffect } from 'react';
import { Plus, LayoutDashboard, History, Wallet, PiggyBank, ShieldCheck, ChevronUp, ChevronLeft, ChevronRight, Settings, Layers } from 'lucide-react';
import { View } from '../types';

interface RadialNavigationProps {
  currentView: View;
  onNavigate: (view: View) => void;
  onAdd: () => void;
}

const RadialNavigation: React.FC<RadialNavigationProps> = ({ currentView, onNavigate, onAdd }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Touch/Mouse Tracking
  const startPos = useRef<{x: number, y: number} | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleStart = (clientX: number, clientY: number) => {
    startPos.current = { x: clientX, y: clientY };
  };

  const handleEnd = (clientX: number, clientY: number) => {
    if (!startPos.current) return;
    
    const dx = clientX - startPos.current.x;
    const dy = clientY - startPos.current.y;
    startPos.current = null;

    const SWIPE_THRESHOLD = 30; // pixels
    
    if (Math.abs(dx) < SWIPE_THRESHOLD && Math.abs(dy) < SWIPE_THRESHOLD) {
      // Tap detected
      if (isOpen) {
        setIsOpen(false);
      } else {
        onAdd();
      }
    } else {
      // Swipe detected
      if (dy < -SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) {
        // Swipe Up -> Open Menu
        setIsOpen(true);
      } else if (Math.abs(dx) > SWIPE_THRESHOLD) {
        // Swipe Horizontal -> Add Transaction
        onAdd();
      }
    }
  };

  // Mouse Handlers (for desktop testing)
  // We attach a global mouseup listener to catch swipes that end outside the button
  const handleMouseDown = (e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY);
    
    const handleWindowMouseUp = (ev: MouseEvent) => {
      handleEnd(ev.clientX, ev.clientY);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
    
    window.addEventListener('mouseup', handleWindowMouseUp);
  };

  // Touch Handlers (for mobile)
  const handleTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX, e.touches[0].clientY);
  const handleTouchEnd = (e: React.TouchEvent) => handleEnd(e.changedTouches[0].clientX, e.changedTouches[0].clientY);

  // Radial Menu Items (Removed Home/History as they are now static)
  const menuItems = [
    { view: 'settings', icon: Settings, label: 'Settings', angle: -160 },
    { view: 'categories', icon: Layers, label: 'Cats', angle: -125 },
    { view: 'planning', icon: PiggyBank, label: 'Plan', angle: -90 }, // Top center
    { view: 'accounts', icon: Wallet, label: 'Accts', angle: -55 },
    { view: 'warranties', icon: ShieldCheck, label: 'Wrties', angle: -20 },
  ];

  const radius = 120; 

  return (
    <div className="fixed bottom-0 left-0 right-0 h-32 flex justify-center items-end pointer-events-none z-40" ref={menuRef}>
      
      {/* Static Tabs (Original Position) */}
      {!isOpen && (
        <>
          <button 
            onClick={() => onNavigate('dashboard')}
            className={`absolute bottom-8 left-10 flex flex-col items-center gap-1 pointer-events-auto transition-colors ${currentView === 'dashboard' ? 'text-brand-600' : 'text-slate-400'}`}
          >
            <div className={`p-2 rounded-xl ${currentView === 'dashboard' ? 'bg-brand-50' : 'bg-transparent'}`}>
              <LayoutDashboard size={24} />
            </div>
            <span className="text-[10px] font-bold">Home</span>
          </button>

          <button 
            onClick={() => onNavigate('history')}
            className={`absolute bottom-8 right-10 flex flex-col items-center gap-1 pointer-events-auto transition-colors ${currentView === 'history' ? 'text-brand-600' : 'text-slate-400'}`}
          >
            <div className={`p-2 rounded-xl ${currentView === 'history' ? 'bg-brand-50' : 'bg-transparent'}`}>
              <History size={24} />
            </div>
            <span className="text-[10px] font-bold">Hist</span>
          </button>
        </>
      )}

      {/* Radial Items Container */}
      <div className="absolute bottom-12 left-1/2 w-0 h-0 flex items-center justify-center">
        {menuItems.map((item) => {
          const isActive = currentView === item.view;
          // Calculate position
          const rad = item.angle * (Math.PI / 180);
          const tx = isOpen ? Math.cos(rad) * radius : 0;
          const ty = isOpen ? Math.sin(rad) * radius : 0;
          const scale = isOpen ? 1 : 0;
          const opacity = isOpen ? 1 : 0;

          return (
            <div
              key={item.view}
              className="absolute flex flex-col items-center justify-center transition-all duration-300 pointer-events-auto"
              style={{
                transform: `translate(${tx}px, ${ty}px) translate(-50%, -50%) scale(${scale})`,
                opacity: opacity
              }}
            >
              <button
                onClick={() => { onNavigate(item.view as View); setIsOpen(false); }}
                className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg border-2 transition-colors duration-200
                  ${isActive ? 'bg-brand-600 border-brand-700 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300'}
                `}
              >
                <item.icon size={20} />
              </button>
              {/* Text outside the circle */}
              <span className={`text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded-md bg-white/90 shadow-sm border border-slate-100 whitespace-nowrap
                 ${isActive ? 'text-brand-700' : 'text-slate-600'}
              `}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Swipe Indicators */}
      {!isOpen && (
        <>
          {/* Vertical Swipe Up Indicator - Close to button */}
          <div className="absolute bottom-[5.5rem] flex flex-col items-center gap-0.5 opacity-60 animate-bounce pointer-events-none z-10">
             <ChevronUp size={20} className="text-red-500" strokeWidth={3} />
             <span className="text-[9px] text-slate-400 font-bold bg-white/90 px-1.5 rounded-full backdrop-blur-sm shadow-sm">Swipe Up</span>
          </div>

          {/* Horizontal Swipe Indicators - Close to button */}
          <div className="absolute bottom-10 w-48 flex justify-between items-center pointer-events-none px-2 opacity-50 z-0">
             <div className="flex items-center gap-1 animate-pulse">
                <ChevronLeft className="text-red-500" size={24} strokeWidth={3} />
             </div>
             
             <div className="flex items-center gap-1 animate-pulse">
                <ChevronRight className="text-red-500" size={24} strokeWidth={3} />
             </div>
          </div>
        </>
      )}

      {/* Main FAB */}
      <div className="pointer-events-auto mb-8 relative group">
          <button
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={`w-20 h-20 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 z-50 border-4 border-slate-50
              ${isOpen ? 'bg-slate-800 rotate-45 scale-90' : 'bg-brand-600 hover:bg-brand-700 active:scale-95'}
            `}
          >
            <Plus size={40} className="text-white" />
          </button>
          {!isOpen && (
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold text-slate-400 pointer-events-none bg-white/80 px-2 rounded-full">
              Tap to Add
            </div>
          )}
      </div>

    </div>
  );
};

export default RadialNavigation;