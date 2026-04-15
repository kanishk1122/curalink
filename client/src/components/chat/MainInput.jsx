import React from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, Loader2, Lock, Paperclip, FileText, Sparkles, X, Square 
} from 'lucide-react';
import { AnimatedButton } from './UIAtoms';

const MainInput = ({
  input, setInput, isChatBusy, isUploading, isAuthenticated,
  selectedFile, analyzedData, disease,
  onSend, onStop, onAttachClick, onFileClear, inputRef
}) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 px-4 sm:px-10 pb-6 pt-10 bg-gradient-to-t from-white via-white/95 to-transparent">
      <form onSubmit={onSend} className="w-full lg:max-w-[70%] max-w-[95%] mx-auto flex items-end gap-2 bg-white border border-slate-200 p-2 rounded-2xl shadow-lg shadow-slate-100/80 focus-within:border-blue-300">
        
        <AnimatedButton 
          type="button" 
          onClick={onAttachClick}
          disabled={isChatBusy || isUploading}
          className={`mb-1 p-2.5 rounded-xl transition-all flex-shrink-0 ${
            !isAuthenticated 
              ? 'bg-slate-50 text-slate-300 border border-slate-100' 
              : 'hover:bg-slate-100 text-slate-400'
          }`}
        >
          {isUploading ? (
            <Loader2 size={20} className="animate-spin text-blue-500" />
          ) : !isAuthenticated ? (
            <Lock size={18} className="text-slate-300" />
          ) : (
            <Paperclip size={20} />
          )}
        </AnimatedButton>

        <div className="flex-1 relative flex flex-col">
          {selectedFile && (
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 5 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="absolute bottom-full mb-3 left-0">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg shadow-sm">
                <FileText size={14} className="text-blue-500" />
                <span className="text-[11px] font-bold text-blue-700 truncate max-w-[120px]">{selectedFile.name}</span>
                {analyzedData && <Sparkles size={12} className="text-teal-500" title="Analyzed" />}
                <button 
                  type="button"
                  onClick={onFileClear}
                  className="ml-1 p-0.5 rounded-full hover:bg-blue-100 text-blue-400"
                >
                  <X size={12} />
                </button>
              </div>
            </motion.div>
          )}
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              maxLength={2000}
              disabled={isChatBusy}
              onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`; }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(e); } }}
              placeholder={isChatBusy ? "Synthesizing research..." : (disease ? `Ask about ${disease}…` : 'Set a condition first…')}
              className="w-full bg-transparent border-none focus:ring-0 text-[15px] font-medium px-3 py-2.5 placeholder:text-slate-300 text-slate-800 min-w-0 resize-none max-h-[120px] outline-none disabled:opacity-50"
            />
            {input.length > 1500 && (
              <div className="absolute -top-6 right-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                {input.length} / 2000
              </div>
            )}
          </div>

        {isChatBusy ? (
          <AnimatedButton type="button" onClick={onStop} className="mb-1 px-5 py-2.5 bg-red-500 text-white rounded-xl font-bold text-sm hover:bg-red-600 transition-colors flex items-center gap-2">
            <Square size={14} fill="white" />
            <span className="hidden sm:inline">Stop Reasoning</span>
          </AnimatedButton>
        ) : (
          <AnimatedButton 
            type="submit" 
            disabled={(!input.trim() && !analyzedData) || !disease} 
            className={`mb-1 px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
              ((!input.trim() && !analyzedData) || !disease)
                ? 'bg-slate-100 text-slate-300 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-100'
            }`}
          >
            <Sparkles size={15} />
            <span className="hidden sm:inline">Search Research</span>
          </AnimatedButton>
        )}
      </form>
      <p className="text-[10px] text-center text-slate-300 mt-3 font-bold uppercase tracking-widest">Research-Backed Insights • Empathetic Care</p>
    </div>
  );
};

export default MainInput;
