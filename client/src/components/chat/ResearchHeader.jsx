import React from 'react';
import { History, MapPin, ChevronDown, Sparkles, ShieldCheck } from 'lucide-react';
import { AnimatedButton } from './UIAtoms';

const ResearchHeader = ({ 
  isChatBusy, disease, onToggleSidebar, onSetFocus 
}) => {
  return (
    <header className="h-16 px-6 sm:px-10 border-b border-slate-100 flex items-center justify-between flex-shrink-0 bg-white/80 backdrop-blur-xl z-20">
      <div className="flex items-center gap-5">
        <button onClick={onToggleSidebar} className="text-slate-400 hover:text-blue-600 transition-colors p-1 bg-slate-50 rounded-lg border border-slate-100">
          <History size={18} />
        </button>
        <div className="h-4 w-px bg-slate-200 hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isChatBusy ? 'bg-amber-400' : 'bg-teal-400'} animate-pulse`} />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            {isChatBusy ? 'Synthesizing Response' : 'System Ready'}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4">
         <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-100">
           <ShieldCheck size={14} className="text-teal-500" />
           <span className="text-[10px] font-bold text-slate-500 tracking-wide uppercase">HIPAA Compliant</span>
         </div>
         {disease ? (
            <div onClick={onSetFocus} className="cursor-pointer group flex items-center gap-3 px-4 py-2 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 transition-all hover:bg-blue-100">
              <div className="p-1 rounded bg-blue-600 text-white flex-shrink-0"><MapPin size={10} /></div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-400 leading-none mb-0.5">Focusing on</span>
                <span className="text-xs font-black truncate">{disease}</span>
              </div>
              <ChevronDown size={14} className="text-blue-300 group-hover:text-blue-500" />
            </div>
         ) : (
           <AnimatedButton onClick={onSetFocus} className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all flex items-center gap-2">
             <Sparkles size={14} /> Set Focus
           </AnimatedButton>
         )}
      </div>
    </header>
  );
};

export default ResearchHeader;
