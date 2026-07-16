// TopBanner.jsx - Global Header Banner and Telemetry Feed

import React, { useState } from 'react';
import { Menu, LogOut, AlertTriangle } from 'lucide-react';
import { db } from '../../services/dbService';

export default function TopBanner({ 
  currentUser, 
  activePlant, 
  onLogout, 
  toggleMobileSidebar,
  activePlantTelemetry 
}) {
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Show telemetry feed only for ADMIN and MANAGEMENT roles
  const showTelemetryFeed = currentUser.role === 'ADMIN' || currentUser.role === 'MANAGEMENT';

  // Get active critical faults count for this plant
  const issues = db.getAll(db.TABLES.PLANT_ISSUES);
  const activeFaultsCount = issues.filter(
    issue => issue.plant_id === Number(activePlant?.id) && issue.status === 'Active' && issue.severity === 'Critical'
  ).length;

  // Real-time telemetry calculations
  const livePowerKW = activePlantTelemetry ? activePlantTelemetry.power : 0;
  const todayYieldKWh = activePlantTelemetry 
    ? activePlantTelemetry.daily_generation 
    : 0;

  const isPlantOnline = activePlantTelemetry ? activePlantTelemetry.status === 'Normal' || activePlantTelemetry.status === 'Online' : false;

  return (
    <>
      <header className="w-full flex flex-col z-20 shadow-sm border-b border-slate-200">
        {/* Primary Tier (Top Bar - Dark Blue) */}
        <div className="bg-[#1e3a8a] text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Mobile Menu Button */}
            <button 
              onClick={toggleMobileSidebar}
              className="lg:hidden p-1 rounded hover:bg-white/10 transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-base truncate text-slate-100">
                Hello {currentUser.name}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* User Role Label */}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs font-bold tracking-wider text-[#bfd4f2] uppercase">
                {currentUser.role === 'MANAGEMENT' ? 'Management' : currentUser.role.replace('_', ' ')}
              </span>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => setShowLogoutModal(true)}
              className="px-3 py-1.5 bg-white text-[#0f172a] hover:bg-[#f1f5f9] rounded-md font-medium text-xs flex items-center space-x-1.5 transition-colors border border-slate-300 shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* Secondary Tier (Telemetry Feed) */}
        {showTelemetryFeed && activePlant && (
          <div className="bg-[#172554] text-slate-200 border-t border-[#1e3a8a] px-4 py-2 text-xs flex items-center space-x-6 overflow-x-auto whitespace-nowrap">
            <div className="flex items-center space-x-2 font-medium">
              <span className="text-slate-400">Status:</span>
              <div className="flex items-center space-x-1">
                <span className={`w-2 h-2 rounded-full bg-[#16a34a] animate-scada-pulse`}></span>
                <span className="text-[#16a34a] font-semibold">
                  NOMINAL
                </span>
              </div>
            </div>

            <div className="h-4 w-px bg-slate-700"></div>

            <div className="flex items-center space-x-1.5">
              <span className="text-slate-400">PV Power:</span>
              <span className="font-mono font-bold text-white">{livePowerKW.toFixed(2)} kW</span>
            </div>

            <div className="h-4 w-px bg-slate-700"></div>

            <div className="flex items-center space-x-1.5">
              <span className="text-slate-400">Faults:</span>
              <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${activeFaultsCount > 0 ? 'bg-red-950 text-red-400 font-semibold' : 'text-slate-300'}`}>
                {activeFaultsCount} Active
              </span>
            </div>

            <div className="h-4 w-px bg-slate-700"></div>

            <div className="flex items-center space-x-1.5">
              <span className="text-slate-400">Today Yield:</span>
              <span className="font-mono font-bold text-[#d4af37]">{todayYieldKWh.toFixed(2)} kWh</span>
            </div>
          </div>
        )}
      </header>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-red-50 text-[#dc2626] rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">Confirm Logout</h3>
                <p className="text-xs text-slate-500">
                  Are you sure you want to end your current SCADA monitoring session? Unsaved operational changes may not be synced.
                </p>
              </div>
            </div>
            
            <div className="mt-5 flex items-center justify-end space-x-2.5">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-3.5 py-1.5 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowLogoutModal(false);
                  onLogout();
                }}
                className="px-3.5 py-1.5 bg-[#dc2626] hover:bg-[#b91c1c] active:bg-[#991b1b] text-white rounded-md text-xs font-semibold shadow transition-colors"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
