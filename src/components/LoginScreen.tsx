import React, { useState } from 'react';
import { useGameStore } from '../store/gameStore';

export const LoginScreen: React.FC = () => {
    const [nickname, setNickname] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const setMe = useGameStore(state => state.setMe);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nickname.trim()) return;

        setLoading(true);
        setError('');

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nickname })
            });

            const data = await res.json();
            
            if (res.ok) {
                setMe(data.player);
            } else {
                setError(data.error || 'Failed to login');
            }
        } catch (err: any) {
            console.error("Login fetch error:", err);
            setError(`Network error: ${err.message || String(err)}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen w-screen items-center justify-center bg-gray-900 bg-opacity-90 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
             <div className="bg-slate-800 p-8 rounded-xl shadow-2xl border border-slate-700 w-full max-w-sm backdrop-blur-sm bg-opacity-80">
                  <h1 className="text-3xl text-white font-bold text-center mb-2 tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                      SWORD ART ONLINE
                  </h1>
                  <p className="text-center text-slate-400 text-sm mb-8 uppercase tracking-widest">Prototype</p>

                  <form onSubmit={handleLogin} className="flex flex-col gap-4">
                      <div>
                          <label className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-2 block">Link Start: Nickname</label>
                          <input 
                              type="text" 
                              required
                              value={nickname}
                              onChange={(e) => setNickname(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-600 rounded-md px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                              placeholder="Enter your name..."
                          />
                      </div>
                      
                      {error && <p className="text-red-400 text-sm text-center">{error}</p>}

                      <button 
                          type="submit" 
                          disabled={loading}
                          className="mt-4 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:text-slate-400 text-white font-bold py-3 px-4 rounded-md uppercase tracking-wider transition-colors"
                      >
                          {loading ? 'Connecting...' : 'Link Start'}
                      </button>
                  </form>
             </div>
        </div>
    );
};
