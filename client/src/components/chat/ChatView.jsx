import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Globe, Sparkles, ArrowDown } from 'lucide-react';
import MessageItem from './MessageItem';
import EmptyState from './EmptyState';
import { TypingDots } from './UIAtoms';

const ChatView = ({ 
  messages, activeChatId, disease, loading, isStreaming, isChatBusy, progress,
  hasMoreHistory, isFetchingMore, onSuggestion, scrollContainerRef, topSentinelRef, chatEndRef
}) => {
  const [showScrollButton, setShowScrollButton] = React.useState(false);

  const handleScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Show button if more than 300px away from bottom
    const isFarFromBottom = scrollHeight - scrollTop - clientHeight > 300;
    setShowScrollButton(isFarFromBottom);
  };

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div 
      ref={scrollContainerRef} 
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar bg-slate-50/30 relative"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-10 py-10 pb-32 pt-2">
        {/* ... (existing content) */}
        {!activeChatId && messages.length === 0 ? (
          <EmptyState disease={disease} onSuggestion={onSuggestion} />
        ) : (
          <div className="space-y-12 min-h-full flex flex-col">
            {/* TOP SENTINEL FOR PAGINATION */}
            <div ref={topSentinelRef} className="h-4 w-full flex-shrink-0 flex items-center justify-center">
              {isFetchingMore && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                  <Loader2 size={12} className="animate-spin" /> Retrieving context...
                </div>
              )}
            </div>

            {messages.map((msg) => <MessageItem key={msg.id} msg={msg} />)}
            
            {/* Active Reasoning/Processing State */}
            {(isChatBusy && !isStreaming) && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-start gap-4">
                 {/* ... (existing reasoning UI) */}
                 <div className="flex items-end gap-2.5">
                    <div className="flex-shrink-0 w-8 h-8 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                      <Loader2 size={15} className="text-blue-500 animate-spin" />
                    </div>
                    <div className="bg-white border border-slate-200 px-5 py-4 rounded-2xl rounded-bl-sm shadow-sm min-w-[200px]">
                      <div className="flex flex-col gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">Synthesizing clinical research</span>
                        <TypingDots />
                        {progress.length > 0 && (
                           <div className="space-y-2 mt-1">
                             {progress.map((p, i) => (
                                <motion.div key={i} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
                                  {p.status === 'searching' ? <Globe size={10} className="text-slate-400" /> : <Sparkles size={10} className="text-blue-400" />}
                                  <span className="text-[11px] font-bold text-slate-500 line-clamp-1">{p.message}</span>
                                </motion.div>
                             ))}
                           </div>
                        )}
                      </div>
                    </div>
                 </div>
              </motion.div>
            )}
            <div ref={chatEndRef} className="h-4 w-full flex-shrink-0" />
          </div>
        )}
      </div>

      {/* FLOATING SCROLL TO BOTTOM BUTTON */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.button
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            onClick={scrollToBottom}
            className="fixed bottom-24 right-10 sm:right-16 p-3 rounded-2xl bg-white/80 backdrop-blur-xl border border-slate-200 shadow-2xl shadow-blue-500/10 text-blue-600 hover:text-blue-700 hover:bg-white transition-all z-40 group"
          >
            <div className="flex items-center gap-2 px-1">
              <span className="text-[10px] font-black uppercase tracking-widest overflow-hidden w-0 group-hover:w-20 transition-all duration-300">New Insights</span>
              <ArrowDown size={18} className="group-hover:translate-y-0.5 transition-transform" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatView;
