'use client';

/**
 * Modern 3D Button Component
 * Features smooth push-down animation when clicked
 */

import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface Button3DProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  glow?: boolean;
  shimmer?: boolean;
}

const Button3D = forwardRef<HTMLButtonElement, Button3DProps>(
  ({ className, variant = 'primary', size = 'md', glow = false, shimmer = false, children, ...props }, ref) => {
    // Variant styles with 3D effect
    const variants = {
      primary: `
        bg-gradient-to-b from-brand-green via-brand-green to-brand-green
        text-black font-black
        shadow-[0_6px_0_0_#65a30d,0_8px_12px_0_rgba(132,204,22,0.4)]
        hover:shadow-[0_4px_0_0_#65a30d,0_6px_10px_0_rgba(132,204,22,0.4)]
        active:shadow-[0_1px_0_0_#65a30d,0_2px_4px_0_rgba(132,204,22,0.4)]
        hover:translate-y-[2px]
        active:translate-y-[5px]
      `,
      secondary: `
        bg-gradient-to-b from-blue-500 via-blue-600 to-blue-700
        text-white font-bold
        shadow-[0_6px_0_0_#1e40af,0_8px_12px_0_rgba(59,130,246,0.4)]
        hover:shadow-[0_4px_0_0_#1e40af,0_6px_10px_0_rgba(59,130,246,0.4)]
        active:shadow-[0_1px_0_0_#1e40af,0_2px_4px_0_rgba(59,130,246,0.4)]
        hover:translate-y-[2px]
        active:translate-y-[5px]
      `,
      outline: `
        bg-gradient-to-b from-transparent to-neutral-900
        text-brand-green font-bold
        border-2 border-brand-green
        shadow-[0_6px_0_0_#65a30d,0_8px_12px_0_rgba(132,204,22,0.2)]
        hover:shadow-[0_4px_0_0_#65a30d,0_6px_10px_0_rgba(132,204,22,0.2)]
        active:shadow-[0_1px_0_0_#65a30d,0_2px_4px_0_rgba(132,204,22,0.2)]
        hover:translate-y-[2px]
        active:translate-y-[5px]
        hover:bg-brand-green/10
      `,
      ghost: `
        bg-gradient-to-b from-neutral-800 to-neutral-900
        text-white font-bold
        shadow-[0_4px_0_0_#171717,0_6px_10px_0_rgba(0,0,0,0.3)]
        hover:shadow-[0_3px_0_0_#171717,0_5px_8px_0_rgba(0,0,0,0.3)]
        active:shadow-[0_1px_0_0_#171717,0_2px_4px_0_rgba(0,0,0,0.3)]
        hover:translate-y-[1px]
        active:translate-y-[3px]
      `,
      danger: `
        bg-gradient-to-b from-red-500 via-red-600 to-red-700
        text-white font-black
        shadow-[0_6px_0_0_#991b1b,0_8px_12px_0_rgba(239,68,68,0.4)]
        hover:shadow-[0_4px_0_0_#991b1b,0_6px_10px_0_rgba(239,68,68,0.4)]
        active:shadow-[0_1px_0_0_#991b1b,0_2px_4px_0_rgba(239,68,68,0.4)]
        hover:translate-y-[2px]
        active:translate-y-[5px]
      `,
    };

    // Size styles
    const sizes = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-6 py-3 text-base',
      lg: 'px-8 py-4 text-lg',
      xl: 'px-10 py-5 text-xl',
    };

    // Glow effect
    const glowEffect = glow
      ? 'before:absolute before:inset-0 before:rounded-lg before:opacity-0 hover:before:opacity-100 before:blur-xl before:bg-brand-green/50 before:transition-opacity before:duration-300 before:-z-10'
      : '';

    // Shimmer effect
    const shimmerEffect = shimmer
      ? 'relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent'
      : '';

    return (
      <button
        ref={ref}
        className={cn(
          // Base styles
          'relative inline-flex items-center justify-center',
          'rounded-lg',
          'uppercase tracking-widest',
          'transition-all duration-150 ease-out',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none',
          'focus:outline-none focus:ring-4 focus:ring-brand-green/50',
          'select-none',
          // Variant
          variants[variant],
          // Size
          sizes[size],
          // Effects
          glowEffect,
          shimmerEffect,
          className
        )}
        {...props}
      >
        <span className="relative z-10 flex items-center gap-2">
          {children}
        </span>
      </button>
    );
  }
);

Button3D.displayName = 'Button3D';

export default Button3D;
