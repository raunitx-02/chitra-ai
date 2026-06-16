"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import {
  Users,
  UserPlus,
  Trash2,
  ShieldAlert,
  Loader2,
  Search,
  Check,
  LogOut,
  Sparkles,
  Mail,
  Lock,
  Phone,
  Calendar,
  CheckCircle,
  Database
} from 'lucide-react';

interface ClientUser {
  id: string;
  name: string | null;
  email: string;
  mobileNumber: string | null;
  creditsBalance: number;
  planName: string | null;
  planValidity: string | null;
  planExpiresAt: string | null;
  createdAt: string;
}

export default function ResellerDashboard() {
  const { user: firebaseUser, logout, refreshProfile } = useAuth();
  const router = useRouter();

  // Authentication Status
  const [isReseller, setIsReseller] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Dashboard Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    plansCount: { None: 0, BASIC: 0, PRO: 0, BUSINESS: 0 } as Record<string, number>
  });

  // Client Data
  const [clientsList, setClientsList] = useState<ClientUser[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [loadingData, setLoadingData] = useState(false);

  // New Client Form
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newPlan, setNewPlan] = useState('BASIC');
  const [newValidity, setNewValidity] = useState('1 Month');
  const [creatingClient, setCreatingClient] = useState(false);
  const [formError, setFormError] = useState('');

  // Check Reseller role on mount
  useEffect(() => {
    const verifyResellerRole = async () => {
      if (!firebaseUser) {
        setLoadingAuth(false);
        return;
      }
      try {
        const res = await api.get('/auth/profile');
        if (res.data.user.role === 'RESELLER' || res.data.user.role === 'ADMIN') {
          setIsReseller(true);
          fetchResellerData();
        } else {
          router.push('/login');
        }
      } catch (err) {
        router.push('/login');
      } finally {
        setLoadingAuth(false);
      }
    };
    verifyResellerRole();
  }, [firebaseUser]);

  const fetchResellerData = async () => {
    setLoadingData(true);
    try {
      const statsRes = await api.get('/reseller/stats');
      setStats(statsRes.data);

      const clientsRes = await api.get('/reseller/users');
      setClientsList(clientsRes.data);
    } catch (err) {
      console.error('Error fetching reseller details:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleCreateClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingClient(true);
    setFormError('');

    try {
      await api.post('/reseller/users', {
        email: newEmail,
        password: newPassword,
        name: newName,
        mobileNumber: newMobile || null,
        planName: newPlan,
        planValidity: newValidity
      });

      // Clear states & reload
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewMobile('');
      setNewPlan('BASIC');
      setNewValidity('1 Month');
      setIsCreateModalOpen(false);
      fetchResellerData();
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to create client user.');
    } finally {
      setCreatingClient(false);
    }
  };

  const handleDeleteClient = async (clientId: string, clientEmail: string) => {
    if (!confirm(`Are you sure you want to delete customer ${clientEmail}? This will delete all their video generation logs permanently.`)) return;
    try {
      await api.delete(`/reseller/users/${clientId}`);
      setClientsList(clientsList.filter(c => c.id !== clientId));
      setStats(prev => ({ ...prev, totalUsers: prev.totalUsers - 1 }));
    } catch (err) {
      alert('Failed to delete customer.');
    }
  };

  const handleUpdateSubscription = async (clientId: string, planName: string, planValidity: string) => {
    try {
      await api.put(`/reseller/users/${clientId}`, {
        planName,
        planValidity
      });
      alert('Client subscription updated successfully.');
      fetchResellerData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update user subscription.');
    }
  };

  const handleLogoutClick = async () => {
    await logout();
    router.push('/login');
  };

  const filteredClients = clientsList.filter(c => {
    const q = clientSearch.toLowerCase();
    const nameStr = c.name?.toLowerCase() || '';
    return c.email.toLowerCase().includes(q) || nameStr.includes(q) || c.mobileNumber?.includes(q);
  });

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
        <Loader2 className="w-8 h-8 text-brandGreen animate-spin" />
      </div>
    );
  }

  if (!isReseller) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-brandGreen-dark font-sans pb-16">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b border-black/5 px-6 py-4 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="RetailStacker Logo" className="w-6 h-6 object-contain" />
          <span className="font-black tracking-wider text-lg">RetailStacker Reseller</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-gray-500 font-medium">Logged in as Reseller</span>
          <button
            onClick={handleLogoutClick}
            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 font-bold transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-6 mt-8 flex flex-col gap-8">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-brandGreen/10 text-brandGreen text-[10px] font-bold uppercase tracking-wider rounded-full mb-2">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Reseller Dashboard</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight leading-none">Client Subscriptions</h1>
            <p className="text-xs text-gray-400 mt-2">Appoint customer sub-accounts, credit allocations, and monitor license expiries.</p>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-brandGreen hover:bg-brandGreen-dark text-white font-bold text-xs px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-md shadow-brandGreen/15"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Customer</span>
          </button>
        </div>

        {/* Analytics Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brandGreen/5 flex items-center justify-center text-brandGreen">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Total Clients</p>
              <h3 className="text-2xl font-black mt-0.5">{stats.totalUsers}</h3>
            </div>
          </div>

          <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/5 flex items-center justify-center text-emerald-500">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Active Clients</p>
              <h3 className="text-2xl font-black mt-0.5">{stats.activeUsers}</h3>
            </div>
          </div>

          <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-sm flex items-center gap-4 col-span-1 md:col-span-2">
            <div className="w-12 h-12 rounded-2xl bg-brandGold/5 flex items-center justify-center text-brandGold-dark">
              <Database className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Client Plans Breakdown</p>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <div>BASIC: <span className="font-extrabold text-brandGreen">{stats.plansCount.BASIC || 0}</span></div>
                <div>PRO: <span className="font-extrabold text-brandGreen">{stats.plansCount.PRO || 0}</span></div>
                <div>BUSINESS: <span className="font-extrabold text-brandGreen">{stats.plansCount.BUSINESS || 0}</span></div>
                <div>None: <span className="font-extrabold text-gray-400">{stats.plansCount.None || 0}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Registry list card */}
        <div className="bg-white border border-black/5 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          {/* Search bar */}
          <div className="p-5 border-b border-black/5 flex items-center gap-3 bg-gray-50/20">
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search customers by email, name, or phone..."
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              className="w-full bg-transparent text-xs text-brandGreen-dark placeholder-gray-400 outline-none"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loadingData ? (
              <div className="py-24 text-center flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 text-brandGreen animate-spin" />
                <span className="text-xs text-gray-400 font-medium">Reloading user registry...</span>
              </div>
            ) : (
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-gray-50 border-b border-black/5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="px-6 py-4.5">Client Profile</th>
                    <th className="px-6 py-4.5">Mobile Number</th>
                    <th className="px-6 py-4.5">Plan Tier</th>
                    <th className="px-6 py-4.5">Validity Duration</th>
                    <th className="px-6 py-4.5">Expiry Date</th>
                    <th className="px-6 py-4.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 text-xs">
                  {filteredClients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-gray-400 font-medium">
                        No customer accounts mapped under your reseller session.
                      </td>
                    </tr>
                  ) : (
                    filteredClients.map((client) => {
                      // Manage local updates to plan & validity
                      return (
                        <ClientRow
                          key={client.id}
                          client={client}
                          onSave={handleUpdateSubscription}
                          onDelete={handleDeleteClient}
                        />
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Creation Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <form
            onSubmit={handleCreateClientSubmit}
            className="bg-white border border-black/5 w-full max-w-md rounded-[24px] p-6 shadow-2xl flex flex-col gap-4 relative animate-in zoom-in-95 duration-200"
          >
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
            >
              <XIcon className="w-5 h-5" />
            </button>

            <div>
              <h3 className="text-lg font-black flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-brandGreen" />
                <span>Register Customer Account</span>
              </h3>
              <p className="text-[10px] text-gray-400 mt-1">This will initialize the client profile and generate login access.</p>
            </div>

            {formError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-600 text-[10px] font-bold p-3 rounded-xl">
                {formError}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Client Full Name</label>
              <input
                type="text"
                required
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. John Doe"
                className="bg-gray-50 border border-black/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brandGreen"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Email Address</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="bg-gray-50 border border-black/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brandGreen"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-gray-50 border border-black/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brandGreen"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Mobile Number</label>
              <input
                type="tel"
                value={newMobile}
                onChange={e => setNewMobile(e.target.value)}
                placeholder="e.g. +919876543210"
                className="bg-gray-50 border border-black/5 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brandGreen"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Plan Tier</label>
                <select
                  value={newPlan}
                  onChange={e => setNewPlan(e.target.value)}
                  className="bg-gray-50 border border-black/5 rounded-xl px-3 py-2 text-xs focus:outline-none"
                >
                  <option value="BASIC">BASIC (1k credits)</option>
                  <option value="PRO">PRO (3k credits)</option>
                  <option value="BUSINESS">BUSINESS (7.5k credits)</option>
                  <option value="None">None</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Validity Period</label>
                <select
                  value={newValidity}
                  onChange={e => setNewValidity(e.target.value)}
                  className="bg-gray-50 border border-black/5 rounded-xl px-3 py-2 text-xs focus:outline-none"
                >
                  <option value="1 Month">1 Month</option>
                  <option value="3 Months">3 Months</option>
                  <option value="6 Months">6 Months</option>
                  <option value="1 Year">1 Year</option>
                  <option value="Lifetime">Lifetime</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={creatingClient}
              className="bg-brandGreen hover:bg-brandGreen-dark text-white font-bold text-xs py-3 rounded-xl transition flex items-center justify-center gap-2 mt-2"
            >
              {creatingClient ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span>Register Account</span>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// Row component to track internal changes
function ClientRow({
  client,
  onSave,
  onDelete
}: {
  client: ClientUser;
  onSave: (id: string, plan: string, validity: string) => Promise<void>;
  onDelete: (id: string, email: string) => Promise<void>;
}) {
  const [selectedPlan, setSelectedPlan] = useState(client.planName || 'None');
  const [selectedValidity, setSelectedValidity] = useState(client.planValidity || 'Lifetime');
  const [saving, setSaving] = useState(false);

  const isChanged = selectedPlan !== (client.planName || 'None') || selectedValidity !== (client.planValidity || 'Lifetime');

  const handleSaveClick = async () => {
    setSaving(true);
    try {
      await onSave(client.id, selectedPlan, selectedValidity);
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="hover:bg-gray-50/50 transition">
      <td className="px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-brandGreen/5 flex items-center justify-center text-brandGreen font-bold uppercase text-[10px]">
            {(client.name || client.email).charAt(0)}
          </div>
          <div>
            <div className="font-bold text-brandGreen-dark">{client.name || 'Unnamed Client'}</div>
            <div className="text-[10px] text-gray-400 font-medium">{client.email}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 font-semibold text-gray-500">{client.mobileNumber || 'N/A'}</td>
      <td className="px-6 py-4">
        <select
          value={selectedPlan}
          onChange={e => setSelectedPlan(e.target.value)}
          className="bg-gray-50 border border-black/5 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-brandGreen"
        >
          <option value="BASIC">BASIC</option>
          <option value="PRO">PRO</option>
          <option value="BUSINESS">BUSINESS</option>
          <option value="None">None</option>
        </select>
      </td>
      <td className="px-6 py-4">
        <select
          value={selectedValidity}
          onChange={e => setSelectedValidity(e.target.value)}
          className="bg-gray-50 border border-black/5 rounded-lg px-2.5 py-1 text-xs outline-none focus:border-brandGreen"
        >
          <option value="1 Month">1 Month</option>
          <option value="3 Months">3 Months</option>
          <option value="6 Months">6 Months</option>
          <option value="1 Year">1 Year</option>
          <option value="Lifetime">Lifetime</option>
        </select>
      </td>
      <td className="px-6 py-4 font-semibold text-gray-500">
        {client.planExpiresAt ? new Date(client.planExpiresAt).toLocaleDateString() : 'Never'}
      </td>
      <td className="px-6 py-4 text-right">
        <div className="inline-flex items-center gap-3">
          {isChanged && (
            <button
              onClick={handleSaveClick}
              disabled={saving}
              className="text-emerald-500 hover:text-emerald-600 font-bold transition flex items-center gap-0.5 bg-emerald-50 px-2 py-1 rounded-lg"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              <span>Save</span>
            </button>
          )}
          <button
            onClick={() => onDelete(client.id, client.email)}
            className="text-red-400 hover:text-red-500 transition p-1 hover:bg-red-50 rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// Inline fallback icons
function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
