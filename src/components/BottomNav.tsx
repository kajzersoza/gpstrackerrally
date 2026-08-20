import React from 'react';
import { History, Compass, User, Activity } from 'lucide-react';
import { ActiveTab } from '../types';

interface BottomNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab }) => {
  return (
    <nav className="flex-shrink-0 bg-white/95 border-t border-slate-100 px-4 py-2 flex items-center justify-around z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
      {/* 1. Activity Tab */}
      <button
        id="nav-tab-activity"
        onClick={() => onSelectTab('activity')}
        className={`flex flex-col items-center justify-center transition-all ${
          activeTab === 'activity'
            ? 'bg-[#0066ff] text-white px-5 py-1.5 rounded-full shadow-md font-bold text-xs'
            : 'text-[#5b6572] hover:text-[#0050cb] p-1.5 text-xs font-medium'
        }`}
      >
        {activeTab === 'activity' ? (
          <span className="font-bold tracking-wide">Activity</span>
        ) : (
          <>
            <Activity className="w-5 h-5 mb-0.5" />
            <span>Activity</span>
          </>
        )}
      </button>

      {/* 2. History Tab */}
      <button
        id="nav-tab-history"
        onClick={() => onSelectTab('history')}
        className={`flex flex-col items-center justify-center transition-all ${
          activeTab === 'history'
            ? 'bg-[#0066ff] text-white px-5 py-1.5 rounded-full shadow-md font-bold text-xs'
            : 'text-[#5b6572] hover:text-[#0050cb] p-1.5 text-xs font-medium'
        }`}
      >
        <History className="w-5 h-5 mb-0.5" />
        <span>History</span>
      </button>

      {/* 3. Maps Tab */}
      <button
        id="nav-tab-maps"
        onClick={() => onSelectTab('maps')}
        className={`flex flex-col items-center justify-center transition-all ${
          activeTab === 'maps'
            ? 'bg-[#0066ff] text-white px-5 py-1.5 rounded-full shadow-md font-bold text-xs'
            : 'text-[#5b6572] hover:text-[#0050cb] p-1.5 text-xs font-medium'
        }`}
      >
        <Compass className="w-5 h-5 mb-0.5" />
        <span>Maps</span>
      </button>

      {/* 4. Profile Tab */}
      <button
        id="nav-tab-profile"
        onClick={() => onSelectTab('profile')}
        className={`flex flex-col items-center justify-center transition-all ${
          activeTab === 'profile'
            ? 'bg-[#0066ff] text-white px-5 py-1.5 rounded-full shadow-md font-bold text-xs'
            : 'text-[#5b6572] hover:text-[#0050cb] p-1.5 text-xs font-medium'
        }`}
      >
        <User className="w-5 h-5 mb-0.5" />
        <span>Profile</span>
      </button>
    </nav>
  );
};
