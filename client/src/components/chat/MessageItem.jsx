import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { 
  ExternalLink, Globe, User, Heart, FileText, ChevronRight, Sparkles 
} from 'lucide-react';

/* ─── Reusable spring config (Sync with App.jsx) ─── */
const spring = { type: 'spring', stiffness: 380, damping: 30 };
const softSpring = { type: 'spring', stiffness: 200, damping: 26 };

/* ─── Source card ─── */
const SourceCard = React.memo(({ source, index }) => (
  <motion.a
    href={source.url}
    target="_blank"
    rel="noreferrer"
    initial={{ opacity: 0, y: 14 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ ...softSpring, delay: index * 0.07 }}
    whileHover={{ y: -1.5, boxShadow: '0 8px 30px rgba(59,130,246,0.12)' }}
    className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 transition-colors group flex flex-col gap-3 cursor-pointer"
    style={{ textDecoration: 'none' }}
  >
    <div className="flex justify-between items-start">
      <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
        source.type === 'Trial' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
      }`}>
        {source.platform}
      </span>
      <motion.div className="text-slate-300 group-hover:text-blue-500 transition-colors" whileHover={{ rotate: -10, scale: 1.05 }} transition={spring}>
        <ExternalLink size={14} />
      </motion.div>
    </div>
    <p className="text-sm font-semibold leading-snug text-slate-800 line-clamp-2 flex-1">
      {source.title}
    </p>
    <div className="flex items-center gap-2 text-[11px] text-slate-400 font-bold uppercase tracking-wide">
      <Globe size={11} />
      <span>{source.year}</span>
      <span className="truncate">• {source.authors || source.location}</span>
    </div>
  </motion.a>
));

/* ─── Message Item ─── */
const MessageItem = React.memo(({ msg }) => {
  const [showSources, setShowSources] = useState(false);
  const isUser = msg.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...softSpring, delay: 0.02 }}
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-4 w-full`}
    >
      <div className={`flex items-end gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} w-full`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-2xl flex items-center justify-center shadow-sm ${
          isUser ? 'bg-blue-600' : 'bg-gradient-to-br from-blue-50 to-white border border-blue-100'
        }`}>
          {isUser ? <User size={15} className="text-white" /> : <Heart size={15} className="text-blue-500 fill-blue-100" />}
        </div>

        <motion.div className={`max-w-[85%] sm:max-w-[75%] px-5 py-4 rounded-2xl ${
          isUser ? 'bg-blue-600 text-white rounded-br-sm shadow-lg shadow-blue-100' : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm'
        }`}>
          {isUser && msg.metadata && msg.metadata.patientContext && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 mb-3 bg-white/10 backdrop-blur-md border border-white/20 rounded-lg px-3 py-1.5 w-fit">
              <FileText size={12} className="text-blue-100" />
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-50">Lab Results Integrated</span>
            </motion.div>
          )}

          <div className={`prose max-w-none text-[15px] leading-relaxed ${isUser ? 'prose-invert' : 'prose-slate'}`}>
            <ReactMarkdown components={{
              a: ({ node, ...props }) => (
                <motion.a {...props} whileHover={{ color: '#2563eb' }} className="inline-flex items-center gap-0.5 font-bold text-blue-600 underline underline-offset-4 decoration-blue-200 hover:decoration-blue-500 transition-all cursor-alias mx-0.5" target="_blank" rel="noreferrer" />
              )
            }}>
              {msg.content.replace(/^(#+)([^#\s])/gm, '$1 $2')}
            </ReactMarkdown>
          </div>
        </motion.div>
      </div>

      {!isUser && msg.sources && msg.sources.length > 0 && (
        <motion.button onClick={() => setShowSources(!showSources)} whileHover={{ x: 4, color: '#2563eb' }} className="ml-10 cursor-pointer flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-600 transition-colors group">
          <div className="w-5 h-5 rounded-lg bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center transition-colors">
            <motion.div animate={{ rotate: showSources ? 90 : 0 }}><ChevronRight size={10} /></motion.div>
          </div>
          {showSources ? 'Hide References' : `View ${msg.sources.length} References`}
        </motion.button>
      )}

      <AnimatePresence>
        {showSources && msg.sources && msg.sources.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="w-full max-w-[92%] self-start overflow-hidden ml-10 p-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {msg.sources.map((source, si) => <SourceCard key={si} source={source} index={si} />)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

export default MessageItem;
