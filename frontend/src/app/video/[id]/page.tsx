"use client";

import React, { useState } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import api from '../../../lib/api';
import { Loader2, Video, Play, Download, Sparkles, Home } from 'lucide-react';

const fetcher = (url: string) => api.get(url).then((res) => res.data);

export default function VideoSharePage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data, error, isLoading } = useSWR(`/videos/public/${id}`, fetcher);
  const [downloading, setDownloading] = useState(false);

  const video = data?.video;

  const handleDownload = async () => {
    if (!video?.videoUrl) return;
    setDownloading(true);
    try {
      const response = await fetch(video.videoUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `retailstacker_ugc_${id.slice(0, 8)}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(video.videoUrl, '_blank');
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center bg-[#FAFAF8] px-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brandGreen animate-spin" />
          <p className="text-xs text-gray-400 font-medium">Retrieving shared UGC video...</p>
        </div>
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center bg-[#FAFAF8] px-4">
        <div className="max-w-md w-full text-center bg-white border border-black/5 rounded-3xl p-8 shadow-xl shadow-brandGreen-dark/5 flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-500">
            <Video className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-brandGreen-dark">Shared Video Not Found</h2>
            <p className="text-xs text-gray-400 mt-2">
              The video link is invalid, deleted, or is still undergoing processing in the render pipeline.
            </p>
          </div>
          <Link
            href="/"
            className="w-full bg-brandGreen-dark hover:bg-[#0E4A27] text-white font-bold py-3 rounded-xl transition text-xs flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Go to Homepage</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] bg-[#FAFAF8] px-4 py-12 flex items-center justify-center relative overflow-hidden">
      {/* Decorative Blur Plates */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-brandGreen/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-brandGold/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-4xl bg-white border border-black/5 rounded-3xl p-6 md:p-8 shadow-xl shadow-brandGreen-dark/5 flex flex-col md:flex-row gap-8 relative z-10">
        {/* Left Side: Video Player Column */}
        <div className="w-full md:w-1/2 flex flex-col items-center gap-4">
          <div className="w-full aspect-[9/16] max-h-[550px] bg-black rounded-2xl overflow-hidden shadow-lg border border-black/10 relative group">
            {video.videoUrl ? (
              <video
                src={video.videoUrl}
                controls
                playsInline
                className="w-full h-full object-cover"
                poster={video.thumbnailUrl || undefined}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                <Video className="w-12 h-12" />
                <span className="text-xs font-semibold">Video source unavailable</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Details & Script Column */}
        <div className="w-full md:w-1/2 flex flex-col justify-between gap-6">
          <div className="flex flex-col gap-5">
            {/* Header / Branding */}
            <div>
              <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-brandGreen uppercase tracking-wider hover:underline">
                <Sparkles className="w-3.5 h-3.5" />
                <span>RetailStacker AI UGC</span>
              </Link>
              <h1 className="text-2xl font-black text-brandGreen-dark mt-2">Shared UGC Ad Spot</h1>
              <p className="text-[10px] text-gray-400 mt-1">Generated on {new Date(video.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
            </div>

            {/* Script card */}
            <div className="bg-gray-50/50 border border-black/5 rounded-2xl p-5">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Spoken Script</h3>
              <p className="text-xs text-brandGreen-dark leading-relaxed whitespace-pre-wrap max-h-[220px] overflow-y-auto pr-1">
                {video.script}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full bg-brandGreen-dark hover:bg-[#0E4A27] text-white font-bold py-3.5 rounded-xl transition duration-200 text-xs flex items-center justify-center gap-2 shadow-lg shadow-brandGreen-dark/15 disabled:opacity-50"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Preparing Download...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download UGC Video</span>
                </>
              )}
            </button>

            <Link
              href="/"
              className="w-full bg-transparent border border-black/10 hover:bg-gray-50 text-brandGreen-dark font-bold py-3 rounded-xl transition duration-200 text-xs flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-brandGreen animate-pulse" />
              <span>Create Your Own UGC Video</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
