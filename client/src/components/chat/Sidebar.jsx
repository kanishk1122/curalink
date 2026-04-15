import React from 'react';
import { motion } from 'framer-motion';
import { Plus, Info, ChevronRight, User, X } from 'lucide-react';
import { AnimatedButton, PulseDot } from './UIAtoms';

const spring = { type: 'spring', stiffness: 380, damping: 30 };

/* ─── Sidebar chat item ─── */
const ChatItem = React.memo(({ chat, active, streaming, onClick }) => (
  <motion.button
    onClick={onClick}
    whileHover={{ x: 3 }}
    whileTap={{ scale: 0.98 }}
    transition={spring}
    className={`w-full cursor-pointer p-3.5 rounded-xl flex items-center gap-3 transition-colors text-left ${
      active ? 'bg-white border border-slate-200 shadow-sm' : 'hover:bg-white/60 border border-transparent'
    }`}
  >
    <motion.div className={`p-2 rounded-lg flex-shrink-0 ${active ? 'bg-blue-50 text-blue-600' : 'bg-slate-200/50 text-slate-400'}`}>
      <Info size={14} />
    </motion.div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-0.5">
        <span className={`block truncate text-sm font-semibold ${active ? 'text-blue-900' : 'text-slate-600'}`}>
          {chat.title}
        </span>
        {streaming && <PulseDot />}
      </div>
      <span className="text-[10px] text-slate-400 font-medium">
        {new Date(chat.createdAt).toLocaleDateString()}
      </span>
    </div>
    {active && <motion.div layoutId="activeDot" className="flex-shrink-0"><ChevronRight size={14} className="text-blue-400" /></motion.div>}
  </motion.button>
));

const Sidebar = ({ 
  sidebarOpen, chats, urlChatId, activeStreamIds, 
  isAuthenticated, user, onNewResearch, onChatClick, onLogout, onLogin 
}) => {
  return (
    <motion.aside 
      initial={false}
      animate={{ width: sidebarOpen ? 340 : 0, opacity: sidebarOpen ? 1 : 0 }}
      transition={spring}
      className="relative bg-gradient-to-b from-slate-100 to-slate-200/50 border-r border-slate-200 overflow-hidden"
    >
      <div className="w-[340px] h-full flex flex-col p-6 pr-4">
        <div className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shadow-md border border-slate-200/50 p-0 overflow-hidden">
              <img src="/complete_logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none uppercase">Curalink</h1>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Health Companion</span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col gap-4 mb-8">
          <AnimatedButton onClick={onNewResearch} className="w-full cursor-pointer py-3 px-4 rounded-xl bg-blue-600 text-white flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors font-semibold text-sm shadow-md shadow-blue-100">
            <Plus size={17} /> New Research
          </AnimatedButton>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 custom-scrollbar pr-2">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-1">Research History</h3>
          <div className="space-y-1">
            {chats.map((chat) => (
              <ChatItem 
                key={chat.id} 
                chat={chat} 
                active={urlChatId === chat.id} 
                streaming={activeStreamIds.includes(chat.id)}
                onClick={() => onChatClick(chat.id)} 
              />
            ))}
          </div>
        </div>

        <div className="pt-6 border-t border-slate-200">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-4 border border-slate-200/50 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200/30">
                <User size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-slate-800 truncate">
                  {isAuthenticated ? user?.email?.split('@')[0] : 'Guest Researcher'}
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  {isAuthenticated ? 'Premium Account' : 'Limited Access'}
                </span>
              </div>
              {isAuthenticated ? (
                <button onClick={onLogout} className="text-slate-400 hover:text-red-500 transition-colors p-1.5"><X size={16} /></button>
              ) : (
                <button onClick={onLogin} className="text-blue-500 font-black text-[10px] uppercase tracking-widest hover:text-blue-600">Login</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
