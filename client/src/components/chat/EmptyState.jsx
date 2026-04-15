import React from 'react';
import { motion } from 'framer-motion';

const spring = { type: 'spring', stiffness: 380, damping: 30 };
const softSpring = { type: 'spring', stiffness: 200, damping: 26 };

const EmptyState = React.memo(({ disease, onSuggestion }) => (
  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={softSpring} className="h-[60vh] flex flex-col items-center justify-center text-center gap-8">
    <motion.div className="w-44 h-44 rounded-[2.5rem] bg-white border border-slate-100 flex items-center justify-center shadow-2xl shadow-slate-200/60 p-0 overflow-hidden" animate={{ y: [0, -10, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}>
      <img src="/complete_logo.png" alt="Curalink Logo" className="w-full h-full object-contain" />
    </motion.div>
    <div>
      <h2 className="text-3xl font-bold text-slate-900 tracking-tight mb-3">{disease ? `Researching ${disease}` : 'Welcome to Curalink'}</h2>
      <p className="max-w-sm mx-auto text-base text-slate-400 leading-relaxed">{disease ? "Ask any question and I'll search the latest medical research for you." : 'Set your condition first, then ask me anything about the latest research.'}</p>
    </div>
    {disease && (
      <div className="flex flex-wrap gap-2 justify-center">
        {[`Latest ${disease} treatments`, `${disease} clinical trials`, `${disease} developments 2024`].map((suggestion, i) => (
          <motion.button key={i} onClick={() => onSuggestion(suggestion)} whileHover={{ scale: 1.04, y: -1 }} whileTap={{ scale: 0.97 }} transition={spring} className="text-sm cursor-pointer font-semibold px-4 py-2 bg-white border border-slate-200 rounded-full text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-colors">
            {suggestion}
          </motion.button>
        ))}
      </div>
    )}
  </motion.div>
));

export default EmptyState;
