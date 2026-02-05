'use client';

import Image from 'next/image';

interface StaticImageProps {
  imageSlot: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  fill?: boolean;
  priority?: boolean;
  sizes?: string;
  [key: string]: any;
}

// Simple image mapping - you can add your images here
const imageMap: Record<string, string> = {
  // About page images
  'about-owners': '/uploads/michael-chris-owners.jpg',
  
  // Certification images
  'cert-owens-corning': '/uploads/cert-owens-corning.png',
  'cert-iko': '/uploads/cert-iko.png',
  'cert-iko-codeplus': '/uploads/cert-iko-codeplus.png',
  'cert-bbb': '/uploads/cert-bbb.png',
  'cert-google': '/uploads/cert-google.png',
  'cert-boral': '/uploads/cert-boral.png',
  'cert-procat': '/uploads/cert-procat.png',
  
  // Location images
  'location-decatur': '/uploads/decatur-bridge.jpg',
  'location-huntsville': '/uploads/huntsville-skyline.jpg',
  'location-madison': '/uploads/madison-suburb.jpg',
  'location-athens': '/uploads/athens-courthouse.jpg',
  'location-birmingham': '/uploads/birmingham-city.jpg',
  'location-nashville': '/uploads/nashville-skyline.jpg',
  'location-owens-crossroads': '/uploads/owens-crossroads-nature.jpg',
  
  // Service images
  'service-residential': '/uploads/service-residential.jpg',
  'service-commercial': '/uploads/service-commercial.jpg',
  'service-storm': '/uploads/service-storm-damage.jpg',
  'service-chimney': '/uploads/service-chimney.jpg',
  'service-leafx': '/uploads/service-leafx-gutters.jpg',
  
  // IKO images
  'iko-codeplus-logo': '/uploads/iko-codeplus-logo.png',
  'iko-class3-hail': '/uploads/iko-class3-hail.jpg',
  'iko-class4-hail': '/uploads/iko-class4-hail.jpg',
  
  // Hero/background images
  'hero-background': '/uploads/hero-background.jpg',
  'hero-family-business': '/uploads/hero-family-business.jpg',
};

export default function StaticImage({ 
  imageSlot, 
  alt, 
  width, 
  height, 
  className = '',
  fill,
  priority,
  sizes,
  ...props 
}: StaticImageProps) {
  const imageSrc = imageMap[imageSlot];
  
  if (!imageSrc) {
    // Show placeholder if image not found
    return (
      <div 
        className={`bg-muted border-2 border-dashed border-muted-foreground/20 flex items-center justify-center text-muted-foreground text-sm ${className}`}
        style={{ 
          width: fill ? '100%' : width, 
          height: fill ? '100%' : height 
        }}
      >
        Missing: {imageSlot}
      </div>
    );
  }

  return (
    <Image
      src={imageSrc}
      alt={alt}
      width={width}
      height={height}
      fill={fill}
      priority={priority}
      sizes={sizes}
      className={className}
      onError={() => console.error(`Failed to load image: ${imageSrc}`)}
      {...props}
    />
  );
}
