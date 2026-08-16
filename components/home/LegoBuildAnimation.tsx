import React, { useMemo } from 'react';
import { motion, type Variants } from 'framer-motion';

const COLS = 6;
const ROWS = 3;
const BODY_X = 70, BODY_Y = 130, BODY_W = 180, BODY_H = 130;
const BRICK_W = BODY_W / COLS;
const BRICK_H = BODY_H / ROWS;
const HOUSE_CENTER_X = 160, HOUSE_CENTER_Y = 195;

function pieceVariants(offsetX: number, offsetY: number, rotate: number): Variants {
  return {
    hidden: { x: offsetX, y: offsetY, opacity: 0, rotate, scale: 0.5 },
    visible: {
      x: 0, y: 0, opacity: 1, rotate: 0, scale: 1,
      transition: { type: 'spring', stiffness: 260, damping: 18 },
    },
  };
}

const containerVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.045, delayChildren: 0.2 } },
};

// A house silhouette that assembles itself from individual LEGO-brick pieces flying in
// from outside the frame and snapping into place - each piece's entry direction is
// derived from where it sits relative to the house center, so the whole thing visually
// converges inward like bricks being placed, rather than a generic fade-in.
export function LegoBuildAnimation({ className = '' }: { className?: string }) {
  const bricks = useMemo(() => {
    const items: { key: string; x: number; y: number; offsetX: number; offsetY: number; rotate: number; fill: string }[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const cx = BODY_X + col * BRICK_W + BRICK_W / 2;
        const cy = BODY_Y + row * BRICK_H + BRICK_H / 2;
        const dx = cx - HOUSE_CENTER_X;
        const dy = cy - HOUSE_CENTER_Y;
        const dist = Math.max(Math.hypot(dx, dy), 1);
        items.push({
          key: `b-${row}-${col}`,
          x: BODY_X + col * BRICK_W + 1.5,
          y: BODY_Y + row * BRICK_H + 1.5,
          offsetX: (dx / dist) * 100,
          offsetY: (dy / dist) * 100 - 15,
          rotate: col % 2 === 0 ? -10 : 10,
          fill: (row + col) % 2 === 0 ? '#22D3EE' : '#0EA5E9',
        });
      }
    }
    return items;
  }, []);

  return (
    <motion.svg
      viewBox="0 0 320 280"
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.4 }}
      variants={containerVariants}
    >
      {/* Roof - two large brick pieces sliding down from either side */}
      <motion.polygon points="160,20 60,130 160,130" fill="#F97316" stroke="#C2410C" strokeWidth="2" variants={pieceVariants(-80, -70, -14)} />
      <motion.polygon points="160,20 260,130 160,130" fill="#FB923C" stroke="#C2410C" strokeWidth="2" variants={pieceVariants(80, -70, 14)} />

      {/* Body - grid of individual bricks converging from outside the house */}
      {bricks.map((b) => (
        <motion.rect
          key={b.key}
          x={b.x}
          y={b.y}
          width={BRICK_W - 3}
          height={BRICK_H - 3}
          rx={3}
          fill={b.fill}
          stroke="#0369A1"
          strokeWidth={1.5}
          variants={pieceVariants(b.offsetX, b.offsetY, b.rotate)}
        />
      ))}

      {/* Windows */}
      <motion.rect x="95" y="155" width="30" height="30" rx="3" fill="#FDE68A" stroke="#B45309" strokeWidth="2" variants={pieceVariants(-50, -35, -12)} />
      <motion.rect x="195" y="155" width="30" height="30" rx="3" fill="#FDE68A" stroke="#B45309" strokeWidth="2" variants={pieceVariants(50, -35, 12)} />

      {/* Door - placed last, dropping straight down */}
      <motion.rect x="140" y="190" width="40" height="70" rx="3" fill="#A78BFA" stroke="#6D28D9" strokeWidth="2" variants={pieceVariants(0, 70, 0)} />

      {/* Baseplate hint */}
      <motion.line x1="40" y1="262" x2="280" y2="262" stroke="#22D3EE" strokeWidth="3" strokeLinecap="round" opacity={0.5} variants={pieceVariants(0, 30, 0)} />
    </motion.svg>
  );
}
