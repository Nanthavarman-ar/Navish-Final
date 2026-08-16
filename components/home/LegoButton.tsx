import React from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';

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

const TILT_RANGE = 8; // degrees - subtle, not a full gimbal

// A button styled like a real LEGO brick viewed from the front: raised studs along
// the top edge, a beveled highlight/shadow giving it genuine plastic-brick depth, a
// spring-driven press that compresses on click the way a real brick would, a mouse-tracked
// 3D tilt, and a glossy sheen that sweeps across on hover.
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

  // Raw (unspringed) targets driven by mouse position, smoothed by useSpring so the tilt
  // eases rather than snapping frame-to-frame with the cursor.
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, { stiffness: 300, damping: 20 });
  const springRotateY = useSpring(rotateY, { stiffness: 300, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rotateY.set(px * TILT_RANGE);
    rotateX.set(-py * TILT_RANGE);
  };
  const handleMouseLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`lego-button relative inline-flex items-center justify-center font-semibold rounded-lg select-none ${
        isOutline ? 'lego-button-outline text-cyan-200' : 'lego-button-filled text-white'
      } ${className}`}
      style={{
        paddingTop: s.padY + s.stud / 2,
        paddingBottom: s.padY,
        paddingLeft: s.padX,
        paddingRight: s.padX,
        fontSize: s.font,
        rotateX: springRotateX,
        rotateY: springRotateY,
        transformPerspective: 700,
      }}
      whileHover={{ y: -2 }}
      whileTap={{ y: 3 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
    >
      <span className="lego-sheen" aria-hidden />
      <span className="absolute -top-[5px] left-0 right-0 flex justify-center pointer-events-none" style={{ gap: s.gap }}>
        {Array.from({ length: studCount }).map((_, i) => (
          <span key={i} className="lego-stud" style={{ width: s.stud, height: s.stud }} />
        ))}
      </span>
      <span className="relative z-10">{children}</span>
    </motion.button>
  );
}
