// CompanyVariablesView.jsx - Mapping and Logging company-specific scrapper variables
import React, { useState, useEffect } from 'react';
import { db } from '../../services/dbService';
import { Sliders, Plus, Search, Calendar, Database, CheckCircle, RefreshCw, FileText } from 'lucide-react';

export default function CompanyVariablesView({ currentUser }) {
  // DB Lists
  const [companies, setCompanies] = useState([]);
  const [plants, setPlants] = useState([]);
  const [variables, setVariables] = useState([]);
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [selectedComp, setSelectedComp] = useState('');
  const [selectedPlant, setSelectedPlant] = useState('');
  const [varName, setVarName] = useState('');
  const [varVal, setVarVal] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterComp, setFilterComp] = useState('All');

  // Load initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const compList = db.getAll(db.TABLES.COMPANIES);
      const plantList = db.getPlantsForUser(currentUser.id, currentUser.role);
      setCompanies(compList);
      setPlants(plantList);

      // Fetch dynamic variables from API
      let userCompanyId = currentUser.company_id;
      if (currentUser.role === 'ADMIN') {
        setSelectedComp(userCompanyId || '');
      }
      
      const vars = await db.getVariables(
        currentUser.role === 'ADMIN' ? userCompanyId : null,
        null
      );
      setVariables(vars);
    } catch (err) {
      console.error('Error loading variables view:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // Filter plants based on selected company
  const filteredPlantsForForm = plants.filter(p => {
    if (!selectedComp) return false;
    return p.company_id === Number(selectedComp);
  });

  const handleLogVariable = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!selectedComp) {
      setErrorMsg('Please select a company.');
      return;
    }
    if (!varName.trim()) {
      setErrorMsg('Variable Name cannot be empty.');
      return;
    }
    if (!varVal.trim()) {
      setErrorMsg('Variable Value cannot be empty.');
      return;
    }

    try {
      const newVar = {
        company_id: Number(selectedComp),
        plant_id: selectedPlant ? Number(selectedPlant) : null,
        variable_name: varName.trim(),
        variable_value: varVal.trim(),
        timestamp: new Date().toISOString()
      };

      const result = await db.saveVariable(newVar);
      if (result) {
        setSuccessMsg(`Successfully logged variable "${varName}"!`);
        setVarName('');
        setVarVal('');
        setSelectedPlant('');
        
        // Audit log sync
        db.logAudit(
          currentUser.id,
          `Logged dynamic variable ${varName} for Company ID ${selectedComp}`,
          'CompanyVariable',
          result.id
        );
        
        // Reload list
        const vars = await db.getVariables(
          currentUser.role === 'ADMIN' ? currentUser.company_id : null,
          null
        );
        setVariables(vars);
      } else {
        setErrorMsg('Failed to save variable. Please try again.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred while saving.');
    }
  };

  // Filter variable records based on search and selected filter
  const filteredVariables = variables.filter(v => {
    const matchesSearch = v.variable_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (v.variable_value && v.variable_value.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesComp = filterComp === 'All' || v.company_id === Number(filterComp);
    
    return matchesSearch && matchesComp;
  });

  const getCompanyName = (compId) => {
    const found = companies.find(c => c.id === compId);
    return found ? found.company_name : `Company #${compId}`;
  };

  const getPlantName = (plantId) => {
    if (!plantId) return 'Global (All Plants)';
    const found = plants.find(p => p.id === plantId);
    return found ? found.plant_name : `Plant #${plantId}`;
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-900 text-slate-100 font-sans">
      
      {/* Page Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold flex items-center space-x-2 text-white">
            <Sliders className="w-6 h-6 text-blue-400" />
            <span>Company Variables Management</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Map, resolve, and log dynamic website scraping variables (e.g. Total Yield, ETotal, GoodsKWP) across different plants.
          </p>
        </div>
        <button 
          onClick={loadData}
          disabled={loading}
          className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 active:bg-slate-950 text-slate-200 text-sm font-semibold rounded-lg border border-slate-700 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Reload Logs</span>
        </button>
      </div>

      {/* Main Grid: Form Left, Logs Table Right */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        
        {/* Left Column: Form Card */}
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/60 rounded-xl p-5 shadow-lg">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
              <Plus className="w-5 h-5 text-emerald-400" />
              <span>Log Variable Mapping</span>
            </h2>

            {successMsg && (
              <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm flex items-center space-x-2 animate-fadeIn">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg text-sm flex items-center space-x-2 animate-fadeIn">
                <Database className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleLogVariable} className="space-y-4">
              
              {/* Company Selection */}
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Select Company
                </label>
                {currentUser.role === 'SUPER_ADMIN' ? (
                  <select
                    value={selectedComp}
                    onChange={(e) => {
                      setSelectedComp(e.target.value);
                      setSelectedPlant('');
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="">-- Choose Company --</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.company_name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    disabled
                    value={getCompanyName(currentUser.company_id)}
                    className="w-full bg-slate-900/50 border border-slate-800 rounded-lg py-2 px-3 text-slate-400 text-sm"
                  />
                )}
              </div>

              {/* Plant Selection */}
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Assigned Plant (Optional)
                </label>
                <select
                  value={selectedPlant}
                  disabled={currentUser.role === 'SUPER_ADMIN' && !selectedComp}
                  onChange={(e) => setSelectedPlant(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50"
                >
                  <option value="">-- Global Mapping (No Plant) --</option>
                  {(currentUser.role === 'SUPER_ADMIN' ? filteredPlantsForForm : plants).map(p => (
                    <option key={p.id} value={p.id}>{p.plant_name}</option>
                  ))}
                </select>
              </div>

              {/* Variable Key */}
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Variable Name / Key
                </label>
                <input
                  type="text"
                  value={varName}
                  onChange={(e) => setVarName(e.target.value)}
                  placeholder="e.g. ETotal, GoodsKWP, Total Yield"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              {/* Variable Value */}
              <div>
                <label className="block text-slate-300 text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Scraped Variable Value
                </label>
                <input
                  type="text"
                  value={varVal}
                  onChange={(e) => setVarVal(e.target.value)}
                  placeholder="e.g. 10.50 kW, 39.075MWh"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 px-3 text-slate-200 text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full mt-2 flex items-center justify-center space-x-2 py-2.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-blue-500/10 transition"
              >
                <Sliders className="w-4 h-4" />
                <span>Log Dynamic Variable</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Logs and Variable Registry */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700/60 rounded-xl p-5 shadow-lg flex flex-col h-full">
            
            {/* Search and Filters */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-5 border-b border-slate-700/50">
              <h2 className="text-lg font-semibold text-white flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <span>Logged Variables Registry</span>
              </h2>

              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search variables..."
                    className="bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-4 py-1.5 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 w-full sm:w-56"
                  />
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                </div>

                {/* Company Filter (Super Admin only) */}
                {currentUser.role === 'SUPER_ADMIN' && (
                  <select
                    value={filterComp}
                    onChange={(e) => setFilterComp(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-3 text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="All">All Companies</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.company_name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto min-h-[350px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4">Company</th>
                    <th className="py-3 px-4">Plant</th>
                    <th className="py-3 px-4">Variable Name</th>
                    <th className="py-3 px-4">Logged Value</th>
                    <th className="py-3 px-4 flex items-center space-x-1"><Calendar className="w-3.5 h-3.5" /><span>Timestamp</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-sm text-slate-300">
                  {filteredVariables.length > 0 ? (
                    filteredVariables.map((v, i) => (
                      <tr key={v.id || i} className="hover:bg-slate-750/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-200">
                          {getCompanyName(v.company_id)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {getPlantName(v.plant_id)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-blue-400">
                          {v.variable_name}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-white">
                          <span className="bg-slate-900/60 border border-slate-700/50 rounded px-2.5 py-1 font-mono text-xs">
                            {v.variable_value}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          {new Date(v.timestamp).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-slate-500 font-medium">
                        <Database className="w-8 h-8 text-slate-600 mx-auto mb-2.5" />
                        <span>No dynamic variables found matching filters.</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
