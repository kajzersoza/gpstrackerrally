import React from 'react';
import { History, Compass, User, Activity } from 'lucide-react';
import { ActiveTab } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab }) => {
  const tabs: { id: ActiveTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'history', label: 'Előzmények', icon: History },
    { id: 'maps', label: 'Térkép', icon: Compass },
    { id: 'profile', label: 'Profil', icon: User },
  ];

  return (
    <nav className="flex-shrink-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-2 sm:px-4 pt-1 sm:pt-1.5 landscape:pt-0.5 max-h-[600px]:pt-0.5 pb-[max(0.35rem,env(safe-area-inset-bottom,0.35rem))] z-30 shadow-[0_-2px_12px_rgba(0,0,0,0.04)] select-none">
      <div className="max-w-xl mx-auto flex items-center justify-around sm:justify-center sm:gap-4 md:gap-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 sm:gap-2 transition-all cursor-pointer select-none ${
                isActive
                  ? 'bg-[#0066ff] text-white px-3 sm:px-4 py-1 sm:py-1.5 rounded-full shadow-md font-bold text-xs sm:text-sm font-heading active:scale-95'
                  : 'text-slate-600 hover:text-[#0050cb] hover:bg-slate-100/70 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium active:scale-95'
              }`}
            >
              <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className={isActive ? 'font-bold tracking-wide text-xs sm:text-sm' : 'hidden xs:inline sm:inline text-xs sm:text-sm'}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

