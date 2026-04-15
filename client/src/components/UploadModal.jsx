import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Sparkles, FileType } from 'lucide-react';

const softSpring = { type: 'spring', stiffness: 200, damping: 26 };

export default function UploadModal({ isOpen, onClose, onUpload }) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const validateAndUpload = (file) => {
    setError(null);
    
    // 5MB Limit
    if (file.size > 5 * 1024 * 1024) {
      setError("File is too large. Please keep reports under 5MB.");
      return;
    }

    // Supported Types
    const supportedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!supportedTypes.includes(file.type)) {
      setError("Unsupported format. Please upload a PDF or Image (JPG/PNG).");
      return;
    }

    // Pass to parent handler
    onUpload(file);
    onClose();
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={softSpring}
            className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            <div className="h-2 bg-gradient-to-r from-teal-500 via-blue-600 to-indigo-600" />
            
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2.5 rounded-full hover:bg-slate-50 transition-colors text-slate-400"
            >
              <X size={20} />
            </button>

            <div className="p-8 sm:p-12">
              <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 rounded-3xl bg-teal-50 border border-teal-100 flex items-center justify-center mb-6 shadow-xl shadow-teal-100/20">
                  <Sparkles className="text-teal-600" size={32} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 text-center tracking-tight">
                  Analyze Medical Report
                </h2>
                <p className="text-sm text-slate-400 mt-3 text-center leading-relaxed max-w-[320px]">
                  Curalink will interpret your clinical markers to ground your research in evidence-based data.
                </p>
              </div>

              <div 
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative group cursor-pointer border-2 border-dashed rounded-[2rem] p-10 flex flex-col items-center justify-center transition-all duration-300 ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-50/50 scale-[1.02]' 
                    : 'border-slate-100 hover:border-teal-400 hover:bg-teal-50/30'
                }`}
              >
                <input 
                  type="file" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={(e) => e.target.files?.[0] && validateAndUpload(e.target.files[0])}
                  accept=".pdf, .jpg, .jpeg, .png"
                />

                <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Upload className="text-slate-400 group-hover:text-teal-600" size={24} />
                </div>
                
                <p className="text-sm font-bold text-slate-600 mb-1 group-hover:text-slate-900 transition-colors">
                  {dragActive ? 'Drop report here' : 'Drop report or Click to browse'}
                </p>
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-300 group-hover:text-teal-500/70 transition-colors">
                  <FileType size={12} />
                  PDF • JPG • PNG (Max 5MB)
                </div>

                {dragActive && (
                  <motion.div 
                    layoutId="drag-overlay"
                    className="absolute inset-0 bg-blue-500/5 rounded-[2rem] border-2 border-blue-500 pointer-events-none"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  />
                )}
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold shadow-sm"
                >
                  <AlertCircle size={16} className="flex-shrink-0" />
                  {error}
                </motion.div>
              )}

              <div className="mt-10 grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
                  <CheckCircle2 size={16} className="text-teal-500 mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">OCR Analysis</p>
                  <p className="text-[11px] font-bold text-slate-600">High-Fidelity Text Extraction</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center text-center">
                  <Sparkles size={16} className="text-blue-500 mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">AI Anchoring</p>
                  <p className="text-[11px] font-bold text-slate-600">Cognitive Reasoning Loop</p>
                </div>
              </div>

              <div className="mt-10 flex flex-col items-center lg:px-10">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center">
                  Your medical privacy is our priority. Reports are processed securely and discarded immediately after analysis.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
