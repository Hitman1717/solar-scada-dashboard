// ManagementApp.jsx - Management Dashboard (Aligned with Excel seed data, Dashboard Plants Table, Read-Only)

import React, { useState, useEffect } from 'react';
import { db } from '../../../services/dbService';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  Calendar, FileText, CheckCircle, AlertTriangle, Play, Download, Search, Info, ArrowLeft
} from 'lucide-react';
import DashboardOverview from '../../../components/dashboard/DashboardOverview';

export default function ManagementApp({ currentUser, currentTab, activePlant, setActivePlant, activePlantTelemetry }) {
  // DB States
  const [plants, setPlants] = useState(() => db.getPlantsForUser(currentUser.id, currentUser.role));
  const [issues, setIssues] = useState(() => db.getAll(db.TABLES.PLANT_ISSUES));
  const [tablesList, setTablesList] = useState(() => db.getAll(db.TABLES.PLANT_TABLES));

  // Sync state with database whenever telemetry updates
  useEffect(() => {
    setPlants(db.getPlantsForUser(currentUser.id, currentUser.role));
    setIssues(db.getAll(db.TABLES.PLANT_ISSUES));
    setTablesList(db.getAll(db.TABLES.PLANT_TABLES));
  }, [activePlantTelemetry, currentUser]);

  // Detail navigation states
  const [selectedPlantId, setSelectedPlantId] = useState(null);
  const [detailTab, setDetailTab] = useState('telemetry'); // telemetry | history | alerts | hardware

  // Historical query date range
  const [startDate, setStartDate] = useState('2026-07-05');
  const [endDate, setEndDate] = useState('2026-07-06');
  const [queryHistory, setQueryHistory] = useState([]);
  const [hasQueried, setHasQueried] = useState(false);

  // Profile password state
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');

  const detailPlant = plants.find(p => p.id === selectedPlantId);
  const detailTables = tablesList.filter(t => t.plant_id === selectedPlantId);
  const detailIssues = issues.filter(i => i.plant_id === selectedPlantId);

  // Execute historical queries
  const handleQueryHistory = (e) => {
    e.preventDefault();
    if (!selectedPlantId) return;

    const allTelemetry = db.getTelemetryForPlant(selectedPlantId, 30);
    const filtered = allTelemetry.filter(row => {
      const rowDate = row.timestamp.split('T')[0];
      return rowDate >= startDate && rowDate <= endDate;
    });

    setQueryHistory(filtered);
    setHasQueried(true);
  };

  const handleExportCSV = () => {
    if (!queryHistory.length) return;
    let csv = "Timestamp,PV Power (kW),Voltage (V),Current (A),Battery Voltage (V),Daily Consumed (kWh)\n";
    queryHistory.forEach(row => {
      csv += `${row.timestamp},${row.pv_power || row.power},${row.voltage},${row.current},${row.battery_voltage || 0},${row.daily_consumed || 0}\n`;
    });
    const encoded = encodeURI("data:text/csv;charset=utf-8," + csv);
    const link = document.createElement("a");
    link.setAttribute("href", encoded);
    link.setAttribute("download", `Telemetry_Report_${detailPlant?.plant_name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleUpdatePassword = (e) => {
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

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6">
      
      {/* 1. OVERVIEW DASHBOARD */}
      {currentTab === 'dashboard' && !selectedPlantId && (
        <div className="space-y-6">
          <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Management Analytics Dashboard</h2>
          </div>

          <DashboardOverview plants={plants} issues={issues} />

          {/* Integrated Plants table directly on the Dashboard */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2">Assigned Stations Status</h3>
            <div className="bg-white border border-slate-200 rounded-md overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                    <th className="p-3">Plant Name</th>
                    <th className="p-3 font-mono">Plant Capacity</th>
                    <th className="p-3">Location</th>
                    <th className="p-3 font-mono">Expected Generation Today</th>
                    <th className="p-3">Plant Status</th>
                    <th className="p-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {plants.map(plant => (
                    <tr key={plant.id} className="hover:bg-slate-50">
                      <td className="p-3">
                        <button
                          onClick={() => {
                            setSelectedPlantId(plant.id);
                            setDetailTab('telemetry');
                            setHasQueried(false);
                            setActivePlant(plant);
                          }}
                          className="text-blue-600 hover:text-blue-800 font-bold hover:underline text-left focus:outline-none"
                        >
                          {plant.plant_name}
                        </button>
                      </td>
                      <td className="p-3 font-mono text-slate-700">{plant.plant_capacity}</td>
                      <td className="p-3 text-slate-500">{plant.location}</td>
                      <td className="p-3 font-mono text-[#1e3a8a]">{(parseFloat(plant.plant_capacity) * 1.95).toFixed(2)} kWh</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap border ${
                          plant.status === 'Normal' || plant.status === 'Online' || plant.status === 'Active' ? 'bg-green-50 border border-green-200 text-green-700' :
                          plant.status === 'Offline' || plant.status === 'Inactive' ? 'bg-red-50 border-red-200 text-red-700' :
                          plant.status === 'Under Maintenance' || plant.status === 'Maintenance' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                          'bg-slate-100 border-slate-300 text-slate-600' // Decommissioned/Fallback gray
                        }`}>
                          {plant.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => {
                            setSelectedPlantId(plant.id);
                            setDetailTab('telemetry');
                            setHasQueried(false);
                            setActivePlant(plant);
                          }}
                          className="text-[#1e3a8a] hover:text-[#172554] font-bold text-[11px]"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. PLANTS VIEW */}
      {currentTab === 'plants' && !selectedPlantId && (
        <div className="space-y-6">
          
          {/* ASSIGNED PLANTS LIST VIEW */}
          <div className="space-y-4 font-sans">
              <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
                <h2 className="text-xl font-bold text-slate-800">Assigned Stations</h2>
              </div>

              <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                      <th className="p-3">Plant Name</th>
                      <th className="p-3 font-mono">Plant Capacity</th>
                      <th className="p-3">Location</th>
                      <th className="p-3 font-mono">Expected Generation Today</th>
                      <th className="p-3">Plant Status</th>
                      <th className="p-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {plants.map(plant => (
                      <tr key={plant.id} className="hover:bg-slate-50">
                        <td className="p-3">
                          <button
                            onClick={() => {
                              setSelectedPlantId(plant.id);
                              setDetailTab('telemetry');
                              setHasQueried(false);
                              setActivePlant(plant);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-bold hover:underline text-left focus:outline-none"
                          >
                            {plant.plant_name}
                          </button>
                        </td>
                        <td className="p-3 font-mono text-slate-700">{plant.plant_capacity}</td>
                        <td className="p-3 text-slate-500">{plant.location}</td>
                        <td className="p-3 font-mono text-[#1e3a8a]">{(parseFloat(plant.plant_capacity) * 1.95).toFixed(2)} kWh</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap border ${
                            plant.status === 'Normal' || plant.status === 'Online' || plant.status === 'Active' ? 'bg-green-50 border border-green-200 text-green-700' :
                            plant.status === 'Offline' || plant.status === 'Inactive' ? 'bg-red-50 border-red-200 text-red-700' :
                            plant.status === 'Under Maintenance' || plant.status === 'Maintenance' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                            'bg-slate-100 border-slate-300 text-slate-600' // Decommissioned/Fallback gray
                          }`}>
                            {plant.status}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => {
                              setSelectedPlantId(plant.id);
                              setDetailTab('telemetry');
                              setHasQueried(false);
                              setActivePlant(plant);
                            }}
                            className="text-[#1e3a8a] hover:text-[#172554] font-bold text-[11px]"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ASSIGNED PLANT READ-ONLY DETAILS VIEW */}
        {selectedPlantId && detailPlant && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* Detailed Header */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <button
                  onClick={() => setSelectedPlantId(null)}
                  className="text-xs text-slate-500 hover:text-slate-900 font-bold flex items-center space-x-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back to Stations</span>
                </button>
                <div className="flex items-center space-x-2 text-xs">
                  <span className={`px-2.5 py-0.5 rounded-full font-bold text-xs whitespace-nowrap border ${
                    detailPlant.status === 'Normal' || detailPlant.status === 'Online' || detailPlant.status === 'Active' ? 'bg-green-50 border-green-200 text-green-700' :
                    detailPlant.status === 'Offline' || detailPlant.status === 'Inactive' ? 'bg-red-50 border-red-200 text-red-700' :
                    detailPlant.status === 'Under Maintenance' || detailPlant.status === 'Maintenance' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                    'bg-slate-100 border-slate-300 text-slate-600' // Decommissioned/Fallback gray
                  }`}>
                    {detailPlant.status}
                  </span>
                </div>
              </div>

              {/* Plant info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Plant Capacity</span>
                  <div className="text-xl font-bold font-mono text-slate-800">{detailPlant.plant_capacity}</div>
                </div>
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Commission Date</span>
                  <div className="text-xl font-bold font-mono text-slate-700">{detailPlant.commission_date}</div>
                </div>
                <div className="bg-white border border-slate-200 rounded p-4 shadow-sm space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Location</span>
                  <div className="text-xl font-bold text-slate-700 truncate">{detailPlant.location}</div>
                </div>
              </div>

              {/* Details Subtab navigation */}
              <div className="flex border-b border-slate-200 text-xs">
                {[
                  { id: 'telemetry', label: 'Live Telemetry' },
                  { id: 'history', label: 'Historical Data View' },
                  { id: 'alerts', label: 'Active Alerts' },
                  { id: 'hardware', label: 'Hardware Strings' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setDetailTab(tab.id)}
                    className={`px-4 py-2 font-bold border-b-2 transition-all ${
                      detailTab === tab.id ? 'border-[#1e3a8a] text-[#1e3a8a] font-black' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* READ-ONLY SUBTAB CONTENTS */}

              {/* A. Live Telemetry */}
              {detailTab === 'telemetry' && (
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
                  <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2">Latest SCADA Parameters</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-medium">
                    <p className="flex flex-col p-3 bg-slate-50 border border-slate-200 rounded"><span className="text-slate-400">PV Power (Current):</span> <strong className="font-mono text-base text-[#1e3a8a]">{activePlantTelemetry ? parseFloat(activePlantTelemetry.pv_power || activePlantTelemetry.power || 0).toFixed(2) : '0.00'} kW</strong></p>
                    <p className="flex flex-col p-3 bg-slate-50 border border-slate-200 rounded"><span className="text-slate-400">Voltage:</span> <strong className="font-mono text-base text-slate-800">{activePlantTelemetry ? activePlantTelemetry.voltage : '0'} V</strong></p>
                    <p className="flex flex-col p-3 bg-slate-50 border border-slate-200 rounded"><span className="text-slate-400">Current:</span> <strong className="font-mono text-base text-slate-800">{activePlantTelemetry ? activePlantTelemetry.current : '0'} A</strong></p>
                    <p className="flex flex-col p-3 bg-slate-50 border border-slate-200 rounded"><span className="text-slate-400">Temperature:</span> <strong className="font-mono text-base text-amber-600">{activePlantTelemetry ? activePlantTelemetry.temperature : '0.0'} °C</strong></p>
                    
                    {/* Excel Sheet Custom Telemetry Parameters */}
                    <p className="flex flex-col p-3 bg-slate-50 border border-slate-200 rounded"><span className="text-slate-400">Battery Voltage:</span> <strong className="font-mono text-base text-[#16a34a]">{activePlantTelemetry ? (activePlantTelemetry.battery_voltage || '0.0') : '0.0'} V</strong></p>
                    <p className="flex flex-col p-3 bg-slate-50 border border-slate-200 rounded"><span className="text-slate-400">Daily Consumed:</span> <strong className="font-mono text-base text-indigo-700">{activePlantTelemetry ? (activePlantTelemetry.daily_consumed || '0.00') : '0.00'} kWh</strong></p>
                    <p className="flex flex-col p-3 bg-slate-50 border border-slate-200 rounded"><span className="text-slate-400">Imported Energy:</span> <strong className="font-mono text-base text-slate-800">{activePlantTelemetry ? (activePlantTelemetry.imported_energy || '0.00') : '0.00'} kWh</strong></p>
                    <p className="flex flex-col p-3 bg-slate-50 border border-slate-200 rounded"><span className="text-slate-400">Grid Status:</span> <strong className="font-mono text-base text-blue-800 uppercase">{activePlantTelemetry ? (activePlantTelemetry.grid_status || 'On-grid') : 'On-grid'}</strong></p>
                  </div>
                </div>
              )}

              {/* B. Historical Data */}
              {detailTab === 'history' && (
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
                  <form onSubmit={handleQueryHistory} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end text-xs">
                    <div className="space-y-1">
                      <label className="block text-slate-655 font-semibold">Start Date</label>
                      <input
                        type="date"
                        required
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-255 rounded focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-slate-655 font-semibold">End Date</label>
                      <input
                        type="date"
                        required
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 border border-slate-255 rounded focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      className="py-1.5 px-4 bg-[#1e3a8a] text-white hover:bg-[#172554] font-bold rounded shadow"
                    >
                      Search Records
                    </button>
                  </form>

                  {hasQueried && (
                    <div className="space-y-4 border-t border-slate-100 pt-4 animate-in fade-in duration-200">
                      <div className="flex justify-between items-center bg-slate-50 border border-slate-200 p-3 rounded">
                        <span className="text-xs text-slate-600 font-semibold">Search results ready ({queryHistory.length} entries found)</span>
                        <button
                          onClick={handleExportCSV}
                          disabled={!queryHistory.length}
                          className="px-2.5 py-1 bg-white border border-slate-350 text-[#1e3a8a] hover:bg-slate-50 rounded text-[11px] font-bold shadow-sm flex items-center space-x-1.5"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Export CSV</span>
                        </button>
                      </div>

                      <div className="overflow-x-auto max-h-60">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0">
                              <th className="p-2">Timestamp</th>
                              <th className="p-2 font-mono">PV Power (kW)</th>
                              <th className="p-2 font-mono">Voltage</th>
                              <th className="p-2 font-mono">Current</th>
                              <th className="p-2 font-mono">Battery Voltage</th>
                              <th className="p-2 font-mono">Daily Consumed (kWh)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {queryHistory.map(row => (
                              <tr key={row.id} className="hover:bg-slate-50 font-mono">
                                <td className="p-2 text-slate-655">{new Date(row.timestamp).toLocaleString()}</td>
                                <td className="p-2 text-[#1e3a8a] font-bold">{(row.pv_power || row.power).toFixed(2)} kW</td>
                                <td className="p-2 text-slate-655">{row.voltage} V</td>
                                <td className="p-2 text-slate-655">{row.current} A</td>
                                <td className="p-2 text-[#16a34a]">{row.battery_voltage || '0.0'} V</td>
                                <td className="p-2 text-indigo-750 font-bold">{row.daily_consumed || '0.00'} kWh</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* C. Alerts */}
              {detailTab === 'alerts' && (
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
                  <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2">Active Incidents</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                          <th className="p-3">Alarm Type</th>
                          <th className="p-3">Severity</th>
                          <th className="p-3">Message</th>
                          <th className="p-3">Time Started</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailIssues.map(issue => (
                          <tr key={issue.id} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-855">{issue.issue_type}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                issue.severity === 'Critical' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                {issue.severity}
                              </span>
                            </td>
                            <td className="p-3 text-slate-650 italic">{issue.message}</td>
                            <td className="p-3 font-mono text-slate-450">{new Date(issue.started_at).toLocaleString()}</td>
                            <td className="p-3 font-semibold text-slate-655">{issue.status}</td>
                          </tr>
                        ))}
                        {detailIssues.length === 0 && (
                          <tr>
                            <td colSpan="5" className="p-6 text-center text-slate-450 italic">
                              No active incidents.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* D. Hardware Strings */}
              {detailTab === 'hardware' && (
                <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
                  <h3 className="font-bold text-sm text-slate-855 border-b border-slate-100 pb-2">Active String Tables</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                          <th className="p-3">Table Number</th>
                          <th className="p-3 font-mono text-center">Panels Count</th>
                          <th className="p-3">Panel Spec</th>
                          <th className="p-3">Inverter Spec</th>
                          <th className="p-3 font-mono text-center">Degrade Ratio</th>
                          <th className="p-3 font-mono">Active Power</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailTables.map(table => (
                          <tr key={table.id} className="hover:bg-slate-50">
                            <td className="p-3 font-bold font-mono text-slate-800">{table.table_number}</td>
                            <td className="p-3 font-mono text-center">{table.panels_count}</td>
                            <td className="p-3 font-semibold text-slate-655">{table.panel_model}</td>
                            <td className="p-3 text-slate-655">{table.inverter_model}</td>
                            <td className="p-3 font-mono text-center font-bold text-amber-600">{table.degrade_pct}%</td>
                            <td className="p-3 font-mono font-semibold text-[#1e3a8a]">{table.power_w} W</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

      {/* 3. PROFILE TAB */}
      {currentTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4 text-xs">
            <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2">Profile Details</h3>
            <div className="space-y-2.5">
              <p className="flex justify-between"><span className="text-slate-400 font-medium">Name:</span> <strong className="text-slate-800">{currentUser.name}</strong></p>
              <p className="flex justify-between"><span className="text-slate-400 font-medium">Email:</span> <strong className="text-slate-800 font-mono">{currentUser.email}</strong></p>
              <p className="flex justify-between"><span className="text-slate-400 font-medium">Access:</span> <strong className="text-slate-800 font-semibold">Management (Read-Only)</strong></p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2">Update Password</h3>
            <form onSubmit={handleUpdatePassword} className="space-y-3.5 text-xs">
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
                <label className="block text-slate-655 font-semibold">New Password</label>
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
