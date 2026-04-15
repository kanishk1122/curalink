import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Sparkles, ChevronDown, Check, Search, Loader2 } from 'lucide-react';
import { AnimatedButton } from './UIAtoms';
import axios from 'axios';

const spring = { type: 'spring', stiffness: 380, damping: 30 };

const LocationSelector = ({ label, placeholder, value, onSelect, items, isLoading, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);

  const filteredItems = (Array.isArray(items) ? items : []).filter(item => 
    item.name.toLowerCase().includes(search.toLowerCase())
  ).slice(0, 100);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2.5">{label}</label>
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-slate-50/50 border border-slate-200 rounded-xl px-4 py-4 text-[15px] font-bold cursor-pointer transition-all ${
          isOpen ? 'border-blue-400 bg-white ring-4 ring-blue-50' : 'hover:border-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={value ? 'text-slate-800' : 'text-slate-300'}>{value || placeholder}</span>
        {isLoading ? <Loader2 size={16} className="animate-spin text-blue-400" /> : <ChevronDown size={16} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />}
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute z-30 mt-2 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-3 border-b border-slate-50">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  autoFocus
                  placeholder="Search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-slate-50 border-none rounded-lg pl-9 pr-4 py-2 text-sm font-bold outline-none focus:bg-slate-100 transition-colors"
                />
              </div>
            </div>
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
              {isLoading && filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <Loader2 size={24} className="animate-spin text-blue-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Loading spatial data...</span>
                </div>
              ) : filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <div 
                    key={item.code} 
                    onClick={() => { onSelect(item); setIsOpen(false); setSearch(''); }}
                    className="flex items-center justify-between px-4 py-3 hover:bg-blue-50 cursor-pointer transition-colors group"
                  >
                    <span className="text-sm font-bold text-slate-700 group-hover:text-blue-700">{item.name}</span>
                    {value === item.name && <Check size={14} className="text-blue-500" />}
                  </div>
                ))
              ) : (
                <div className="px-4 py-8 text-center text-xs font-bold text-slate-400">No results found</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FocusModal = ({ 
  isOpen, onClose, disease, setDisease, location, setLocation, onStart 
}) => {
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null); // {name, code}
  const [selectedState, setSelectedState] = useState(null); // {name, code}
  const [loading, setLoading] = useState({ countries: false, states: false });

  useEffect(() => {
    if (isOpen) {
      setLoading(p => ({ ...p, countries: true }));
      axios.get('/api/location/countries')
        .then(res => setCountries(res.data))
        .catch(err => console.error('Failed to fetch countries', err))
        .finally(() => setLoading(p => ({ ...p, countries: false })));
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedCountry) {
      setLoading(p => ({ ...p, states: true }));
      setStates([]);
      setSelectedState(null);
      axios.get(`/api/location/${selectedCountry.code}/states`)
        .then(res => setStates(res.data))
        .catch(err => console.error('Failed to fetch states', err))
        .finally(() => setLoading(p => ({ ...p, states: false })));
    }
  }, [selectedCountry]);

  useEffect(() => {
    if (selectedCountry) {
      const locString = selectedState ? `${selectedState.name}, ${selectedCountry.name}` : selectedCountry.name;
      setLocation(locString);
    }
  }, [selectedCountry, selectedState, setLocation]);

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
          
          <div className="space-y-4">
            <LocationSelector 
              label="Select Country"
              placeholder="e.g. United States"
              value={selectedCountry?.name}
              items={countries}
              isLoading={loading.countries}
              onSelect={setSelectedCountry}
            />

            {countries.length > 0 && (
              <LocationSelector 
                label="Region / State (optional)"
                placeholder="Select region..."
                value={selectedState?.name}
                items={states}
                isLoading={loading.states}
                disabled={!selectedCountry || states.length === 0}
                onSelect={setSelectedState}
              />
            )}
          </div>

          <AnimatedButton 
            disabled={!disease.trim() || !selectedCountry} 
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
