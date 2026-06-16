"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';
import api from '../../lib/api';
import {
  Users,
  DollarSign,
  Plus,
  Trash2,
  Edit,
  ShieldAlert,
  Loader2,
  Search,
  Check,
  X,
  LogOut,
  Sparkles,
  Mail,
  Lock,
  ChevronDown,
  Pencil
} from 'lucide-react';

interface UserItem {
  id: string;
  name: string | null;
  email: string;
  mobileNumber: string | null;
  creditsBalance: number;
  isBanned: boolean;
  role: string;
  createdAt: string;
  planName: string | null;
  planValidity: string | null;
  planExpiresAt: string | null;
  createdBy: string | null;
}

interface PlanFeature {
  id: string;
  text: string;
  isEnabled: boolean;
}

interface PlanItem {
  id: string;
  name: string;
  price: number;
  credits: number;
  isActive: boolean;
  features: PlanFeature[];
}

export default function AdminDashboard() {
  const { user: firebaseUser, logout, refreshProfile } = useAuth();
  const router = useRouter();

  // Authentication Status
  const [isAdmin, setIsAdmin] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Dashboard Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    earnings: { today: 0, week: 0, month: 0, year: 0, allTime: 0 }
  });
  const [earningsFilter, setEarningsFilter] = useState<'today' | 'week' | 'month' | 'year' | 'allTime'>('allTime');

  // Tab View Control
  const [activeTab, setActiveTab] = useState<'users' | 'plans' | 'resellers'>('users');
  const [loadingData, setLoadingData] = useState(false);

  // Users Data
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [userSearch, setUserSearch] = useState('');
  
  // Resellers Data
  const [resellersList, setResellersList] = useState<UserItem[]>([]);
  const [resellerSearch, setResellerSearch] = useState('');

  // Plans Data
  const [plansList, setPlansList] = useState<PlanItem[]>([]);

  // Modals / Editors
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [editUserPlan, setEditUserPlan] = useState('None');
  const [editUserValidity, setEditUserValidity] = useState('Lifetime');
  const [editUserCredits, setEditUserCredits] = useState(0);
  const [editUserCreatedBy, setEditUserCreatedBy] = useState('');
  const [editUserRole, setEditUserRole] = useState('USER');

  const [creatingPlan, setCreatingPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanPrice, setNewPlanPrice] = useState('');
  const [newPlanCredits, setNewPlanCredits] = useState('');

  const [newFeatureText, setNewFeatureText] = useState<Record<string, string>>({});

  // Reseller creation form states
  const [creatingReseller, setCreatingReseller] = useState(false);
  const [newResellerName, setNewResellerName] = useState('');
  const [newResellerEmail, setNewResellerEmail] = useState('');
  const [newResellerPhone, setNewResellerPhone] = useState('');
  const [newResellerPassword, setNewResellerPassword] = useState('');
  const [resellerError, setResellerError] = useState('');

  // Inline editing states for plan prices & credits
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [tempPriceVal, setTempPriceVal] = useState('');
  const [editingCreditsId, setEditingCreditsId] = useState<string | null>(null);
  const [tempCreditsVal, setTempCreditsVal] = useState('');

  // Check admin role on load
  useEffect(() => {
    const checkAdmin = async () => {
      if (!firebaseUser) {
        setIsAdmin(false);
        return;
      }
      try {
        const res = await api.get('/auth/profile');
        if (res.data.user.role === 'ADMIN') {
          setIsAdmin(true);
          fetchDashboardData();
        } else {
          setIsAdmin(false);
        }
      } catch (err) {
        setIsAdmin(false);
      }
    };
    checkAdmin();
  }, [firebaseUser]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    try {
      const res = await api.post('/auth/admin-login', {
        email: loginEmail,
        password: loginPassword
      });

      const { customToken } = res.data;
      if (!customToken) {
        throw new Error('Admin custom token validation failed.');
      }

      await signInWithCustomToken(auth, customToken);
      await refreshProfile();
      setIsAdmin(true);
    } catch (err: any) {
      console.error(err);
      setAuthError(err.response?.data?.message || err.message || 'Invalid admin credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    setLoadingData(true);
    try {
      // 1. Stats
      const statsRes = await api.get('/admin/stats');
      setStats(statsRes.data);

      // 2. Users list
      const usersRes = await api.get('/admin/users');
      setUsersList(usersRes.data);

      // 3. Plans list
      const plansRes = await api.get('/admin/plans');
      setPlansList(plansRes.data);

      // 4. Resellers list
      const resellersRes = await api.get('/admin/resellers');
      setResellersList(resellersRes.data);
    } catch (err) {
      console.error('Error fetching dashboard details:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateResellerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResellerError('');
    try {
      const res = await api.post('/admin/resellers', {
        name: newResellerName,
        email: newResellerEmail,
        mobileNumber: newResellerPhone || undefined,
        password: newResellerPassword
      });
      setResellersList([res.data.user, ...resellersList]);
      setCreatingReseller(false);
      setNewResellerName('');
      setNewResellerEmail('');
      setNewResellerPhone('');
      setNewResellerPassword('');
    } catch (err: any) {
      setResellerError(err.response?.data?.message || 'Failed to appoint reseller.');
    }
  };

  const handleDeleteReseller = async (resellerId: string) => {
    if (!confirm('Are you sure you want to delete this reseller? The reseller will not be able to log in. Clients created by them will remain in system.')) return;
    try {
      await api.delete(`/admin/users/${resellerId}`);
      setResellersList(resellersList.filter(r => r.id !== resellerId));
    } catch (err: any) {
      alert('Failed to delete reseller.');
    }
  };

  const handleResellerBanToggle = async (resellerId: string) => {
    try {
      const res = await api.post(`/admin/users/${resellerId}/ban`);
      setResellersList(resellersList.map(r => r.id === resellerId ? { ...r, isBanned: res.data.user.isBanned } : r));
    } catch (err) {
      alert('Failed to change reseller ban status.');
    }
  };

  // User Functions
  const handleBanToggle = async (userId: string) => {
    try {
      const res = await api.post(`/admin/users/${userId}/ban`);
      setUsersList(usersList.map(u => u.id === userId ? { ...u, isBanned: res.data.user.isBanned } : u));
    } catch (err) {
      alert('Failed to change ban status.');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? All associated videos and transactions will be deleted permanently.')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      setUsersList(usersList.filter(u => u.id !== userId));
      setStats(prev => ({ ...prev, totalUsers: prev.totalUsers - 1 }));
    } catch (err) {
      alert('Failed to delete user.');
    }
  };

  const handleEditUserClick = (u: UserItem) => {
    setEditingUser(u);
    setEditUserName(u.name || '');
    setEditUserEmail(u.email);
    setEditUserPhone(u.mobileNumber || '');
    setEditUserPassword('');
    setEditUserPlan(u.planName || 'None');
    setEditUserValidity(u.planValidity || 'Lifetime');
    setEditUserCredits(u.creditsBalance || 0);
    setEditUserCreatedBy(u.createdBy || '');
    setEditUserRole(u.role || 'USER');
  };

  const handleUpdateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const res = await api.put(`/admin/users/${editingUser.id}`, {
        name: editUserName,
        email: editUserEmail,
        mobileNumber: editUserPhone || null,
        password: editUserPassword || undefined,
        planName: editUserPlan,
        planValidity: editUserValidity,
        creditsBalance: Number(editUserCredits),
        createdBy: editUserCreatedBy || null,
        role: editUserRole
      });

      const updatedUser = res.data.user;

      setUsersList(usersList.map(u => u.id === editingUser.id ? { 
        ...u, 
        name: editUserName, 
        email: editUserEmail, 
        mobileNumber: editUserPhone || null,
        planName: editUserPlan,
        planValidity: editUserValidity,
        creditsBalance: Number(editUserCredits),
        createdBy: editUserCreatedBy || null,
        role: editUserRole,
        planExpiresAt: updatedUser?.planExpiresAt || null
      } : u));
      
      setEditingUser(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update user.');
    }
  };

  // Plan Functions
  const handleTogglePlanActive = async (planId: string, currentStatus: boolean) => {
    try {
      const res = await api.put(`/admin/plans/${planId}`, {
        isActive: !currentStatus
      });
      setPlansList(plansList.map(p => p.id === planId ? { ...p, isActive: res.data.isActive } : p));
    } catch (err) {
      alert('Failed to toggle plan status.');
    }
  };

  // Inline edit handlers
  const startEditPrice = (planId: string, currentVal: number) => {
    setEditingPriceId(planId);
    setTempPriceVal(currentVal.toString());
  };

  const saveEditPrice = async (planId: string, currentCredits: number) => {
    if (!tempPriceVal || isNaN(Number(tempPriceVal))) return;
    try {
      await handleUpdatePlanPriceAndCredits(planId, tempPriceVal, currentCredits.toString());
      setEditingPriceId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const startEditCredits = (planId: string, currentVal: number) => {
    setEditingCreditsId(planId);
    setTempCreditsVal(currentVal.toString());
  };

  const saveEditCredits = async (planId: string, currentPrice: number) => {
    if (!tempCreditsVal || isNaN(Number(tempCreditsVal))) return;
    try {
      await handleUpdatePlanPriceAndCredits(planId, currentPrice.toString(), tempCreditsVal);
      setEditingCreditsId(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdatePlanPriceAndCredits = async (planId: string, newPrice: string, newCredits: string) => {
    try {
      const res = await api.put(`/admin/plans/${planId}`, {
        price: parseFloat(newPrice),
        credits: parseInt(newCredits)
      });
      setPlansList(plansList.map(p => p.id === planId ? { ...p, price: res.data.price, credits: res.data.credits } : p));
    } catch (err) {
      alert('Failed to update plan details.');
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/admin/plans', {
        name: newPlanName.toUpperCase(),
        price: parseFloat(newPlanPrice),
        credits: parseInt(newPlanCredits),
        features: []
      });
      setPlansList([...plansList, res.data]);
      setCreatingPlan(false);
      setNewPlanName('');
      setNewPlanPrice('');
      setNewPlanCredits('');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create plan.');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this pricing plan?')) return;
    try {
      await api.delete(`/admin/plans/${planId}`);
      setPlansList(plansList.filter(p => p.id !== planId));
    } catch (err) {
      alert('Failed to delete plan.');
    }
  };

  // Plan Feature Functions
  const handleToggleFeature = async (featureId: string, planId: string) => {
    try {
      const res = await api.post(`/admin/plans/features/${featureId}/toggle`);
      setPlansList(plansList.map(p => p.id === planId ? {
        ...p,
        features: p.features.map(f => f.id === featureId ? { ...f, isEnabled: res.data.isEnabled } : f)
      } : p));
    } catch (err) {
      alert('Failed to toggle feature status.');
    }
  };

  const handleAddFeature = async (planId: string) => {
    const text = newFeatureText[planId];
    if (!text || !text.trim()) return;

    try {
      const res = await api.post(`/admin/plans/${planId}/features`, { text });
      setPlansList(plansList.map(p => p.id === planId ? {
        ...p,
        features: [...p.features, res.data]
      } : p));
      
      setNewFeatureText({ ...newFeatureText, [planId]: '' });
    } catch (err) {
      alert('Failed to add feature text.');
    }
  };

  const handleDeleteFeature = async (featureId: string, planId: string) => {
    try {
      await api.delete(`/admin/plans/features/${featureId}`);
      setPlansList(plansList.map(p => p.id === planId ? {
        ...p,
        features: p.features.filter(f => f.id !== featureId)
      } : p));
    } catch (err) {
      alert('Failed to delete feature.');
    }
  };

  const filteredUsers = usersList.filter(u => {
    const query = userSearch.toLowerCase();
    return (
      (u.name || '').toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      (u.mobileNumber || '').includes(query)
    );
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-[#FAFAF8] text-[#1A1A1A]">
        <div className="w-full max-w-md bg-white border border-black/5 rounded-3xl p-8 shadow-xl shadow-brandGreen-dark/5 flex flex-col gap-6 relative overflow-hidden">
          
          <div className="absolute top-0 right-0 w-24 h-24 bg-brandGreen/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="text-center flex flex-col items-center gap-2">
            <Link href="/" className="flex items-center gap-2 text-2xl font-black tracking-wider text-brandGreen-dark">
              <img src="/logo.png" alt="RetailStacker AI Logo" className="w-6 h-6 object-contain" />
              <span>RetailStacker</span>
            </Link>
            <h2 className="text-xl font-bold text-brandGreen-dark mt-2">Admin Login</h2>
            <p className="text-xs text-gray-400">Restricted administrative directory</p>
          </div>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-600 text-xs p-3.5 rounded-xl">
              {authError}
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="admin@admin.com"
                  className="bg-gray-50 border border-black/5 rounded-xl w-full pl-10 pr-4 py-2.5 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen transition"
                />
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-gray-50 border border-black/5 rounded-xl w-full pl-10 pr-4 py-2.5 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen transition"
                />
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full bg-brandGreen-dark hover:bg-[#0E4A27] text-white font-bold py-2.5 rounded-xl transition duration-200 flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
            >
              {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Access Command Console'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A] flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-black/5 bg-white backdrop-blur-md px-6 py-4 flex items-center justify-between sticky top-0 z-45">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-wider text-brandGreen-dark">
            <img src="/logo.png" alt="RetailStacker AI Logo" className="w-6 h-6 object-contain" />
            <span>RetailStacker Control Room</span>
          </Link>
          <span className="bg-brandGreen/10 text-brandGreen-dark border border-brandGreen/20 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full">
            SYSTEM ROOT ADMIN
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={fetchDashboardData}
            className="text-xs bg-gray-100 hover:bg-gray-200 text-brandGreen-dark font-semibold px-3 py-1.5 rounded-lg transition"
          >
            Refresh Data
          </button>
          <button
            onClick={async () => {
              await logout();
              router.push('/login');
            }}
            className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-650 border border-red-500/20 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-bold"
          >
            <LogOut className="w-3.5 h-3.5" />
            Logout
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 flex flex-col gap-8">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Total Registered Users */}
          <div className="bg-white border border-black/5 p-6 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="p-4 bg-brandGreen/10 text-brandGreen-dark rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Total Users</p>
              <h3 className="text-2xl font-bold text-brandGreen-dark mt-1">{stats.totalUsers}</h3>
            </div>
          </div>

          {/* Card 2: Filter-wise Earnings Dashboard */}
          <div className="bg-white border border-black/5 p-6 rounded-2xl flex flex-col gap-3 col-span-2 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-brandGold/15 text-brandGold-dark rounded-xl">
                  <DollarSign className="w-5 h-5 text-brandGold-dark" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">System Earning</p>
                  <h3 className="text-2xl font-black text-brandGreen-dark mt-0.5">
                    ₹{stats.earnings[earningsFilter]?.toLocaleString('en-IN') || 0}
                  </h3>
                </div>
              </div>

              {/* Range Range Selector */}
              <select
                value={earningsFilter}
                onChange={(e) => setEarningsFilter(e.target.value as any)}
                className="bg-gray-50 border border-black/5 text-xs text-brandGreen-dark font-medium px-3 py-1.5 rounded-xl focus:outline-none focus:border-brandGreen"
              >
                <option value="today">Today</option>
                <option value="week">Past Week</option>
                <option value="month">Past Month</option>
                <option value="year">Past Year</option>
                <option value="allTime">All Time</option>
              </select>
            </div>

            {/* Quick stats distribution */}
            <div className="grid grid-cols-5 gap-2 border-t border-black/5 pt-3 text-[10px] text-gray-400 font-medium">
              <div>Today: <span className="text-brandGreen-dark font-bold block">₹{stats.earnings.today}</span></div>
              <div>Week: <span className="text-brandGreen-dark font-bold block">₹{stats.earnings.week}</span></div>
              <div>Month: <span className="text-brandGreen-dark font-bold block">₹{stats.earnings.month}</span></div>
              <div>Year: <span className="text-brandGreen-dark font-bold block">₹{stats.earnings.year}</span></div>
              <div>All Time: <span className="text-brandGreen-dark font-bold block">₹{stats.earnings.allTime}</span></div>
            </div>
          </div>
        </div>

        {/* Tab Controllers */}
        <div className="flex border-b border-black/5">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'users' ? 'border-brandGreen text-brandGreen-dark' : 'border-transparent text-gray-400 hover:text-gray-650'}`}
          >
            Manage Accounts ({usersList.length})
          </button>
          <button
            onClick={() => setActiveTab('resellers')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'resellers' ? 'border-brandGreen text-brandGreen-dark' : 'border-transparent text-gray-400 hover:text-gray-650'}`}
          >
            Resellers Management ({resellersList.length})
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition ${activeTab === 'plans' ? 'border-brandGreen text-brandGreen-dark' : 'border-transparent text-gray-400 hover:text-gray-650'}`}
          >
            Dynamic Plans & Features ({plansList.length})
          </button>
        </div>

        {/* LOADING INDICATOR */}
        {loadingData && (
          <div className="flex items-center justify-center py-20 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-brandGreen" />
            <span className="text-sm text-gray-400 font-medium">Syncing database changes...</span>
          </div>
        )}

        {/* TAB 1: USERS DIRECTORY */}
        {!loadingData && activeTab === 'users' && (
          <div className="flex flex-col gap-4">
            
            {/* Search filter row */}
            <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-xl border border-black/5 shadow-sm">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Search user accounts by name, email or phone..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="bg-gray-50 border border-black/5 rounded-xl w-full pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-brandGreen text-brandGreen-dark placeholder-gray-400"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Users list database grid */}
            <div className="bg-white border border-black/5 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/5 text-[10px] text-gray-400 uppercase tracking-wider font-bold">
                    <th className="px-6 py-4">Account UID</th>
                    <th className="px-6 py-4">Personal Details</th>
                    <th className="px-6 py-4">Plan & Validity</th>
                    <th className="px-6 py-4">Assigned Reseller</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Credit Balance</th>
                    <th className="px-6 py-4">Joined Date</th>
                    <th className="px-6 py-4 text-right">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 text-xs text-gray-600">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className={`hover:bg-gray-50/50 ${u.isBanned ? 'bg-red-50/50 text-red-750' : ''}`}>
                      <td className="px-6 py-4 font-mono text-gray-400">{u.id.substring(0, 10)}...</td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-brandGreen-dark text-sm">{u.name || 'Anonymous User'}</div>
                        <div className="text-gray-400">{u.email}</div>
                        {u.mobileNumber && (
                          <div className="text-gray-500 text-[10px] mt-0.5">{u.mobileNumber}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-brandGreen-dark">{u.planName || 'None'}</div>
                        <div className="text-gray-400 text-[10px]">{u.planValidity || 'Lifetime'}</div>
                        {u.planExpiresAt && (
                          <div className="text-red-500 text-[9px] mt-0.5 font-medium">Expires: {new Date(u.planExpiresAt).toLocaleDateString()}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {u.createdBy ? (
                          <div>
                            <div className="font-bold text-brandGreen-dark">{u.createdBy.split('@')[0]}</div>
                            <div className="text-gray-400 text-[10px]">{u.createdBy}</div>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-[10px]">Direct/Admin</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-750 border border-purple-200' : u.role === 'RESELLER' ? 'bg-emerald-100 text-emerald-850 border border-emerald-200' : 'bg-gray-150 text-gray-500 border border-gray-200'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-brandGreen-dark">{u.creditsBalance} Cr</td>
                      <td className="px-6 py-4 text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => handleEditUserClick(u)}
                          className="bg-gray-100 hover:bg-gray-200 p-1.5 rounded-lg text-brandGreen-dark transition border border-black/5"
                          title="Edit User Details"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleBanToggle(u.id)}
                          className={`p-1.5 rounded-lg border transition ${u.isBanned ? 'bg-red-100 text-red-650 border-red-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-500 border-black/5'}`}
                          title={u.isBanned ? "Unban User" : "Ban User"}
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                        </button>
                        {u.role !== 'ADMIN' && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="bg-red-50 hover:bg-red-100 p-1.5 rounded-lg text-red-600 border border-red-200 transition"
                            title="Delete User permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-gray-450 font-medium">
                        No active users matching criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: DYNAMIC PLANS SETUP */}
        {!loadingData && activeTab === 'plans' && (
          <div className="flex flex-col gap-6">
            
            {/* Create new plan trigger row */}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-brandGreen-dark">Dynamic Pricing Setup</h3>
                <p className="text-xs text-gray-400">Pricing options display live sync dynamically to the frontend page</p>
              </div>
              <button
                onClick={() => setCreatingPlan(true)}
                className="bg-brandGreen-dark hover:bg-[#0E4A27] text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                Add New Plan Option
              </button>
            </div>

            {/* Plans listing cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {plansList.map((plan) => {
                return (
                  <div key={plan.id} className={`bg-white border rounded-3xl p-6 flex flex-col gap-4 relative overflow-hidden shadow-sm ${plan.isActive ? 'border-brandGreen/30' : 'border-black/5'}`}>
                    
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xl font-bold text-brandGreen-dark">{plan.name}</h4>
                          {plan.isActive ? (
                            <span className="bg-brandGreen/10 text-brandGreen-dark border border-brandGreen/20 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                              Live on Site
                            </span>
                          ) : (
                            <span className="bg-gray-105 text-gray-400 border border-gray-200 text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full">
                              Disabled Draft
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-400 font-mono">Plan ID: {plan.id}</span>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTogglePlanActive(plan.id, plan.isActive)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition ${plan.isActive ? 'bg-orange-50 hover:bg-orange-100 border-orange-200 text-orange-650' : 'bg-brandGreen/10 border-brandGreen/25 text-brandGreen-dark'}`}
                        >
                          {plan.isActive ? 'Disable Option' : 'Make Live'}
                        </button>
                        <button
                          onClick={() => handleDeletePlan(plan.id)}
                          className="bg-red-50 hover:bg-red-100 border border-red-200 p-1.5 rounded-lg text-red-650 transition"
                          title="Delete Plan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Plan inputs (Live update pricing amounts) */}
                    <div className="grid grid-cols-2 gap-4 bg-[#FAFAF8] p-4 rounded-xl border border-black/5">
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 uppercase">Pricing (INR)</label>
                        {editingPriceId === plan.id ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <input
                              type="number"
                              value={tempPriceVal}
                              onChange={(e) => setTempPriceVal(e.target.value)}
                              className="bg-white border border-brandGreen rounded-lg px-2 py-0.5 text-sm font-extrabold text-brandGreen-dark w-24 focus:outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditPrice(plan.id, plan.credits);
                                if (e.key === 'Escape') setEditingPriceId(null);
                              }}
                            />
                            <button
                              onClick={() => saveEditPrice(plan.id, plan.credits)}
                              className="bg-brandGreen text-white p-1 rounded-lg hover:bg-brandGreen-dark transition"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => startEditPrice(plan.id, plan.price)}
                            className="flex items-center gap-1.5 cursor-pointer mt-0.5 hover:text-brandGreen text-brandGreen-dark transition group"
                          >
                            <span className="font-extrabold text-lg">₹{plan.price.toLocaleString('en-IN')}</span>
                            <Pencil className="w-3 h-3 text-gray-400 group-hover:text-brandGreen opacity-60 group-hover:opacity-100 transition" />
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-gray-400 uppercase">Credits Offered</label>
                        {editingCreditsId === plan.id ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <input
                              type="number"
                              value={tempCreditsVal}
                              onChange={(e) => setTempCreditsVal(e.target.value)}
                              className="bg-white border border-brandGreen rounded-lg px-2 py-0.5 text-sm font-extrabold text-brandGreen-dark w-24 focus:outline-none"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditCredits(plan.id, plan.price);
                                if (e.key === 'Escape') setEditingCreditsId(null);
                              }}
                            />
                            <button
                              onClick={() => saveEditCredits(plan.id, plan.price)}
                              className="bg-brandGreen text-white p-1 rounded-lg hover:bg-brandGreen-dark transition"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div 
                            onClick={() => startEditCredits(plan.id, plan.credits)}
                            className="flex items-center gap-1.5 cursor-pointer mt-0.5 hover:text-brandGreen text-brandGreen-dark transition group"
                          >
                            <span className="font-extrabold text-lg">{plan.credits.toLocaleString('en-IN')} Cr</span>
                            <Pencil className="w-3 h-3 text-gray-400 group-hover:text-brandGreen opacity-60 group-hover:opacity-100 transition" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Features list management */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-bold text-gray-450 uppercase tracking-wider">Features Checklist</label>
                      <div className="flex flex-col gap-1.5 divide-y divide-black/5">
                        {plan.features.map((feature) => (
                          <div key={feature.id} className="flex items-center justify-between py-1.5 text-xs">
                            <span className={feature.isEnabled ? 'text-gray-650' : 'text-gray-350 line-through'}>
                              {feature.text}
                            </span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleToggleFeature(feature.id, plan.id)}
                                className={`p-1 rounded text-[10px] font-bold border transition ${feature.isEnabled ? 'bg-brandGreen/10 border-brandGreen/20 text-brandGreen-dark' : 'bg-gray-100 border-transparent text-gray-455'}`}
                              >
                                {feature.isEnabled ? 'Active' : 'Hidden'}
                              </button>
                              <button
                                onClick={() => handleDeleteFeature(feature.id, plan.id)}
                                className="text-red-500 hover:text-red-650 p-0.5 animate-fade-in"
                                title="Delete feature from checklist"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add new feature input */}
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          placeholder="Add new feature bullet (e.g. 4K Video exports)..."
                          value={newFeatureText[plan.id] || ''}
                          onChange={(e) => setNewFeatureText({ ...newFeatureText, [plan.id]: e.target.value })}
                          className="bg-gray-50 border border-black/5 rounded-xl px-3 py-1.5 text-xs flex-1 focus:outline-none focus:border-brandGreen"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddFeature(plan.id)}
                          className="bg-brandGreen text-white hover:bg-brandGreen-dark px-3 rounded-xl text-xs font-bold transition"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: RESELLERS DIRECTORY */}
        {!loadingData && activeTab === 'resellers' && (
          <div className="flex flex-col gap-4">
            
            {/* Action Row */}
            <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-xl border border-black/5 shadow-sm">
              <div className="relative flex-1 max-w-md">
                <input
                  type="text"
                  placeholder="Search resellers by name, email or phone..."
                  value={resellerSearch}
                  onChange={(e) => setResellerSearch(e.target.value)}
                  className="bg-gray-50 border border-black/5 rounded-xl w-full pl-10 pr-4 py-2.5 text-xs focus:outline-none focus:border-brandGreen text-brandGreen-dark placeholder-gray-400"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              <button
                onClick={() => setCreatingReseller(true)}
                className="bg-brandGreen-dark hover:bg-[#0E4A27] text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition"
              >
                <Plus className="w-4 h-4" />
                Appoint New Reseller
              </button>
            </div>

            {/* Resellers database list */}
            <div className="bg-white border border-black/5 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-black/5 text-[10px] text-gray-400 uppercase tracking-wider font-bold">
                    <th className="px-6 py-4">Reseller UID</th>
                    <th className="px-6 py-4">Personal Details</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Joined Date</th>
                    <th className="px-6 py-4 text-right">Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 text-xs text-gray-600">
                  {resellersList
                    .filter(r => {
                      const query = resellerSearch.toLowerCase();
                      return (
                        (r.name || '').toLowerCase().includes(query) ||
                        r.email.toLowerCase().includes(query) ||
                        (r.mobileNumber || '').includes(query)
                      );
                    })
                    .map((r) => (
                      <tr key={r.id} className={`hover:bg-gray-50/50 ${r.isBanned ? 'bg-red-50/50 text-red-755' : ''}`}>
                        <td className="px-6 py-4 font-mono text-gray-400">{r.id.substring(0, 10)}...</td>
                        <td className="px-6 py-4">
                          <div className="font-bold text-brandGreen-dark text-sm">{r.name || 'Anonymous Reseller'}</div>
                          <div className="text-gray-400">{r.email}</div>
                          {r.mobileNumber && (
                            <div className="text-gray-500 text-[10px] mt-0.5">{r.mobileNumber}</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="bg-emerald-100 text-emerald-850 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold">
                            {r.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => handleResellerBanToggle(r.id)}
                            className={`p-1.5 rounded-lg border transition ${r.isBanned ? 'bg-red-100 text-red-650 border-red-200' : 'bg-gray-100 hover:bg-gray-200 text-gray-500 border-black/5'}`}
                            title={r.isBanned ? "Unban Reseller" : "Ban Reseller"}
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteReseller(r.id)}
                            className="bg-red-50 hover:bg-red-100 p-1.5 rounded-lg text-red-605 border border-red-200 transition"
                            title="Delete Reseller permanently"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  {resellersList.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-gray-450 font-medium">
                        No resellers appointed yet. Use "Appoint New Reseller" button to start.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* MODAL 1: EDIT USER DETAILS */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-black/5 rounded-3xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl relative text-[#1A1A1A]">
            <button
              onClick={() => setEditingUser(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-650"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-brandGreen-dark">Edit User Settings</h3>
            <p className="text-xs text-gray-400">Modifying profile data will reflect instantly in the user database</p>

            <form onSubmit={handleUpdateUserSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Full Name</label>
                <input
                  type="text"
                  required
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="bg-gray-50 border border-black/5 rounded-xl w-full px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Email Address</label>
                <input
                  type="email"
                  required
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  className="bg-slate-50 border border-black/5 rounded-xl w-full px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Mobile Number</label>
                <input
                  type="text"
                  value={editUserPhone}
                  onChange={(e) => setEditUserPhone(e.target.value)}
                  placeholder="+919876543210"
                  className="bg-gray-50 border border-black/5 rounded-xl w-full px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">New Password (Leave blank to keep current)</label>
                <input
                  type="password"
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-gray-50 border border-black/5 rounded-xl w-full px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Plan Tier</label>
                  <select
                    value={editUserPlan}
                    onChange={(e) => setEditUserPlan(e.target.value)}
                    className="bg-gray-50 border border-black/5 rounded-xl w-full px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen mt-1"
                  >
                    <option value="None">None</option>
                    <option value="BASIC">BASIC</option>
                    <option value="PRO">PRO</option>
                    <option value="BUSINESS">BUSINESS</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Plan Validity</label>
                  <select
                    value={editUserValidity}
                    onChange={(e) => setEditUserValidity(e.target.value)}
                    className="bg-gray-50 border border-black/5 rounded-xl w-full px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen mt-1"
                  >
                    <option value="Lifetime">Lifetime</option>
                    <option value="1 Month">1 Month</option>
                    <option value="3 Months">3 Months</option>
                    <option value="6 Months">6 Months</option>
                    <option value="1 Year">1 Year</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Credits Balance</label>
                  <input
                    type="number"
                    value={editUserCredits}
                    onChange={(e) => setEditUserCredits(Number(e.target.value))}
                    className="bg-gray-50 border border-black/5 rounded-xl w-full px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase">System Role</label>
                  <select
                    value={editUserRole}
                    onChange={(e) => setEditUserRole(e.target.value)}
                    className="bg-gray-50 border border-black/5 rounded-xl w-full px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen mt-1"
                  >
                    <option value="USER">USER</option>
                    <option value="RESELLER">RESELLER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Assigned Reseller (Email)</label>
                <input
                  type="email"
                  value={editUserCreatedBy}
                  onChange={(e) => setEditUserCreatedBy(e.target.value)}
                  placeholder="reseller@example.com (or blank for direct)"
                  className="bg-gray-50 border border-black/5 rounded-xl w-full px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen mt-1"
                />
              </div>

              <div className="flex gap-2 justify-end mt-4">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="bg-gray-150 hover:bg-gray-200 px-4 py-2 rounded-xl text-xs font-bold transition text-gray-650"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-brandGreen text-white hover:bg-brandGreen-dark font-bold px-4 py-2 rounded-xl text-xs transition"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CREATE NEW PRICING PLAN */}
      {creatingPlan && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-black/5 rounded-3xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl relative text-[#1A1A1A]">
            <button
              onClick={() => setCreatingPlan(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-650"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-brandGreen-dark">Create Plan Tier</h3>
            <p className="text-xs text-gray-400">Add a new tier to the dynamic pricing checklist</p>

            <form onSubmit={handleCreatePlan} className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Plan Tier Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ULTIMATE"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  className="bg-gray-50 border border-black/5 rounded-xl w-full px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Cost price (INR)</label>
                <input
                  type="number"
                  required
                  placeholder="9999"
                  value={newPlanPrice}
                  onChange={(e) => setNewPlanPrice(e.target.value)}
                  className="bg-gray-50 border border-black/5 rounded-xl w-full px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Credits Offered</label>
                <input
                  type="number"
                  required
                  placeholder="5000"
                  value={newPlanCredits}
                  onChange={(e) => setNewPlanCredits(e.target.value)}
                  className="bg-gray-50 border border-black/5 rounded-xl w-full px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen mt-1"
                />
              </div>

              <div className="flex gap-2 justify-end mt-4">
                <button
                  type="button"
                  onClick={() => setCreatingPlan(false)}
                  className="bg-gray-150 hover:bg-gray-200 px-4 py-2 rounded-xl text-xs font-bold transition text-gray-650"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-brandGreen text-white hover:bg-brandGreen-dark font-bold px-4 py-2 rounded-xl text-xs transition"
                >
                  Create Plan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CREATE NEW RESELLER */}
      {creatingReseller && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-black/5 rounded-3xl w-full max-w-md p-6 flex flex-col gap-4 shadow-2xl relative text-[#1A1A1A]">
            <button
              onClick={() => setCreatingReseller(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-650"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-brandGreen-dark">Appoint Reseller</h3>
            <p className="text-xs text-gray-400">Create a reseller account to distribute platform packages</p>

            {resellerError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-650 text-xs p-3 rounded-xl">
                {resellerError}
              </div>
            )}

            <form onSubmit={handleCreateResellerSubmit} className="flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Reseller Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={newResellerName}
                  onChange={(e) => setNewResellerName(e.target.value)}
                  className="bg-gray-50 border border-black/5 rounded-xl w-full px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="john@example.com"
                  value={newResellerEmail}
                  onChange={(e) => setNewResellerEmail(e.target.value)}
                  className="bg-gray-50 border border-black/5 rounded-xl w-full px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Mobile Number (With Country Code)</label>
                <input
                  type="text"
                  placeholder="+919876543210"
                  value={newResellerPhone}
                  onChange={(e) => setNewResellerPhone(e.target.value)}
                  className="bg-gray-50 border border-black/5 rounded-xl w-full px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase">Password</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newResellerPassword}
                  onChange={(e) => setNewResellerPassword(e.target.value)}
                  className="bg-gray-50 border border-black/5 rounded-xl w-full px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen mt-1"
                />
              </div>

              <div className="flex gap-2 justify-end mt-4">
                <button
                  type="button"
                  onClick={() => setCreatingReseller(false)}
                  className="bg-gray-150 hover:bg-gray-200 px-4 py-2 rounded-xl text-xs font-bold transition text-gray-650"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-brandGreen text-white hover:bg-brandGreen-dark font-bold px-4 py-2 rounded-xl text-xs transition"
                >
                  Appoint Reseller
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
