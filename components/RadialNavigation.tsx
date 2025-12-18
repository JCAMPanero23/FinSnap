import React, { useState, useRef, useEffect } from 'react';
import { Plus, LayoutDashboard, History, Wallet, PiggyBank, ShieldCheck, ChevronUp, ChevronLeft, ChevronRight, Settings, Layers, Calendar } from 'lucide-react';
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

  // Radial Menu Items - Neo-Brutalist Colors
  const menuItems = [
    { view: 'settings', icon: Settings, label: 'Config', angle: -160, color: '#808080' },
    { view: 'categories', icon: Layers, label: 'Cats', angle: -140, color: '#FF006E' },
    { view: 'calendar', icon: Calendar, label: 'Cal', angle: -110, color: '#00F5FF' },
    { view: 'planning', icon: PiggyBank, label: 'Plan', angle: -80, color: '#BFFF00' },
    { view: 'accounts', icon: Wallet, label: 'Accts', angle: -50, color: '#FFD600' },
    { view: 'warranties', icon: ShieldCheck, label: 'Wrty', angle: -20, color: '#000000' },
  ];

  const radius = 120; 

  return (
    <div className="fixed bottom-0 left-0 right-0 h-32 flex justify-center items-end pointer-events-none z-40" ref={menuRef}>

      {/* Static Tabs - Brutalist Style */}
      {!isOpen && (
        <>
          <button
            onClick={() => onNavigate('dashboard')}
            className={`absolute bottom-8 left-8 flex flex-col items-center gap-2 pointer-events-auto transition-all duration-150 ${
              currentView === 'dashboard'
                ? 'translate-x-[-2px] translate-y-[-2px]'
                : 'hover:translate-x-[-2px] hover:translate-y-[-2px]'
            }`}
          >
            <div className={`p-3 border-3 border-black shadow-brutal-md ${
              currentView === 'dashboard' ? 'bg-lime' : 'bg-white hover:bg-near-white'
            }`}>
              <LayoutDashboard size={22} className="text-black" strokeWidth={2.5} />
            </div>
            <span className={`text-[9px] font-display font-bold uppercase tracking-wider px-2 py-1 border-2 border-black ${
              currentView === 'dashboard' ? 'bg-lime text-black' : 'bg-white text-black'
            }`}>Home</span>
          </button>

          <button
            onClick={() => onNavigate('history')}
            className={`absolute bottom-8 right-8 flex flex-col items-center gap-2 pointer-events-auto transition-all duration-150 ${
              currentView === 'history'
                ? 'translate-x-[-2px] translate-y-[-2px]'
                : 'hover:translate-x-[-2px] hover:translate-y-[-2px]'
            }`}
          >
            <div className={`p-3 border-3 border-black shadow-brutal-md ${
              currentView === 'history' ? 'bg-lime' : 'bg-white hover:bg-near-white'
            }`}>
              <History size={22} className="text-black" strokeWidth={2.5} />
            </div>
            <span className={`text-[9px] font-display font-bold uppercase tracking-wider px-2 py-1 border-2 border-black ${
              currentView === 'history' ? 'bg-lime text-black' : 'bg-white text-black'
            }`}>Hist</span>
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
              className="absolute flex flex-col items-center justify-center transition-all duration-300 ease-out pointer-events-auto"
              style={{
                transform: `translate(${tx}px, ${ty}px) translate(-50%, -50%) scale(${scale})`,
                opacity: opacity
              }}
            >
              <button
                onClick={() => { onNavigate(item.view as View); setIsOpen(false); }}
                className={`w-14 h-14 border-3 border-black flex items-center justify-center shadow-brutal-md transition-all duration-150 hover:shadow-brutal-lg hover:translate-x-[-2px] hover:translate-y-[-2px]
                  ${isActive ? 'scale-110 shadow-brutal-lg' : 'scale-100'}
                `}
                style={{ backgroundColor: item.color }}
              >
                <item.icon
                  size={22}
                  className={item.color === '#000000' ? 'text-white' : 'text-black'}
                  strokeWidth={2.5}
                />
              </button>
              {/* Text outside the circle */}
              <span className={`text-[9px] font-display font-bold mt-2 px-2 py-1 bg-white border-2 border-black shadow-brutal-sm whitespace-nowrap uppercase tracking-wider
                 ${isActive ? 'text-black bg-lime' : 'text-black'}
              `}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Swipe Indicators - Brutalist */}
      {!isOpen && (
        <>
          {/* Vertical Swipe Up Indicator */}
          <div className="absolute bottom-[6.5rem] flex flex-col items-center gap-1 opacity-70 animate-bounce pointer-events-none z-10">
             <ChevronUp size={22} className="text-black" strokeWidth={4} />
             <span className="text-[8px] font-display font-bold bg-lime px-2 py-0.5 border-2 border-black uppercase tracking-wide">Menu</span>
          </div>

          {/* Horizontal Swipe Indicators */}
          <div className="absolute bottom-10 w-48 flex justify-between items-center pointer-events-none px-2 opacity-60 z-0">
             <div className="flex items-center gap-1 animate-pulse">
                <ChevronLeft className="text-black" size={26} strokeWidth={4} />
             </div>

             <div className="flex items-center gap-1 animate-pulse">
                <ChevronRight className="text-black" size={26} strokeWidth={4} />
             </div>
          </div>
        </>
      )}

      {/* Main FAB - Brutalist */}
      <div className="pointer-events-auto mb-8 relative group">
          {/* Background */}
          <div className="absolute -inset-4 bg-white border-3 border-black shadow-brutal-lg z-0"></div>

          <button
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            className={`relative w-20 h-20 border-3 border-black shadow-brutal-xl flex items-center justify-center transition-all duration-200 z-50
              ${isOpen ? 'bg-black rotate-45 scale-90 shadow-brutal-md' : 'bg-lime hover:bg-lime-dark hover:shadow-[10px_10px_0_#000] hover:translate-x-[-2px] hover:translate-y-[-2px] active:shadow-brutal-sm active:translate-x-[2px] active:translate-y-[2px]'}
            `}
          >
            <Plus size={42} className={isOpen ? 'text-lime' : 'text-black'} strokeWidth={3} />
          </button>
          {!isOpen && (
            <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-display font-bold text-black pointer-events-none bg-white px-2 py-1 border-2 border-black uppercase tracking-wider">
              Add
            </div>
          )}
      </div>

    </div>
  );
};

export default RadialNavigation;