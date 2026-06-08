"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';
import { Mail, Lock, Play, Chrome, Loader2, Sparkles } from 'lucide-react';

export default function Login() {
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      await refreshProfile();
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');

    try {
      await signInWithPopup(auth, googleProvider);
      await refreshProfile();
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-[#FAFAF8]">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-black/5 shadow-xl shadow-brandGreen-dark/5 flex flex-col gap-6">
        <div className="text-center flex flex-col items-center gap-2">
          <Link href="/" className="flex items-center gap-2 text-2xl font-black tracking-wider text-brandGreen-dark">
            <img src="/logo.png" alt="RetailStacker AI Logo" className="w-6 h-6 object-contain" />
            <span>RetailStacker</span>
          </Link>
          <h2 className="text-xl font-bold text-brandGreen-dark mt-2">
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p className="text-xs text-gray-400">Launch premium AI marketing videos in minutes</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 text-xs p-3.5 rounded-xl">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="bg-gray-50 border border-black/5 rounded-xl w-full pl-10 pr-4 py-2.5 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen transition"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brandGreen-dark hover:bg-[#0E4A27] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition duration-200 flex items-center justify-center gap-2 mt-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (isRegister ? 'Register' : 'Sign In')}
          </button>
        </form>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-black/5 w-full"></div>
          <span className="absolute bg-white px-3 text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Or</span>
        </div>

        <button
          onClick={handleGoogleAuth}
          disabled={loading}
          className="w-full bg-white hover:bg-gray-50 border border-black/10 text-brandGreen-dark font-semibold py-2.5 rounded-xl transition duration-200 flex items-center justify-center gap-2"
        >
          <Chrome className="w-4 h-4" />
          <span>Continue with Google</span>
        </button>

        <p className="text-center text-xs text-gray-500">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => setIsRegister(!isRegister)}
            className="text-brandGreen font-bold hover:underline"
          >
            {isRegister ? 'Sign In' : 'Register'}
          </button>
        </p>
      </div>
    </div>
  );
}
