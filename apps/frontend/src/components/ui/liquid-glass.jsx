import React from 'react';
import { cn } from '../../lib/utils';

// A shared glass surface for content placed over photography.
export function LiquidGlassCard({ as: Element = 'div', className, children, borderRadius = '24px', blurIntensity = 'sm', glowIntensity = 'sm', shadowIntensity = 'sm', style, ...props }) {
  const blur = { sm: '12px', md: '20px', lg: '28px' }[blurIntensity] || '12px';
  return <Element {...props} className={cn('liquid-glass-card', className)}
    data-glow={glowIntensity} data-shadow={shadowIntensity}
    style={{ '--glass-blur': blur, borderRadius, ...style }}>
    {children}
  </Element>;
}
