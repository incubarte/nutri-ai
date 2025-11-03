"use client";

import React, { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

interface ReplayOverlayProps {
  url: string;
  onFinish: () => void;
}

export function ReplayOverlay({ url, onFinish }: ReplayOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement) {
      videoElement.play().catch(error => {
        // This error is expected if user hasn't interacted with the page.
        // It will still play muted.
        console.warn("Error attempting to play video automatically (this is often expected):", error);
      });
    }
  }, [url]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 overflow-hidden"
    >
      <video
        ref={videoRef}
        key={url} // Important to re-mount the video element on URL change
        onEnded={onFinish}
        className="w-full h-full object-contain"
        autoPlay
        playsInline
        muted // Muted to allow autoplay in most browsers
      >
        <source src={url} type="video/mp4" />
        Tu navegador no soporta el tag de video.
      </video>
    </motion.div>
  );
}
