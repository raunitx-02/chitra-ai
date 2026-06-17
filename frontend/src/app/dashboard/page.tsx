"use client";

import React, { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import api from '../../lib/api';
import {
  Sparkles, Play, Volume2, Send, Loader2, Video, CreditCard,
  AlertTriangle, History, CheckCircle, Pause, Search, Sliders,
  X, Check, ChevronDown, LayoutGrid, List, Plus, Clock, Monitor,
  Smartphone, Square, Upload, Image, Palette, Mic, User, SlidersHorizontal,
  Paperclip, Wand2, ArrowRight, ExternalLink
} from 'lucide-react';

const fetcher = (url: string) => api.get(url).then((res) => res.data);

// ─── Avatar category heuristics ───────────────────────────────────────────────
const ANIMATED_KEYWORDS = ['cartoon', 'anime', 'animated', 'fox', 'cat', 'bear', 'rabbit', 'dog', 'animal', 'panda', 'lion', 'tiger', 'stylized', 'pixel', '3d'];
const PROFESSIONAL_KEYWORDS = ['suit', 'business', 'office', 'corporate', 'formal', 'professional', 'executive'];
const UGC_KEYWORDS = ['casual', 'creator', 'influencer', 'home', 'ugc', 'selfie', 'vlog'];
const LIFESTYLE_KEYWORDS = ['lifestyle', 'outdoor', 'sport', 'active', 'health', 'wellness', 'travel'];

function classifyAvatar(name: string, tags: string[] = []): string {
  const lower = (name + ' ' + tags.join(' ')).toLowerCase();
  if (ANIMATED_KEYWORDS.some(k => lower.includes(k))) return 'Animated';
  if (UGC_KEYWORDS.some(k => lower.includes(k))) return 'UGC';
  if (PROFESSIONAL_KEYWORDS.some(k => lower.includes(k))) return 'Professional';
  if (LIFESTYLE_KEYWORDS.some(k => lower.includes(k))) return 'Lifestyle';
  return 'Community';
}

function getCharacterKey(nameStr: string): string {
  if (!nameStr) return '';
  const parts = nameStr.trim().split(/\s+/);
  if (parts.length === 0) return '';
  const first = parts[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const salutations = ['dr', 'mr', 'mrs', 'ms', 'prof', 'doctor'];
  if (salutations.includes(first) && parts.length > 1) return (parts[0] + '_' + parts[1]).toLowerCase();
  return first;
}

// ─── Orientation config ────────────────────────────────────────────────────────
const ORIENTATIONS = [
  { value: 'portrait', label: '9:16 Portrait', icon: Smartphone },
  { value: 'landscape', label: '16:9 Landscape', icon: Monitor },
  { value: 'square', label: '1:1 Square', icon: Square },
];

const DURATIONS = [
  { value: 'auto', label: 'Auto' },
  { value: '15', label: '15s' },
  { value: '30', label: '30s' },
  { value: '60', label: '60s' },
];

const STYLE_CATEGORIES = ['All Styles', 'Retro Tech', 'Iconic Artist', 'Pop Culture', 'Print', 'Handmade', 'Cinematic'];
const AVATAR_TABS = ['Public Avatars', 'Recently Used', 'My Avatars'] as const;
const AVATAR_CATEGORIES = ['All', 'Professional', 'Lifestyle', 'UGC', 'Community', 'Animated', 'Favorites'] as const;

const ModalBackdrop = ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}
  >
    {children}
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user, loading: authLoading, creditsBalance, refreshProfile } = useAuth();
  const router = useRouter();

  // HeyGen API assets
  const { data: avatarsRes, error: avatarsErr } = useSWR(user ? '/videos/avatars' : null, fetcher);
  const { data: voicesRes, error: voicesErr } = useSWR(user ? '/videos/voices' : null, fetcher);
  const { data: stylesRes } = useSWR(user ? '/videos/styles' : null, fetcher);
  const { data: videoData, mutate } = useSWR(user ? '/videos' : null, fetcher, { refreshInterval: 5000 });

  const videos = videoData?.videos || [];

  // ── Parse raw API data ────────────────────────────────────────────────────
  const allAvatars = (() => {
    let rawList: any[] = [];
    if (avatarsRes) {
      if (Array.isArray(avatarsRes)) rawList = avatarsRes;
      else {
        const d = avatarsRes.data;
        if (Array.isArray(d)) rawList = d;
        else if (d && Array.isArray(d.avatars)) rawList = d.avatars;
        else if (d && Array.isArray(d.looks)) rawList = d.looks;
      }
    }
    return rawList.map(av => ({
      ...av,
      _category: classifyAvatar(av.name || av.avatar_name || '', av.tags || []),
    }));
  })();

  const avatars = (() => {
    const seenChars = new Set<string>();
    return allAvatars.filter((av: any) => {
      const avName = av.name || av.avatar_name || '';
      if (!avName) return false;
      const lowerName = avName.toLowerCase();
      if (lowerName.includes('side') || lowerName.includes('back')) return false;
      const charKey = getCharacterKey(avName);
      if (!charKey || seenChars.has(charKey)) return false;
      seenChars.add(charKey);
      return true;
    });
  })();

  const voices = (() => {
    let rawList: any[] = [];
    if (voicesRes) {
      if (Array.isArray(voicesRes)) rawList = voicesRes;
      else {
        const d = voicesRes.data;
        if (Array.isArray(d)) rawList = d;
        else if (d && Array.isArray(d.voices)) rawList = d.voices;
      }
    }
    const seen = new Set<string>();
    return rawList.filter((v: any) => {
      if (!v.voice_id || seen.has(v.voice_id)) return false;
      seen.add(v.voice_id);
      return true;
    });
  })();

  const styles = stylesRes?.styles || [];

  // ── Selection states ──────────────────────────────────────────────────────
  const [selectedAvatarId, setSelectedAvatarId] = useState('');
  const [hoveredAvatarId, setHoveredAvatarId] = useState<string | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState('');
  const [voicePreviewPlaying, setVoicePreviewPlaying] = useState<string | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<any>(null);

  // ── Basics bar ────────────────────────────────────────────────────────────
  const [duration, setDuration] = useState('auto');
  const [orientation, setOrientation] = useState('portrait');
  const [seedance, setSeedance] = useState(false);

  // ── Mode: avatar | product ────────────────────────────────────────────────
  const [mode, setMode] = useState<'avatar' | 'product'>('avatar');
  
  // ── Product Ad Upload & Analysis States ──────────────────────────────────
  const [productImageFile, setProductImageFile] = useState<File | null>(null);
  const [productImageBase64, setProductImageBase64] = useState('');
  const [productImageMime, setProductImageMime] = useState('image/jpeg');
  const [productImagePreview, setProductImagePreview] = useState('');
    const [productAnalysis, setProductAnalysis] = useState<any>(null);
  const [analysisSource, setAnalysisSource] = useState<string>('');
  const [analyzingProduct, setAnalyzingProduct] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data:image/jpeg;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const handleProductImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setProductImageFile(file);
    setProductImageMime(file.type);
    setProductAnalysis(null);
    setAnalysisError('');
    setAnalysisSource('');
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setProductImagePreview(previewUrl);
    
    // Convert to base64
    const b64 = await fileToBase64(file);
    setProductImageBase64(b64);
    
    // Auto-trigger analysis
    analyzeProductImage(b64, file.type);
  };

  const analyzeProductImage = async (base64: string, mime: string) => {
    setAnalyzingProduct(true);
    setAnalysisError('');
    setAnalysisSource('');
    try {
      const res = await api.post('/product/analyze', {
        imageBase64: base64,
        mimeType: mime,
      });
      const analysis = res.data.analysis;
      setProductAnalysis(analysis);
      setAnalysisSource(res.data.source || '');
      // Auto-populate script and visual prompt from AI
      setScript(analysis.adScript || '');
      setVisualPrompt(analysis.visualPrompt || '');
    } catch (err: any) {
      setAnalysisError(err.response?.data?.message || 'AI analysis failed. You can still write your own script.');
    } finally {
      setAnalyzingProduct(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleProductImageFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  // ── Script / prompts ──────────────────────────────────────────────────────
  const [script, setScript] = useState('');
  const [hookText, setHookText] = useState('');
  const [visualPrompt, setVisualPrompt] = useState('');
  const [instructions, setInstructions] = useState('');

  // ── Search / filter ───────────────────────────────────────────────────────
  const [avatarSearch, setAvatarSearch] = useState('');
  const [avatarCategory, setAvatarCategory] = useState<string>('All');
  const [avatarTab, setAvatarTab] = useState<typeof AVATAR_TABS[number]>('Public Avatars');
  const [avatarViewMode, setAvatarViewMode] = useState<'grid' | 'list'>('grid');
  const [voiceSearch, setVoiceSearch] = useState('');
  const [voiceGender, setVoiceGender] = useState('all');
  const [voiceLanguage, setVoiceLanguage] = useState('all');
  const [styleCategory, setStyleCategory] = useState('All Styles');
  const [avatarLimit, setAvatarLimit] = useState(24);
  const [voiceLimit, setVoiceLimit] = useState(24);

  // ── Modals ────────────────────────────────────────────────────────────────
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [showAiWriter, setShowAiWriter] = useState(false);
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [modalStage, setModalStage] = useState(0);

  // ── Loading / error ───────────────────────────────────────────────────────
  const [rendering, setRendering] = useState(false);
  const [creatifyRendering, setCreatifyRendering] = useState(false);
  const [creatifyConfigured, setCreatifyConfigured] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // ── AI Scriptwriter ───────────────────────────────────────────────────────
  const [productName, setProductName] = useState('');
  const [productDesc, setProductDesc] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [aiWriting, setAiWriting] = useState(false);

  // ── Derived data ──────────────────────────────────────────────────────────
  const selectedAvatarObj = allAvatars.find((av: any) => (av.id || av.avatar_id) === selectedAvatarId);
  const selectedCharKey = selectedAvatarObj ? getCharacterKey(selectedAvatarObj.name || selectedAvatarObj.avatar_name || '') : '';
  const availableLooks = allAvatars.filter((av: any) => {
    const avName = av.name || av.avatar_name || '';
    return getCharacterKey(avName) === selectedCharKey;
  });

  const uniqueLanguages = Array.from(new Set(voices.map((v: any) => v.language))).filter(Boolean).sort() as string[];

  const filteredAvatars = avatars.filter((av: any) => {
    const avName = av.name || av.avatar_name || '';
    const nameMatch = avName.toLowerCase().includes(avatarSearch.toLowerCase());
    const catMatch = avatarCategory === 'All' || av._category === avatarCategory;
    return nameMatch && catMatch;
  });

  const filteredVoices = voices.filter((v: any) => {
    const nameMatch = v.name?.toLowerCase().includes(voiceSearch.toLowerCase()) || v.voice_id?.toLowerCase().includes(voiceSearch.toLowerCase());
    const genderMatch = voiceGender === 'all' || v.gender?.toLowerCase() === voiceGender.toLowerCase();
    const langMatch = voiceLanguage === 'all' || v.language === voiceLanguage;
    return nameMatch && genderMatch && langMatch;
  });

  const filteredStyles = styles.filter((s: any) =>
    styleCategory === 'All Styles' || s.category === styleCategory
  );

  const visibleAvatars = filteredAvatars.slice(0, avatarLimit);
  const visibleVoices = filteredVoices.slice(0, voiceLimit);

  // ── Redirect unauthorized users ───────────────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading]);

  // ── Creatify avatars (check if API is configured) ────────────────────────
  useEffect(() => {
    if (!user) return;
    api.get('/product/creatify-avatars')
      .then(res => setCreatifyConfigured(res.data.configured === true))
      .catch(() => setCreatifyConfigured(false));
  }, [user]);

  // ── Generate product ad via Creatify ─────────────────────────────────────
  const handleGenerateProductAd = async () => {
    if (!productImageBase64) { setError('Please upload a product image first.'); return; }
    if (!script.trim()) { setError('Please enter an ad script.'); return; }
    if (creditsBalance < 20) { setError('Insufficient credits.'); return; }

    setCreatifyRendering(true); setError('');
    setShowProcessingModal(true); setModalStage(0);
    const stageInterval = setInterval(() => setModalStage(prev => (prev + 1) % modalStages.length), 3000);

    try {
      await api.post('/product/generate-ad', {
        imageBase64: productImageBase64,
        mimeType: productImageMime,
        script,
        duration: duration === 'auto' ? 30 : parseInt(duration),
        aspectRatio: orientation === 'portrait' ? '9:16' : orientation === 'landscape' ? '16:9' : '1:1',
        language: 'en',
        productName: productAnalysis?.productName,
        visualPrompt,
      });
      setScript(''); setVisualPrompt('');
      setProductImageFile(null); setProductImageBase64(''); setProductImagePreview(''); setProductAnalysis(null);
      mutate(); await refreshProfile();
      clearInterval(stageInterval);
      setModalStage(5);
      setTimeout(() => setShowProcessingModal(false), 3500);
    } catch (err: any) {
      clearInterval(stageInterval);
      setShowProcessingModal(false);
      const data = err.response?.data;
      if (data?.needsSetup) {
        setError('UGC video ad creation API is not configured on the server. Please contact support.');
      } else {
        setError(data?.message || 'Product ad generation failed.');
      }
    } finally {
      setCreatifyRendering(false);
    }
  };


  useEffect(() => {
    if (filteredAvatars.length > 0 && !selectedAvatarId) {
      setSelectedAvatarId(filteredAvatars[0].id || filteredAvatars[0].avatar_id);
    }
  }, [filteredAvatars.length]);

  useEffect(() => {
    if (filteredVoices.length > 0 && !selectedVoiceId) {
      setSelectedVoiceId(filteredVoices[0].voice_id);
    }
  }, [filteredVoices.length]);

  // Keep voice gender in sync with selected avatar ONLY when the avatar changes
  const lastSelectedAvatarIdRef = useRef('');
  useEffect(() => {
    if (!selectedAvatarId || voices.length === 0) return;
    if (selectedAvatarId === lastSelectedAvatarIdRef.current) return;
    lastSelectedAvatarIdRef.current = selectedAvatarId;

    const av = allAvatars.find((a: any) => (a.id || a.avatar_id) === selectedAvatarId);
    if (av) {
      const avatarGender = av.gender?.toLowerCase() || 'female';
      const currentVoice = voices.find((v: any) => v.voice_id === selectedVoiceId);
      if (!currentVoice || currentVoice.gender?.toLowerCase() !== avatarGender) {
        // Find the first voice of the matching gender
        const matchingVoice = voices.find((v: any) => v.gender?.toLowerCase() === avatarGender);
        if (matchingVoice) {
          setSelectedVoiceId(matchingVoice.voice_id);
        }
      }
    }
  }, [selectedAvatarId, voices]);


  useEffect(() => { setAvatarLimit(24); }, [avatarSearch, avatarCategory]);
  useEffect(() => { setVoiceLimit(24); }, [voiceSearch, voiceGender, voiceLanguage]);

  useEffect(() => {
    return () => { if (voiceAudioRef.current) voiceAudioRef.current.pause(); };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const playVoicePreview = (voiceId: string, url: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!url) return;
    if (voiceAudioRef.current) voiceAudioRef.current.pause();
    if (voicePreviewPlaying === voiceId) {
      setVoicePreviewPlaying(null);
      voiceAudioRef.current = null;
    } else {
      setVoicePreviewPlaying(voiceId);
      const audio = new Audio(url);
      voiceAudioRef.current = audio;
      audio.play().catch(() => setVoicePreviewPlaying(null));
      audio.onended = () => { setVoicePreviewPlaying(null); voiceAudioRef.current = null; };
    }
  };

  const handleGenerateScript = async () => {
    if (!productName.trim() || !productDesc.trim()) return;
    setAiWriting(true);
    setError('');
    try {
      const activeVoice = voices.find((v: any) => v.voice_id === selectedVoiceId);
      const res = await api.post('/videos/generate-script', {
        productName, description: productDesc, targetAudience,
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

  const modalStages = [
    { title: "Analyzing UGC script prompt...", description: "Structuring the copy and parsing emotional prompts" },
    { title: "Choosing character look & outfits...", description: "Selecting clothes and visual settings matching your selection" },
    { title: "Synthesizing voice presets...", description: "Generating regional voice waveforms and lip-sync markers" },
    { title: "Stitching media & rendering scenery...", description: "Combining background visual plates with custom AI assets" },
    { title: "Finalizing UGC video render...", description: "Polishing character lighting and completing the render pipeline" }
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveScript = script.trim();
    if (!effectiveScript) { setError('Please enter a script or description.'); return; }
    if (mode === 'avatar' && !selectedAvatarId) { setError('Please select an avatar.'); return; }
    if (mode === 'product' && !productImageBase64) { setError('Please upload a product image first.'); return; }
    if (creditsBalance < 10) { setError('Insufficient credits. Please top up.'); return; }

    setRendering(true); setError('');
    setShowProcessingModal(true); setModalStage(0);

    const stageInterval = setInterval(() => {
      setModalStage(prev => (prev + 1) % modalStages.length);
    }, 3000);

    try {
      const activeVoice = voices.find((v: any) => v.voice_id === selectedVoiceId);
      await api.post('/videos/generate', {
        script: effectiveScript,
        avatarId: selectedAvatarId || undefined,
        voiceId: selectedVoiceId || undefined,
        language: activeVoice ? activeVoice.language : 'English',
        visualPrompt,
        duration,
        orientation,
        style: selectedStyle?.id,
        mode,
        productImageBase64: mode === 'product' ? productImageBase64 : undefined,
        productImageMime: mode === 'product' ? productImageMime : undefined,
        hookText: hookText || undefined,
        productAnalysis: mode === 'product' ? productAnalysis : undefined,
      });
      setScript(''); setVisualPrompt(''); setHookText('');
      setProductImageFile(null); setProductImageBase64(''); setProductImagePreview(''); setProductAnalysis(null);
      mutate(); await refreshProfile();
      clearInterval(stageInterval);
      setModalStage(5);
      setTimeout(() => setShowProcessingModal(false), 3500);
    } catch (err: any) {
      clearInterval(stageInterval);
      setShowProcessingModal(false);
      setError(err.response?.data?.message || 'Video generation initiation failed.');
    } finally {
      setRendering(false);
    }
  };

  const handleShare = (videoId: string) => {
    const shareUrl = `${window.location.origin}/video/${videoId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedId(videoId);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => alert('Failed to copy link.'));
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl; link.download = filename;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch { window.open(url, '_blank'); }
  };

  const loadRazorpayScript = () => new Promise(resolve => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const handleTopup = async (plan: 'BASIC' | 'PRO') => {
    setBillingLoading(true); setError('');
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) throw new Error('Razorpay SDK failed to load.');
      const res = await api.post('/payments/order', { plan });
      const { orderId, amount, currency, keyId } = res.data;
      const options = {
        key: keyId, amount, currency,
        name: 'RetailStacker AI Credits',
        description: `Purchase ${plan} package`,
        order_id: orderId,
        handler: async (response: any) => {
          try {
            await api.post('/payments/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            alert('Top-up completed successfully!');
            await refreshProfile();
          } catch { alert('Payment verification failed.'); }
        },
        prefill: { email: user?.email || '' },
        theme: { color: '#0A3A1E' },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      setError(err.message || 'Billing initialization failed.');
    } finally { setBillingLoading(false); }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-brandGreen animate-spin" />
      </div>
    );
  }

  const OrientationIcon = ORIENTATIONS.find(o => o.value === orientation)?.icon || Smartphone;

  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">

      {/* ─── Left: Studio Panel ─────────────────────────────────────────────── */}
      <div className="lg:col-span-2 flex flex-col gap-5">
        <div className="bg-white border border-black/5 rounded-3xl shadow-xl shadow-brandGreen-dark/5 overflow-hidden">

          {/* Studio Header */}
          <div className="px-6 pt-6 pb-4 border-b border-black/5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-brandGreen-dark flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brandGreen" />
                <span>UGC Ad Studio</span>
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">Create avatar videos, product ads, and animated UGC content.</p>
            </div>
            {/* Mode toggle */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setMode('avatar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${mode === 'avatar' ? 'bg-white text-brandGreen-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <User className="w-3.5 h-3.5" /> Avatar
              </button>
              <button
                onClick={() => setMode('product')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${mode === 'product' ? 'bg-white text-brandGreen-dark shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <Image className="w-3.5 h-3.5" /> Product Ad
              </button>
            </div>
          </div>

          {/* ── Basics Bar ──────────────────────────────────────────────────── */}
          <div className="px-6 py-3 bg-gray-50/60 border-b border-black/5 flex flex-wrap items-center gap-3">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Basics</span>

            {/* Duration */}
            <div className="relative">
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="appearance-none pl-7 pr-6 py-1.5 bg-white border border-black/8 rounded-xl text-xs font-semibold text-brandGreen-dark focus:outline-none focus:border-brandGreen cursor-pointer shadow-sm"
              >
                {DURATIONS.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              <Clock className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Orientation */}
            <div className="relative">
              <select
                value={orientation}
                onChange={e => setOrientation(e.target.value)}
                className="appearance-none pl-7 pr-6 py-1.5 bg-white border border-black/8 rounded-xl text-xs font-semibold text-brandGreen-dark focus:outline-none focus:border-brandGreen cursor-pointer shadow-sm"
              >
                {ORIENTATIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <OrientationIcon className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Seedance toggle */}
            <button
              onClick={() => setSeedance(!seedance)}
              className={`flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-xl text-xs font-semibold border transition shadow-sm ${seedance ? 'bg-brandGreen/10 border-brandGreen/30 text-brandGreen-dark' : 'bg-white border-black/8 text-gray-500'}`}
            >
              Seedance
              <span className={`w-7 h-4 rounded-full transition-colors relative inline-block ${seedance ? 'bg-brandGreen' : 'bg-gray-200'}`}>
                <span className={`w-3 h-3 rounded-full bg-white shadow absolute top-0.5 transition-all ${seedance ? 'left-3.5' : 'left-0.5'}`} />
              </span>
            </button>

            {/* Style badge if selected */}
            {selectedStyle && (
              <button
                onClick={() => setShowStyleModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-xl text-xs font-semibold text-purple-700 hover:bg-purple-100 transition"
              >
                <Palette className="w-3.5 h-3.5" />
                {selectedStyle.name}
                <X className="w-3 h-3 opacity-60" onClick={e => { e.stopPropagation(); setSelectedStyle(null); }} />
              </button>
            )}
          </div>

          {error && (
            <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/30 text-red-600 text-xs p-3.5 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleGenerate} className="flex flex-col gap-0">

            {/* ── AVATAR MODE: Avatar picker ─────────────────────────────── */}
            {mode === 'avatar' && (
              <div className="px-6 pt-5 pb-4">
                {/* Selected avatar preview + change button */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-brandGreen" /> Avatar
                    {selectedAvatarObj && (
                      <span className="text-gray-300 font-normal">—</span>
                    )}
                    {selectedAvatarObj && (
                      <span className="text-brandGreen-dark normal-case font-semibold">
                        {(selectedAvatarObj.name || selectedAvatarObj.avatar_name || '').split(' ')[0]}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAvatarModal(true)}
                    className="text-xs font-bold text-brandGreen border border-brandGreen/30 bg-brandGreen/5 hover:bg-brandGreen/10 px-3 py-1.5 rounded-xl flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Change Avatar
                  </button>
                </div>

                {/* Selected avatar card */}
                {selectedAvatarObj ? (
                  <div className="flex items-center gap-4 bg-gray-50 border border-black/5 rounded-2xl p-3">
                    <div className="w-16 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 border border-black/5">
                      {selectedAvatarObj.preview_image_url ? (
                        <img src={selectedAvatarObj.preview_image_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><User className="w-6 h-6 text-gray-300" /></div>
                      )}
                    </div>
                    <div className="flex-grow min-w-0">
                      <h4 className="font-bold text-sm text-brandGreen-dark truncate">{selectedAvatarObj.name || selectedAvatarObj.avatar_name}</h4>
                      <span className="text-[10px] text-gray-400 capitalize block mt-0.5">{selectedAvatarObj.gender || 'neutral'} · {selectedAvatarObj._category}</span>
                      {availableLooks.length > 1 && (
                        <p className="text-[10px] text-brandGreen font-semibold mt-1">{availableLooks.length} looks available</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAvatarModal(true)}
                      className="p-2 rounded-xl bg-white border border-black/5 hover:bg-gray-50 text-gray-400 transition flex-shrink-0"
                      title="Change avatar"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAvatarModal(true)}
                    className="w-full h-24 border-2 border-dashed border-black/10 hover:border-brandGreen/40 rounded-2xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-brandGreen-dark transition bg-gray-50/50 hover:bg-brandGreen/5"
                  >
                    <User className="w-6 h-6" />
                    <span className="text-xs font-semibold">Select an Avatar</span>
                  </button>
                )}

                {/* Costume / look selector for selected character */}
                {availableLooks.length > 1 && (
                  <div className="flex flex-col gap-2 mt-3 bg-gray-50/50 border border-black/5 rounded-2xl p-3">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <Sliders className="w-3 h-3 text-brandGreen" /> Costume & Look
                    </span>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-[120px] overflow-y-auto pr-1">
                      {availableLooks.map((look: any) => {
                        const lookId = look.id || look.avatar_id;
                        const lookName = (look.name || look.avatar_name || 'Default Look')
                          .replace(new RegExp(`^${(selectedAvatarObj?.name || '').split(' ')[0]}`, 'i'), '').replace(/^(in\s+)/i, '').trim() || 'Default';
                        const isSelected = selectedAvatarId === lookId;
                        return (
                          <div
                            key={lookId}
                            role="button"
                            onClick={() => setSelectedAvatarId(lookId)}
                            className={`rounded-xl border p-1.5 flex flex-col items-center gap-1 cursor-pointer transition text-center ${isSelected ? 'border-brandGreen bg-brandGreen/5 ring-1 ring-brandGreen/20' : 'border-black/5 bg-white hover:bg-gray-50'}`}
                          >
                            <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-100">
                              {look.preview_image_url ? (
                                <img src={look.preview_image_url} alt={lookName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center"><User className="w-3 h-3 text-gray-300" /></div>
                              )}
                            </div>
                            <span className="text-[8px] font-semibold text-gray-500 truncate w-full">{lookName}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── PRODUCT MODE: AI Product Ad Creator ────────────────── */}
            {mode === 'product' && (
              <div className="px-6 pt-5 pb-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Image className="w-3.5 h-3.5 text-brandGreen" /> Product Image
                  </span>
                  {productImagePreview && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductImageFile(null);
                        setProductImageBase64('');
                        setProductImagePreview('');
                        setProductAnalysis(null);
                        setScript('');
                        setVisualPrompt('');
                      }}
                      className="text-xs text-red-400 hover:text-red-600 font-semibold flex items-center gap-1 transition"
                    >
                      <X className="w-3 h-3" /> Remove
                    </button>
                  )}
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleProductImageFile(f); }}
                />

                {!productImagePreview ? (
                  /* ── Drag & Drop Upload Zone ── */
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all ${
                      isDragging
                        ? 'border-brandGreen bg-brandGreen/5 scale-[1.01]'
                        : 'border-black/10 hover:border-brandGreen/50 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? 'bg-brandGreen/15' : 'bg-gray-100'}`}>
                      <Upload className={`w-7 h-7 transition-colors ${isDragging ? 'text-brandGreen' : 'text-gray-400'}`} />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-brandGreen-dark">Drop your product image here</p>
                      <p className="text-xs text-gray-400 mt-1">or click to browse · JPG, PNG, WEBP supported</p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 bg-gray-50 border border-black/5 rounded-xl px-4 py-2">
                      <Sparkles className="w-3.5 h-3.5 text-brandGreen" />
                      <span>AI will analyze your product and <strong className="text-brandGreen-dark">auto-generate your ad script</strong></span>
                    </div>
                  </div>
                ) : (
                  /* ── Image uploaded: Show preview + analysis ── */
                  <div className="flex flex-col gap-4">
                    
                    {/* Image preview + analysis side by side */}
                    <div className="flex gap-4">
                      {/* Product thumbnail */}
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="w-28 h-28 flex-shrink-0 rounded-2xl overflow-hidden border-2 border-black/5 bg-gray-100 cursor-pointer hover:opacity-80 transition relative group"
                      >
                        <img src={productImagePreview} alt="Product" className="w-full h-full object-contain p-2" />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center rounded-2xl">
                          <Upload className="w-5 h-5 text-white" />
                        </div>
                      </div>

                      {/* Analysis results or loading */}
                      <div className="flex-grow min-w-0">
                        {analyzingProduct ? (
                          <div className="flex flex-col gap-3 h-full justify-center">
                            <div className="flex items-center gap-2 text-sm font-semibold text-brandGreen-dark">
                              <Loader2 className="w-4 h-4 animate-spin text-brandGreen" />
                              <span>AI is analyzing your product...</span>
                            </div>
                            <div className="space-y-2">
                              <div className="h-3 bg-gray-100 rounded-full animate-pulse w-3/4" />
                              <div className="h-3 bg-gray-100 rounded-full animate-pulse w-1/2" />
                              <div className="h-3 bg-gray-100 rounded-full animate-pulse w-2/3" />
                            </div>
                            <p className="text-[10px] text-gray-400">Generating ad script, tagline and scene setup...</p>
                          </div>
                        ) : analysisError ? (
                          <div className="flex flex-col gap-2">
                            <div className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-xl p-3">{analysisError}</div>
                            <button
                              type="button"
                              onClick={() => analyzeProductImage(productImageBase64, productImageMime)}
                              className="text-xs font-bold text-brandGreen hover:underline flex items-center gap-1"
                            >
                              <Sparkles className="w-3 h-3" /> Retry AI Analysis
                            </button>
                          </div>
                        ) : productAnalysis ? (
                          <div className="flex flex-col gap-2">
                            {/* Product name + category */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-brandGreen-dark">{productAnalysis.productName}</h4>
                              <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-brandGreen/10 text-brandGreen-dark rounded-full">{productAnalysis.category}</span>
                            </div>
                            {/* Tagline */}
                            {productAnalysis.tagline && (
                              <p className="text-[11px] italic text-gray-500">"{productAnalysis.tagline}"</p>
                            )}
                            {/* Target audience */}
                            <p className="text-[10px] text-gray-400">
                              <span className="font-semibold text-gray-500">Audience:</span> {productAnalysis.targetAudience}
                            </p>
                            {/* Key features */}
                            {productAnalysis.keyFeatures && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {productAnalysis.keyFeatures.slice(0, 3).map((f: string, i: number) => (
                                  <span key={i} className="text-[9px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">{f}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {/* AI analysis success banner */}
                    {productAnalysis && !analyzingProduct && (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start gap-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5">
                          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-emerald-700">AI analysis complete!</p>
                            <p className="text-[10px] text-emerald-600 mt-0.5">Ad script and scene setup have been auto-filled below. You can edit them before generating.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => analyzeProductImage(productImageBase64, productImageMime)}
                            className="flex-shrink-0 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 underline"
                          >
                            Re-analyze
                          </button>
                        </div>

                        {analysisSource === 'heuristic' && (
                          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] p-3 rounded-2xl flex items-start gap-2 shadow-sm">
                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <span className="font-bold">Notice:</span> The AI vision models are currently not configured on this server, so a generic fallback script template was used. For high-quality, product-specific ads (e.g. shoes, beauty, watch, tech), please add your <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono">GEMINI_API_KEY</code> to the server's <code className="bg-amber-100/80 px-1 py-0.5 rounded font-mono">.env</code> file.
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}


            {/* Divider */}
            <div className="border-t border-black/5 mx-6" />

            {/* ── Script area ───────────────────────────────────────────── */}
            <div className="px-6 pt-5 pb-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-brandGreen" />
                  Script
                </label>
                <button
                  type="button"
                  onClick={() => setShowAiWriter(!showAiWriter)}
                  className="text-xs font-bold text-brandGreen hover:underline flex items-center gap-1"
                >
                  <Wand2 className="w-3.5 h-3.5 animate-pulse" />
                  <span>{showAiWriter ? 'Close Writer' : '✦ Script Writer'}</span>
                </button>
              </div>

              {showAiWriter && (
                <div className="bg-gradient-to-br from-brandGreen/5 to-emerald-50 border border-brandGreen/15 rounded-2xl p-4 flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-brandGreen-dark flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-brandGreen" /> AI Scriptwriter Assistant
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-gray-400">Product Name</span>
                      <input type="text" value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. RetailStacker AI" className="bg-white border border-black/5 rounded-xl px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-gray-400">Target Audience</span>
                      <input type="text" value={targetAudience} onChange={e => setTargetAudience(e.target.value)} placeholder="e.g. D2C brands, creators" className="bg-white border border-black/5 rounded-xl px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-gray-400">Key Offerings / Pain Points</span>
                    <input type="text" value={productDesc} onChange={e => setProductDesc(e.target.value)} placeholder="e.g. generating viral video ads in regional languages in minutes" className="bg-white border border-black/5 rounded-xl px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen" />
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateScript}
                    disabled={aiWriting || !productName.trim() || !productDesc.trim()}
                    className="w-full bg-brandGreen hover:bg-brandGreen-dark disabled:opacity-50 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                  >
                    {aiWriting ? (<><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Generating...</span></>) : (<><Sparkles className="w-3.5 h-3.5" /><span>Generate & Insert Script</span></>)}
                  </button>
                </div>
              )}

              {/* ── Hook/Top Banner Text ── */}
              <div className="flex flex-col gap-1.5 mt-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <span>✦ Hook / Top Banner Text (Optional)</span>
                </label>
                <input
                  type="text"
                  value={hookText}
                  onChange={e => setHookText(e.target.value)}
                  placeholder="e.g. PROFESSIONAL VIDEO AD IN 2 MINUTE"
                  className="bg-gray-50 border border-black/5 rounded-xl px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen transition placeholder:text-gray-300"
                />
              </div>

              <textarea
                required
                rows={4}
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder={mode === 'product' ? "Enter the ad copy / pitch to be narrated over your product animation..." : "Type your script or a prompt for me to generate one for you..."}
                className="bg-gray-50 border border-black/5 rounded-2xl px-4 py-3 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen transition resize-none leading-relaxed"
              />
            </div>

            {/* ── Bottom Action Pills ────────────────────────────────────── */}
            <div className="px-6 pb-4 flex flex-wrap gap-2">
              {(mode === 'avatar' || mode === 'product') && (
                <>
                  <button type="button" onClick={() => setShowAvatarModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-black/8 rounded-xl text-xs font-semibold text-gray-600 hover:border-brandGreen/40 hover:text-brandGreen-dark hover:bg-brandGreen/5 transition">
                    <Plus className="w-3.5 h-3.5" /> Avatar
                  </button>
                  <button type="button" onClick={() => setShowVoiceModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-black/8 rounded-xl text-xs font-semibold text-gray-600 hover:border-brandGreen/40 hover:text-brandGreen-dark hover:bg-brandGreen/5 transition">
                    <Plus className="w-3.5 h-3.5" /> Voice
                    {selectedVoiceId && (
                      <span className="bg-brandGreen/15 text-brandGreen-dark px-1.5 py-0.5 rounded-md text-[9px] font-bold">
                        {voices.find((v: any) => v.voice_id === selectedVoiceId)?.name?.split(' ')[0] || '✓'}
                      </span>
                    )}
                  </button>
                </>
              )}
              <button type="button" onClick={() => setShowStyleModal(true)}
                className={`flex items-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-semibold transition ${selectedStyle ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100' : 'bg-gray-50 border-black/8 text-gray-600 hover:border-brandGreen/40 hover:text-brandGreen-dark hover:bg-brandGreen/5'}`}>
                <Plus className="w-3.5 h-3.5" /> Style or Brand System
                {selectedStyle && <span className="text-[9px] font-bold">· {selectedStyle.name}</span>}
              </button>
              <button type="button" onClick={() => setShowInstructionsModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-black/8 rounded-xl text-xs font-semibold text-gray-600 hover:border-brandGreen/40 hover:text-brandGreen-dark hover:bg-brandGreen/5 transition">
                <Plus className="w-3.5 h-3.5" /> Instructions
                {instructions && <span className="w-2 h-2 rounded-full bg-brandGreen inline-block ml-0.5" />}
              </button>
              <button type="button" onClick={() => setShowAttachmentsModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 border border-black/8 rounded-xl text-xs font-semibold text-gray-600 hover:border-brandGreen/40 hover:text-brandGreen-dark hover:bg-brandGreen/5 transition">
                <Plus className="w-3.5 h-3.5" /> Attachments
              </button>
            </div>

            {/* ── Visual / Instructions area (expanded from pills) ───────── */}
            {(visualPrompt || instructions) && (
              <div className="px-6 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                {visualPrompt !== undefined && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <Video className="w-3 h-3 text-brandGreen" /> Visual Scene
                    </label>
                    <textarea rows={2} value={visualPrompt} onChange={e => setVisualPrompt(e.target.value)} placeholder="Cozy home background, smiling face..." className="bg-gray-50 border border-black/5 rounded-xl px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen resize-none" />
                  </div>
                )}
                {instructions !== undefined && instructions && (
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Extra Instructions</label>
                    <textarea rows={2} value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="e.g. speak slowly, emphasize the discount..." className="bg-gray-50 border border-black/5 rounded-xl px-3 py-2 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen resize-none" />
                  </div>
                )}
              </div>
            )}


            {/* ── Submit Button ─────────────────────────────────────────── */}
            <div className="px-6 pb-6 flex flex-col gap-3">

              {/* Product Ad mode — single optimized generation button */}
              {mode === 'product' && productImageBase64 && (
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (creatifyConfigured) {
                        await handleGenerateProductAd();
                      } else {
                        await handleGenerate(e);
                      }
                    }}
                    disabled={creatifyRendering || rendering || !script.trim() || creditsBalance < 20}
                    className="w-full bg-brandGreen-dark hover:bg-[#0E4A27] disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition duration-200 flex items-center justify-center gap-2 text-sm shadow-lg shadow-brandGreen-dark/20"
                  >
                    {creatifyRendering || rendering ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /><span>Creating your product ad...</span></>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Create Product Ad</span>
                      </>
                    )}
                  </button>
                  <p className="text-[10px] text-center text-gray-400">
                    {creatifyConfigured
                      ? '✨ Avatar interacts with your product in a 3D-like setting'
                      : '✨ Avatar presents your product using the image as background'}
                  </p>
                </div>
              )}

              {/* Standard avatar mode — normal generate button */}
              {(mode === 'avatar' || !productImageBase64) && (
                <button
                  type="submit"
                  disabled={rendering || !script.trim() || creditsBalance < 10}
                  className="w-full bg-brandGreen-dark hover:bg-[#0E4A27] disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl transition duration-200 flex items-center justify-center gap-2 text-sm shadow-lg shadow-brandGreen-dark/20"
                >
                  {rendering ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /><span>Submitting render task...</span></>
                  ) : (
                    <><Send className="w-4 h-4" /><span>Generate Video (Costs 20 credits)</span></>
                  )}
                </button>
              )}
            </div>

          </form>
        </div>
      </div>

      {/* ─── Right: Sidebar ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6">
        {/* Credits topup */}
        <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-xl shadow-brandGreen-dark/5 flex flex-col gap-4">
          <h3 className="font-bold text-sm text-brandGreen-dark flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-brandGreen" />
            <span>Top-up Credits</span>
          </h3>
          <div className="grid grid-cols-2 gap-3 mt-1">
            <button onClick={() => handleTopup('BASIC')} disabled={billingLoading} className="p-3 border border-black/10 hover:border-brandGreen hover:bg-brandGreen-light/10 rounded-2xl flex flex-col gap-1 text-left transition disabled:opacity-50">
              <span className="font-bold text-xs text-brandGreen-dark">₹1,999 Package</span>
              <span className="text-[10px] text-gray-400">1,000 credits</span>
            </button>
            <button onClick={() => handleTopup('PRO')} disabled={billingLoading} className="p-3 border border-brandGreen bg-brandGreen-light/20 hover:bg-brandGreen-light/30 rounded-2xl flex flex-col gap-1 text-left transition disabled:opacity-50">
              <span className="font-bold text-xs text-brandGreen-dark">₹4,999 Package</span>
              <span className="text-[10px] text-brandGreen-dark">3,000 credits</span>
            </button>
          </div>
        </div>

        {/* Video history */}
        <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-xl shadow-brandGreen-dark/5 flex-grow flex flex-col gap-5">
          <h3 className="font-bold text-sm text-brandGreen-dark flex items-center gap-1.5 border-b border-black/5 pb-3">
            <History className="w-4 h-4 text-brandGreen" />
            <span>Generated Videos</span>
          </h3>
          <div className="flex flex-col gap-4 overflow-y-auto max-h-[500px] pr-1">
            {videos.length > 0 ? (
              videos.map((vid: any) => (
                <div key={vid.id} className="border border-black/5 p-3 rounded-2xl flex gap-3 bg-gray-50/30">
                  <div className="w-16 aspect-video rounded-xl bg-brandGreen-dark/5 overflow-hidden flex-shrink-0 border border-black/5 flex items-center justify-center">
                    {vid.thumbnailUrl ? (
                      <img src={vid.thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                    ) : (
                      <Video className="w-5 h-5 text-gray-300" />
                    )}
                  </div>
                  <div className="flex-grow min-w-0 flex flex-col justify-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase">#{vid.id.slice(0, 8)}</span>
                    <p className="text-[11px] font-medium text-brandGreen-dark truncate mt-0.5">{vid.script}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className={`text-[9px] font-bold uppercase ${vid.status === 'COMPLETED' ? 'text-emerald-500' : vid.status === 'FAILED' ? 'text-red-500' : 'text-indigo-500'}`}>
                        {vid.status}
                      </span>
                    </div>
                    {vid.status === 'COMPLETED' && vid.videoUrl && (
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <a href={vid.videoUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-brandGreen hover:bg-brandGreen/10 transition flex items-center gap-1 bg-brandGreen/5 px-2.5 py-1 rounded-lg">
                          <Play className="w-2.5 h-2.5 fill-brandGreen" /> Watch
                        </a>
                        <button type="button" onClick={() => handleDownload(vid.videoUrl, `ugc_ad_${vid.id.slice(0, 8)}.mp4`)} className="text-[10px] font-bold text-brandGreen hover:bg-brandGreen/10 transition flex items-center gap-1 bg-brandGreen/5 px-2.5 py-1 rounded-lg">
                          Download
                        </button>
                        <button type="button" onClick={() => handleShare(vid.id)} className="text-[10px] font-bold text-brandGreen hover:bg-brandGreen/10 transition flex items-center gap-1 bg-brandGreen/5 px-2.5 py-1 rounded-lg">
                          {copiedId === vid.id ? 'Copied!' : 'Share'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-gray-500">No generated videos found. Write a script to begin.</div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Avatar Picker
      ═══════════════════════════════════════════════════════════════════════ */}
      {showAvatarModal && (
        <ModalBackdrop onClose={() => setShowAvatarModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl border border-black/5 overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-black/5 flex items-start justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-brandGreen-dark">Select Avatar</h3>
                <p className="text-xs text-gray-400 mt-0.5">Select from our newest and best-quality Avatar models</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowAvatarModal(false)} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-black/5 flex-shrink-0 px-6">
              {AVATAR_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setAvatarTab(tab)}
                  className={`px-4 py-3 text-sm font-semibold border-b-2 transition ${avatarTab === tab ? 'border-brandGreen text-brandGreen-dark' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
                >
                  {tab}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2 py-2">
                <button onClick={() => setAvatarViewMode('grid')} className={`p-1.5 rounded-lg transition ${avatarViewMode === 'grid' ? 'bg-gray-100 text-brandGreen-dark' : 'text-gray-400 hover:text-gray-600'}`}>
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button onClick={() => setAvatarViewMode('list')} className={`p-1.5 rounded-lg transition ${avatarViewMode === 'list' ? 'bg-gray-100 text-brandGreen-dark' : 'text-gray-400 hover:text-gray-600'}`}>
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search + filter row */}
            <div className="px-6 py-3 border-b border-black/5 flex items-center gap-3 flex-shrink-0">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search"
                  value={avatarSearch}
                  onChange={e => setAvatarSearch(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-gray-50 border border-black/5 rounded-xl w-full text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen"
                />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
              <button className="p-2 rounded-xl border border-black/5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition">
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>

            {/* Category pills */}
            <div className="px-6 py-3 flex gap-2 flex-wrap border-b border-black/5 flex-shrink-0">
              {AVATAR_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setAvatarCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition border ${avatarCategory === cat ? 'bg-brandGreen-dark text-white border-brandGreen-dark' : 'bg-gray-50 text-gray-600 border-black/8 hover:border-brandGreen/30 hover:text-brandGreen-dark'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Avatar grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {!avatarsRes && !avatarsErr ? (
                <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin text-brandGreen" />
                  <span className="text-sm">Loading avatars...</span>
                </div>
              ) : avatarsErr ? (
                <div className="text-center py-16 text-red-500 text-sm">Failed to load avatars. Please try again.</div>
              ) : avatarTab === 'My Avatars' ? (
                <div className="text-center py-16 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <User className="w-8 h-8 text-gray-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-600">No custom avatars yet</p>
                    <p className="text-xs text-gray-400 mt-1">Please contact support to record and create your own custom avatar.</p>
                  </div>
                </div>
              ) : (
                <div className={avatarViewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 gap-4' : 'flex flex-col gap-3'}>
                  {visibleAvatars.length > 0 ? visibleAvatars.map((av: any) => {
                    const avId = av.id || av.avatar_id;
                    const avName = av.name || av.avatar_name || 'Unnamed';
                    const isSelected = selectedAvatarId === avId || selectedCharKey === getCharacterKey(avName);

                    if (avatarViewMode === 'list') {
                      return (
                        <div
                          key={avId}
                          role="button"
                          onClick={() => { setSelectedAvatarId(avId); setShowAvatarModal(false); }}
                          className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition ${isSelected ? 'border-brandGreen bg-brandGreen/5 ring-1 ring-brandGreen/20' : 'border-black/5 hover:bg-gray-50'}`}
                        >
                          <div className="w-12 h-14 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                            {av.preview_image_url ? (
                              <img src={av.preview_image_url} alt={avName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><User className="w-4 h-4 text-gray-300" /></div>
                            )}
                          </div>
                          <div className="flex-grow min-w-0">
                            <h4 className="font-bold text-sm text-brandGreen-dark truncate">{avName}</h4>
                            <span className="text-[10px] text-gray-400 capitalize">{av.gender || 'neutral'} · {av._category}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-brandGreen flex-shrink-0" />}
                        </div>
                      );
                    }

                    // Group view (like HeyGen) — show multiple looks per character
                    const charLooks = allAvatars.filter((a: any) => getCharacterKey(a.name || a.avatar_name || '') === getCharacterKey(avName));
                    return (
                      <div
                        key={avId}
                        role="button"
                        onClick={() => { setSelectedAvatarId(avId); setShowAvatarModal(false); }}
                        className={`rounded-2xl border cursor-pointer transition overflow-hidden ${isSelected ? 'border-brandGreen ring-2 ring-brandGreen/20' : 'border-black/5 hover:border-gray-200'}`}
                      >
                        {/* Multi-image mosaic like HeyGen */}
                        <div className={`grid gap-0.5 bg-gray-100 ${charLooks.length >= 2 ? 'grid-cols-2' : 'grid-cols-1'}`} style={{ height: '140px' }}>
                          {charLooks.slice(0, charLooks.length >= 4 ? 4 : charLooks.length >= 2 ? 2 : 1).map((look: any, i: number) => (
                            <div key={look.id || look.avatar_id} className={`overflow-hidden ${charLooks.length >= 4 && i === 0 ? 'row-span-2' : ''}`}>
                              {look.preview_image_url ? (
                                <img
                                  src={look.preview_image_url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                  onMouseEnter={() => setHoveredAvatarId(avId)}
                                  onMouseLeave={() => setHoveredAvatarId(null)}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                                  <User className="w-6 h-6 text-gray-300" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="p-2.5 bg-white flex items-center justify-between">
                          <div>
                            <h4 className="font-bold text-xs text-brandGreen-dark truncate">{avName.split(' ')[0]}</h4>
                            <span className="text-[9px] text-gray-400 capitalize">{av._category}</span>
                          </div>
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-brandGreen flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }) : (
                    <div className="col-span-3 text-center py-12 text-xs text-gray-400">No avatars match your search.</div>
                  )}
                  {filteredAvatars.length > avatarLimit && (
                    <div
                      role="button"
                      onClick={() => setAvatarLimit(prev => prev + 24)}
                      className="col-span-3 py-2.5 bg-gray-50 border border-dashed border-black/10 hover:bg-gray-100 rounded-xl text-xs font-bold text-brandGreen-dark text-center transition cursor-pointer"
                    >
                      Load More (+{filteredAvatars.length - avatarLimit} more)
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Voice Picker
      ═══════════════════════════════════════════════════════════════════════ */}
      {showVoiceModal && (
        <ModalBackdrop onClose={() => setShowVoiceModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-xl max-h-[85vh] flex flex-col shadow-2xl border border-black/5 overflow-hidden">
            <div className="p-6 border-b border-black/5 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold text-brandGreen-dark">Choose a Voice</h3>
                <p className="text-xs text-gray-400 mt-0.5">Select the voice that best fits your UGC ad</p>
              </div>
              <button onClick={() => setShowVoiceModal(false)} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-3 flex flex-wrap gap-2 border-b border-black/5 flex-shrink-0">
              <div className="relative flex-1 min-w-[150px]">
                <input type="text" placeholder="Search voices..." value={voiceSearch} onChange={e => setVoiceSearch(e.target.value)} className="pl-9 pr-4 py-2 bg-gray-50 border border-black/5 rounded-xl w-full text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen" />
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
              <select value={voiceLanguage} onChange={e => setVoiceLanguage(e.target.value)} className="px-3 py-2 bg-gray-50 border border-black/5 rounded-xl text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen">
                <option value="all">All Languages</option>
                {uniqueLanguages.map(lang => <option key={lang} value={lang}>{lang}</option>)}
              </select>
              <select value={voiceGender} onChange={e => setVoiceGender(e.target.value)} className="px-3 py-2 bg-gray-50 border border-black/5 rounded-xl text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen">
                <option value="all">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {!voicesRes && !voicesErr ? (
                <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin text-brandGreen" />
                  <span className="text-sm">Loading voices...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {visibleVoices.length > 0 ? visibleVoices.map((v: any) => {
                    const audioUrl = v.preview_audio || v.preview_audio_url;
                    const isSelected = selectedVoiceId === v.voice_id;
                    return (
                      <div
                        key={v.voice_id}
                        role="button"
                        onClick={() => { setSelectedVoiceId(v.voice_id); setShowVoiceModal(false); }}
                        className={`p-4 rounded-2xl border cursor-pointer transition flex items-center justify-between ${isSelected ? 'border-brandGreen bg-brandGreen/5 ring-1 ring-brandGreen/20' : 'border-black/5 hover:bg-gray-50'}`}
                      >
                        <div className="min-w-0 flex-grow pr-3">
                          <div className="font-bold text-sm text-brandGreen-dark flex items-center gap-1.5 flex-wrap">
                            <span className="truncate">{v.name}</span>
                            <span className="text-[9px] font-semibold px-2 py-0.5 bg-black/5 text-gray-500 rounded-full capitalize flex-shrink-0">{v.gender}</span>
                          </div>
                          <span className="text-[10px] text-gray-400 block mt-0.5">{v.language}</span>
                        </div>
                        {audioUrl && (
                          <button type="button" onClick={e => playVoicePreview(v.voice_id, audioUrl, e)} className="p-2 rounded-full hover:bg-black/5 text-brandGreen transition flex-shrink-0">
                            {voicePreviewPlaying === v.voice_id ? <Pause className="w-4 h-4 fill-brandGreen animate-pulse" /> : <Volume2 className="w-4 h-4" />}
                          </button>
                        )}
                        {isSelected && <Check className="w-4 h-4 text-brandGreen flex-shrink-0 ml-2" />}
                      </div>
                    );
                  }) : (
                    <div className="text-center py-8 text-xs text-gray-400">No voices match your criteria.</div>
                  )}
                  {filteredVoices.length > voiceLimit && (
                    <button type="button" onClick={() => setVoiceLimit(p => p + 24)} className="py-2 bg-gray-50 border border-dashed border-black/10 hover:bg-gray-100 rounded-xl text-xs font-bold text-brandGreen-dark text-center transition">
                      Load More Voices (+{filteredVoices.length - voiceLimit} more)
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Style Picker
      ═══════════════════════════════════════════════════════════════════════ */}
      {showStyleModal && (
        <ModalBackdrop onClose={() => setShowStyleModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-black/5 overflow-hidden">
            <div className="p-6 border-b border-black/5 flex items-center justify-between flex-shrink-0">
              <h3 className="text-lg font-bold text-brandGreen-dark">Choose a Style or Brand System</h3>
              <button onClick={() => setShowStyleModal(false)} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Style / Brand System tab */}
            <div className="flex px-6 pt-4 gap-1 flex-shrink-0">
              <button className="flex-1 py-2 rounded-xl text-xs font-bold text-brandGreen-dark bg-brandGreen/10 border border-brandGreen/20 text-center">Style</button>
              <button className="flex-1 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-50 border border-transparent text-center transition">Brand System</button>
            </div>

            {/* Category pills */}
            <div className="px-6 py-3 flex gap-2 flex-wrap flex-shrink-0">
              {STYLE_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setStyleCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition border ${styleCategory === cat ? 'bg-brandGreen-dark text-white border-brandGreen-dark' : 'bg-gray-50 text-gray-600 border-black/8 hover:border-brandGreen/30 hover:text-brandGreen-dark'}`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Style grid */}
            <div className="flex-1 overflow-y-auto p-6">
              {filteredStyles.length === 0 ? (
                <div className="text-center py-12 text-xs text-gray-400">No styles available yet.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {filteredStyles.map((s: any) => {
                    const isSelected = selectedStyle?.id === s.id;
                    return (
                      <div
                        key={s.id}
                        role="button"
                        onClick={() => { setSelectedStyle(isSelected ? null : s); setShowStyleModal(false); }}
                        className={`rounded-2xl border cursor-pointer transition overflow-hidden group ${isSelected ? 'border-brandGreen ring-2 ring-brandGreen/20' : 'border-black/5 hover:border-gray-200'}`}
                      >
                        <div className="aspect-video bg-gray-100 overflow-hidden relative">
                          <img
                            src={s.preview}
                            alt={s.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-brandGreen/20 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full bg-brandGreen flex items-center justify-center">
                                <Check className="w-4 h-4 text-white" />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="p-2.5 bg-white">
                          <h4 className="font-bold text-xs text-brandGreen-dark truncate">{s.name}</h4>
                          <span className="text-[9px] text-gray-400">{s.category}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Instructions
      ═══════════════════════════════════════════════════════════════════════ */}
      {showInstructionsModal && (
        <ModalBackdrop onClose={() => setShowInstructionsModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-black/5 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-brandGreen-dark">Extra Instructions</h3>
              <button onClick={() => setShowInstructionsModal(false)} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-400">Add scene directions, tone guidance, or visual cues for the AI.</p>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Visual Scene / Background</label>
              <textarea
                rows={3}
                value={visualPrompt}
                onChange={e => setVisualPrompt(e.target.value)}
                placeholder="e.g. Cozy home background, smiling face expressions, wearing casual pink suit jacket"
                className="bg-gray-50 border border-black/5 rounded-2xl px-4 py-3 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen resize-none"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Tone & Delivery Notes</label>
              <textarea
                rows={3}
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder="e.g. speak slowly and clearly, emphasize the discount, be energetic and friendly"
                className="bg-gray-50 border border-black/5 rounded-2xl px-4 py-3 text-xs text-brandGreen-dark focus:outline-none focus:border-brandGreen resize-none"
              />
            </div>
            <button onClick={() => setShowInstructionsModal(false)} className="bg-brandGreen-dark hover:bg-[#0E4A27] text-white font-bold py-2.5 rounded-xl text-xs transition">
              Save Instructions
            </button>
          </div>
        </ModalBackdrop>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: Attachments (Product Ad)
      ═══════════════════════════════════════════════════════════════════════ */}
      {showAttachmentsModal && (
        <ModalBackdrop onClose={() => setShowAttachmentsModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-black/5 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-brandGreen-dark">Attachments</h3>
              <button onClick={() => setShowAttachmentsModal(false)} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-400">Upload your product image to create an AI-powered animated product ad.</p>
            
            {/* Hidden file input for attachments modal */}
            <input
              type="file"
              accept="image/*"
              id="attachments-file-input"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) {
                  handleProductImageFile(f);
                  setMode('product');
                  setShowAttachmentsModal(false);
                }
              }}
            />

            {productImagePreview ? (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
                <img src={productImagePreview} alt="Preview" className="w-14 h-14 object-contain rounded-xl border border-black/5 bg-white p-1 flex-shrink-0" />
                <div className="flex-grow min-w-0">
                  <p className="text-xs font-bold text-emerald-700">Product image loaded</p>
                  <p className="text-[10px] text-emerald-600 truncate">{productImageFile?.name}</p>
                </div>
              </div>
            ) : (
              <label
                htmlFor="attachments-file-input"
                className="border-2 border-dashed border-black/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-brandGreen/50 hover:bg-gray-50 transition"
              >
                <Upload className="w-8 h-8 text-gray-300" />
                <span className="text-sm font-semibold text-gray-500">Click to upload product image</span>
                <span className="text-[10px] text-gray-400">JPG, PNG, WEBP supported</span>
              </label>
            )}

            <button
              onClick={() => {
                if (productImagePreview) {
                  setMode('product');
                  setShowAttachmentsModal(false);
                } else {
                  document.getElementById('attachments-file-input')?.click();
                }
              }}
              className="bg-brandGreen-dark hover:bg-[#0E4A27] text-white font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-1.5"
            >
              <ArrowRight className="w-4 h-4" /> {productImagePreview ? 'Switch to Product Ad Mode' : 'Upload Product Image'}
            </button>

          </div>
        </ModalBackdrop>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          Processing Modal
      ═══════════════════════════════════════════════════════════════════════ */}
      {showProcessingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white/90 backdrop-blur-xl border border-white/40 rounded-[32px] p-8 max-w-md w-full shadow-2xl shadow-black/20 flex flex-col items-center text-center">
            <div className="relative flex items-center justify-center w-24 h-24 mb-6 rounded-full bg-brandGreen/10 animate-pulse">
              {modalStage === 5 ? (
                <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg animate-in zoom-in duration-300">
                  <Check className="w-8 h-8" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-brandGreen flex items-center justify-center text-white shadow-lg">
                  <Sparkles className="w-7 h-7 animate-pulse text-white" />
                </div>
              )}
            </div>

            {modalStage === 5 ? (
              <>
                <h3 className="text-xl font-bold text-brandGreen-dark mb-2">UGC Ad Initiated!</h3>
                <p className="text-sm text-gray-500 max-w-xs leading-relaxed">Your video render is now processing. Check progress in your video history!</p>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-brandGreen-dark mb-2">Rendering UGC Ad Video</h3>
                <p className="text-xs text-brandGreen font-semibold px-3 py-1 bg-brandGreen-light/20 rounded-full mb-6 uppercase tracking-wider animate-pulse">
                  Step {modalStage + 1} of 5
                </p>
                <div className="w-full text-left bg-gray-50/50 border border-black/5 rounded-2xl p-4 flex flex-col gap-3">
                  {modalStages.map((stage, idx) => {
                    const isDone = idx < modalStage;
                    const isActive = idx === modalStage;
                    return (
                      <div key={idx} className={`flex items-start gap-3 transition-opacity duration-300 ${isDone ? 'opacity-50' : isActive ? 'opacity-100' : 'opacity-30'}`}>
                        <div className="mt-0.5">
                          {isDone ? (
                            <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center"><Check className="w-2.5 h-2.5 text-white stroke-[3]" /></div>
                          ) : isActive ? (
                            <div className="w-4 h-4 rounded-full bg-brandGreen flex items-center justify-center animate-pulse"><Loader2 className="w-2.5 h-2.5 text-white animate-spin" /></div>
                          ) : (
                            <div className="w-4 h-4 rounded-full border border-gray-300 bg-white" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold ${isActive ? 'text-brandGreen-dark' : 'text-gray-600'}`}>{stage.title}</p>
                          {isActive && <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{stage.description}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
