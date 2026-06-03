"use client";

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  Play, 
  Volume2, 
  Languages, 
  FileText, 
  Video, 
  Compass, 
  CheckCircle2, 
  ArrowRight,
  TrendingUp,
  Smile,
  Info,
  Zap,
  Users,
  Award,
  DollarSign,
  Clock,
  RefreshCw,
  Eye
} from 'lucide-react';

const AVATARS = [
  { id: '1', name: 'Aisha', role: 'Fashion & Lifestyle', img: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80' },
  { id: '2', name: 'Kabir', role: 'Business & Tech', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80' },
  { id: '3', name: 'Priya', role: 'Education & Health', img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&auto=format&fit=crop&q=80' },
  { id: '4', name: 'Rohan', role: 'Gaming & Fitness', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80' },
];

const VOICES = [
  { lang: 'Hindi', label: 'Male - Deep Tone', preview: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { lang: 'Tamil', label: 'Female - Expressive', preview: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { lang: 'English (IN)', label: 'Female - Professional', preview: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { lang: 'Telugu', label: 'Male - Friendly Voice', preview: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
];

const ScrollSection = ({ children, className = "", id = "" }: { children: React.ReactNode; className?: string; id?: string }) => {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 45 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
};

export default function Home() {
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);

  const toggleVoicePlay = (lang: string, previewUrl: string) => {
    if (playingVoice === lang) {
      setPlayingVoice(null);
    } else {
      setPlayingVoice(lang);
      const audio = new Audio(previewUrl);
      audio.volume = 0.5;
      audio.play().catch(e => console.log('Audio playback blocked:', e));
      audio.onended = () => setPlayingVoice(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#FAFAF8] text-[#1A1A1A] overflow-x-hidden">
      
      {/* 1. Hero Section */}
      <section className="relative pt-16 pb-20 lg:pt-24 lg:pb-32 px-6 overflow-hidden">
        <div aria-hidden="true" className="absolute top-10 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-[#CEF8DC]/30 to-[#E8C46B]/20 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center relative z-10">
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col gap-6 text-center lg:text-left"
          >
            <div className="inline-flex items-center justify-center lg:justify-start gap-2 text-xs font-semibold uppercase tracking-widest text-brandGreen-dark">
              <span className="h-2 w-2 rounded-full bg-brandGreen animate-pulse" />
              <span>India's Premium Creative AI Partner</span>
            </div>

            <h1 className="font-heading text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-brandGreen-dark leading-[1.05]">
              Generate Viral <br />
              <span className="italic font-normal text-brandGreen">AI Ads & Reels</span>
            </h1>

            <p className="text-lg md:text-xl text-gray-600 max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Create high-converting video promotions, Instagram Reels, and Shorts in minutes. Powered by realistic AI presenters, multilingual voice synthesis, and auto-generated captions.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mt-4">
              <Link
                href="/dashboard"
                className="btn-smooth bg-brandGreen-dark hover:bg-[#0E4A27] text-white font-semibold px-8 py-4 rounded-full shadow-lg shadow-brandGreen-dark/20 text-base flex items-center gap-2"
              >
                <span>Launch Creator Studio</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="#how-it-works"
                className="btn-smooth border border-black/10 hover:border-black/30 bg-white/50 backdrop-blur text-brandGreen-dark font-semibold px-8 py-4 rounded-full text-base"
              >
                Watch Workflow
              </a>
            </div>

            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-5 mt-6 text-xs text-gray-500">
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-brandGreen" /> Free AI Scriptwriter</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-brandGreen" /> 10+ Regional Accents</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="w-4 h-4 text-brandGreen" /> HD Video Exports</span>
            </div>
          </motion.div>

          {/* Interactive Hero Visual Mockup */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative w-full aspect-[5/6] max-w-md mx-auto lg:ml-auto liquid-glass rounded-[40px] p-6 flex flex-col justify-between"
          >
            {/* Liquid-glass floating elements */}
            <div className="absolute top-[8%] -left-[10%] w-[48%] bg-white/80 p-3.5 rounded-2xl shadow-xl border border-white/40 flex flex-col gap-1 z-20">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-brandGreen" />
                <span>AI Scriptwriter</span>
              </span>
              <p className="text-[11px] font-medium leading-relaxed text-[#1A1A1A]">"Unbox the new collection..."</p>
            </div>

            <div className="absolute bottom-[10%] -right-[8%] w-[42%] bg-brandGreen-dark text-white p-3 rounded-2xl shadow-xl border border-white/15 flex flex-col gap-1 z-20">
              <span className="text-[9px] font-bold text-brandGreen-light uppercase tracking-widest">Voice Output</span>
              <span className="text-[11px] font-semibold flex items-center gap-1.5"><Volume2 className="w-3.5 h-3.5" /> Hindi (Male)</span>
            </div>

            {/* Video preview container */}
            <div className="relative w-full h-[78%] bg-brandGreen-dark/5 rounded-[30px] overflow-hidden border border-black/[0.03]">
              <img
                src={selectedAvatar.img}
                alt={selectedAvatar.name}
                className="w-full h-full object-cover transition-all duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brandGreen-dark/70 via-transparent to-transparent" />
              
              <div className="absolute bottom-4 left-4 flex flex-col">
                <span className="text-white text-base font-bold flex items-center gap-2">
                  <span>{selectedAvatar.name}</span>
                  <span className="text-xs bg-brandGreen text-white px-2 py-0.5 rounded-full font-medium">Presenter</span>
                </span>
                <span className="text-white/70 text-xs mt-0.5">{selectedAvatar.role}</span>
              </div>
            </div>

            {/* Interactive Selector */}
            <div className="flex flex-col gap-2 mt-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Choose Presenter Model:</span>
              <div className="flex gap-2">
                {AVATARS.map((av) => (
                  <button
                    key={av.id}
                    onClick={() => setSelectedAvatar(av)}
                    className={`h-10 w-10 rounded-full overflow-hidden border-2 transition ${
                      selectedAvatar.id === av.id ? 'border-brandGreen scale-105 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={av.img} alt={av.name} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Brands Showcase */}
      <section className="bg-white border-y border-black/[0.03] py-8 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 flex flex-col gap-4 text-center">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">TRUSTED BY CONTENT TEAMS AT LEADING INDIAN BRANDS</span>
          <div className="flex flex-wrap items-center justify-center gap-12 text-lg font-black text-gray-300">
            <span className="hover:text-gray-500 transition duration-300">Bewakoof</span>
            <span className="hover:text-gray-500 transition duration-300">Mamaearth</span>
            <span className="hover:text-gray-500 transition duration-300">Sleepy Owl</span>
            <span className="hover:text-gray-500 transition duration-300">Sugar Cosmetics</span>
          </div>
        </div>
      </section>

      {/* 2. Platform Value / Stats */}
      <ScrollSection className="bg-[#F3F1EA] py-12 border-b border-black/[0.03]">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { count: '100K+', desc: 'Indian Businesses' },
            { count: '1.2M+', desc: 'Ads & Reels Generated' },
            { count: '10+', desc: 'Indian Regional Dialects' },
            { count: '90%', desc: 'Cost Reduction vs. Crew' },
          ].map((stat, idx) => (
            <div key={idx} className="flex flex-col gap-1.5">
              <h3 className="text-3xl md:text-4xl font-black text-brandGreen-dark">{stat.count}</h3>
              <span className="text-xs md:text-sm text-gray-500 font-semibold">{stat.desc}</span>
            </div>
          ))}
        </div>
      </ScrollSection>

      {/* 3. Detailed Features Explanation (Expanded) */}
      <div className="py-20 lg:py-28 px-6 flex flex-col gap-24 lg:gap-32 max-w-7xl mx-auto">
        
        {/* Core Video generator deep dive - AI SCRIPTWRITER */}
        <ScrollSection id="scriptwriter" className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="flex flex-col gap-6">
            <span className="text-xs font-bold uppercase tracking-widest text-brandGreen flex items-center gap-1">
              <Sparkles className="w-4.5 h-4.5" />
              <span>AI Copywriter</span>
            </span>
            <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-brandGreen-dark">
              Generate Sales Scripts In Seconds.
            </h2>
            <p className="text-gray-600 leading-relaxed text-base md:text-lg">
              Stuck on marketing angles? Input your product name and key selling points. Chitra AI's built-in script generator will automatically compile high-converting hooks, customer pain points, and convincing call-to-actions tailored specifically to Indian regional dialects.
            </p>
            <div className="flex flex-col gap-3.5 border-t border-black/5 pt-5 mt-2">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-brandGreen mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-brandGreen-dark">Optimized Hook Angles</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Tested video starts that capture user attention in the first 3 seconds of scrolling.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-brandGreen mt-0.5" />
                <div>
                  <h4 className="font-bold text-xs text-brandGreen-dark">Instant Language Translation</h4>
                  <p className="text-xs text-gray-500 mt-0.5">Seamlessly adapt scripts to Hindi, Tamil, or Telugu colloquial speech patterns.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-xl shadow-brandGreen-dark/5 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-black/5 pb-3">
              <Sparkles className="w-5 h-5 text-brandGreen" />
              <span className="text-xs font-bold text-brandGreen-dark">AI Scriptwriter Helper Interface Preview</span>
            </div>
            <div className="flex flex-col gap-3 text-xs">
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-gray-400 text-[10px] uppercase">Product name</span>
                <div className="bg-gray-50 border border-black/5 px-3 py-2 rounded-xl font-medium text-brandGreen-dark">Chitra Clothing Co.</div>
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-gray-400 text-[10px] uppercase">Core offerings</span>
                <div className="bg-gray-50 border border-black/5 px-3 py-2 rounded-xl font-medium text-brandGreen-dark">Stain-resistant linen kurtas that stay cool in peak summer heat</div>
              </div>
              <div className="bg-brandGreen-light/20 text-brandGreen-dark p-3.5 rounded-xl border border-brandGreen/10 leading-relaxed font-medium text-[11px]">
                <strong>AI Script Generated (Hindi):</strong> "हे दोस्तों! क्या आप गर्मी में पसीने और कपड़ों के दाग से परेशान हैं? पेश है Chitra Clothing के कमाल के stain-resistant linen kurtas..."
              </div>
            </div>
          </div>
        </ScrollSection>

        {/* AI Voice & Accents Deep Dive */}
        <ScrollSection id="voice-accents" className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-xl shadow-brandGreen-dark/5 flex flex-col gap-5">
            <div className="flex items-center gap-2 border-b border-black/5 pb-3">
              <Volume2 className="w-5 h-5 text-brandGreen" />
              <span className="text-xs font-bold text-brandGreen-dark">AI Voice Synthesis Dashboard</span>
            </div>
            
            <div className="flex flex-col gap-4">
              {/* Animated waveform container */}
              <div className="bg-[#0A3A1E] rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden">
                <span className="text-[9px] font-bold text-brandGreen-light uppercase tracking-widest">Live Voice Output Signal</span>
                <div className="flex items-end justify-center gap-1.5 h-16 mt-2">
                  {[20, 60, 45, 80, 50, 95, 30, 75, 40, 85, 60, 45, 90, 50, 20].map((h, i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 bg-gradient-to-t from-brandGreen to-[#E8C46B] rounded-full"
                      animate={{ height: [h/2, h, h/2] }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.08, ease: "easeInOut" }}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-[10px] text-white/60 font-semibold mt-1">
                  <span>0:12</span>
                  <span>Dialect: Hindi (Local Colloquial)</span>
                  <span>0:30</span>
                </div>
              </div>

              {/* Setting knobs preview */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 border border-black/5 p-3 rounded-xl flex flex-col gap-1 text-center">
                  <span className="text-[9px] font-bold text-gray-400">PITCH</span>
                  <span className="text-xs font-bold text-brandGreen-dark">98% Warmth</span>
                </div>
                <div className="bg-gray-50 border border-black/5 p-3 rounded-xl flex flex-col gap-1 text-center">
                  <span className="text-[9px] font-bold text-gray-400">CLARITY</span>
                  <span className="text-xs font-bold text-brandGreen-dark">AI Enhanced</span>
                </div>
                <div className="bg-gray-50 border border-black/5 p-3 rounded-xl flex flex-col gap-1 text-center">
                  <span className="text-[9px] font-bold text-gray-400">STABILITY</span>
                  <span className="text-xs font-bold text-brandGreen-dark">94.2%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <span className="text-xs font-bold uppercase tracking-widest text-brandGreen">AI Voice & Accents</span>
            <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-brandGreen-dark">
              Local Accents That Build Absolute Trust.
            </h2>
            <p className="text-gray-600 leading-relaxed text-base md:text-lg">
              Trained on regional dialect nuances, our voice models sound natural, human, and local. The video example showcases our presenter **Aisha** generating a high-converting fashion ad with synced speech elements.
            </p>

            {/* Interactive Voice Player Mockup */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {VOICES.map((vo) => (
                <button
                  key={vo.lang}
                  onClick={() => toggleVoicePlay(vo.lang, vo.preview)}
                  className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition ${
                    playingVoice === vo.lang 
                      ? 'bg-brandGreen-light/30 border-brandGreen text-brandGreen-dark' 
                      : 'bg-white border-black/5 hover:border-black/15 text-gray-700'
                  }`}
                >
                  <div>
                    <h4 className="font-bold text-sm text-brandGreen-dark">{vo.lang}</h4>
                    <span className="text-xs text-gray-400">{vo.label}</span>
                  </div>
                  <Volume2 className={`w-4.5 h-4.5 text-brandGreen ${playingVoice === vo.lang ? 'animate-bounce' : ''}`} />
                </button>
              ))}
            </div>
          </div>
        </ScrollSection>

        {/* Multi-language Captions Section */}
        <ScrollSection id="captions" className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="flex flex-col gap-6">
            <span className="text-xs font-bold uppercase tracking-widest text-brandGreen">Burned-in Captions</span>
            <h2 className="font-heading text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-brandGreen-dark">
              Automated Captions For Muted Viewports.
            </h2>
            <p className="text-gray-600 leading-relaxed text-base md:text-lg">
              Over 85% of mobile users watch Reels and Shorts on mute. Chitra AI dynamically syncs voice track speech data to automatically burn bright, high-retention subtitles into the visual output. The video alongside exhibits the automated captioned result for a lifestyle shoe brand.
            </p>
            <div className="flex flex-col gap-3 mt-2">
              {[
                'Translates and transcribes accurately in real-time.',
                'Interactive highlighting styles (current word highlighting).',
                'Perfect mobile-native safe zones (no cropped text on Instagram/YouTube).',
              ].map((point, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-sm font-semibold text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-brandGreen" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-black/5 rounded-3xl p-6 shadow-xl shadow-brandGreen-dark/5 flex flex-col gap-5 order-first lg:order-last">
            <div className="flex items-center gap-2 border-b border-black/5 pb-3">
              <Languages className="w-5 h-5 text-brandGreen" />
              <span className="text-xs font-bold text-brandGreen-dark">Caption Styling & Subtitle Safe-Zone</span>
            </div>

            <div className="flex flex-col gap-4">
              {/* Safe-zone mobile layout mockup */}
              <div className="border border-dashed border-[#E8C46B] rounded-2xl p-4 bg-[#FAFAF8] flex flex-col gap-6 relative items-center justify-center min-h-[140px]">
                <span className="absolute top-2 left-3 text-[9px] font-bold text-[#E8C46B] uppercase tracking-widest">Safe Zone Limit (9:16)</span>
                
                <div className="flex flex-col items-center text-center gap-2 max-w-[80%]">
                  <span className="text-xs font-semibold text-gray-400 leading-relaxed">Aisha Presenter Speaking...</span>
                  <div className="bg-brandGreen-dark text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-lg shadow-brandGreen-dark/10 tracking-wide border border-white/10 flex flex-wrap justify-center gap-1">
                    <span>Stain-Resistant</span>
                    <span className="text-[#E8C46B] underline decoration-wavy underline-offset-4 font-black">kurtas</span>
                    <span>that stay cool!</span>
                  </div>
                </div>
              </div>

              {/* Caption settings presets */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-50 border border-black/5 p-3 rounded-xl flex items-center justify-between">
                  <span className="font-semibold text-brandGreen-dark">Preset Style:</span>
                  <span className="bg-brandGreen text-white px-2 py-0.5 rounded text-[10px] font-bold">Bubble Pop</span>
                </div>
                <div className="bg-gray-50 border border-black/5 p-3 rounded-xl flex items-center justify-between">
                  <span className="font-semibold text-brandGreen-dark">Active Word Color:</span>
                  <span className="bg-[#E8C46B]/20 text-[#cda439] px-2 py-0.5 rounded text-[10px] font-bold">Muted Amber</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollSection>
      </div>

      {/* 4. Comparison Section (Chitra AI vs Traditional Agencies) */}
      <ScrollSection className="bg-white py-20 lg:py-28 px-6 border-y border-black/[0.03]">
        <div className="max-w-7xl mx-auto flex flex-col gap-16">
          <div className="text-center max-w-2xl mx-auto flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-brandGreen">Smart Content Creation</span>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-brandGreen-dark">Traditional Production vs. Chitra AI</h2>
            <p className="text-xs text-gray-400 mt-1">Why scaling D2C brands are moving away from traditional agencies.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full">
            {/* Traditional production card */}
            <div className="bg-[#FAFAF8] border border-black/5 rounded-3xl p-8 flex flex-col gap-6">
              <h3 className="font-bold text-lg text-gray-500 flex items-center gap-2">
                <span>Traditional Video Agencies</span>
              </h3>
              <div className="flex flex-col gap-4 text-xs text-gray-600">
                <div className="flex items-start gap-3">
                  <span className="bg-red-500/10 text-red-600 px-2 py-0.5 rounded font-bold">Cost</span>
                  <p className="font-medium">₹25,000 - ₹80,000 per single video ad concept.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-red-500/10 text-red-600 px-2 py-0.5 rounded font-bold">Speed</span>
                  <p className="font-medium">7 to 15 business days for storyboards, shoots, and editing.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-red-500/10 text-red-600 px-2 py-0.5 rounded font-bold">Actors</span>
                  <p className="font-medium">Hiring fees, contract limitations, and scheduling stress.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-red-500/10 text-red-600 px-2 py-0.5 rounded font-bold">Edits</span>
                  <p className="font-medium">Restricted rounds of iterations; extra fees for script updates.</p>
                </div>
              </div>
            </div>

            {/* Chitra AI card */}
            <div className="border border-brandGreen bg-brandGreen-light/10 rounded-3xl p-8 flex flex-col gap-6 relative shadow-lg shadow-brandGreen/5">
              <span className="absolute -top-3 right-6 bg-brandGreen text-white text-[9px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full">
                Highly Scalable
              </span>
              <h3 className="font-bold text-lg text-brandGreen-dark flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-brandGreen" />
                <span>Chitra AI Workspace</span>
              </h3>
              <div className="flex flex-col gap-4 text-xs text-brandGreen-dark">
                <div className="flex items-start gap-3">
                  <span className="bg-brandGreen text-white px-2 py-0.5 rounded font-bold">Cost</span>
                  <p className="font-semibold">Under ₹20 per video creation (credits billing model).</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-brandGreen text-white px-2 py-0.5 rounded font-bold">Speed</span>
                  <p className="font-semibold">Rendering takes less than 3 minutes to output HD files.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-brandGreen text-white px-2 py-0.5 rounded font-bold">Actors</span>
                  <p className="font-semibold">Instant access to photorealistic regional presenter models.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-brandGreen text-white px-2 py-0.5 rounded font-bold">Edits</span>
                  <p className="font-semibold">Unlimited edits. Tweak copy and generate a new video instantly.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollSection>

      {/* 5. Use Case Scenarios */}
      <ScrollSection className="py-20 lg:py-28 px-6 max-w-7xl mx-auto flex flex-col gap-16">
        <div className="text-center max-w-xl mx-auto flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-brandGreen">Target Industries</span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-brandGreen-dark">Designed for Indian Marketers</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: <TrendingUp className="w-6 h-6 text-brandGreen" />, title: 'D2C E-commerce Brands', desc: 'Instantly generate dozens of hook variations for catalog products to continuously test on Meta/Google ads and counter banner-blindness.' },
            { icon: <Award className="w-6 h-6 text-brandGreen" />, title: 'Local Businesses', desc: 'Produce localized ads in Hindi, Tamil, or Telugu dialects to advertise store openings, regional offers, and WhatsApp catalog items.' },
            { icon: <Users className="w-6 h-6 text-brandGreen" />, title: 'Content Agencies', desc: 'Scale client video deliveries exponentially. Create rapid drafts, client pitches, and multi-language social reels in minutes.' },
          ].map((useCase, idx) => (
            <div key={idx} className="bg-white border border-black/5 rounded-3xl p-6 flex flex-col gap-4 shadow-xl shadow-brandGreen-dark/5">
              <div className="p-3 bg-brandGreen-light/20 rounded-2xl w-fit">{useCase.icon}</div>
              <h4 className="font-bold text-base text-brandGreen-dark">{useCase.title}</h4>
              <p className="text-xs text-gray-500 leading-relaxed">{useCase.desc}</p>
            </div>
          ))}
        </div>
      </ScrollSection>

      {/* 6. How It Works (Workflow Block) */}
      <ScrollSection id="how-it-works" className="bg-[#F3F1EA] py-20 lg:py-28 px-6 border-y border-black/[0.03]">
        <div className="max-w-7xl mx-auto flex flex-col gap-16">
          <div className="text-center max-w-xl mx-auto flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-brandGreen">Process Overview</span>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-[#1A1A1A]">Generate Ads In 4 Steps</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {[
              { step: '01', title: 'Write Script', desc: 'Enter your promotion text or use our inline AI Assistant to compile hooks and hooks angles.' },
              { step: '02', title: 'Pick Avatar', desc: 'Select from our catalog of diverse, regional presenter models.' },
              { step: '03', title: 'Select Voice', desc: 'Choose regional accents and Indian voice profiles for styling.' },
              { step: '04', title: 'Render Video', desc: 'Click publish to compile the final HD marketing video instantly.' },
            ].map((step, idx) => (
              <div key={idx} className="bg-white/40 border border-black/5 rounded-2xl p-6 flex flex-col gap-4 relative">
                <span className="font-heading text-4xl font-black text-brandGreen/20 absolute top-4 right-6">{step.step}</span>
                <h4 className="font-bold text-lg text-brandGreen-dark mt-2">{step.title}</h4>
                <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* 7. Premium Pricing Grid & Checkout */}
      <ScrollSection id="pricing" className="py-20 lg:py-28 px-6 max-w-7xl mx-auto w-full flex flex-col gap-16">
        <div className="text-center max-w-xl mx-auto flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-brandGreen">Transparent Pricing</span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-brandGreen-dark">Simple Packages For All Needs</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-5xl mx-auto w-full">
          {[
            { plan: 'BASIC', price: '1,999', desc: 'Ideal for small business promos.', features: ['1,000 Video Generation Credits', 'HD Video Exports', 'Standard Presenter Catalog', 'Basic AI Script Generator helper', 'Email Support'], color: 'border-black/5 bg-white' },
            { plan: 'PRO', price: '4,999', desc: 'Perfect for scaling D2C marketers.', features: ['3,000 Video Generation Credits', 'HD Video Exports', 'Priority Rendering Queue', 'Advanced AI Scriptwriter tool', 'All Regional Accent Voices', 'Priority WhatsApp Support'], color: 'border-brandGreen bg-white shadow-xl shadow-brandGreen/5 relative' },
            { plan: 'BUSINESS', price: '9,999', desc: 'Designed for agency & content teams.', features: ['7,500 Video Generation Credits', 'Custom Avatar Cloning options', 'HD Video Exports', 'API developer access keys', 'Dedicated Campaign Manager'], color: 'border-black/5 bg-white' },
          ].map((card, idx) => (
            <div key={idx} className={`border rounded-[32px] p-8 flex flex-col justify-between gap-6 ${card.color}`}>
              {card.plan === 'PRO' && (
                <span className="absolute -top-3.5 left-6 bg-brandGreen text-white text-[10px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full">
                  Best Value
                </span>
              )}

              <div>
                <h3 className="font-bold text-xl text-brandGreen-dark">{card.plan}</h3>
                <p className="text-xs text-gray-400 mt-1">{card.desc}</p>

                <div className="mt-5 flex items-baseline gap-1 text-brandGreen-dark">
                  <span className="text-4xl font-black">₹{card.price}</span>
                  <span className="text-xs text-gray-400 font-semibold">/ topup pack</span>
                </div>

                <div className="border-t border-black/5 mt-6 pt-6 flex flex-col gap-3">
                  {card.features.map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-center gap-2.5 text-xs text-gray-600 font-medium">
                      <CheckCircle2 className="w-4.5 h-4.5 text-brandGreen flex-shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Link
                href="/login"
                className={`w-full text-center py-3.5 rounded-xl text-sm font-bold transition ${
                  card.plan === 'PRO'
                    ? 'bg-brandGreen-dark text-white hover:bg-[#0E4A27]'
                    : 'bg-white hover:bg-gray-50 border border-black/10 text-brandGreen-dark'
                }`}
              >
                Purchase Plan
              </Link>
            </div>
          ))}
        </div>
      </ScrollSection>

      {/* 8. FAQ Accordion (Expanded) */}
      <ScrollSection className="bg-[#F3F1EA] py-20 px-6 border-t border-black/[0.03]">
        <div className="max-w-4xl mx-auto flex flex-col gap-12">
          <h2 className="font-heading text-3xl font-bold text-brandGreen-dark text-center">Frequently Asked Questions</h2>
          <div className="flex flex-col gap-4">
            {[
              { q: 'How many videos can I generate per credit?', a: 'Generating a video costs 10 credits. A Basic top-up pack (1,000 credits) allows you to render up to 100 HD marketing videos.' },
              { q: 'Does Chitra AI generate video script automatically?', a: 'Yes, inside the studio workshop dashboard, you can toggle the "Write script with AI" helper, enter your product parameters, and the AI will auto-write copy in Hindi, Tamil, Telugu or English.' },
              { q: 'Can I choose different languages and accents?', a: 'Yes, our platform supports Hindi, Tamil, Telugu, Kannada, English (IN), and 5+ more regional accents.' },
              { q: 'Are these videos copyright-free for advertising?', a: 'Yes. All video rendering exports generated on Chitra AI belong to you. You are free to run them as paid advertisements on Meta, Google, TikTok, or YouTube.' },
              { q: 'Do these videos have a watermark?', a: 'No, paid plans do not contain watermarks. You own the content rights completely.' },
              { q: 'How does the Razorpay checkout and transaction verification work?', a: 'When you purchase a credit top-up pack, Razorpay generates a secure transaction token. Once payment succeeds, credits are automatically added to your workspace instantly.' }
            ].map((faq, idx) => (
              <div key={idx} className="bg-white/50 border border-black/5 p-5 rounded-2xl">
                <h4 className="font-bold text-sm text-brandGreen-dark flex items-center gap-2">
                  <Info className="w-4 h-4 text-brandGreen" />
                  <span>{faq.q}</span>
                </h4>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed pl-6">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </ScrollSection>

      {/* 9. Footer */}
      <footer className="bg-brandGreen-dark text-[#FAFAF8]/80 py-16 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-sm">
          <div className="flex flex-col gap-3">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <img src="/logo.png" alt="Chitra Logo" className="w-5 h-5 object-contain" />
              <span>Chitra AI</span>
            </h3>
            <p className="text-xs text-white/60 leading-relaxed max-w-xs">
              Automated high-converting video and Reels generator trained on your brand guidelines.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-bold text-white uppercase tracking-wider text-xs">Features</span>
            <a href="#how-it-works" className="hover:text-white transition text-xs">AI Video Maker</a>
            <a href="#voice-accents" className="hover:text-white transition text-xs">Indian Regional Dialects</a>
            <a href="#scriptwriter" className="hover:text-white transition text-xs">AI Scriptwriter Assistant</a>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-bold text-white uppercase tracking-wider text-xs">Support</span>
            <a href="#pricing" className="hover:text-white transition text-xs">Pricing Details</a>
            <a href="#" className="hover:text-white transition text-xs">Contact Helpdesk</a>
            <a href="#" className="hover:text-white transition text-xs">Privacy Policy</a>
          </div>
        </div>
        <div className="max-w-7xl mx-auto border-t border-white/10 mt-12 pt-8 flex justify-between text-xs text-white/40">
          <span>© {new Date().getFullYear()} Chitra. Made with ♥ in India.</span>
          <span>Unsubscribe</span>
        </div>
      </footer>
    </div>
  );
}
