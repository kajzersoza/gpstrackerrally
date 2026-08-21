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
    <nav className="flex-shrink-0 bg-white/95 backdrop-blur-md border-t border-slate-200/80 px-4 py-2 z-20 shadow-[0_-2px_12px_rgba(0,0,0,0.03)]">
      <div className="max-w-xl mx-auto flex items-center justify-around sm:justify-center sm:gap-6 md:gap-8">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              id={`nav-tab-${tab.id}`}
              onClick={() => onSelectTab(tab.id)}
              className={`flex items-center justify-center gap-2 transition-all cursor-pointer select-none ${
                isActive
                  ? 'bg-[#0066ff] text-white px-5 py-2 rounded-full shadow-md font-bold text-xs sm:text-sm font-heading active:scale-95'
                  : 'text-slate-600 hover:text-[#0050cb] hover:bg-slate-100/70 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium active:scale-95'
              }`}
            >
              <Icon className={`w-4 h-4 sm:w-4.5 sm:h-4.5 ${isActive ? 'stroke-[2.5]' : ''}`} />
              <span className={isActive ? 'font-bold tracking-wide' : 'hidden sm:inline'}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

