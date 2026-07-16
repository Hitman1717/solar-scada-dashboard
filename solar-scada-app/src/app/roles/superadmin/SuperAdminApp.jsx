// SuperAdminApp.jsx - Super Admin Management Dashboard (Aligned with Feature_workflow.md)

import React, { useState } from 'react';
import { db } from '../../../services/dbService';
import { Plus, Trash2, Edit3, ShieldAlert, CheckCircle, Database, Search, RefreshCw, User, Eye, EyeOff } from 'lucide-react';

export default function SuperAdminApp({ currentUser, currentTab }) {
  // DB States
  const [companies, setCompanies] = useState(db.getAll(db.TABLES.COMPANIES));
  const [users, setUsers] = useState(db.getAll(db.TABLES.USERS));
  const [plants, setPlants] = useState(db.getAll(db.TABLES.PLANTS));
  const [audits, setAudits] = useState(db.getAll(db.TABLES.AUDIT_LOGS));

  // Search & Filter
  const [compSearch, setCompSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Company Details Drawer & Edit Modal
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPerson, setEditPerson] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddr, setEditAddr] = useState('');

  // Onboarding Form States
  const [onboardStep, setOnboardStep] = useState('form'); // form | provisioning | success
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  
  // Onboarding fields
  const [compName, setCompName] = useState('');
  const [compAddr, setCompAddr] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
  // Dynamic initial plant configurations list
  const [onboardPlants, setOnboardPlants] = useState([
    { name: 'Primary 1MW Field', capacity: '1000 kW' }
  ]);

  // Profile fields
  const [profName, setProfName] = useState(currentUser.name);
  const [profEmail, setProfEmail] = useState(currentUser.email);
  const [currPass, setCurrPass] = useState('');
  const [newPass, setNewPass] = useState('');

  // Add/Remove Plant blocks on onboarding
  const addPlantBlock = () => {
    setOnboardPlants([...onboardPlants, { name: '', capacity: '' }]);
  };

  const removePlantBlock = (index) => {
    const updated = [...onboardPlants];
    updated.splice(index, 1);
    setOnboardPlants(updated);
  };

  const handlePlantFieldChange = (index, field, value) => {
    const updated = [...onboardPlants];
    updated[index][field] = value;
    setOnboardPlants(updated);
  };

  // Submit Onboarding company
  const handleOnboardSubmit = (e) => {
    e.preventDefault();
    if (!compName || !contactEmail || !adminEmail || !adminPassword) {
      alert('Please fill out all required fields.');
      return;
    }

    setOnboardStep('provisioning');
    setProgress(0);

    const phases = [
      { prg: 25, msg: 'Allocating Dedicated Cloud Space...' },
      { prg: 50, msg: 'Creating Base SQL Tables...' },
      { prg: 75, msg: 'Configuring Cloud Permissions...' },
      { prg: 100, msg: 'Generating Admin Account...' }
    ];

    let currentPhase = 0;
    const interval = setInterval(() => {
      if (currentPhase < phases.length) {
        setProgress(phases[currentPhase].prg);
        setProgressMsg(phases[currentPhase].msg);
        currentPhase++;
      } else {
        clearInterval(interval);
        
        // Actually insert company
        const newCompany = db.insert(db.TABLES.COMPANIES, {
          company_name: compName,
          address: compAddr,
          contact_person: contactName,
          contact_email: contactEmail,
          contact_phone: contactPhone,
          status: 'Active'
        });

        // Insert admin user
        const newAdmin = db.insert(db.TABLES.USERS, {
          company_id: newCompany.id,
          name: adminName || compName + ' Admin',
          email: adminEmail,
          password: adminPassword,
          role: 'ADMIN',
          is_active: true
        });

        // Create initial plants
        onboardPlants.forEach(plantInfo => {
          if (plantInfo.name) {
            const newPlant = db.insert(db.TABLES.PLANTS, {
              company_id: newCompany.id,
              plant_name: plantInfo.name,
              plant_capacity: plantInfo.capacity || '1000 kW',
              location: compAddr || 'Unknown',
              status: 'Online',
              commission_date: new Date().toISOString().split('T')[0]
            });

            // Map admin to plant
            db.assignPlantToUser(newAdmin.id, newPlant.id);

            // Add standard table records
            for (let i = 1; i <= 3; i++) {
              db.insert(db.TABLES.PLANT_TABLES, {
                plant_id: newPlant.id,
                table_number: `T-0${i}`,
                panels_count: 16,
                panel_model: 'MSL-350W',
                inverter_model: 'Growatt 3000TL',
                gateway_id: 'GW-01',
                mac_address: `00:1A:2B:3C:4D:0${i}`,
                degrade_pct: 2,
                age_years: 1,
                power_w: 4800
              });
            }
          }
        });

        // Setup mock website provider credential
        db.insert(db.TABLES.WEBSITE_ACCOUNTS, {
          plant_id: newCompany.id,
          provider_id: 1, // SolarEdge
          username: adminEmail,
          password: adminPassword,
          scrape_interval_minutes: 10,
          enabled: true,
          last_scraped_at: new Date().toISOString()
        });

        db.logAudit(currentUser.id, `Onboarded company ${compName}`, 'Company', newCompany.id);

        // Refresh lists
        setCompanies(db.getAll(db.TABLES.COMPANIES));
        setUsers(db.getAll(db.TABLES.USERS));
        setPlants(db.getAll(db.TABLES.PLANTS));
        setAudits(db.getAll(db.TABLES.AUDIT_LOGS));

        setOnboardStep('success');
      }
    }, 1000);
  };

  const resetOnboardForm = () => {
    setCompName('');
    setCompAddr('');
    setContactName('');
    setContactEmail('');
    setContactPhone('');
    setAdminName('');
    setAdminEmail('');
    setAdminPassword('');
    setOnboardPlants([{ name: 'Primary 1MW Field', capacity: '1000 kW' }]);
    setOnboardStep('form');
  };

  // Edit company
  const startEditCompany = (company) => {
    setEditName(company.company_name);
    setEditPerson(company.contact_person);
    setEditEmail(company.contact_email);
    setEditPhone(company.contact_phone);
    setEditAddr(company.address);
    setSelectedCompany(company);
    setIsEditing(true);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!selectedCompany) return;

    db.update(db.TABLES.COMPANIES, selectedCompany.id, {
      company_name: editName,
      contact_person: editPerson,
      contact_email: editEmail,
      contact_phone: editPhone,
      address: editAddr
    });

    db.logAudit(currentUser.id, `Updated company details for ${editName}`, 'Company', selectedCompany.id);
    
    setCompanies(db.getAll(db.TABLES.COMPANIES));
    setIsEditing(false);
    setSelectedCompany(null);
  };

  const toggleCompanyStatus = (companyId) => {
    const company = companies.find(c => c.id === companyId);
    if (!company) return;
    const newStatus = company.status === 'Active' ? 'Suspended' : 'Active';
    db.update(db.TABLES.COMPANIES, companyId, { status: newStatus });
    setCompanies(db.getAll(db.TABLES.COMPANIES));
    db.logAudit(currentUser.id, `Changed status of company ${company.company_name} to ${newStatus}`, 'Company', companyId);
  };

  const deleteCompany = (companyId) => {
    if (confirm('Deletes all linked users and solar plants. Confirm?')) {
      db.delete(db.TABLES.COMPANIES, companyId);
      // clean users
      db.getAll(db.TABLES.USERS)
        .filter(u => u.company_id === companyId)
        .forEach(u => db.delete(db.TABLES.USERS, u.id));
      // clean plants
      db.getAll(db.TABLES.PLANTS)
        .filter(p => p.company_id === companyId)
        .forEach(p => db.delete(db.TABLES.PLANTS, p.id));

      setCompanies(db.getAll(db.TABLES.COMPANIES));
      setUsers(db.getAll(db.TABLES.USERS));
      setPlants(db.getAll(db.TABLES.PLANTS));
      db.logAudit(currentUser.id, `Deleted client company ID: ${companyId}`, 'Company', companyId);
    }
  };

  // Change Profile
  const handleUpdateProfile = (e) => {
    e.preventDefault();
    db.update(db.TABLES.USERS, currentUser.id, {
      name: profName,
      email: profEmail
    });
    db.logAudit(currentUser.id, 'Updated profile info', 'User', currentUser.id);
    alert('Profile updated successfully.');
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

  // Filter companies
  const filteredCompanies = companies.filter(company => {
    const matchesSearch = company.company_name.toLowerCase().includes(compSearch.toLowerCase()) ||
      company.contact_person.toLowerCase().includes(compSearch.toLowerCase()) ||
      company.contact_email.toLowerCase().includes(compSearch.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter !== 'All') {
      matchesStatus = company.status === statusFilter;
    }
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-6">
      
      {/* 1. DASHBOARD TAB */}
      {currentTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Super Admin Dashboard</h2>
            <span className="text-xs font-semibold text-slate-500 font-mono">System Core Status: Nominal</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Companies</span>
              <div className="text-2xl font-bold font-mono text-slate-800">{companies.length}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Total Active Stations</span>
              <div className="text-2xl font-bold font-mono text-[#1e3a8a]">{plants.length}</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Administrators Registered</span>
              <div className="text-2xl font-bold font-mono text-slate-700">
                {users.filter(u => u.role === 'ADMIN').length}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">Audit Logs</span>
              <div className="text-2xl font-bold font-mono text-amber-600">{audits.length}</div>
            </div>
          </div>

          {/* System Audit logs */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2">Recent Security & Audit Logs</h3>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {audits.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 10).map(log => (
                <div key={log.id} className="flex justify-between items-center text-xs py-1.5 border-b border-slate-100 last:border-b-0">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-750">{log.action}</span>
                    <p className="text-[10px] text-slate-400">Entity: {log.entity_type} (ID: {log.entity_id || 'N/A'})</p>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. COMPANIES TAB */}
      {currentTab === 'companies' && (
        <div className="space-y-6">
          <div className="border-b border-slate-200 pb-3 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800">Companies Registry</h2>
            <div className="text-[10px] text-slate-400 uppercase font-mono">Count: {companies.length} Onboarded</div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-2 bg-white border border-slate-250 px-3 py-1.5 rounded-lg max-w-xs w-full shadow-sm">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={compSearch}
                onChange={(e) => setCompSearch(e.target.value)}
                placeholder="Search company by name, person or email..."
                className="bg-transparent border-none text-xs w-full focus:outline-none"
              />
            </div>
            
            <div className="flex items-center space-x-1.5 text-xs">
              <span className="text-slate-400 font-semibold">Status Filter:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-slate-250 rounded px-2.5 py-1.5 focus:outline-none"
              >
                <option value="All">All Companies</option>
                <option value="Active">Active Only</option>
                <option value="Suspended">Suspended Only</option>
              </select>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                  <th className="p-3">Company Name</th>
                  <th className="p-3">Contact Person</th>
                  <th className="p-3">Contact Email</th>
                  <th className="p-3">Contact Number</th>
                  <th className="p-3 font-mono text-center">Plants</th>
                  <th className="p-3 font-mono text-center">Users</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 font-mono">Date Onboarded</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCompanies.map(comp => {
                  const compPlants = plants.filter(p => p.company_id === comp.id);
                  const compUsers = users.filter(u => u.company_id === comp.id);
                  return (
                    <tr key={comp.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-800">{comp.company_name}</td>
                      <td className="p-3 text-slate-650">{comp.contact_person}</td>
                      <td className="p-3 font-mono text-slate-500">{comp.contact_email}</td>
                      <td className="p-3 font-mono text-slate-500">{comp.contact_phone}</td>
                      <td className="p-3 font-mono text-center">{compPlants.length}</td>
                      <td className="p-3 font-mono text-center">{compUsers.length}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          comp.status === 'Active' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
                        }`}>
                          {comp.status}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-400">{new Date(comp.created_at).toLocaleDateString()}</td>
                      <td className="p-3 text-center space-x-2">
                        <button
                          onClick={() => startEditCompany(comp)}
                          className="text-[#1e3a8a] hover:text-[#172554] font-semibold text-[11px]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => toggleCompanyStatus(comp.id)}
                          className={`px-2 py-0.5 rounded text-[10px] border shadow-sm font-semibold ${
                            comp.status === 'Active' ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'
                          }`}
                        >
                          {comp.status === 'Active' ? 'Suspend' : 'Activate'}
                        </button>
                        <button
                          onClick={() => deleteCompany(comp.id)}
                          className="text-red-655 hover:text-red-800 font-semibold text-[11px]"
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
        </div>
      )}

      {/* 3. ONBOARD COMPANY TAB */}
      {currentTab === 'onboard' && (
        <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          {onboardStep === 'form' && (
            <form onSubmit={handleOnboardSubmit} className="space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-xl font-bold text-slate-850">Onboard Company</h2>
                <p className="text-xs text-slate-500">Initialize business structures, admin roles, and initial plant grids.</p>
              </div>

              {/* Company Info */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Company Specifications</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="block text-slate-650 font-semibold">Company Name *</label>
                    <input
                      type="text"
                      required
                      value={compName}
                      onChange={(e) => setCompName(e.target.value)}
                      placeholder="e.g. CleanVolt Systems"
                      className="w-full px-3 py-2 border border-slate-250 rounded focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-650 font-semibold">Head Office Address</label>
                    <input
                      type="text"
                      value={compAddr}
                      onChange={(e) => setCompAddr(e.target.value)}
                      placeholder="Street, City, Country"
                      className="w-full px-3 py-2 border border-slate-250 rounded focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-650 font-semibold">Contact Person Name</label>
                    <input
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Operations Director"
                      className="w-full px-3 py-2 border border-slate-250 rounded focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-650 font-semibold">Contact Number</label>
                    <input
                      type="text"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="+91 99999 00000"
                      className="w-full px-3 py-2 border border-slate-250 rounded focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-slate-650 font-semibold">Contact Email Address *</label>
                    <input
                      type="email"
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="primary@company.com"
                      className="w-full px-3 py-2 border border-slate-250 rounded focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Admin Info */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Corporate Administrator Setup</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <label className="block text-slate-650 font-semibold">Admin Full Name</label>
                    <input
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="e.g. Ramesh Admin"
                      className="w-full px-3 py-2 border border-slate-250 rounded focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-slate-650 font-semibold">Admin Login Email *</label>
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="admin@company.com"
                      className="w-full px-3 py-2 border border-slate-250 rounded focus:ring-1 focus:ring-[#1e3a8a] focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-slate-650 font-semibold">Security Password *</label>
                    <input
                      type="password"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Minimum 4 characters"
                      className="w-full px-3 py-2 border border-slate-250 rounded focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Initial Plants */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Register Initial Plants</h3>
                  <button
                    type="button"
                    onClick={addPlantBlock}
                    className="px-2 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-semibold border border-slate-350 shadow-sm flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Plant</span>
                  </button>
                </div>

                <div className="space-y-3 text-xs">
                  {onboardPlants.map((plant, idx) => (
                    <div key={idx} className="flex items-center space-x-3 bg-slate-50 border border-slate-250 p-3.5 rounded-lg">
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Plant Name</label>
                          <input
                            type="text"
                            required
                            value={plant.name}
                            onChange={(e) => handlePlantFieldChange(idx, 'name', e.target.value)}
                            placeholder="e.g. Pune Field 1"
                            className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase">Capacity</label>
                          <input
                            type="text"
                            required
                            value={plant.capacity}
                            onChange={(e) => handlePlantFieldChange(idx, 'capacity', e.target.value)}
                            placeholder="e.g. 1000 kW"
                            className="w-full px-2.5 py-1.5 border border-slate-250 bg-white rounded"
                          />
                        </div>
                      </div>
                      
                      {onboardPlants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePlantBlock(idx)}
                          className="text-red-655 hover:text-red-800 p-1.5 mt-4"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-slate-100 pt-4 flex justify-end space-x-3 text-xs">
                <button
                  type="button"
                  onClick={resetOnboardForm}
                  className="px-4 py-2 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 shadow-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#1e3a8a] text-white rounded font-bold shadow-md hover:bg-[#172554]"
                >
                  Save Company
                </button>
              </div>
            </form>
          )}

          {/* Provisioning Screen */}
          {onboardStep === 'provisioning' && (
            <div className="py-12 flex flex-col items-center justify-center space-y-6">
              <Database className="w-12 h-12 text-[#1e3a8a] animate-spin" />
              <div className="text-center space-y-2">
                <h3 className="font-bold text-lg text-slate-800">Provisioning Company Resources</h3>
                <p className="text-xs text-slate-500 font-mono">{progressMsg}</p>
              </div>
              <div className="w-full max-w-sm bg-slate-100 border border-slate-250 rounded-full h-3.5 overflow-hidden shadow-inner">
                <div 
                  className="bg-[#2563eb] h-full rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <span className="font-mono text-sm font-bold text-blue-750">{progress}%</span>
            </div>
          )}

          {/* Success Screen */}
          {onboardStep === 'success' && (
            <div className="py-12 flex flex-col items-center text-center space-y-6">
              <CheckCircle className="w-16 h-16 text-[#16a34a]" />
              <div className="space-y-2">
                <h3 className="font-bold text-xl text-slate-850">Client Onboarded Successfully</h3>
                <p className="text-xs text-slate-500 max-w-sm">
                  The client database configurations have been initialized and administrator login parameters mapped.
                </p>
              </div>
              <div className="bg-[#f0f7ff] border border-blue-200 rounded p-4 text-xs text-slate-700 font-mono space-y-1">
                <p><strong>Admin Email:</strong> {adminEmail}</p>
                <p><strong>Temporary Pass:</strong> {adminPassword}</p>
              </div>
              <button
                onClick={resetOnboardForm}
                className="px-4 py-2 bg-[#1e3a8a] text-white rounded font-bold shadow-md hover:bg-[#172554] text-xs"
              >
                Onboard Another Company
              </button>
            </div>
          )}
        </div>
      )}

      {/* 4. PROFILE TAB */}
      {currentTab === 'profile' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Info Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2">Profile Details</h3>
            <form onSubmit={handleUpdateProfile} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-650 font-semibold">Full Name</label>
                <input
                  type="text"
                  required
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-250 rounded focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-slate-650 font-semibold">Email Address</label>
                <input
                  type="email"
                  required
                  value={profEmail}
                  onChange={(e) => setProfEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-250 rounded focus:outline-none"
                />
              </div>
              <button
                type="submit"
                className="py-2 px-4 bg-[#1e3a8a] text-white rounded font-bold shadow hover:bg-[#172554] transition-colors"
              >
                Update Profile
              </button>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-2">Update Password</h3>
            <form onSubmit={handleUpdatePassword} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-650 font-semibold">Current Password</label>
                <input
                  type="password"
                  required
                  value={currPass}
                  onChange={(e) => setCurrPass(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-250 rounded focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-slate-650 font-semibold">New Password</label>
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

      {/* Edit Company Modal Dialog */}
      {isEditing && selectedCompany && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white border border-slate-200 rounded-lg shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150 text-xs">
            <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">Edit Company Information</h3>
            <form onSubmit={handleEditSubmit} className="space-y-3.5 mt-3">
              <div className="space-y-1">
                <label className="block text-slate-650 font-semibold">Company Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-250 rounded focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-slate-650 font-semibold">Contact Person</label>
                <input
                  type="text"
                  required
                  value={editPerson}
                  onChange={(e) => setEditPerson(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-250 rounded focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-slate-650 font-semibold">Contact Email</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-250 rounded focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-slate-650 font-semibold">Contact Phone</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-250 rounded focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-slate-650 font-semibold">Business Address</label>
                <input
                  type="text"
                  value={editAddr}
                  onChange={(e) => setEditAddr(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-250 rounded focus:outline-none"
                />
              </div>
              
              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setSelectedCompany(null);
                  }}
                  className="px-3.5 py-1.5 border border-slate-350 rounded text-slate-700 hover:bg-slate-50 font-semibold"
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

    </div>
  );
}
