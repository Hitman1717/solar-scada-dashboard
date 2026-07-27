// AdminApp.jsx - Administrator Dashboard (Aligned with Excel seed data, Dashboard Plants Table and Clickable Names)

import React, { useState, useEffect } from 'react';
import { db } from '../../../services/dbService';
import { runSimulationTick } from '../../../services/simulationService';
import {
  Server, Shield, Sliders, User, Plus, Trash2, Edit3, CheckCircle,
  Search, RefreshCw, KeyRound, Globe, ToggleLeft, ToggleRight, ArrowLeft, Download, Eye, EyeOff
} from 'lucide-react';
import DashboardOverview from '../../../components/dashboard/DashboardOverview';
import CompanyVariablesView from '../../../components/dashboard/CompanyVariablesView';

export default function AdminApp({ currentUser, currentTab, activePlant, setActivePlant, activePlantTelemetry }) {
  // DB States
  const [plants, setPlants] = useState(() => db.getAll(db.TABLES.PLANTS).filter(p => Number(p.company_id) === Number(currentUser?.company_id)));
  const [users, setUsers] = useState(() => db.getAll(db.TABLES.USERS).filter(u => Number(u.company_id) === Number(currentUser?.company_id)));
  const [accounts, setAccounts] = useState(() => db.getAll(db.TABLES.WEBSITE_ACCOUNTS));
  const [providers, setProviders] = useState(() => db.getAll(db.TABLES.WEBSITE_PROVIDERS));
  const [issues, setIssues] = useState(() => db.getAll(db.TABLES.PLANT_ISSUES));
  const [tablesList, setTablesList] = useState(() => db.getAll(db.TABLES.PLANT_TABLES));

  // Sync state with database whenever telemetry tick or backend synchronizes
  useEffect(() => {
    setPlants(db.getAll(db.TABLES.PLANTS).filter(p => Number(p.company_id) === Number(currentUser?.company_id)));
    setUsers(db.getAll(db.TABLES.USERS).filter(u => Number(u.company_id) === Number(currentUser?.company_id)));
    setAccounts(db.getAll(db.TABLES.WEBSITE_ACCOUNTS));
    setProviders(db.getAll(db.TABLES.WEBSITE_PROVIDERS));
    setIssues(db.getAll(db.TABLES.PLANT_ISSUES));
    setTablesList(db.getAll(db.TABLES.PLANT_TABLES));
  }, [activePlantTelemetry, currentUser]);

  // Navigation Sub-states
  const [selectedPlantId, setSelectedPlantId] = useState(null); // null means list view, plantId means detail view

  // Tab states for Plant Details page
  const [detailActiveTab, setDetailActiveTab] = useState('telemetry'); // telemetry | history | alerts | scraper | hardware

  // Forms & Modal toggles
  const [staffSubTab, setStaffSubTab] = useState('list'); // list | add
  const [isEditingPlant, setIsEditingPlant] = useState(false);
  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [isAddingPlant, setIsAddingPlant] = useState(false);

  // Search & Filter
  const [plantSearch, setPlantSearch] = useState('');
  const [plantStatusFilter, setPlantStatusFilter] = useState('All');
  const [plantSortBy, setPlantSortBy] = useState('name'); // name | capacity
  const [plantPage, setPlantPage] = useState(1);
  const itemsPerPage = 5;

  const [staffSearch, setStaffSearch] = useState('');

  // Form Fields - Manage Accounts
  const [staffName, setStaffName] = useState('');
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffRole, setStaffRole] = useState('MANAGEMENT');
  const [staffPlantAccess, setStaffPlantAccess] = useState([]);

  // Form Fields - Add Plant
  const [newPlantName, setNewPlantName] = useState('');
  const [newPlantCapacity, setNewPlantCapacity] = useState('');
  const [newPlantLoc, setNewPlantLoc] = useState('');
  const [newPlantProvider, setNewPlantProvider] = useState('other');
  const [newPlantUser, setNewPlantUser] = useState('');
  const [newPlantPass, setNewPlantPass] = useState('');
  const [newPlantInterval, setNewPlantInterval] = useState(5);
  const [customProviderName, setCustomProviderName] = useState('');

  // Set default provider dynamically from database when onboarding page is opened
  useEffect(() => {
    if (isAddingPlant) {
      const list = db.getAll(db.TABLES.WEBSITE_PROVIDERS);
      if (list.length > 0) {
        setNewPlantProvider(list[0].id);
      } else {
        setNewPlantProvider('other');
      }
      setCustomProviderName('');
    }
  }, [isAddingPlant]);

  // Form Fields - Edit Plant
  const [editPlantName, setEditPlantName] = useState('');
  const [editPlantCapacity, setEditPlantCapacity] = useState('');
  const [editPlantLoc, setEditPlantLoc] = useState('');

  // Form Fields - Edit Scraper Account Credentials
  const [editScUsername, setEditScUsername] = useState('');
  const [editScPassword, setEditScPassword] = useState('');
  const [editScInterval, setEditScInterval] = useState(5);

  // Form Fields - Add Hardware String Table
  const [tabNum, setTabNum] = useState('');
  const [tabPanels, setTabPanels] = useState(16);
  const [tabPanelModel, setTabPanelModel] = useState('MSL-350W');
  const [tabInverterModel, setTabInverterModel] = useState('Growatt 3000TL');
  const [tabGateway, setTabGateway] = useState('GW-01');
  const [tabMAC, setTabMAC] = useState('');
  const [tabPower, setTabPower] = useState(5200);
  const [tabDegrade, setTabDegrade] = useState(2);
  const [tabAge, setTabAge] = useState(1);

  // Form Fields - Change Password
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');

  const [isScraping, setIsScraping] = useState(false);

  // Scraper Manual Tick trigger
  const triggerRefreshData = async (plantId) => {
    setIsScraping(true);
    try {
      const result = await db.triggerScrape(plantId);
      if (result.success) {
        // Re-fetch all state from DB cache after scrape completes
        const freshPlants = db.getAll(db.TABLES.PLANTS).filter(p => Number(p.company_id) === Number(currentUser?.company_id));
        setIssues(db.getAll(db.TABLES.PLANT_ISSUES));
        setTablesList(db.getAll(db.TABLES.PLANT_TABLES));
        setAccounts(db.getAll(db.TABLES.WEBSITE_ACCOUNTS));
        setPlants(freshPlants);

        const updatedPlantObj = freshPlants.find(p => Number(p.id) === Number(plantId));
        if (updatedPlantObj && activePlant && Number(activePlant.id) === Number(plantId)) {
          setActivePlant({ ...updatedPlantObj });
        }
        // Use setTimeout so React can re-render before blocking with alert
        setTimeout(() => alert(result.message || 'Scraper execution and synchronization completed.'), 100);
      } else {
        alert(`Scraper error: ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to execute backend scraper: ' + err.message);
    } finally {
      setIsScraping(false);
    }
  };

  // User/Staff Registry Actions
  const handleAddStaff = (e) => {
    e.preventDefault();
    if (!staffName || !staffEmail || !staffPassword) {
      alert('Required parameters missing.');
      return;
    }

    const newStaff = db.insert(db.TABLES.USERS, {
      company_id: currentUser.company_id,
      name: staffName,
      email: staffEmail,
      password: staffPassword,
      role: staffRole,
      is_active: true
    });

    staffPlantAccess.forEach(pId => {
      db.assignPlantToUser(newStaff.id, pId);
    });

    db.logAudit(currentUser.id, `Registered staff account ${staffName} (${staffRole})`, 'User', newStaff.id);

    setUsers(db.getAll(db.TABLES.USERS).filter(u => Number(u.company_id) === Number(currentUser?.company_id)));
    setStaffName('');
    setStaffEmail('');
    setStaffPassword('');
    setStaffPlantAccess([]);
    setStaffSubTab('list');
  };

  const handleToggleStaffStatus = (userId) => {
    const userObj = users.find(u => u.id === userId);
    if (!userObj) return;
    const newStatus = !userObj.is_active;
    db.update(db.TABLES.USERS, userId, { is_active: newStatus });
    setUsers(db.getAll(db.TABLES.USERS).filter(u => Number(u.company_id) === Number(currentUser?.company_id)));
    db.logAudit(currentUser.id, `Toggled user status of ${userObj.name} to ${newStatus}`, 'User', userId);
  };

  const handleDeleteStaff = (userId) => {
    if (confirm('Delete this user?')) {
      db.delete(db.TABLES.USERS, userId);
      setUsers(db.getAll(db.TABLES.USERS).filter(u => Number(u.company_id) === Number(currentUser?.company_id)));
      db.logAudit(currentUser.id, `Deleted staff account ID: ${userId}`, 'User', userId);
    }
  };

  // Plant Actions
  const handleAddPlant = async (e) => {
    e.preventDefault();
    setIsScraping(true);

    let providerId = newPlantProvider;
    if (newPlantProvider === 'other') {
      if (!customProviderName) {
        alert('Please specify the website provider name.');
        setIsScraping(false);
        return;
      }
      const insertedProv = db.insert(db.TABLES.WEBSITE_PROVIDERS, {
        provider_name: customProviderName,
        login_url: 'https://custom-solar-portal.com',
        description: 'Custom added scraper portal'
      });
      providerId = insertedProv.id;
      setProviders(db.getAll(db.TABLES.WEBSITE_PROVIDERS));
    }

    try {
      console.log('Sending onboarding credentials to backend...');
      const result = await db.onboardScraperAccount(
        providerId,
        newPlantUser || 'scada_user',
        newPlantPass || 'password',
        newPlantInterval
      );

      if (result.success) {
        alert(result.message || 'Scraper credentials onboarded and plants discovered successfully!');
        
        // Refresh local cache states from newly reloaded cache
        setPlants(db.getAll(db.TABLES.PLANTS).filter(p => Number(p.company_id) === Number(currentUser?.company_id)));
        setAccounts(db.getAll(db.TABLES.WEBSITE_ACCOUNTS));
        setProviders(db.getAll(db.TABLES.WEBSITE_PROVIDERS));
        setIssues(db.getAll(db.TABLES.PLANT_ISSUES));

        // Reset fields
        setNewPlantUser('');
        setNewPlantPass('');
        setNewPlantInterval(5);
        setCustomProviderName('');
        
        // Close add plant view
        setIsAddingPlant(false);
      } else {
        alert(`Error: ${result.error || 'Failed to onboard scraper account.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to connect to backend onboarding service.');
    } finally {
      setIsScraping(false);
    }
  };

  const handleEditPlant = (e) => {
    e.preventDefault();
    if (!selectedPlantId) return;

    db.update(db.TABLES.PLANTS, selectedPlantId, {
      plant_name: editPlantName,
      plant_capacity: editPlantCapacity,
      location: editPlantLoc
    });

    db.logAudit(currentUser.id, `Updated parameters for station ${editPlantName}`, 'Plant', selectedPlantId);

    setPlants(db.getAll(db.TABLES.PLANTS).filter(p => Number(p.company_id) === Number(currentUser?.company_id)));
    setIsEditingPlant(false);
  };

  const handleDeletePlant = (plantId) => {
    if (confirm('Warning: Deleting plant wipes linked tables and credentials. Confirm?')) {
      db.delete(db.TABLES.PLANTS, plantId);

      const plantAcc = accounts.find(a => a.plant_id === plantId);
      if (plantAcc) db.delete(db.TABLES.WEBSITE_ACCOUNTS, plantAcc.id);

      tablesList.filter(t => t.plant_id === plantId).forEach(t => db.delete(db.TABLES.PLANT_TABLES, t.id));

      setPlants(db.getAll(db.TABLES.PLANTS).filter(p => Number(p.company_id) === Number(currentUser?.company_id)));
      setAccounts(db.getAll(db.TABLES.WEBSITE_ACCOUNTS));
      setTablesList(db.getAll(db.TABLES.PLANT_TABLES));
      setSelectedPlantId(null);
      db.logAudit(currentUser.id, `Deleted station ID: ${plantId}`, 'Plant', plantId);
    }
  };

  // Scraper edits
  const handleEditAccount = (e) => {
    e.preventDefault();
    const acc = accounts.find(a => a.plant_id === selectedPlantId);
    if (!acc) return;

    db.update(db.TABLES.WEBSITE_ACCOUNTS, acc.id, {
      username: editScUsername,
      password: editScPassword,
      scrape_interval_minutes: Number(editScInterval)
    });

    db.logAudit(currentUser.id, `Updated scraper credentials for Station ID: ${selectedPlantId}`, 'WebsiteAccount', acc.id);
    setAccounts(db.getAll(db.TABLES.WEBSITE_ACCOUNTS));
    setIsEditingAccount(false);
  };

  const handleToggleScraping = (accountId) => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return;
    const newStatus = !acc.enabled;
    db.update(db.TABLES.WEBSITE_ACCOUNTS, accountId, { enabled: newStatus });
    setAccounts(db.getAll(db.TABLES.WEBSITE_ACCOUNTS));
    db.logAudit(currentUser.id, `Toggled scraping Account ID: ${accountId} status to ${newStatus}`, 'WebsiteAccount', accountId);
  };

  // Table hardware configurations
  const handleAddTable = (e) => {
    e.preventDefault();
    if (!tabNum) return;

    const insertedTable = db.insert(db.TABLES.PLANT_TABLES, {
      plant_id: selectedPlantId,
      table_number: tabNum,
      panels_count: Number(tabPanels),
      panel_model: tabPanelModel,
      inverter_model: tabInverterModel,
      gateway_id: tabGateway,
      mac_address: tabMAC || '00:00:00:00:00:00',
      degrade_pct: Number(tabDegrade),
      age_years: Number(tabAge),
      power_w: Number(tabPower)
    });

    db.logAudit(currentUser.id, `Provisioned table ${tabNum} on plant ID: ${selectedPlantId}`, 'PlantTable', insertedTable.id);

    setTablesList(db.getAll(db.TABLES.PLANT_TABLES));
    setTabNum('');
    setTabMAC('');
  };

  const handleRemoveTable = (tableId) => {
    if (confirm('Confirm removal of table hardware?')) {
      db.delete(db.TABLES.PLANT_TABLES, tableId);
      setTablesList(db.getAll(db.TABLES.PLANT_TABLES));
      db.logAudit(currentUser.id, `Removed table ID: ${tableId}`, 'PlantTable', tableId);
    }
  };

  // Change Profile Password
  const handleChangePassword = (e) => {
    e.preventDefault();
    if (currentUser.password !== currPass) {
      alert('Incorrect current password.');
      return;
    }
    if (newPass.length < 4) {
      alert('Password must be 4 or more characters.');
      return;
    }
    db.update(db.TABLES.USERS, currentUser.id, { password: newPass });
    db.logAudit(currentUser.id, 'Changed profile password', 'User', currentUser.id);
    alert('Password updated successfully.');
    setCurrPass('');
    setNewPass('');
  };

  // Filters & Page math for Plants Registry
  const filteredPlants = plants.filter(plant => {
    const matchesSearch = plant.plant_name.toLowerCase().includes(plantSearch.toLowerCase()) ||
      plant.location.toLowerCase().includes(plantSearch.toLowerCase());

    let matchesStatus = true;
    if (plantStatusFilter === 'WithIssues') {
      const activeIssuesForPlant = issues.filter(i => Number(i.plant_id) === Number(plant.id) && i.status === 'Active');
      matchesStatus = activeIssuesForPlant.length > 0;
    } else if (plantStatusFilter !== 'All') {
      matchesStatus = plant.status === plantStatusFilter;
    }
    return matchesSearch && matchesStatus;
  });

  const sortedPlants = [...filteredPlants].sort((a, b) => {
    if (plantSortBy === 'name') {
      return a.plant_name.localeCompare(b.plant_name);
    } else if (plantSortBy === 'capacity') {
      const capA = parseFloat(a.plant_capacity);
      const capB = parseFloat(b.plant_capacity);
      return capB - capA;
    }
    return 0;
  });

  const totalPages = Math.ceil(sortedPlants.length / itemsPerPage);
  const paginatedPlants = sortedPlants;

  // Selected Plant Telemetry & details calculations
  const detailPlant = plants.find(p => Number(p.id) === Number(selectedPlantId));
  const detailAccount = accounts.find(a => Number(a.plant_id) === Number(selectedPlantId));
  const detailProvider = providers.find(p => Number(p.id) === Number(detailAccount?.provider_id));
  const detailTables = tablesList.filter(t => Number(t.plant_id) === Number(selectedPlantId));

  // Load latest telemetry entry
  const detailTelemetry = selectedPlantId ? db.getTelemetryForPlant(selectedPlantId, 1)[0] : null;
  const detailHistory = selectedPlantId ? db.getTelemetryForPlant(selectedPlantId, 20) : [];
  const detailIssues = issues.filter(i => i.plant_id === selectedPlantId);

  // Export CSV helper
  const handleExportCSV = () => {
    if (!detailHistory.length) return;
    let csv = "Timestamp,PV Power (kW),Voltage (V),Current (A),Battery Voltage (V),Daily Consumed (kWh)\n";
    detailHistory.forEach(row => {
      csv += `${row.timestamp},${row.pv_power || row.power},${row.voltage},${row.current},${row.battery_voltage || 0},${row.daily_consumed || 0}\n`;
    });
    const encoded = encodeURI("data:text/csv;charset=utf-8," + csv);
    const link = document.createElement("a");
    link.setAttribute("href", encoded);
    link.setAttribute("download", `SCADA_Telemetry_Export_${detailPlant?.plant_name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6">

      {/* 1. OVERVIEW DASHBOARD */}
      {currentTab === 'dashboard' && !selectedPlantId && (
        <div className="space-y-6">
          <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Operational Summary</h2>
          </div>

          <DashboardOverview plants={plants} issues={issues} />

          {/* Integrated Plants Registry Table directly on the Dashboard */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2">Active Solar Inverters Station Grid</h3>
            <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                    <th className="p-3">Plant Name</th>
                    <th className="p-3 font-mono">Plant Capacity</th>
                    <th className="p-3">Location</th>
                    <th className="p-3">Website Provider</th>
                    <th className="p-3 font-mono">Current PV Power</th>
                    <th className="p-3 font-mono">Daily Gen</th>
                    <th className="p-3">Plant Status</th>
                    <th className="p-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {plants.map(plant => {
                    const acc = accounts.find(a => a.plant_id === plant.id);
                    const prov = providers.find(p => p.id === acc?.provider_id);
                    const tele = db.getTelemetryForPlant(plant.id, 1)[0];
                    const powerVal = tele ? parseFloat(tele.pv_power || tele.power || 0) : 0;
                    const yieldVal = tele ? parseFloat(tele.daily_generation || 0) : 0;

                    return (
                      <tr key={plant.id} className="hover:bg-slate-50">
                        <td className="p-3">
                          <button
                            onClick={() => {
                              setSelectedPlantId(plant.id);
                              setDetailActiveTab('telemetry');
                              setActivePlant(plant);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-bold hover:underline text-left focus:outline-none"
                          >
                            {plant.plant_name}
                          </button>
                        </td>
                        <td className="p-3 font-mono font-semibold text-slate-700">{plant.plant_capacity}</td>
                        <td className="p-3 text-slate-500">{plant.location}</td>
                        <td className="p-3 font-semibold text-slate-655">{prov ? prov.provider_name : 'Solar API'}</td>
                        <td className="p-3 font-mono text-[#1e3a8a]">{powerVal.toFixed(2)} kW</td>
                        <td className="p-3 font-mono text-[#d4af37] font-semibold">{yieldVal.toFixed(2)} kWh</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap border ${
                            plant.status === 'Normal' || plant.status === 'Online' || plant.status === 'Active' ? 'bg-green-50 border-green-200 text-green-700' :
                            plant.status === 'Offline' || plant.status === 'Inactive' ? 'bg-red-50 border-red-200 text-red-700' :
                            plant.status === 'Under Maintenance' || plant.status === 'Maintenance' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                            'bg-slate-100 border-slate-300 text-slate-600' // Decommissioned/Fallback gray
                          }`}>
                            {plant.status}
                          </span>
                        </td>
                        <td className="p-3 text-center space-x-2.5">
                          <button
                            onClick={() => {
                              setSelectedPlantId(plant.id);
                              setDetailActiveTab('telemetry');
                              setActivePlant(plant);
                            }}
                            className="text-[#1e3a8a] hover:text-[#172554] font-bold text-[11px]"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. PLANTS VIEW */}
      {currentTab === 'plants' && !selectedPlantId && (
        <div className="space-y-6">

          {/* PLANT REGISTRY LIST VIEW */}
          {!isAddingPlant && (
            <div className="space-y-4">
              <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Plants Registry</h2>
                <button
                  onClick={() => setIsAddingPlant(true)}
                  className="px-3 py-1.5 bg-[#1e3a8a] text-white hover:bg-[#172554] text-xs font-bold rounded shadow flex items-center space-x-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Solar Station</span>
                </button>
              </div>

              {/* Filtering / Search */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                <div className="flex items-center space-x-2 bg-white border border-slate-250 px-3 py-1.5 rounded-lg max-w-xs w-full shadow-sm">
                  <Search className="w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={plantSearch}
                    onChange={(e) => setPlantSearch(e.target.value)}
                    placeholder="Search plant by name or location..."
                    className="bg-transparent border-none text-xs w-full focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-400 font-semibold">Status:</span>
                    <select
                      value={plantStatusFilter}
                      onChange={(e) => setPlantStatusFilter(e.target.value)}
                      className="bg-white border border-slate-250 rounded px-2 py-1 focus:outline-none"
                    >
                      <option value="All">All Plants</option>
                      <option value="WithIssues">Has Active Issues</option>
                      <option value="Normal">Normal Only</option>
                      <option value="Offline">Offline Only</option>
                    </select>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-400 font-semibold">Sort By:</span>
                    <select
                      value={plantSortBy}
                      onChange={(e) => setPlantSortBy(e.target.value)}
                      className="bg-white border border-slate-250 rounded px-2 py-1 focus:outline-none font-sans"
                    >
                      <option value="name">Plant Name</option>
                      <option value="capacity">Power Capacity</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Table Data */}
              <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="p-3">Plant Name</th>
                      <th className="p-3 font-mono">Plant Capacity</th>
                      <th className="p-3">Location</th>
                      <th className="p-3">Website Provider</th>
                      <th className="p-3 font-mono">Current PV Power</th>
                      <th className="p-3 font-mono">Daily Gen</th>
                      <th className="p-3">Plant Status</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedPlants.map(plant => {
                      const acc = accounts.find(a => a.plant_id === plant.id);
                      const prov = providers.find(p => p.id === acc?.provider_id);

                      // Calculate telemetry metrics
                      const tele = db.getTelemetryForPlant(plant.id, 1)[0];
                      const powerVal = tele ? parseFloat(tele.pv_power || tele.power || 0) : 0;
                      const yieldVal = tele ? parseFloat(tele.daily_generation || 0) : 0;

                      return (
                        <tr key={plant.id} className="hover:bg-slate-50">
                          <td className="p-3">
                            <button
                              onClick={() => {
                                setSelectedPlantId(plant.id);
                                setDetailActiveTab('telemetry');
                                setActivePlant(plant);
                              }}
                              className="text-blue-600 hover:text-blue-800 font-bold hover:underline text-left focus:outline-none"
                            >
                              {plant.plant_name}
                            </button>
                          </td>
                          <td className="p-3 font-mono font-semibold text-slate-700">{plant.plant_capacity}</td>
                          <td className="p-3 text-slate-500">{plant.location}</td>
                          <td className="p-3 font-semibold text-slate-650">{prov ? prov.provider_name : 'Solar API'}</td>
                          <td className="p-3 font-mono text-[#1e3a8a]">{powerVal.toFixed(2)} kW</td>
                          <td className="p-3 font-mono text-[#d4af37] font-semibold">{yieldVal.toFixed(2)} kWh</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap border ${
                              plant.status === 'Normal' || plant.status === 'Online' || plant.status === 'Active' ? 'bg-green-50 border-green-200 text-green-700' :
                              plant.status === 'Offline' || plant.status === 'Inactive' ? 'bg-red-50 border-red-200 text-red-700' :
                              plant.status === 'Under Maintenance' || plant.status === 'Maintenance' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                              'bg-slate-100 border-slate-300 text-slate-600' // Decommissioned/Fallback gray
                            }`}>
                              {plant.status}
                            </span>
                          </td>
                          <td className="p-3 text-center space-x-2.5">
                            <button
                              onClick={() => {
                                setSelectedPlantId(plant.id);
                                setDetailActiveTab('telemetry');
                                setActivePlant(plant);
                              }}
                              className="text-[#1e3a8a] hover:text-[#172554] font-bold text-[11px]"
                            >
                              View
                            </button>
                            <button
                              onClick={() => {
                                setEditPlantName(plant.plant_name);
                                setEditPlantCapacity(plant.plant_capacity);
                                setEditPlantLoc(plant.location);
                                setSelectedPlantId(plant.id);
                                setIsEditingPlant(true);
                              }}
                              className="text-slate-600 hover:text-slate-900 font-bold text-[11px]"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeletePlant(plant.id)}
                              className="text-red-655 hover:text-red-800 font-bold text-[11px]"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination controls */}
              {false && totalPages > 1 && (
                <div className="flex justify-end items-center space-x-2 text-xs">
                  <button
                    disabled={plantPage === 1}
                    onClick={() => setPlantPage(plantPage - 1)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="font-semibold text-slate-700">Page {plantPage} of {totalPages}</span>
                  <button
                    disabled={plantPage === totalPages}
                    onClick={() => setPlantPage(plantPage + 1)}
                    className="px-2.5 py-1.5 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ADD SOLAR STATION PAGE */}
          {isAddingPlant && (
            <div className="max-w-2xl bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
              <form onSubmit={handleAddPlant} className="space-y-6 text-xs">
                <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                  <h3 className="text-base font-bold text-slate-855">Onboard Solar Station</h3>
                </div>

                {/* Info Alert explaining Auto-Discovery */}
                <div className="p-4 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg flex items-start space-x-3">
                  <Globe className="w-5 h-5 flex-shrink-0 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-xs">Automated SCADA Plant Discovery</h4>
                    <p className="text-[11px] text-blue-700 font-medium mt-0.5">
                      You do not need to manually configure plant names, locations, capacities, or coordinates.
                      By selects your Website Provider and entering your credentials below, our scraper system will
                      automatically discover and onboard all solar stations associated with your account.
                    </p>
                  </div>
                </div>

                {/* Scraper Credentials */}
                <div className="space-y-4 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Website Scraper Account Configuration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-slate-655 font-semibold">Website Provider</label>
                      <select
                        value={newPlantProvider}
                        onChange={(e) => setNewPlantProvider(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-250 bg-white rounded focus:outline-none"
                      >
                        {providers.map(p => (
                          <option key={p.id} value={p.id}>{p.provider_name}</option>
                        ))}
                        <option value="other">Other</option>
                      </select>
                    </div>

                    {newPlantProvider === 'other' && (
                      <div className="space-y-1">
                        <label className="block text-slate-655 font-semibold">Other Provider Name *</label>
                        <input
                          type="text"
                          required
                          value={customProviderName}
                          onChange={(e) => setCustomProviderName(e.target.value)}
                          placeholder="e.g. Sungrow, Growatt"
                          className="w-full px-3 py-2 border border-slate-250 rounded focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none"
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="block text-slate-650 font-semibold">Scrape Interval (Minutes)</label>
                      <select
                        value={newPlantInterval}
                        onChange={(e) => setNewPlantInterval(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-250 bg-white rounded focus:outline-none"
                      >
                        <option value="5">Every 5 minutes</option>
                        <option value="10">Every 10 minutes</option>
                        <option value="15">Every 15 minutes</option>
                        <option value="30">Every 30 minutes</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-slate-650 font-semibold">Credential Username / Account Login ID</label>
                      <input
                        type="text"
                        value={newPlantUser}
                        onChange={(e) => setNewPlantUser(e.target.value)}
                        placeholder="omkar.oak"
                        className="w-full px-3 py-2 border border-slate-250 rounded focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-slate-650 font-semibold">Credential Password</label>
                      <input
                        type="password"
                        value={newPlantPass}
                        onChange={(e) => setNewPlantPass(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-3 py-2 border border-slate-250 rounded focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsAddingPlant(false)}
                    className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isScraping}
                    className="px-4 py-2 bg-[#1e3a8a] text-white rounded font-bold shadow-md hover:bg-[#172554] disabled:opacity-50 flex items-center space-x-2"
                  >
                    {isScraping && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isScraping ? 'Onboarding & Scraping...' : 'Save Plant'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

          {/* EDIT PLANT PARAMETERS MODAL */}
          {isEditingPlant && detailPlant && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
              <div className="bg-white border border-slate-200 rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150 text-xs">
                <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">Edit Plant Information</h3>
                <form onSubmit={handleEditPlant} className="space-y-3.5 mt-3">
                  <div className="space-y-1">
                    <label className="block text-slate-655 font-semibold">Plant Name</label>
                    <input
                      type="text"
                      required
                      value={editPlantName}
                      onChange={(e) => setEditPlantName(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-250 rounded focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-655 font-semibold">Plant Capacity</label>
                    <input
                      type="text"
                      required
                      value={editPlantCapacity}
                      onChange={(e) => setEditPlantCapacity(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-250 rounded focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-655 font-semibold">Location</label>
                    <input
                      type="text"
                      value={editPlantLoc}
                      onChange={(e) => setEditPlantLoc(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-250 rounded focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingPlant(false);
                        setSelectedPlantId(null);
                      }}
                      className="px-3.5 py-1.5 border border-slate-355 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 bg-[#1e3a8a] text-white rounded font-bold shadow hover:bg-[#172554]"
                    >
                      Save Changes
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

      {/* PLANT DETAILED PAGE */}
      {selectedPlantId && !isEditingPlant && (
        <div className="space-y-6">
          {!detailPlant ? (
            <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
              <span>Loading plant data...</span>
            </div>
          ) : (
            <>

              {/* Detailed Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <button
                  onClick={() => setSelectedPlantId(null)}
                  className="text-xs text-slate-500 hover:text-slate-900 font-bold flex items-center space-x-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Registry</span>
                </button>
                <div className="flex items-center space-x-2 text-xs">
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs whitespace-nowrap border ${
                    detailPlant?.status === 'Normal' || detailPlant?.status === 'Online' || detailPlant?.status === 'Active' ? 'bg-green-50 border-green-200 text-green-700' :
                    detailPlant?.status === 'Offline' || detailPlant?.status === 'Inactive' ? 'bg-red-50 border-red-200 text-red-700' :
                    detailPlant?.status === 'Under Maintenance' || detailPlant?.status === 'Maintenance' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                    'bg-slate-100 border-slate-300 text-slate-600' // Decommissioned/Fallback gray
                  }`}>
                    {detailPlant?.status}
                  </span>
                  <button
                    onClick={() => triggerRefreshData(detailPlant?.id)}
                    disabled={isScraping}
                    className="px-2.5 py-1 bg-[#f0f7ff] text-[#1e3a8a] border border-[#bfd4f2] hover:bg-blue-100 font-bold rounded flex items-center space-x-1 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isScraping ? 'animate-spin' : ''}`} />
                    <span>{isScraping ? 'Scraping...' : 'Refresh Telemetry'}</span>
                  </button>
                </div>
              </div>

              {/* Plant info and capacity */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Operational Capacity</span>
                  <div className="text-xl font-bold font-mono text-slate-800">{detailPlant?.plant_capacity}</div>
                </div>
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Website Provider</span>
                  <div className="text-xl font-bold text-slate-700">{detailProvider ? detailProvider.provider_name : 'Oaksun Solar'}</div>
                </div>
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Commission Date</span>
                  <div className="text-xl font-bold font-mono text-slate-750">{detailPlant?.commission_date}</div>
                </div>
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Gateway Controller ID</span>
                  <div className="text-xl font-bold font-mono text-slate-755">
                    {detailTables[0] ? detailTables[0].gateway_id : 'GW-01'}
                  </div>
                </div>
              </div>

              {/* Sub-Tabs for Details */}
              <div className="flex border-b border-slate-200 text-xs">
                {[
                  { id: 'telemetry', label: 'Live Telemetry' },
                  { id: 'history', label: 'Historical Data' },
                  { id: 'alerts', label: 'Alerts / Issues' },
                  { id: 'scraper', label: 'Scraping configuration' },
                  { id: 'hardware', label: 'Hardware Strings' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setDetailActiveTab(tab.id)}
                    className={`px-4 py-2 font-bold border-b-2 transition-all ${detailActiveTab === tab.id ? 'border-[#1e3a8a] text-[#1e3a8a] font-black' : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* SUBTAB CONTENTS */}

              {/* A. Live Telemetry */}
              {detailActiveTab === 'telemetry' && (
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
                  <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2">Latest SCADA Telemetry</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-medium">
                    <p className="flex flex-col p-3 bg-slate-50 border border-slate-200 rounded"><span className="text-slate-400">PV Power (Current):</span> <strong className="font-mono text-base text-[#1e3a8a]">{parseFloat(detailTelemetry ? (detailTelemetry.pv_power || detailTelemetry.power) : 0.00).toFixed(2)} kW</strong></p>
                    <p className="flex flex-col p-3 bg-slate-50 border border-slate-200 rounded"><span className="text-slate-400">Voltage:</span> <strong className="font-mono text-base text-slate-800">{detailTelemetry ? detailTelemetry.voltage : '0'} V</strong></p>
                    <p className="flex flex-col p-3 bg-slate-50 border border-slate-200 rounded"><span className="text-slate-400">Current:</span> <strong className="font-mono text-base text-slate-800">{detailTelemetry ? detailTelemetry.current : '0'} A</strong></p>
                    <p className="flex flex-col p-3 bg-slate-50 border border-slate-200 rounded"><span className="text-slate-400">Temperature:</span> <strong className="font-mono text-base text-amber-600">{detailTelemetry ? detailTelemetry.temperature : '0.0'} °C</strong></p>

                    {/* Excel Sheet Custom Telemetry Parameters */}
                    <p className="flex flex-col p-3 bg-slate-50 border border-slate-200 rounded"><span className="text-slate-400">Battery Voltage:</span> <strong className="font-mono text-base text-[#16a34a]">{detailTelemetry ? (detailTelemetry.battery_voltage || '0.0') : '0.0'} V</strong></p>
                    <p className="flex flex-col p-3 bg-slate-50 border border-slate-200 rounded"><span className="text-slate-400">Daily Consumed:</span> <strong className="font-mono text-base text-indigo-700">{detailTelemetry ? (detailTelemetry.daily_consumed || '0.00') : '0.00'} kWh</strong></p>
                    <p className="flex flex-col p-3 bg-slate-50 border border-slate-200 rounded"><span className="text-slate-400">Imported Energy:</span> <strong className="font-mono text-base text-slate-800">{detailTelemetry ? (detailTelemetry.imported_energy || '0.00') : '0.00'} kWh</strong></p>
                    <p className="flex flex-col p-3 bg-slate-50 border border-slate-200 rounded"><span className="text-slate-400">Grid Status:</span> <strong className="font-mono text-base text-blue-800 uppercase">{detailTelemetry ? (detailTelemetry.grid_status || 'On-grid') : 'On-grid'}</strong></p>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Last Updated: {detailTelemetry ? new Date(detailTelemetry.timestamp).toLocaleString() : 'N/A'}
                  </div>
                </div>
              )}

              {/* B. Historical Data */}
              {detailActiveTab === 'history' && (
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h3 className="font-bold text-sm text-slate-800">Telemetry History Logs</h3>
                    <button
                      onClick={handleExportCSV}
                      disabled={!detailHistory.length}
                      className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-350 text-[#1e3a8a] rounded text-[11px] font-bold shadow-sm flex items-center space-x-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200 sticky top-0">
                          <th className="p-2.5">Timestamp</th>
                          <th className="p-2.5 font-mono">PV Power (kW)</th>
                          <th className="p-2.5 font-mono">Voltage</th>
                          <th className="p-2.5 font-mono">Current</th>
                          <th className="p-2.5 font-mono">Battery Voltage</th>
                          <th className="p-2.5 font-mono">Daily Consumed (kWh)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailHistory.map(row => (
                          <tr key={row.id} className="hover:bg-slate-50 font-mono">
                            <td className="p-2.5 text-slate-655">{new Date(row.timestamp).toLocaleString()}</td>
                            <td className="p-2.5 text-[#1e3a8a] font-bold">{(row.pv_power || row.power).toFixed(2)} kW</td>
                            <td className="p-2.5 text-slate-655">{row.voltage} V</td>
                            <td className="p-2.5 text-slate-655">{row.current} A</td>
                            <td className="p-2.5 text-[#16a34a]">{row.battery_voltage || '0.0'} V</td>
                            <td className="p-2.5 text-indigo-700 font-semibold">{row.daily_consumed || '0.00'} kWh</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* C. Alerts / Issues */}
              {detailActiveTab === 'alerts' && (
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
                  <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2">Active Alarms Logs</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                          <th className="p-3">Alarm Class</th>
                          <th className="p-3">Severity</th>
                          <th className="p-3">System Message</th>
                          <th className="p-3 font-mono">Timestamp</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailIssues.map(issue => (
                          <tr key={issue.id} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-855">{issue.issue_type}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${issue.severity === 'Critical' ? 'bg-red-50 text-red-700 animate-scada-pulse border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                {issue.severity}
                              </span>
                            </td>
                            <td className="p-3 text-slate-650 italic">{issue.message}</td>
                            <td className="p-3 font-mono text-slate-450">{new Date(issue.started_at).toLocaleString()}</td>
                            <td className="p-3 font-semibold">
                              <span className={issue.status === 'Active' ? 'text-red-655' : 'text-slate-450'}>
                                {issue.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {detailIssues.length === 0 && (
                          <tr>
                            <td colSpan="5" className="p-6 text-center text-slate-450 italic">
                              No active alerts reported.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* D. Scraper Config */}
              {detailActiveTab === 'scraper' && detailAccount && (
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4 text-xs">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h3 className="font-bold text-sm text-slate-800">Scraping Credentials</h3>
                    <button
                      onClick={() => {
                        setEditScUsername(detailAccount.username);
                        setEditScPassword(detailAccount.password);
                        setEditScInterval(detailAccount.scrape_interval_minutes);
                        setIsEditingAccount(true);
                      }}
                      className="text-[#1e3a8a] font-bold hover:text-[#172554]"
                    >
                      Edit Credentials
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2 font-medium">
                    <p><span className="text-slate-400">Username / ID:</span> <strong className="font-mono text-slate-850">{detailAccount.username}</strong></p>
                    <p><span className="text-slate-400">Interval:</span> <strong className="font-mono text-slate-850">Every {detailAccount.scrape_interval_minutes} minutes</strong></p>
                    <p><span className="text-slate-400">Last Scrape Sync:</span> <strong className="font-mono text-slate-850">{new Date(detailAccount.last_scraped_at).toLocaleString()}</strong></p>
                    <p className="flex items-center space-x-2">
                      <span className="text-slate-400">Status:</span>
                      <button
                        onClick={() => handleToggleScraping(detailAccount.id)}
                        className="focus:outline-none"
                      >
                        {detailAccount.enabled ? (
                          <span className="px-2 py-0.5 rounded bg-green-50 text-green-700 font-bold border border-green-200">RUNNING</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-bold border border-slate-200">PAUSED</span>
                        )}
                      </button>
                    </p>
                  </div>
                </div>
              )}

              {/* E. Hardware Strings */}
              {detailActiveTab === 'hardware' && (
                <div className="space-y-6">
                  {/* String Table Listing */}
                  <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-slate-855 border-b border-slate-100 pb-2">Hardware String Tables</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                            <th className="p-3">Table ID</th>
                            <th className="p-3 font-mono text-center">Panels</th>
                            <th className="p-3">Panel Spec</th>
                            <th className="p-3">Inverter Spec</th>
                            <th className="p-3 font-mono">Gateway ID</th>
                            <th className="p-3 font-mono text-center">Degrade Ratio</th>
                            <th className="p-3 font-mono">Hardware Age</th>
                            <th className="p-3 font-mono">Active Power</th>
                            <th className="p-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {detailTables.map(table => (
                            <tr key={table.id} className="hover:bg-slate-50">
                              <td className="p-3 font-bold font-mono text-slate-800">{table.table_number}</td>
                              <td className="p-3 font-mono text-center">{table.panels_count}</td>
                              <td className="p-3 font-semibold text-slate-650">{table.panel_model}</td>
                              <td className="p-3 text-slate-655">{table.inverter_model}</td>
                              <td className="p-3 font-mono text-slate-500">{table.gateway_id}</td>
                              <td className="p-3 font-mono font-bold text-amber-600">{table.degrade_pct}%</td>
                              <td className="p-3 font-mono text-slate-500">{table.age_years} yr</td>
                              <td className="p-3 font-mono font-semibold text-[#1e3a8a]">{table.power_w} W</td>
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => handleRemoveTable(table.id)}
                                  className="text-red-655 hover:text-red-800 p-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Add New Table Form */}
                  <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
                    <h3 className="font-bold text-sm text-slate-855 border-b border-slate-100 pb-2">Add New Table Form</h3>
                    <form onSubmit={handleAddTable} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                      <div className="space-y-1">
                        <label className="block text-slate-600 font-semibold">Table Number *</label>
                        <input
                          type="text"
                          required
                          value={tabNum}
                          onChange={(e) => setTabNum(e.target.value)}
                          placeholder="e.g. T-04"
                          className="w-full px-2.5 py-1.5 border border-slate-250 rounded focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-slate-600 font-semibold">Number of Panels *</label>
                        <input
                          type="number"
                          required
                          max="20"
                          value={tabPanels}
                          onChange={(e) => setTabPanels(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-250 rounded focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-slate-600 font-semibold">Panel Model</label>
                        <input
                          type="text"
                          value={tabPanelModel}
                          onChange={(e) => setTabPanelModel(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-250 rounded focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-slate-600 font-semibold">Inverter Model</label>
                        <input
                          type="text"
                          value={tabInverterModel}
                          onChange={(e) => setTabInverterModel(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-250 rounded focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-slate-600 font-semibold">Gateway ID</label>
                        <input
                          type="text"
                          value={tabGateway}
                          onChange={(e) => setTabGateway(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-255 rounded focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-slate-600 font-semibold">Table MAC Address</label>
                        <input
                          type="text"
                          value={tabMAC}
                          onChange={(e) => setTabMAC(e.target.value)}
                          placeholder="e.g. 00:1A:2B:3C:4D:09"
                          className="w-full px-2.5 py-1.5 border border-slate-255 rounded focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-slate-600 font-semibold">Table Power (W)</label>
                        <input
                          type="number"
                          value={tabPower}
                          onChange={(e) => setTabPower(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-255 rounded focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-slate-600 font-semibold">Degrade %</label>
                        <input
                          type="number"
                          value={tabDegrade}
                          onChange={(e) => setTabDegrade(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-255 rounded focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-slate-600 font-semibold">Panel Age (Years)</label>
                        <input
                          type="number"
                          value={tabAge}
                          onChange={(e) => setTabAge(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-255 rounded focus:outline-none"
                        />
                      </div>

                      <div className="lg:col-span-4 flex justify-end">
                        <button
                          type="submit"
                          className="px-4 py-2 bg-[#1e3a8a] hover:bg-[#172554] text-white rounded font-bold shadow-sm"
                        >
                          Add String Table
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* EDIT SCRAPER MODAL */}
              {isEditingAccount && detailAccount && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                  <div className="bg-white border border-slate-200 rounded-lg shadow-xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-150 text-xs">
                    <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">Edit Scraping Parameters</h3>
                    <form onSubmit={handleEditAccount} className="space-y-3.5 mt-3">
                      <div className="space-y-1">
                        <label className="block text-slate-655 font-semibold">Scraper Username</label>
                        <input
                          type="text"
                          required
                          value={editScUsername}
                          onChange={(e) => setEditScUsername(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-250 rounded focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-slate-655 font-semibold">Scraper Password</label>
                        <input
                          type="password"
                          required
                          value={editScPassword}
                          onChange={(e) => setEditScPassword(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-250 rounded focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-slate-655 font-semibold">Interval (Minutes)</label>
                        <select
                          value={editScInterval}
                          onChange={(e) => setEditScInterval(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded focus:outline-none"
                        >
                          <option value="5">Every 5 minutes</option>
                          <option value="10">Every 10 minutes</option>
                          <option value="15">Every 15 minutes</option>
                          <option value="30">Every 30 minutes</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setIsEditingAccount(false)}
                          className="px-3 py-1.5 border border-slate-350 rounded text-slate-700 hover:bg-slate-50 font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-[#1e3a8a] text-white rounded font-bold shadow hover:bg-[#172554]"
                        >
                          Save Credentials
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* 3. MANAGE ACCOUNTS (Staff Registry) */}
      {currentTab === 'staff' && (
        <div className="space-y-6">
          <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setStaffSubTab('list')}
                className={`text-sm font-bold pb-1.5 border-b-2 ${staffSubTab === 'list' ? 'border-[#1e3a8a] text-[#1e3a8a]' : 'border-transparent text-slate-500'}`}
              >
                Accounts Directory
              </button>
              <button
                onClick={() => setStaffSubTab('add')}
                className={`text-sm font-bold pb-1.5 border-b-2 ${staffSubTab === 'add' ? 'border-[#1e3a8a] text-[#1e3a8a]' : 'border-transparent text-slate-500'}`}
              >
                Add User Account
              </button>
            </div>
            <div className="text-[10px] text-slate-400 uppercase font-mono">Access Users: {users.length}</div>
          </div>

          {staffSubTab === 'list' ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-2 bg-white border border-slate-250 px-3 py-1.5 rounded-lg max-w-sm shadow-sm">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  placeholder="Search user accounts..."
                  className="bg-transparent border-none text-xs w-full focus:outline-none"
                />
              </div>

              <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="p-3">User Name</th>
                      <th className="p-3">Email Address</th>
                      <th className="p-3">Role Badge</th>
                      <th className="p-3 font-semibold">Monitoring Access Scope</th>
                      <th className="p-3 font-sans">Status</th>
                      <th className="p-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.filter(u => u.name.toLowerCase().includes(staffSearch.toLowerCase()) || u.email.toLowerCase().includes(staffSearch.toLowerCase())).map(user => {
                      const userPlantNames = db.getPlantsForUser(user.id, user.role).map(p => p.plant_name).join(', ');
                      return (
                        <tr key={user.id} className="hover:bg-slate-50">
                          <td className="p-3 font-bold text-slate-800">{user.name}</td>
                          <td className="p-3 font-mono text-slate-650">{user.email}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${user.role === 'ADMIN' ? 'bg-blue-50 border border-blue-200 text-blue-700' : 'bg-purple-50 border border-purple-200 text-purple-700'
                              }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="p-3 text-slate-500 font-medium truncate max-w-xs">{userPlantNames || 'No plant assignments'}</td>
                          <td className="p-3">
                            <div className="flex items-center space-x-1.5">
                              <span className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-[#16a34a]' : 'bg-red-500'}`}></span>
                              <span className="font-semibold text-slate-700">{user.is_active ? 'Active' : 'Suspended'}</span>
                            </div>
                          </td>
                          <td className="p-3 text-center space-x-2.5">
                            <button
                              onClick={() => handleToggleStaffStatus(user.id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border shadow-sm ${user.is_active ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                                }`}
                            >
                              {user.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            {user.id !== currentUser.id && (
                              <button
                                onClick={() => handleDeleteStaff(user.id)}
                                className="text-red-655 hover:text-red-800 font-semibold text-[11px]"
                              >
                                Delete
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Add User Account Form */
            <div className="max-w-xl bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
              <form onSubmit={handleAddStaff} className="space-y-6 text-xs">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-855">Register User Account</h3>
                  <p className="text-slate-500">Configure details, role access rules, and station maps.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-slate-655 font-semibold">User Name *</label>
                    <input
                      type="text"
                      required
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      placeholder="e.g. Ramesh"
                      className="w-full px-3 py-2 border border-slate-250 rounded focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-655 font-semibold">Email Address (Login) *</label>
                    <input
                      type="email"
                      required
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      placeholder="operator@company.com"
                      className="w-full px-3 py-2 border border-slate-250 rounded focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-655 font-semibold">Temporary Password *</label>
                    <input
                      type="password"
                      required
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3 py-2 border border-slate-250 rounded focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-655 font-semibold">Role Category</label>
                    <select
                      value={staffRole}
                      onChange={(e) => setStaffRole(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-250 bg-white rounded focus:outline-none"
                    >
                      <option value="MANAGEMENT">Management (Read-Only Analytics)</option>
                      <option value="ADMIN">Admin (Read-Write Controls)</option>
                    </select>
                  </div>

                  {/* Station Assigns */}
                  <div className="space-y-2 md:col-span-2 pt-4 border-t border-slate-100">
                    <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Assign Plant Monitoring Access</label>
                    <div className="space-y-2 border border-slate-200 rounded p-3 max-h-40 overflow-y-auto bg-slate-50">
                      {plants.map(p => {
                        const isChecked = staffPlantAccess.includes(p.id);
                        return (
                          <label key={p.id} className="flex items-center space-x-2 py-0.5 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setStaffPlantAccess(staffPlantAccess.filter(id => id !== p.id));
                                } else {
                                  setStaffPlantAccess([...staffPlantAccess, p.id]);
                                }
                              }}
                              className="rounded border-slate-355 text-[#1e3a8a] focus:ring-[#1e3a8a]"
                            />
                            <span className="text-slate-700">{p.plant_name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setStaffSubTab('list')}
                    className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[#1e3a8a] text-white rounded font-bold shadow-md hover:bg-[#172554]"
                  >
                    Save User
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* 4. PROFILE TAB */}
      {currentTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile details */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2">Profile Information</h3>
            <div className="space-y-2.5">
              <p className="flex justify-between"><span className="text-slate-400 font-medium">Name:</span> <strong className="text-slate-800">{currentUser.name}</strong></p>
              <p className="flex justify-between"><span className="text-slate-400 font-medium">Email / ID:</span> <strong className="text-slate-800 font-mono">{currentUser.email}</strong></p>
              <p className="flex justify-between"><span className="text-slate-400 font-medium">Corporate Access:</span> <strong className="text-slate-800 font-semibold">{currentUser.role}</strong></p>
            </div>
          </div>

          {/* Password update */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2">Update Password</h3>
            <form onSubmit={handleChangePassword} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-655 font-semibold">Current Password</label>
                <input
                  type="password"
                  required
                  value={currPass}
                  onChange={(e) => setCurrPass(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-250 rounded focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-slate-655 font-semibold">New Security Password</label>
                <input
                  type="password"
                  required
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Minimum 4 characters"
                  className="w-full px-3 py-2 border border-slate-250 rounded focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-[#1e3a8a] text-white rounded font-bold shadow hover:bg-[#172554] transition-colors"
              >
                Change Password
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
