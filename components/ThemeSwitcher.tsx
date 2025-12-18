import React from 'react';
import { Palette, Check } from 'lucide-react';
import { Theme, themes, applyTheme } from '../themes';

interface ThemeSwitcherProps {
  currentTheme: Theme;
  onThemeChange: (theme: Theme) => void;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({ currentTheme, onThemeChange }) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-lime border-2 border-black">
          <Palette size={20} className="text-black" />
        </div>
        <div>
          <h3 className="text-base font-display font-bold text-black uppercase tracking-wider">UI Theme</h3>
          <p className="text-xs font-body text-mid-gray">Choose your visual style</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {themes.map((theme) => {
          const isActive = currentTheme.id === theme.id;

          return (
            <button
              key={theme.id}
              onClick={() => {
                applyTheme(theme);
                onThemeChange(theme);
              }}
              className={`p-4 border-3 text-left transition-all duration-150 ${
                isActive
                  ? 'border-black bg-lime shadow-brutal-md translate-x-[-2px] translate-y-[-2px]'
                  : 'border-black bg-white hover:shadow-brutal-sm hover:translate-x-[-2px] hover:translate-y-[-2px]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-display font-bold text-sm text-black uppercase">{theme.name}</h4>
                    {isActive && (
                      <div className="w-5 h-5 bg-black border-2 border-black flex items-center justify-center">
                        <Check size={14} className="text-lime" strokeWidth={3} />
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-body text-mid-gray mb-3">{theme.description}</p>

                  {/* Color Preview */}
                  <div className="flex gap-1.5">
                    <div
                      className="w-8 h-8 border-2 border-black"
                      style={{ backgroundColor: theme.colors.primary }}
                      title="Primary"
                    />
                    <div
                      className="w-8 h-8 border-2 border-black"
                      style={{ backgroundColor: theme.colors.secondary }}
                      title="Secondary"
                    />
                    <div
                      className="w-8 h-8 border-2 border-black"
                      style={{ backgroundColor: theme.colors.accent }}
                      title="Accent"
                    />
                    <div
                      className="w-8 h-8 border-2 border-black"
                      style={{ backgroundColor: theme.colors.background }}
                      title="Background"
                    />
                    <div
                      className="w-8 h-8 border-2 border-black"
                      style={{ backgroundColor: theme.colors.foreground }}
                      title="Foreground"
                    />
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-near-white border-2 border-black">
        <p className="text-xs font-body text-mid-gray">
          <span className="font-bold text-black">💡 Tip:</span> Your theme preference is saved automatically and persists across sessions.
        </p>
      </div>
    </div>
  );
};

export default ThemeSwitcher;
