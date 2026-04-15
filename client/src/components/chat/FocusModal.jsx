import React from 'react';
import { motion } from 'framer-motion';
import { X, MapPin, Sparkles } from 'lucide-react';
import { AnimatedButton } from './UIAtoms';

const spring = { type: 'spring', stiffness: 380, damping: 30 };

const FocusModal = ({ 
  isOpen, onClose, disease, setDisease, location, setLocation, onStart 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6 text-slate-800">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ opacity: 0, y: 80, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 80, scale: 0.95 }} className="relative w-full sm:max-w-md bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl overflow-hidden p-8 sm:p-10">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 to-teal-400" />
        <button onClick={onClose} className="absolute top-5 right-5 p-2.5 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"><X size={18} /></button>
        
        <div className="mb-8">
          <motion.div whileHover={{ scale: 1.05 }} transition={spring} className="w-16 h-16 rounded-2xl bg-white border border-slate-100 flex items-center justify-center mb-6 shadow-xl shadow-slate-200/50 p-0 overflow-hidden">
            <img src="/complete_logo.png" alt="Curalink" className="w-full h-full object-contain" />
          </motion.div>
          <h3 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Let's set your focus</h3>
          <p className="text-sm text-slate-400 leading-relaxed">Define your condition to enable high-authority medical synthesis tailored to your needs.</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2.5">Condition or Disease</label>
            <input value={disease} onChange={e => setDisease(e.target.value)} onKeyDown={e => e.key === 'Enter' && disease.trim() && onStart()} placeholder="e.g. Type 2 Diabetes" autoFocus className="w-full bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-4 text-[15px] font-bold outline-none focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-300" />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2.5">Your Location (optional)</label>
            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. New York, USA" className="w-full bg-slate-50/50 border border-slate-200 rounded-xl pl-12 pr-4 py-4 text-[15px] font-bold outline-none focus:border-blue-400 focus:bg-white transition-all placeholder:text-slate-300" />
            </div>
          </div>

          <AnimatedButton 
            disabled={!disease.trim()} 
            onClick={onStart} 
            className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-700 disabled:opacity-30 shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-3 mt-4"
          >
            <Sparkles size={16} />
            Start Researching
          </AnimatedButton>
        </div>
      </motion.div>
    </div>
  );
};

export default FocusModal;
