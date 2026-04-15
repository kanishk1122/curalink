import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, User as UserIcon, ArrowRight, Loader2, Sparkles, Heart } from 'lucide-react';
import { login, register, clearError, googleLogin } from '../store/authSlice';
import { GoogleLogin } from '@react-oauth/google';

const softSpring = { type: 'spring', stiffness: 200, damping: 26 };

export default function AuthModal({ isOpen, onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  
  const dispatch = useDispatch();
  const { loading, error } = useSelector(state => state.auth);

  const handleSubmit = async (e) => {
    e.preventDefault();
    let result;
    if (isLogin) {
      result = await dispatch(login({ email, password }));
    } else {
      result = await dispatch(register({ email, password, name }));
    }
    
    if (!result.error) {
      onClose();
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    dispatch(clearError());
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={softSpring}
            className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl shadow-blue-900/20 overflow-hidden"
          >
            {/* Header Gradient */}
            <div className="h-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600" />
            
            <button
              onClick={onClose}
              className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-50 transition-colors text-slate-400"
            >
              <X size={20} />
            </button>

            <div className="p-8 sm:p-10">
              <div className="flex flex-col items-center mb-8">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-5 shadow-inner">
                  <Heart className="text-blue-600 fill-blue-100" size={28} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 text-center">
                  {isLogin ? 'Welcome back to Curalink' : 'Join the Research'}
                </h2>
                <p className="text-sm text-slate-400 mt-2 text-center">
                  {isLogin 
                    ? 'Start saving your medical research journey safely.' 
                    : 'Create an account to persist your medical insights forever.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <AnimatePresence mode="wait">
                  {!isLogin && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="relative"
                    >
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                      <input
                        type="text"
                        placeholder="Your Name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required={!isLogin}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-4 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-slate-800 transition-all outline-none"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-4 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-slate-800 transition-all outline-none"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={18} />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-4 py-4 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 text-slate-800 transition-all outline-none"
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-xs font-bold text-red-500 bg-red-50 p-3 rounded-xl border border-red-100"
                  >
                    {error}
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-100 relative group overflow-hidden"
                >
                  {loading ? (
                    <Loader2 className="animate-spin" size={20} />
                  ) : (
                    <>
                      {isLogin ? 'Sign In' : 'Create Account'}
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </button>

                <div className="relative my-6 text-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-100"></div>
                  </div>
                  <span className="relative px-4 bg-white text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                    Or continue with
                  </span>
                </div>

                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={credentialResponse => {
                      dispatch(googleLogin(credentialResponse.credential));
                      onClose();
                    }}
                    onError={() => {
                      console.log('Login Failed');
                    }}
                    useOneTap
                    shape="pill"
                    theme="outline"
                    width="100%"
                  />
                </div>
              </form>

              <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col items-center">
                <button
                  onClick={toggleMode}
                  className="text-sm font-bold text-slate-400 hover:text-blue-600 transition-colors"
                >
                  {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
                </button>
                <div className="flex items-center gap-2 mt-4 text-[10px] text-slate-300 font-bold uppercase tracking-widest">
                  <Sparkles size={12} />
                  Private • Research-Focused • Secure
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
