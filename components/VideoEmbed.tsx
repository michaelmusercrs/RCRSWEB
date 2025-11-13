'use client';

/**
 * Modern Video Embed Component
 * Supports YouTube, Vimeo, and direct video files
 * Features smooth loading, play button overlay, and responsive sizing
 */

import { useState } from 'react';
import { Play, Volume2, VolumeX } from 'lucide-react';

export interface VideoEmbedProps {
  src: string; // YouTube URL, Vimeo URL, or direct video file
  title?: string;
  thumbnail?: string; // Custom thumbnail image
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  aspectRatio?: '16:9' | '4:3' | '1:1' | '21:9';
  className?: string;
}

export default function VideoEmbed({
  src,
  title = 'Video',
  thumbnail,
  autoplay = false,
  muted = false,
  loop = false,
  controls = true,
  aspectRatio = '16:9',
  className = '',
}: VideoEmbedProps) {
  const [isPlaying, setIsPlaying] = useState(autoplay);
  const [isMuted, setIsMuted] = useState(muted);
  const [isLoading, setIsLoading] = useState(false);

  // Determine video type
  const isYouTube = src.includes('youtube.com') || src.includes('youtu.be');
  const isVimeo = src.includes('vimeo.com');
  const isDirect = !isYouTube && !isVimeo;

  // Extract video ID
  function getYouTubeId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? match[1] : null;
  }

  function getVimeoId(url: string): string | null {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? match[1] : null;
  }

  const videoId = isYouTube ? getYouTubeId(src) : isVimeo ? getVimeoId(src) : null;

  // Generate embed URL
  const embedUrl = isYouTube
    ? `https://www.youtube.com/embed/${videoId}?autoplay=${autoplay ? 1 : 0}&mute=${
        muted ? 1 : 0
      }&loop=${loop ? 1 : 0}&controls=${controls ? 1 : 0}`
    : isVimeo
    ? `https://player.vimeo.com/video/${videoId}?autoplay=${autoplay ? 1 : 0}&muted=${
        muted ? 1 : 0
      }&loop=${loop ? 1 : 0}&controls=${controls ? 1 : 0}`
    : src;

  // Get thumbnail
  const defaultThumbnail = isYouTube
    ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
    : undefined;

  const thumbnailSrc = thumbnail || defaultThumbnail;

  // Aspect ratio padding
  const aspectRatios = {
    '16:9': '56.25%',
    '4:3': '75%',
    '1:1': '100%',
    '21:9': '42.86%',
  };

  const handlePlay = () => {
    setIsPlaying(true);
    setIsLoading(true);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div
      className={`video-embed-container relative overflow-hidden rounded-xl shadow-2xl ${className}`}
      style={{
        paddingBottom: aspectRatios[aspectRatio],
        height: 0,
      }}
    >
      {/* Video Element */}
      {isPlaying || autoplay ? (
        <>
          {isDirect ? (
            <video
              className="absolute top-0 left-0 w-full h-full object-cover"
              src={src}
              autoPlay={autoplay}
              muted={isMuted}
              loop={loop}
              controls={controls}
              onLoadedData={() => setIsLoading(false)}
            >
              Your browser does not support the video tag.
            </video>
          ) : (
            <iframe
              className="absolute top-0 left-0 w-full h-full"
              src={embedUrl}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              onLoad={() => setIsLoading(false)}
            />
          )}

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20 animate-fade-in-up">
              <div className="w-16 h-16 border-4 border-lime-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Mute toggle for direct video */}
          {isDirect && (
            <button
              onClick={toggleMute}
              className="absolute bottom-4 right-4 z-30 p-3 bg-black/70 hover:bg-black/90 rounded-full transition-all duration-300 hover:scale-110"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="h-5 w-5 text-white" />
              ) : (
                <Volume2 className="h-5 w-5 text-white" />
              )}
            </button>
          )}
        </>
      ) : (
        /* Thumbnail with play button overlay */
        <div
          className="absolute inset-0 cursor-pointer group"
          onClick={handlePlay}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handlePlay()}
          aria-label={`Play ${title}`}
        >
          {/* Thumbnail */}
          {thumbnailSrc ? (
            <img
              src={thumbnailSrc}
              alt={title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-neutral-900 to-black" />
          )}

          {/* Dark overlay */}
          <div className="absolute inset-0 bg-black/40 group-hover:bg-black/60 transition-all duration-300" />

          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="relative">
              {/* Pulse effect */}
              <div className="absolute inset-0 bg-lime-400 rounded-full animate-ping opacity-30" />

              {/* Main play button */}
              <div className="relative bg-gradient-to-br from-lime-400 to-lime-600 rounded-full p-6 shadow-2xl transform group-hover:scale-110 transition-all duration-300 hover:shadow-[0_0_40px_rgba(163,230,53,0.6)]">
                <Play className="h-10 w-10 text-black fill-black translate-x-0.5" />
              </div>
            </div>
          </div>

          {/* Title overlay (optional) */}
          {title && (
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent z-10">
              <h3 className="text-white font-bold text-xl">{title}</h3>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
