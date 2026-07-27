// Sidebar.jsx - Navigation and Info Side panel (ACTIVE STATION selector removed)

import React, { useEffect, useState } from 'react';
import { 
  X, Activity, Clock, LayoutDashboard, AlertCircle, FileSpreadsheet, 
  Users, Server, Building2, UserCircle, Shield, ListTodo, Sliders
} from 'lucide-react';
import { db } from '../../services/dbService';

export default function Sidebar({
  currentUser,
  userPlants,
  activePlant,
  setActivePlant,
  currentTab,
  setCurrentTab,
  mobileOpen,
  setMobileOpen
}) {
  const [timeStr, setTimeStr] = useState('');

  // Indian Standard Time (IST) Clock
  useEffect(() => {
    const updateTime = () => {
      try {
        const options = {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        };
        const formatter = new Intl.DateTimeFormat('en-US', options);
        setTimeStr(formatter.format(new Date()) + ' IST');
      } catch (err) {
        setTimeStr(new Date().toLocaleTimeString() + ' Local');
      }
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTabClick = (tab) => {
    setCurrentTab(tab);
    setMobileOpen(false);
  };

  // Determine navigation items based on User Role (aligned with Feature_workflow.md)
  const getNavItems = () => {
    switch (currentUser.role) {
      case 'SUPER_ADMIN':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'companies', label: 'Companies', icon: Building2 },
          { id: 'onboard', label: 'Onboard Company', icon: Shield },
          { id: 'variables', label: 'Company Variables', icon: Sliders },
          { id: 'profile', label: 'Profile', icon: UserCircle }
        ];
      case 'ADMIN':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'plants', label: 'Plants', icon: Server },
          { id: 'staff', label: 'Manage Accounts', icon: Users },
          { id: 'profile', label: 'Profile', icon: UserCircle }
        ];
      case 'MANAGEMENT':
        return [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'plants', label: 'Plants', icon: Server },
          { id: 'profile', label: 'Profile', icon: UserCircle }
        ];
      default:
        return [];
    }
  };

  const navItems = getNavItems();

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-350 border-r border-slate-800 font-sans">
      {/* Sidebar Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-[#d4af37]" />
          <span className="font-semibold text-white text-sm tracking-wide">MSL solar dashboard</span>
        </div>
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Info & Status Container */}
      <div className="p-4 space-y-3.5 border-b border-slate-800 bg-slate-950/40">
        {/* Connectivity and Clock Indicators */}
        <div className="flex flex-col space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Link Status:</span>
            <div className="flex items-center space-x-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#16a34a] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#16a34a]"></span>
              </span>
              <span className="text-white font-semibold text-[10px] tracking-wider uppercase">ONLINE</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-0.5">
            <span className="text-slate-500 font-medium">System Time:</span>
            <div className="flex items-center space-x-1.5 text-white font-mono text-[10.5px]">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{timeStr}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                isActive 
                  ? 'bg-[#1e3a8a] text-white shadow-md font-bold' 
                  : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </div>
            </button>
          );
        })}
      </nav>
      
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (Left) */}
      <aside className="hidden lg:block w-56 h-full flex-shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          {/* Backdrop Overlay */}
          <div 
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
          ></div>

          {/* Drawer Sliding Body */}
          <div className="relative flex-1 flex flex-col max-w-[240px] w-full bg-slate-900 animate-in slide-in-from-left duration-250">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
