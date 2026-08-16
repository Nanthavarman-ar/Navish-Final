import React from 'react';
import { motion } from 'framer-motion';

interface LegoButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'filled' | 'outline';
  className?: string;
  studCount?: number;
  type?: 'button' | 'submit';
}

const SIZE_STYLES: Record<NonNullable<LegoButtonProps['size']>, { padY: number; padX: number; font: string; stud: number; gap: number }> = {
  sm: { padY: 8, padX: 20, font: '0.8125rem', stud: 6, gap: 10 },
  default: { padY: 12, padX: 28, font: '0.9375rem', stud: 8, gap: 14 },
  lg: { padY: 16, padX: 40, font: '1.125rem', stud: 10, gap: 18 },
};

// A button styled like a real LEGO brick viewed from the front: raised studs along
// the top edge, a beveled highlight/shadow giving it genuine plastic-brick depth, and
// a spring-driven press that compresses on click the way a real brick would.
export function LegoButton({
  children,
  onClick,
  size = 'default',
  variant = 'filled',
  className = '',
  studCount = 3,
  type = 'button',
}: LegoButtonProps) {
  const s = SIZE_STYLES[size];
  const isOutline = variant === 'outline';

  return (
    <motion.button
      type={type}
      onClick={onClick}
      className={`lego-button relative inline-flex items-center justify-center font-semibold rounded-lg select-none ${
        isOutline ? 'lego-button-outline text-cyan-200' : 'lego-button-filled text-white'
      } ${className}`}
      style={{
        paddingTop: s.padY + s.stud / 2,
        paddingBottom: s.padY,
        paddingLeft: s.padX,
        paddingRight: s.padX,
        fontSize: s.font,
      }}
      whileHover={{ y: -2 }}
      whileTap={{ y: 3 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
    >
      <span className="absolute -top-[5px] left-0 right-0 flex justify-center pointer-events-none" style={{ gap: s.gap }}>
        {Array.from({ length: studCount }).map((_, i) => (
          <span key={i} className="lego-stud" style={{ width: s.stud, height: s.stud }} />
        ))}
      </span>
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
