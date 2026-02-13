/**
 * Wide-Format Image Component
 * Responsive image with loading states, hover effects, and placeholders
 */

import Image from 'next/image';
import { useState } from 'react';

export interface WideImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  aspectRatio?: '16:9' | '21:9' | '3:2' | '4:3' | '1:1';
  priority?: boolean;
  overlay?: boolean; // Darken overlay on hover
  zoom?: boolean; // Zoom effect on hover
  className?: string;
  placeholderColor?: string;
}

export default function WideImage({
  src,
  alt,
  width = 1920,
  height = 1080,
  aspectRatio = '16:9',
  priority = false,
  overlay = true,
  zoom = true,
  className = '',
  placeholderColor = '#1a1a1a',
}: WideImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Aspect ratio classes
  const aspectRatioClasses = {
    '16:9': 'aspect-[16/9]',
    '21:9': 'aspect-[21/9]',
    '3:2': 'aspect-[3/2]',
    '4:3': 'aspect-[4/3]',
    '1:1': 'aspect-square',
  };

  const containerClass = `relative w-full ${aspectRatioClasses[aspectRatio]} overflow-hidden rounded-xl ${
    overlay || zoom ? 'image-overlay' : ''
  } ${className}`;

  const imageClass = `object-cover transition-all duration-700 ${
    isLoading ? 'blur-lg scale-110' : 'blur-0 scale-100'
  } ${zoom ? 'group-hover:scale-110' : ''}`;

  // Handle image load
  const handleLoad = () => {
    setIsLoading(false);
  };

  // Handle image error
  const handleError = () => {
    setIsLoading(false);
    setHasError(true);
  };

  return (
    <div className={`group ${containerClass}`}>
      {hasError ? (
        /* Error placeholder */
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-950">
          <div className="text-center p-8">
            <svg
              className="h-16 w-16 text-neutral-700 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-neutral-500 text-sm font-medium">Image unavailable</p>
          </div>
        </div>
      ) : (
        <>
          {/* Loading placeholder with shimmer */}
          {isLoading && (
            <div
              className="absolute inset-0 animate-pulse"
              style={{ backgroundColor: placeholderColor }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
            </div>
          )}

          {/* Actual image */}
          <Image
            src={src}
            alt={alt}
            fill
            className={imageClass}
            priority={priority}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 70vw"
            onLoad={handleLoad}
            onError={handleError}
          />

          {/* Overlay gradient (appears on hover if enabled) */}
          {overlay && (
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Wide Image with Caption
 */
export function WideImageWithCaption({
  src,
  alt,
  caption,
  ...props
}: WideImageProps & { caption: string }) {
  return (
    <figure className="space-y-3">
      <WideImage src={src} alt={alt} {...props} />
      <figcaption className="text-sm text-neutral-400 text-center italic">
        {caption}
      </figcaption>
    </figure>
  );
}

/**
 * Wide Image Grid
 * Display multiple images in responsive grid
 */
export function WideImageGrid({
  images,
  columns = 3,
  gap = 'gap-6',
}: {
  images: Array<{ src: string; alt: string; caption?: string }>;
  columns?: 2 | 3 | 4;
  gap?: string;
}) {
  const gridCols = {
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid ${gridCols[columns]} ${gap}`}>
      {images.map((image, index) => (
        <div key={index} className="hover-lift">
          {image.caption ? (
            <WideImageWithCaption
              src={image.src}
              alt={image.alt}
              caption={image.caption}
            />
          ) : (
            <WideImage src={image.src} alt={image.alt} />
          )}
        </div>
      ))}
    </div>
  );
}
