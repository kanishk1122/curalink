import React from 'react';
import { motion } from 'framer-motion';

const spring = { type: 'spring', stiffness: 380, damping: 30 };

/* ─── AnimatedButton ─── */
export const AnimatedButton = React.memo(({ children, className = '', disabled = false, onClick, type = 'button' }) => (
  <motion.button
    type={type}
    onClick={onClick}
    disabled={disabled}
    whileHover={!disabled ? { scale: 1.025 } : {}}
    whileTap={!disabled ? { scale: 0.96 } : {}}
    transition={spring}
    className={className}
  >
    {children}
  </motion.button>
));

/* ─── Pulse dot ─── */
export const PulseDot = React.memo(() => (
  <span className="relative flex h-2.5 w-2.5">
    <motion.span
      className="absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"
      animate={{ scale: [1, 1.8, 1], opacity: [0.75, 0, 0.75] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
    />
    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
  </span>
));

/* ─── Typing dots loader ─── */
export const TypingDots = React.memo(() => (
  <div className="flex gap-1.5 items-center px-2 py-1">
    {[0, 1, 2].map(i => (
      <motion.span
        key={i}
        className="w-2 h-2 rounded-full bg-blue-400"
        animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
      />
    ))}
  </div>
));
