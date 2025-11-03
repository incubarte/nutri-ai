
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
        console.error("Error attempting to play video automatically:", error);
      });
    }
  }, [url]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50"
    >
      <video
        ref={videoRef}
        key={url} // Important to re-mount the video element on URL change
        onEnded={onFinish}
        className="max-w-full max-h-full"
        controls // Add browser controls for play/pause/volume
        autoPlay
        muted // Mute by default to allow autoplay
        playsInline
      >
        <source src={url} type="video/mp4" />
        Tu navegador no soporta el tag de video.
      </video>
    </motion.div>
  );
}
