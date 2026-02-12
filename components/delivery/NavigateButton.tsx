'use client';

import { Navigation, ExternalLink } from 'lucide-react';

interface NavigateButtonProps {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'outline';
  fullWidth?: boolean;
  showIcon?: boolean;
  label?: string;
}

export default function NavigateButton({
  address,
  city,
  state,
  zip,
  size = 'md',
  variant = 'primary',
  fullWidth = false,
  showIcon = true,
  label = 'Navigate',
}: NavigateButtonProps) {
  // Build full address string
  const fullAddress = [
    address,
    city,
    state && zip ? `${state} ${zip}` : state || zip,
  ]
    .filter(Boolean)
    .join(', ');

  // Encode for URL
  const encodedAddress = encodeURIComponent(fullAddress);

  // Google Maps navigation URL
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`;

  // Apple Maps URL (works on iOS)
  const appleMapsUrl = `https://maps.apple.com/?daddr=${encodedAddress}&dirflg=d`;

  // Detect iOS for Apple Maps preference
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);

  const handleNavigate = () => {
    // Use Apple Maps on iOS, Google Maps otherwise
    const url = isIOS ? appleMapsUrl : googleMapsUrl;
    window.open(url, '_blank');
  };

  // Size classes
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3.5 text-lg',
  };

  // Icon sizes
  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  // Variant classes
  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white border-blue-600',
    secondary: 'bg-neutral-700 hover:bg-neutral-600 text-white border-neutral-700',
    outline: 'bg-transparent hover:bg-blue-600/10 text-blue-500 border-blue-500',
  };

  return (
    <button
      onClick={handleNavigate}
      className={`
        inline-flex items-center justify-center gap-2 font-semibold rounded-lg
        border-2 transition-all duration-200 active:scale-95
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${fullWidth ? 'w-full' : ''}
      `}
    >
      {showIcon && <Navigation size={iconSizes[size]} />}
      {label}
      <ExternalLink size={iconSizes[size] - 4} className="opacity-60" />
    </button>
  );
}

// Multi-stop navigation button
interface MultiStopNavigateButtonProps {
  stops: Array<{
    address: string;
    city?: string;
    state?: string;
    zip?: string;
  }>;
  origin?: {
    address: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  returnToOrigin?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'outline';
  fullWidth?: boolean;
  label?: string;
}

export function MultiStopNavigateButton({
  stops,
  origin,
  returnToOrigin = false,
  size = 'md',
  variant = 'primary',
  fullWidth = false,
  label = 'Navigate Route',
}: MultiStopNavigateButtonProps) {
  const buildAddressString = (loc: { address: string; city?: string; state?: string; zip?: string }) => {
    return [loc.address, loc.city, loc.state && loc.zip ? `${loc.state} ${loc.zip}` : loc.state || loc.zip]
      .filter(Boolean)
      .join(', ');
  };

  const handleNavigate = () => {
    if (stops.length === 0) return;

    // Build waypoints
    const waypoints = stops.slice(0, -1).map(stop => encodeURIComponent(buildAddressString(stop)));
    const destination = encodeURIComponent(buildAddressString(stops[stops.length - 1]));

    let url = 'https://www.google.com/maps/dir/?api=1';

    if (origin) {
      url += `&origin=${encodeURIComponent(buildAddressString(origin))}`;
    }

    url += `&destination=${returnToOrigin && origin ? encodeURIComponent(buildAddressString(origin)) : destination}`;

    if (waypoints.length > 0 || (returnToOrigin && stops.length > 0)) {
      const allWaypoints = returnToOrigin
        ? [...waypoints, destination]
        : waypoints;
      if (allWaypoints.length > 0) {
        url += `&waypoints=${allWaypoints.join('|')}`;
      }
    }

    url += '&travelmode=driving';

    window.open(url, '_blank');
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-base',
    lg: 'px-6 py-3.5 text-lg',
  };

  const iconSizes = {
    sm: 16,
    md: 20,
    lg: 24,
  };

  const variantClasses = {
    primary: 'bg-blue-600 hover:bg-blue-500 text-white border-blue-600',
    secondary: 'bg-neutral-700 hover:bg-neutral-600 text-white border-neutral-700',
    outline: 'bg-transparent hover:bg-blue-600/10 text-blue-500 border-blue-500',
  };

  return (
    <button
      onClick={handleNavigate}
      disabled={stops.length === 0}
      className={`
        inline-flex items-center justify-center gap-2 font-semibold rounded-lg
        border-2 transition-all duration-200 active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${fullWidth ? 'w-full' : ''}
      `}
    >
      <Navigation size={iconSizes[size]} />
      {label} ({stops.length} stops)
      <ExternalLink size={iconSizes[size] - 4} className="opacity-60" />
    </button>
  );
}
