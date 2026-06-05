"use client";

import React, { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import { 
  Sparkles, 
  Play, 
  Volume2, 
  Send, 
  Loader2, 
  Video, 
  CreditCard, 
  AlertTriangle,
  History,
  CheckCircle,
  Pause,
  Search,
  Filter
} from 'lucide-react';

const fetcher = (url: string) => api.get(url).then((res) => res.data);

export default function Dashboard() {
  const { user, loading: authLoading, creditsBalance, refreshProfile } = useAuth();
  const router = useRouter();

  // HeyGen API dynamic assets
  const { data: avatarsRes, error: avatarsErr } = useSWR(user ? '/videos/avatars' : null, fetcher);
  const { data: voicesRes, error: voicesErr } = useSWR(user ? '/videos/voices' : null, fetcher);

  // Safely parse HeyGen responses
  const avatars = (() => {
    if (!avatarsRes) return [];
    if (Array.isArray(avatarsRes)) return avatarsRes;
    const d = avatarsRes.data;
    if (Array.isArray(d)) return d;
    if (d && Array.isArray(d.avatars)) return d.avatars;
    if (d && Array.isArray(d.looks)) return d.looks;
    return [];
  })();

  const voices = (() => {
    if (!voicesRes) return [];
    if (Array.isArray(voicesRes)) return voicesRes;
    const d = voicesRes.data;
    if (Array.isArray(d)) return d;
    if (d && Array.isArray(d.voices)) return d.voices;
    return [];
  })();

  const [selectedAvatarId, setSelectedAvatarId] = useState<string>('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [voicePreviewPlaying, setVoicePreviewPlaying] = useState<string | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);

  // Search/Filters
  const [avatarSearch, setAvatarSearch] = useState('');
  const [avatarGender, setAvatarGender] = useState('all');

  const [voiceSearch, setVoiceSearch] = useState('');
  const [voiceGender, setVoiceGender] = useState('all');
  const [voiceLanguage, setVoiceLanguage] = useState('all');

  const [script, setScript] = useState('');
  const [rendering, setRendering] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [error, setError] = useState('');

  // AI Scriptwriter States
  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [aiWriting, setAiWriting] = useState(false);
  const [showAiWriter, setShowAiWriter] = useState(false);

  useEffect(() => {
    if (avatars.length > 0 && !selectedAvatarId) {
      setSelectedAvatarId(avatars[0].id || avatars[0].avatar_id);
    }
  }, [avatars, selectedAvatarId]);

  useEffect(() => {
    if (voices.length > 0 && !selectedVoiceId) {
      setSelectedVoiceId(voices[0].voice_id);
    }
  }, [voices, selectedVoiceId]);

  useEffect(() => {
    return () => {
      if (voiceAudioRef.current) {
        voiceAudioRef.current.pause();
      }
    };
  }, []);

  const playVoicePreview = (voiceId: string, url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!url) return;

    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
    }

    if (voicePreviewPlaying === voiceId) {
      setVoicePreviewPlaying(null);
      voiceAudioRef.current = null;
    } else {
      setVoicePreviewPlaying(voiceId);
      const audio = new Audio(url);
      voiceAudioRef.current = audio;
      audio.play().catch(err => {
        console.error('Audio playback blocked:', err);
        setVoicePreviewPlaying(null);
      });
      audio.onended = () => {
        setVoicePreviewPlaying(null);
        voiceAudioRef.current = null;
      };
    }
  };

  const uniqueLanguages = Array.from(new Set(voices.map((v: any) => v.language))).filter(Boolean).sort();

  const filteredAvatars = avatars.filter((av: any) => {
    const targetId = av.id || av.avatar_id || '';
    const nameMatch = av.name?.toLowerCase().includes(avatarSearch.toLowerCase()) || targetId.toLowerCase().includes(avatarSearch.toLowerCase());
    const genderMatch = avatarGender === 'all' || av.gender?.toLowerCase() === avatarGender.toLowerCase();
    return nameMatch && genderMatch;
  });

  const filteredVoices = voices.filter((v: any) => {
    const nameMatch = v.name?.toLowerCase().includes(voiceSearch.toLowerCase()) || v.voice_id?.toLowerCase().includes(voiceSearch.toLowerCase());
    const genderMatch = voiceGender === 'all' || v.gender?.toLowerCase() === voiceGender.toLowerCase();
    const langMatch = voiceLanguage === 'all' || v.language === voiceLanguage;
    return nameMatch && genderMatch && langMatch;
  });

  const handleGenerateScript = async () => {
    if (!productName.trim() || !productDesc.trim()) return;
    setAiWriting(true);
    setError('');
    try {
      const activeVoice = voices.find((v: any) => v.voice_id === selectedVoiceId);
      const res = await api.post('/videos/generate-script', {
        productName,
        description: productDesc,
        targetAudience,
        language: activeVoice ? activeVoice.language : 'English',
      });
      setScript(res.data.script);
      setShowAiWriter(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to generate script.');
    } finally {
      setAiWriting(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading]);

  // Fetch past videos using SWR
  const { data: videoData, mutate } = useSWR(user ? '/videos' : null, fetcher, {
    refreshInterval: 5000, // poll status every 5 seconds
  });

  const videos = videoData?.videos || [];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!script.trim()) return;
    if (creditsBalance < 10) {
      setError('Insufficient credits. Please top up.');
      return;
    }

    setRendering(true);
    setError('');

    try {
      const activeVoice = voices.find((v: any) => v.voice_id === selectedVoiceId);
      await api.post('/videos/generate', {
        script,
        avatarId: selectedAvatarId,
        voiceId: selectedVoiceId,
        language: activeVoice ? activeVoice.language : 'English',
      });
      setScript('');
      mutate();
      await refreshProfile();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Video generation initiation failed.');
    } finally {
      setRendering(false);
    }
  };

  // Top up credits checkout flow
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleTopup = async (plan: 'BASIC' | 'PRO') => {
    setBillingLoading(true);
    setError('');

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay SDK failed to load.');
      }

      const res = await api.post('/payments/order', { plan });
      const { orderId, amount, currency, keyId } = res.data;

      const options = {
        key: keyId,
        amount,
        currency,
        name: 'Chitra AI Credits',
        description: `Purchase ${plan} package`,
        order_id: orderId,
        handler: async function (response: any) {
          try {
            await api.post('/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            alert('Top-up completed successfully!');
            await refreshProfile();
          } catch (verifyErr: any) {
            alert('Payment verification failed.');
          }
        },
        prefill: {
          email: user?.email || '',
        },
        theme: {
          color: '#0A3A1E',
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      setError(err.message || 'Billing initialization failed.');
    } finally {
      setBillingLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-brandGreen animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Columns: Editor Panel */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-xl shadow-brandGreen-dark/5 flex flex-col gap-6">
          <div>
            <h2 className="text-xl font-bold text-brandGreen-dark flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brandGreen" />
              <span>Studio Workshop</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">Configure your avatar and enter your script draft below.</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-600 text-xs p-3.5 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleGenerate} className="flex flex-col gap-6">
            {/* Avatar picker */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/5 pb-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">1. Select Presenter Model</span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search presenters..."
                      value={avatarSearch}
                      onChange={(e) => setAvatarSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-gray-50 border border-black/5 rounded-xl text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen max-w-[150px] sm:max-w-xs"
                    />
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                  <select
                    value={avatarGender}
                    onChange={(e) => setAvatarGender(e.target.value)}
                    className="px-2 py-1.5 bg-gray-50 border border-black/5 rounded-xl text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen"
                  >
                    <option value="all">All Genders</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>

              {avatarsErr && <div className="text-xs text-red-500 bg-red-50 p-3 rounded-xl">Failed to load presenter models from HeyGen.</div>}
              {!avatarsRes && !avatarsErr ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-6 justify-center bg-gray-50/50 rounded-2xl border border-dashed border-black/5">
                  <Loader2 className="w-4 h-4 animate-spin text-brandGreen" />
                  <span>Loading presenter avatars...</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-h-72 overflow-y-auto pr-1">
                  {filteredAvatars.length > 0 ? (
                    filteredAvatars.map((av: any) => {
                      const avId = av.id || av.avatar_id;
                      return (
                        <button
                          type="button"
                          key={avId}
                          onClick={() => setSelectedAvatarId(avId)}
                          className={`p-3 rounded-2xl border transition-all text-left flex flex-col items-center gap-2 relative overflow-hidden ${
                            selectedAvatarId === avId
                              ? 'border-brandGreen bg-brandGreen-light/20 shadow-md shadow-brandGreen/5'
                              : 'border-black/5 bg-gray-50/50 hover:bg-gray-50'
                          }`}
                        >
                          <div className="h-16 w-16 rounded-full overflow-hidden border border-black/5 bg-gray-100 flex items-center justify-center">
                            {av.preview_image_url ? (
                              <img src={av.preview_image_url} alt={av.name} className="h-full w-full object-cover" />
                            ) : (
                              <Video className="w-6 h-6 text-gray-300" />
                            )}
                          </div>
                          <div className="text-center w-full min-w-0">
                            <h4 className="font-bold text-xs text-brandGreen-dark truncate">{av.name || "Unnamed"}</h4>
                            <span className="text-[9px] text-gray-400 block mt-0.5 capitalize">{av.gender || "neutral"}</span>
                          </div>
                          {selectedAvatarId === avId && (
                            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brandGreen animate-pulse" />
                          )}
                        </button>
                      );
                    })
                  ) : (
                    <div className="col-span-full py-8 text-center text-xs text-gray-400">No presenter models match your search.</div>
                  )}
                </div>
              )}
            </div>

            {/* Language voice picker */}
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/5 pb-2">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">2. Regional Voice Output</span>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search voice presets..."
                      value={voiceSearch}
                      onChange={(e) => setVoiceSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-gray-50 border border-black/5 rounded-xl text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen max-w-[130px] sm:max-w-xs"
                    />
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                  <select
                    value={voiceLanguage}
                    onChange={(e) => setVoiceLanguage(e.target.value)}
                    className="px-2 py-1.5 bg-gray-50 border border-black/5 rounded-xl text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen max-w-[110px]"
                  >
                    <option value="all">All Languages</option>
                    {uniqueLanguages.map((lang: any) => (
                      <option key={lang} value={lang}>{lang}</option>
                    ))}
                  </select>
                  <select
                    value={voiceGender}
                    onChange={(e) => setVoiceGender(e.target.value)}
                    className="px-2 py-1.5 bg-gray-50 border border-black/5 rounded-xl text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen"
                  >
                    <option value="all">All Genders</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
              </div>

              {voicesErr && <div className="text-xs text-red-500 bg-red-50 p-3 rounded-xl">Failed to load voice presets from HeyGen.</div>}
              {!voicesRes && !voicesErr ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 py-6 justify-center bg-gray-50/50 rounded-2xl border border-dashed border-black/5">
                  <Loader2 className="w-4 h-4 animate-spin text-brandGreen" />
                  <span>Loading voice synthesizers...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                  {filteredVoices.length > 0 ? (
                    filteredVoices.map((v: any) => (
                      <button
                        type="button"
                        key={v.voice_id}
                        onClick={() => setSelectedVoiceId(v.voice_id)}
                        className={`p-3 rounded-xl border text-left flex items-center justify-between text-xs transition relative overflow-hidden ${
                          selectedVoiceId === v.voice_id
                            ? 'border-brandGreen bg-brandGreen-light/20 text-brandGreen-dark font-bold'
                            : 'border-black/5 text-gray-600 bg-gray-50/50 hover:bg-gray-50'
                        }`}
                      >
                        <div className="min-w-0 flex-grow pr-2">
                          <div className="font-bold text-brandGreen-dark flex items-center gap-1.5">
                            <span className="truncate">{v.name}</span>
                            <span className="text-[8px] font-semibold px-1.5 py-0.2 bg-black/5 text-gray-500 rounded-full capitalize flex-shrink-0">{v.gender}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 block mt-0.5 truncate">{v.language}</span>
                        </div>
                        {v.preview_audio_url && (
                          <button
                            type="button"
                            onClick={(e) => playVoicePreview(v.voice_id, v.preview_audio_url, e)}
                            className="p-1.5 rounded-full hover:bg-black/5 text-brandGreen transition flex-shrink-0"
                          >
                            {voicePreviewPlaying === v.voice_id ? (
                              <Pause className="w-3.5 h-3.5 fill-brandGreen animate-pulse" />
                            ) : (
                              <Volume2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="col-span-full py-8 text-center text-xs text-gray-400">No voice presets match your criteria.</div>
                  )}
                </div>
              )}
            </div>

            {/* Script input */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">3. Video Script</label>
                <button
                  type="button"
                  onClick={() => setShowAiWriter(!showAiWriter)}
                  className="text-xs font-bold text-brandGreen hover:underline flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  <span>{showAiWriter ? "Close AI Writer" : "Write script with AI"}</span>
                </button>
              </div>

              {showAiWriter && (
                <div className="bg-brandGreen-light/20 border border-brandGreen/10 rounded-2xl p-4 flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-brandGreen-dark flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-brandGreen" />
                    <span>AI Scriptwriter Assistant</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-gray-400">Product Name</span>
                      <input
                        type="text"
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        placeholder="e.g. Chitra AI"
                        className="bg-white border border-black/5 rounded-xl px-3 py-2 text-xs text-brandGreen-dark focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-gray-400">Target Audience</span>
                      <input
                        type="text"
                        value={targetAudience}
                        onChange={(e) => setTargetAudience(e.target.value)}
                        placeholder="e.g. D2C brands, creators"
                        className="bg-white border border-black/5 rounded-xl px-3 py-2 text-xs text-brandGreen-dark focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-gray-400">Key Offerings / Pain Points</span>
                    <input
                      type="text"
                      value={productDesc}
                      onChange={(e) => setProductDesc(e.target.value)}
                      placeholder="e.g. generating viral video ads in regional languages in minutes"
                      className="bg-white border border-black/5 rounded-xl px-3 py-2 text-xs text-brandGreen-dark focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateScript}
                    disabled={aiWriting || !productName.trim() || !productDesc.trim()}
                    className="w-full bg-brandGreen hover:bg-brandGreen-dark disabled:opacity-50 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    {aiWriting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Generate & Insert Script</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              <textarea
                required
                rows={5}
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Write your promo text here. AI will sync speech and burn captions automatically..."
                className="bg-gray-50 border border-black/5 rounded-2xl px-4 py-3.5 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen transition resize-none leading-relaxed"
              />
            </div>

            <button
              type="submit"
              disabled={rendering || !script.trim() || creditsBalance < 10}
              className="w-full bg-brandGreen-dark hover:bg-[#0E4A27] disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition duration-200 mt-2 flex items-center justify-center gap-2 text-sm shadow-lg shadow-brandGreen-dark/20"
            >
              {rendering ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Submitting render task...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Generate Video (Costs 10 credits)</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Right Column: Billing and Render History */}
      <div className="flex flex-col gap-6">
        {/* Credits topup box */}
        <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-xl shadow-brandGreen-dark/5 flex flex-col gap-4">
          <h3 className="font-bold text-sm text-brandGreen-dark flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-brandGreen" />
            <span>Top-up Workspace Credits</span>
          </h3>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <button
              onClick={() => handleTopup('BASIC')}
              disabled={billingLoading}
              className="p-3 border border-black/10 hover:border-brandGreen hover:bg-brandGreen-light/10 rounded-2xl flex flex-col gap-1 text-left transition disabled:opacity-50"
            >
              <span className="font-bold text-xs text-brandGreen-dark">₹1,999 Package</span>
              <span className="text-[10px] text-gray-400">1,000 credits</span>
            </button>
            <button
              onClick={() => handleTopup('PRO')}
              disabled={billingLoading}
              className="p-3 border border-brandGreen bg-brandGreen-light/20 hover:bg-brandGreen-light/30 rounded-2xl flex flex-col gap-1 text-left transition disabled:opacity-50"
            >
              <span className="font-bold text-xs text-brandGreen-dark">₹4,999 Package</span>
              <span className="text-[10px] text-brandGreen-dark">3,000 credits</span>
            </button>
          </div>
        </div>

        {/* History of renders */}
        <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-xl shadow-brandGreen-dark/5 flex-grow flex flex-col gap-5">
          <h3 className="font-bold text-sm text-brandGreen-dark flex items-center gap-1.5 border-b border-black/5 pb-3">
            <History className="w-4 h-4 text-brandGreen" />
            <span>Generated Videos</span>
          </h3>

          <div className="flex flex-col gap-4 overflow-y-auto max-h-[400px] pr-1">
            {videos.length > 0 ? (
              videos.map((vid: any) => (
                <div key={vid.id} className="border border-black/5 p-3 rounded-2xl flex gap-3 bg-gray-50/30">
                  <div className="w-20 aspect-video rounded-xl bg-brandGreen-dark/5 overflow-hidden flex-shrink-0 relative flex items-center justify-center border border-black/5">
                    {vid.thumbnailUrl ? (
                      <img src={vid.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                    ) : (
                      <Video className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-grow min-w-0 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">ID: #{vid.id.slice(0, 8)}</span>
                    <p className="text-[11px] font-medium text-brandGreen-dark truncate mt-0.5">{vid.script}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`text-[9px] font-bold uppercase ${
                        vid.status === 'COMPLETED'
                          ? 'text-emerald-500'
                          : vid.status === 'FAILED'
                          ? 'text-red-500'
                          : 'text-indigo-500'
                      }`}>
                        {vid.status}
                      </span>
                      {vid.status === 'COMPLETED' && vid.videoUrl && (
                        <a
                          href={vid.videoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[10px] font-bold text-brandGreen hover:underline flex items-center gap-1"
                        >
                          <Play className="w-2.5 h-2.5 fill-brandGreen" />
                          <span>Watch</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-gray-500">No generated videos found. Write a script to begin.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
