"use client";

import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { Play, Sparkles, LogOut, ShieldCheck, User } from 'lucide-react';

export default function Navbar() {
  const { user, logout, creditsBalance } = useAuth();

  return (
    <nav className="sticky top-0 z-50 w-full bg-[#FAFAF8]/85 backdrop-blur border-b border-black/[0.06] px-6 py-4 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-wider text-brandGreen-dark">
        <img src="/logo.png" alt="Chitra AI Logo" className="w-6 h-6 object-contain" />
        <span>Chitra</span>
      </Link>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <div className="flex items-center gap-2 bg-brandGreen-light/40 border border-brandGreen/10 rounded-full px-3.5 py-1.5 text-xs font-semibold text-brandGreen-dark">
              <span>{creditsBalance} credits</span>
            </div>
            
            <Link
              href="/dashboard"
              className="bg-brandGreen-dark hover:bg-[#0E4A27] text-white px-4 py-1.5 rounded-full text-xs font-medium transition duration-200"
            >
              Workspace
            </Link>

            <button
              onClick={() => logout()}
              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg transition"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="bg-brandGreen-dark hover:bg-[#0E4A27] text-white px-5 py-2 rounded-full text-xs font-medium transition duration-200"
          >
            Get Started
          </Link>
        )}
      </div>
    </nav>
  );
}
