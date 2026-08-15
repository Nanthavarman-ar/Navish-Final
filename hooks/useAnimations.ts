import { useMotionValue, useTransform, useSpring, MotionValue } from 'framer-motion';

export const useHoverScale = (scale: number = 1.05) => {
  const scaleValue = useMotionValue(1);
  const springScale = useSpring(scaleValue, { stiffness: 300, damping: 30 });

  const handleHoverStart = () => scaleValue.set(scale);
  const handleHoverEnd = () => scaleValue.set(1);

  return { scale: springScale, onHoverStart: handleHoverStart, onHoverEnd: handleHoverEnd };
};

export const useFadeIn = (delay: number = 0) => {
  const opacity = useMotionValue(0);
  const y = useMotionValue(20);

  const springOpacity = useSpring(opacity, { stiffness: 100, damping: 30 });
  const springY = useSpring(y, { stiffness: 100, damping: 30 });

  const trigger = () => {
    setTimeout(() => {
      opacity.set(1);
      y.set(0);
    }, delay);
  };

  return { opacity: springOpacity, y: springY, trigger };
};

export const useSlideIn = (direction: 'left' | 'right' | 'up' | 'down' = 'up', delay: number = 0) => {
  const x = useMotionValue(direction === 'left' ? -100 : direction === 'right' ? 100 : 0);
  const y = useMotionValue(direction === 'up' ? 100 : direction === 'down' ? -100 : 0);

  const springX = useSpring(x, { stiffness: 100, damping: 30 });
  const springY = useSpring(y, { stiffness: 100, damping: 30 });

  const trigger = () => {
    setTimeout(() => {
      x.set(0);
      y.set(0);
    }, delay);
  };

  return { x: springX, y: springY, trigger };
};

export const useGlow = (color: string = '#ffffff', intensity: number = 0.5) => {
  const glowValue = useMotionValue(0);
  const springGlow = useSpring(glowValue, { stiffness: 300, damping: 30 });

  const handleHoverStart = () => glowValue.set(intensity);
  const handleHoverEnd = () => glowValue.set(0);

  const glowStyle = useTransform(springGlow, (value) => `0 0 ${value * 20}px ${color}`);

  return { boxShadow: glowStyle, onHoverStart: handleHoverStart, onHoverEnd: handleHoverEnd };
};
