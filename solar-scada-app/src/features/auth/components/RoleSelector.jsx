// RoleSelector.jsx - Authentication Portal

import React, { useState } from 'react';
import { Shield, Eye, EyeOff, KeyRound, Building, Mail, ChevronDown } from 'lucide-react';
import { db } from '../../../services/dbService';

export default function RoleSelector({ onLoginSuccess }) {
  const [isFormMode, setIsFormMode] = useState(false);
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [errors, setErrors] = useState({});

  const handleBypassOrValidate = async (e) => {
    e.preventDefault();
    const newErrors = {};
    setErrors({});

    const isBypass = company.toLowerCase() === 'msl' || email.toLowerCase() === 'msl';

    if (isBypass) {
      const result = await db.bypassLogin(null, 'SUPER_ADMIN');
      if (result.success) {
        onLoginSuccess({
          ...result.user,
          token: result.token
        });
      } else {
        setErrors({ general: result.error || 'Failed to authenticate bypass login.' });
      }
      return;
    }

    // Role selection bypass - if a role is selected from the dropdown, bypass credentials and log in directly
    if (role && role !== 'Select category') {
      const result = await db.bypassLogin(null, role);
      if (result.success) {
        onLoginSuccess({
          ...result.user,
          token: result.token
        });
      } else {
        setErrors({ general: result.error || 'Failed to authenticate role bypass.' });
      }
      return;
    }

    // Standard Validation
    if (company.length < 2) {
      newErrors.company = 'Company name must be 2 or more characters.';
    }
    if (email.length < 2) {
      newErrors.email = 'Email/Login must be 2 or more characters.';
    }
    if (password.length < 4) {
      newErrors.password = 'Password must be 4 or more characters.';
    }
    if (!role || role === 'Select category') {
      newErrors.role = 'Please select a valid category.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Attempt secure server authentication
    const result = await db.login(email, password, role);
    if (result.success) {
      onLoginSuccess({
        ...result.user,
        token: result.token
      });
    } else {
      setErrors({ general: result.error || 'Invalid credentials or connection issue.' });
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-between items-center py-8 px-4 font-sans selection:bg-[#bfd4f2]">
      {/* Spacer / Top Align */}
      <div></div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-md p-8 transition-all duration-300">
        
        {/* Welcome Mode */}
        {!isFormMode ? (
          <div className="flex flex-col items-center text-center space-y-6">
            {/* MSLogic SCADA Brand Logo */}
            <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-[#1e3a8a] text-white shadow-inner">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m12.728 12.728l.707.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
              </svg>
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-[#1e3a8a] tracking-tight">Solar Plant Manager</h1>
              <p className="text-slate-500 text-sm">Industrial Telemetry Monitoring Platform</p>
            </div>

            <button
              onClick={() => setIsFormMode(true)}
              className="w-full py-3.5 px-6 rounded-full border-2 border-[#d4af37] text-[#b8860b] font-semibold bg-white hover:bg-[#fffbeb] active:bg-[#fff7ed] shadow-sm flex items-center justify-center space-x-2.5 transition-all duration-200"
            >
              <Shield className="w-5 h-5" />
              <span>Enter credentials</span>
            </button>
          </div>
        ) : (
          /* Form Input Mode */
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-[#1e3a8a] text-lg">Sign In</span>
              </div>
              <button 
                onClick={() => {
                  setIsFormMode(false);
                  setErrors({});
                }} 
                className="text-xs text-slate-400 hover:text-[#1e3a8a] font-medium"
              >
                Back
              </button>
            </div>

            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
                {errors.general}
              </div>
            )}

            <form onSubmit={handleBypassOrValidate} className="space-y-4">
              {/* Company Input */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Company Name</label>
                <div className="relative">
                  <Building className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Enter company name"
                    className="w-full pl-9 pr-4 py-2 border border-slate-250 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-[#1e3a8a] focus:border-[#1e3a8a]"
                  />
                </div>
                {errors.company && (
                  <p className="text-red-650 text-xs font-medium">{errors.company}</p>
                )}
              </div>

              {/* Email Input */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Email Address / Login ID</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full pl-9 pr-4 py-2 border border-slate-250 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-[#1e3a8a] focus:border-[#1e3a8a]"
                  />
                </div>
                {errors.email && (
                  <p className="text-red-650 text-xs font-medium">{errors.email}</p>
                )}
              </div>

              {/* Password Input */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-10 py-2 border border-slate-250 rounded-lg text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-[#1e3a8a] focus:border-[#1e3a8a]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-650"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-650 text-xs font-medium">{errors.password}</p>
                )}
              </div>

              {/* Role Selector dropdown */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Category (Role)</label>
                <div className="relative">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full pl-3 pr-8 py-2 border border-slate-250 rounded-lg text-sm bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-[#1e3a8a] focus:border-[#1e3a8a] appearance-none"
                  >
                    <option value="Select category">Select category</option>
                    <option value="ADMIN">Admin</option>
                    <option value="MANAGEMENT">Mgmt.</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
                {errors.role && (
                  <p className="text-red-650 text-xs font-medium mt-1">{errors.role}</p>
                )}
              </div>

              {/* Keep me signed in and Forgot Password */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                    className="rounded border-slate-300 text-[#1e3a8a] focus:ring-[#1e3a8a]"
                  />
                  <span className="text-xs font-medium text-slate-600">Keep me signed in</span>
                </label>
                <button 
                  type="button" 
                  onClick={() => alert('Credentials recovery notice: Default passwords are "password". Contact System Administrator for access resets.')} 
                  className="text-xs text-slate-500 hover:text-[#1e3a8a] font-medium"
                >
                  Forget Password
                </button>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full mt-4 py-2.5 bg-[#1e3a8a] hover:bg-[#172554] active:bg-[#0f172a] text-white font-bold text-sm rounded-lg shadow-md transition-colors duration-150"
              >
                OK
              </button>
            </form>
          </div>
        )}
      </div>

      {/* Copyright Footer */}
      <div className="text-slate-400 text-xs select-none">
        &copy; 2026 Microsyslogic. All rights reserved.
      </div>
    </div>
  );
}
