"use client";

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithCustomToken, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import Link from 'next/link';
import api from '../../lib/api';
import {
  Phone,
  User,
  Mail,
  Lock,
  Loader2,
  Chrome,
  ArrowLeft,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';

interface CountryOption {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
}

const COUNTRIES: CountryOption[] = [
  { code: 'IN', dialCode: '+91', flag: '🇮🇳', name: 'India' },
  { code: 'US', dialCode: '+1', flag: '🇺🇸', name: 'United States' },
  { code: 'CA', dialCode: '+1', flag: '🇨🇦', name: 'Canada' },
  { code: 'ID', dialCode: '+62', flag: '🇮🇩', name: 'Indonesia' },
  { code: 'GB', dialCode: '+44', flag: '🇬🇧', name: 'United Kingdom' },
  { code: 'AU', dialCode: '+61', flag: '🇦🇺', name: 'Australia' },
  { code: 'SG', dialCode: '+65', flag: '🇸🇬', name: 'Singapore' },
  { code: 'MY', dialCode: '+60', flag: '🇲🇾', name: 'Malaysia' },
  { code: 'AE', dialCode: '+971', flag: '🇦🇪', name: 'UAE' },
];

export default function Login() {
  const { refreshProfile } = useAuth();
  const router = useRouter();

  // Core Auth States
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  // Phone Binding flow state (for Google sign-in)
  const [isBindingPhone, setIsBindingPhone] = useState(false);
  const [sandboxOtp, setSandboxOtp] = useState('');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Country Selector
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(COUNTRIES[0]); // India by default
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  // OTP Verification Code (6 digits)
  const [otpDigits, setOtpDigits] = useState<string[]>(new Array(6).fill(''));
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Automatically reset states when switching between Login & Signup
  useEffect(() => {
    setError('');
    setOtpSent(false);
    setSandboxOtp('');
    setOtpDigits(new Array(6).fill(''));
    setPassword('');
    setConfirmPassword('');
    setIsBindingPhone(false);
  }, [isRegister]);

  // Combine selected country code and phone input
  const getFullMobileNumber = () => {
    // Trim spaces, dashes, leading zeroes from the user's input
    const cleanInput = phoneInput.replace(/[^\d]/g, '').replace(/^0+/, '');
    return `${selectedCountry.dialCode}${cleanInput}`;
  };

  // Handle individual OTP input changes
  const handleOtpChange = (value: string, index: number) => {
    if (isNaN(Number(value))) return; // Only allow numbers

    const newDigits = [...otpDigits];
    newDigits[index] = value.substring(value.length - 1); // Get last typed char
    setOtpDigits(newDigits);

    // Auto focus next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === 'Backspace') {
      if (!otpDigits[index] && index > 0) {
        // Focus previous input if current is empty and backspace pressed
        const newDigits = [...otpDigits];
        newDigits[index - 1] = '';
        setOtpDigits(newDigits);
        otpRefs.current[index - 1]?.focus();
      } else {
        const newDigits = [...otpDigits];
        newDigits[index] = '';
        setOtpDigits(newDigits);
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();
    if (pastedData.length === 6 && !isNaN(Number(pastedData))) {
      const digits = pastedData.split('');
      setOtpDigits(digits);
      otpRefs.current[5]?.focus();
    }
  };

  // Step 1: Submit Register Info or Login Request to get OTP
  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fullMobileNumber = getFullMobileNumber();
    if (!phoneInput.trim()) {
      setError('Please enter a valid mobile number.');
      setLoading(false);
      return;
    }

    try {
      if (isRegister) {
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password should be at least 6 characters long.');
          setLoading(false);
          return;
        }

        // Register request
        const res = await api.post('/auth/register-request', {
          name,
          email,
          mobileNumber: fullMobileNumber,
          password
        });
        if (res.data.debugOtp) {
          setSandboxOtp(res.data.debugOtp);
        }
        setOtpSent(true);
      } else {
        // Login request
        const res = await api.post('/auth/login-otp-request', {
          mobileNumber: fullMobileNumber
        });
        if (res.data.debugOtp) {
          setSandboxOtp(res.data.debugOtp);
        }
        setOtpSent(true);
      }
    } catch (err: any) {
      console.error('Auth request error:', err);
      setError(err.response?.data?.message || 'Authentication request failed. Please check details.');
    } finally {
      setLoading(false);
    }
  };

  // Google Login flow requiring binding mobile number
  const handleGoogleAuth = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await signInWithPopup(auth, googleProvider);
      
      // Call sync user endpoint to get status of user
      const syncRes = await api.post('/auth/sync');
      
      if (syncRes.data.mobileBound) {
        await refreshProfile();
        if (syncRes.data?.user?.role === 'ADMIN') {
          router.push('/admin');
        } else if (syncRes.data?.user?.role === 'RESELLER') {
          router.push('/reseller');
        } else {
          router.push('/dashboard');
        }
      } else {
        // Trigger Bind phone number page
        setIsBindingPhone(true);
        setOtpSent(false);
      }
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      setError(err.response?.data?.message || err.message || 'Google authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  // Submit phone number to bind (for Google Sign-in)
  const handleBindPhoneRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const fullMobileNumber = getFullMobileNumber();
    if (!phoneInput.trim()) {
      setError('Please enter a valid mobile number.');
      setLoading(false);
      return;
    }

    try {
      const res = await api.post('/auth/bind-phone-request', {
        mobileNumber: fullMobileNumber
      });
      if (res.data.debugOtp) {
        setSandboxOtp(res.data.debugOtp);
      }
      setOtpSent(true);
    } catch (err: any) {
      console.error('Phone binding request error:', err);
      setError(err.response?.data?.message || 'Failed to trigger verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Submit OTP to verify and bind (for Google Sign-in)
  const handleBindPhoneVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otpDigits.join('');
    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.post('/auth/bind-phone-verify', {
        otp: otpCode
      });
      await refreshProfile();
      if (res.data?.user?.role === 'ADMIN') {
        router.push('/admin');
      } else if (res.data?.user?.role === 'RESELLER') {
        router.push('/reseller');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('Phone binding verification error:', err);
      setError(err.response?.data?.message || 'Failed to verify OTP code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Submit OTP digits to complete verification (For normal signin/signup)
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otpDigits.join('');
    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setLoading(true);
    setError('');

    const fullMobileNumber = getFullMobileNumber();

    try {
      let customToken = '';
      if (isRegister) {
        const response = await api.post('/auth/register-verify', {
          mobileNumber: fullMobileNumber,
          otp: otpCode
        });
        customToken = response.data.customToken;
      } else {
        const response = await api.post('/auth/login-otp-verify', {
          mobileNumber: fullMobileNumber,
          otp: otpCode
        });
        customToken = response.data.customToken;
      }

      if (!customToken) {
        throw new Error('No authentication token received.');
      }

      // Authenticate with Firebase using Custom Token
      await signInWithCustomToken(auth, customToken);
      
      // Fetch sync data to inspect role
      const syncRes = await api.post('/auth/sync');
      await refreshProfile();

      if (syncRes.data?.user?.role === 'ADMIN') {
        router.push('/admin');
      } else if (syncRes.data?.user?.role === 'RESELLER') {
        router.push('/reseller');
      } else {
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('Verification error:', err);
      setError(err.response?.data?.message || err.message || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12 bg-[#FAFAF8]">
      <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-black/5 shadow-xl shadow-brandGreen-dark/5 flex flex-col gap-6 relative overflow-hidden">
        
        {/* Subtle Decorative Ambient Background Blur */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-brandGreen/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-brandGold/15 rounded-full blur-2xl pointer-events-none" />

        {/* Logo and Title header */}
        <div className="text-center flex flex-col items-center gap-2 relative z-10">
          <Link href="/" className="flex items-center gap-2 text-2xl font-black tracking-wider text-brandGreen-dark">
            <img src="/logo.png" alt="RetailStacker AI Logo" className="w-6 h-6 object-contain" />
            <span>RetailStacker</span>
          </Link>
          <h2 className="text-xl font-bold text-brandGreen-dark mt-2">
            {isBindingPhone 
              ? (otpSent ? 'Verify Phone Code' : 'Bind Phone Number')
              : isRegister
                ? (otpSent ? 'Verify Phone Number' : 'Create Account')
                : (otpSent ? 'Enter OTP Code' : 'Welcome Back')}
          </h2>
          <p className="text-xs text-gray-400">
            {otpSent
              ? `Verification code sent to ${getFullMobileNumber()}`
              : isBindingPhone
                ? 'Please verify your phone number to complete account setup'
                : 'Launch premium AI marketing videos in minutes'}
          </p>
        </div>

        {/* Error message box */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-600 text-xs p-3.5 rounded-xl transition duration-200">
            {error}
          </div>
        )}

        {/* Main Content Forms */}
        <div className="relative z-20">
          
          {/* FLOW A: BIND PHONE FLOW (GOOGLE AUTH AFTERMATH) */}
          {isBindingPhone ? (
            !otpSent ? (
              <form onSubmit={handleBindPhoneRequest} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 relative">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mobile Number</label>
                  <div className="flex gap-2">
                    {/* Country Code Dropdown Select */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                        className="bg-gray-50 border border-black/5 rounded-xl px-3 py-2.5 text-xs text-brandGreen-dark flex items-center gap-1.5 hover:bg-gray-100 transition"
                      >
                        <span className="text-sm">{selectedCountry.flag}</span>
                        <span className="font-semibold">{selectedCountry.dialCode}</span>
                        <ChevronDown className="w-3 h-3 text-gray-400" />
                      </button>

                      {showCountryDropdown && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-black/10 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                          {COUNTRIES.map((country) => (
                            <button
                              key={country.code}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(country);
                                setShowCountryDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 text-brandGreen-dark font-medium"
                            >
                              <span className="text-base">{country.flag}</span>
                              <span className="font-semibold">{country.dialCode}</span>
                              <span className="text-gray-400 text-[10px]">({country.name})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Phone Input Box */}
                    <div className="relative flex-1">
                      <input
                        type="tel"
                        required
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="Mobile number"
                        className="bg-gray-50 border border-black/5 rounded-xl w-full pl-10 pr-4 py-2.5 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen transition"
                      />
                      <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brandGreen-dark hover:bg-[#0E4A27] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition duration-200 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send Verification OTP'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleBindPhoneVerify} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 items-center w-full">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    6-Digit Verification Code
                  </label>

                  {sandboxOtp && (
                    <div className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs p-3.5 rounded-xl text-center mb-2 font-semibold">
                      [SANDBOX MODE] OTP verification code: <strong className="text-sm font-extrabold tracking-wider">{sandboxOtp}</strong>
                    </div>
                  )}
                  
                  <div className="flex gap-2 justify-between w-full max-w-xs" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { otpRefs.current[idx] = el; }}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(e.target.value, idx)}
                        onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                        className="w-10 h-12 text-center text-lg font-bold bg-gray-50 border border-black/10 rounded-xl focus:border-brandGreen focus:ring-1 focus:ring-brandGreen focus:outline-none transition"
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brandGreen-dark hover:bg-[#0E4A27] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition duration-200 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        Verify & Link Phone
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="w-full bg-transparent border border-black/5 hover:bg-gray-50 text-gray-600 text-xs font-semibold py-2 rounded-xl transition duration-200 flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Edit phone number
                  </button>
                </div>
              </form>
            )
          ) : (
            
            /* FLOW B: NORMAL REGISTRATION/LOGIN FLOW */
            !otpSent ? (
              /* PHASE 1: INPUT CREDENTIALS & PHONE NUMBER */
              <form onSubmit={handleSubmitRequest} className="flex flex-col gap-4">
                {isRegister && (
                  <>
                    {/* Full Name */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="John Doe"
                          className="bg-gray-50 border border-black/5 rounded-xl w-full pl-10 pr-4 py-2.5 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen transition"
                        />
                        <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>

                    {/* Email ID */}
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
                  </>
                )}

                {/* Mobile Number Input with Country Code Dropdown */}
                <div className="flex flex-col gap-1.5 relative">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Mobile Number</label>
                  <div className="flex gap-2">
                    {/* Country Code Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                        className="bg-gray-50 border border-black/5 rounded-xl px-3 py-2.5 text-xs text-brandGreen-dark flex items-center gap-1.5 hover:bg-gray-100 transition"
                      >
                        <span className="text-sm">{selectedCountry.flag}</span>
                        <span className="font-semibold">{selectedCountry.dialCode}</span>
                        <ChevronDown className="w-3 h-3 text-gray-400" />
                      </button>

                      {showCountryDropdown && (
                        <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-black/10 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                          {COUNTRIES.map((country) => (
                            <button
                              key={country.code}
                              type="button"
                              onClick={() => {
                                setSelectedCountry(country);
                                setShowCountryDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 text-brandGreen-dark font-medium"
                            >
                              <span className="text-base">{country.flag}</span>
                              <span className="font-semibold">{country.dialCode}</span>
                              <span className="text-gray-400 text-[10px]">({country.name})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Phone Input Box */}
                    <div className="relative flex-1">
                      <input
                        type="tel"
                        required
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder="Mobile number"
                        className="bg-gray-50 border border-black/5 rounded-xl w-full pl-10 pr-4 py-2.5 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen transition"
                      />
                      <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>

                {isRegister && (
                  <>
                    {/* Password */}
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

                    {/* Confirm Password */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Confirm Password</label>
                      <div className="relative">
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          className="bg-gray-50 border border-black/5 rounded-xl w-full pl-10 pr-4 py-2.5 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen transition"
                        />
                        <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>
                  </>
                )}

                {/* Submit Trigger */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brandGreen-dark hover:bg-[#0E4A27] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition duration-200 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    isRegister ? 'Next' : 'Send Verification OTP'
                  )}
                </button>
              </form>
            ) : (
              /* PHASE 2: VERIFY OTP */
              <form onSubmit={handleVerifyOtp} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2 items-center w-full">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    6-Digit Verification Code
                  </label>

                  {sandboxOtp && (
                    <div className="w-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 text-xs p-3.5 rounded-xl text-center mb-2 font-semibold">
                      [SANDBOX MODE] OTP verification code: <strong className="text-sm font-extrabold tracking-wider">{sandboxOtp}</strong>
                    </div>
                  )}
                  
                  {/* 6 Digit Input Boxes */}
                  <div className="flex gap-2 justify-between w-full max-w-xs" onPaste={handleOtpPaste}>
                    {otpDigits.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { otpRefs.current[idx] = el; }}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(e.target.value, idx)}
                        onKeyDown={(e) => handleOtpKeyDown(e, idx)}
                        className="w-10 h-12 text-center text-lg font-bold bg-gray-50 border border-black/10 rounded-xl focus:border-brandGreen focus:ring-1 focus:ring-brandGreen focus:outline-none transition"
                      />
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brandGreen-dark hover:bg-[#0E4A27] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition duration-200 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" />
                        Verify & Authenticate
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="w-full bg-transparent border border-black/5 hover:bg-gray-50 text-gray-600 text-xs font-semibold py-2 rounded-xl transition duration-200 flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Edit phone number
                  </button>
                </div>
              </form>
            )
          )}
        </div>

        {/* Divider and Alternative Google Login */}
        {!otpSent && !isBindingPhone && (
          <>
            <div className="relative flex items-center justify-center mt-2">
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
          </>
        )}

        {/* Switch Login / Sign Up link */}
        {!isBindingPhone && (
          <p className="text-center text-xs text-gray-500 mt-2">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={() => setIsRegister(!isRegister)}
              className="text-brandGreen font-bold hover:underline"
            >
              {isRegister ? 'Sign In' : 'Register'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
