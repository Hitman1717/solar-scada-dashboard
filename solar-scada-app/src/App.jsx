// App.jsx - Main Application Orchestration (Aligned with Feature_workflow.md)

import React, { useState, useEffect } from 'react';
import { initializeDB, db } from './services/dbService';
import { runSimulationTick } from './services/simulationService';
import RoleSelector from './features/auth/components/RoleSelector';
import TopBanner from './components/layout/TopBanner';
import Sidebar from './components/layout/Sidebar';
import SuperAdminApp from './app/roles/superadmin/SuperAdminApp';
import AdminApp from './app/roles/admin/AdminApp';
import ManagementApp from './app/roles/management/ManagementApp';

// Initialize mock DB
initializeDB();

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('solar_scada_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [userPlants, setUserPlants] = useState([]);
  const [activePlant, setActivePlant] = useState(null);
  const [activePlantTelemetry, setActivePlantTelemetry] = useState(null);
  const [currentTab, setCurrentTab] = useState('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Set up plant listings and defaults on authentication
  useEffect(() => {
    if (currentUser) {
      const assigned = db.getPlantsForUser(currentUser.id, currentUser.role);
      setUserPlants(assigned);
      
      // Default active plant
      if (assigned.length > 0) {
        setActivePlant(assigned[0]);
      } else {
        setActivePlant(null);
      }

      // Default navigation tabs based on roles
      if (currentUser.role === 'SUPER_ADMIN') {
        setCurrentTab('dashboard');
      } else if (currentUser.role === 'ADMIN') {
        setCurrentTab('dashboard');
      } else {
        setCurrentTab('dashboard');
      }
    } else {
      setUserPlants([]);
      setActivePlant(null);
      setActivePlantTelemetry(null);
      setCurrentTab('');
    }
  }, [currentUser]);

  // Load telemetry for active plant and set up periodic scraper simulation loop
  useEffect(() => {
    if (!activePlant) {
      setActivePlantTelemetry(null);
      return;
    }

    // Load initial telemetry row
    const loadLatestTelemetry = () => {
      const telemetryList = db.getTelemetryForPlant(activePlant.id, 1);
      if (telemetryList.length > 0) {
        setActivePlantTelemetry(telemetryList[0]);
      } else {
        // Generate seed row if none exists
        const newRow = runSimulationTick(activePlant.id);
        setActivePlantTelemetry(newRow);
      }
    };

    loadLatestTelemetry();

    // Background loop: simulate telemetry scraping every 30 seconds
    const interval = setInterval(() => {
      const newRow = runSimulationTick(activePlant.id);
      setActivePlantTelemetry(newRow);
    }, 30000);

    return () => clearInterval(interval);
  }, [activePlant]);

  // Session Handlers
  const handleLoginSuccess = (user) => {
    localStorage.setItem('solar_scada_session', JSON.stringify(user));
    setCurrentUser(user);
  };

  const handleLogout = () => {
    localStorage.removeItem('solar_scada_session');
    if (currentUser) {
      db.logAudit(currentUser.id, 'User Logged Out', 'User', currentUser.id);
    }
    setCurrentUser(null);
  };

  // Render Login Portal if not authenticated
  if (!currentUser) {
    return <RoleSelector onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden font-sans">
      
      {/* Sidebar Navigation Drawer */}
      <Sidebar
        currentUser={currentUser}
        userPlants={userPlants}
        activePlant={activePlant}
        setActivePlant={setActivePlant}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
      />

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Top Header Banner & Telemetry Feed */}
        <TopBanner
          currentUser={currentUser}
          activePlant={activePlant}
          onLogout={handleLogout}
          toggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          activePlantTelemetry={activePlantTelemetry}
        />

        {/* Dashboard Frame Viewport */}
        <main className="flex-1 overflow-hidden flex flex-col bg-[#f1f5f9]">
          {currentUser.role === 'SUPER_ADMIN' && (
            <SuperAdminApp 
              currentUser={currentUser} 
              currentTab={currentTab} 
            />
          )}

          {currentUser.role === 'ADMIN' && (
            <AdminApp 
              currentUser={currentUser} 
              currentTab={currentTab} 
              activePlant={activePlant}
              setActivePlant={setActivePlant}
            />
          )}

          {currentUser.role === 'MANAGEMENT' && (
            <ManagementApp 
              currentUser={currentUser} 
              currentTab={currentTab} 
              activePlant={activePlant}
              setActivePlant={setActivePlant}
              activePlantTelemetry={activePlantTelemetry}
            />
          )}
        </main>

      </div>
    </div>
  );
}
