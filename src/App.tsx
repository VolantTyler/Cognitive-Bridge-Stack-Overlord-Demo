/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Layers, Dna, ArrowRight, Zap, Target, ShieldCheck, Github } from 'lucide-react';
import { ModuleId, OceanScores, Message, ComparisonMessage } from './types';
import { INITIAL_OCEAN } from './constants';
import Mirror from './components/Mirror';
import Tailor from './components/Tailor';
import Playground from './components/Playground';

export default function App() {
  const [activeModule, setActiveModule] = useState<ModuleId>('mirror');
  const [scores, setScores] = useState<OceanScores | null>(null);
  
  // Theme state initialized from localStorage
  const [isLightMode, setIsLightMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved === 'light';
    }
    return false;
  });

  // Synchronize class list on document element
  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
    localStorage.setItem('theme', isLightMode ? 'light' : 'dark');
  }, [isLightMode]);

  const toggleTheme = () => {
    setIsLightMode(prev => !prev);
  };

  const [mirrorMessages, setMirrorMessages] = useState<Message[]>([
    { role: 'model', content: "Welcome to the Mirror. I am here to explore the architecture of your mind. Let's begin with a scenario. You are 10 minutes away from a critical project demo when you discover a significant bug. Do you apply a quick, messy 'dirty hack' to fix it for the demo, or do you cancel the presentation to resolve it properly?" }
  ]);
  const [playgroundMessages, setPlaygroundMessages] = useState<ComparisonMessage[]>([]);

  const handleMirrorComplete = (newScores: OceanScores) => {
    setScores(newScores);
    setActiveModule('tailor');
  };

  const currentStep = scores ? (activeModule === 'playground' ? 3 : 2) : 1;

  return (
    <div className="min-h-screen bg-bg-primary text-text-secondary flex flex-col font-sans transition-colors duration-300">
      {/* Navigation Header */}
      <nav className="h-16 bg-bg-secondary border-b border-border-primary px-6 flex items-center justify-between z-50 sticky top-0 transition-colors duration-300">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/10">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold tracking-tight text-lg">COGNITIVE BRIDGE <span className="text-[10px] font-mono text-orange-500 ml-1 border border-orange-500/30 px-1 rounded uppercase">v1.0</span></span>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-8">
            {[
              { id: 'mirror', label: '1. The Mirror', active: activeModule === 'mirror' },
              { id: 'tailor', label: '2. The Tailor', active: activeModule === 'tailor', disabled: !scores },
              { id: 'playground', label: '3. The Bridge', active: activeModule === 'playground', disabled: !scores },
            ].map((step) => (
              <button
                key={step.id}
                onClick={() => !step.disabled && setActiveModule(step.id as ModuleId)}
                disabled={step.disabled}
                className={`text-xs uppercase tracking-[0.2em] font-bold transition-all px-4 py-2 rounded-full cursor-pointer ${step.active
                  ? 'text-text-primary bg-bg-surface border border-border-secondary'
                  : step.disabled ? 'text-text-muted-darker cursor-not-allowed' : 'text-text-muted hover:text-text-primary'
                  }`}
              >
                {step.label}
              </button>
            ))}
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-bg-tertiary border border-border-primary text-text-muted hover:text-text-primary hover:bg-bg-surface transition-all flex items-center justify-center cursor-pointer shadow-sm relative group overflow-hidden"
            aria-label="Toggle theme"
            id="theme-toggle-btn"
          >
            <svg 
              className="w-5 h-5 transition-transform duration-500 group-hover:rotate-12 text-text-muted hover:text-text-primary"
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              {/* Sun rays on the left side */}
              <path d="M12 2v2" />
              <path d="M4.93 4.93l1.41 1.41" />
              <path d="M2 12h2" />
              <path d="M4.93 19.07l1.41-1.41" />
              <path d="M12 20v2" />
              
              {/* Sun left half (filled) */}
              <path d="M12 5 A 7 7 0 0 0 12 19 Z" fill="currentColor" />
              
              {/* Moon right crescent (filled) */}
              <path d="M12 5 A 7 7 0 0 1 12 19 A 5 5 0 0 0 12 5 Z" fill="currentColor" />
            </svg>
          </button>
        </div>

      </nav>

      {/* Hero / Information Bar (Only on Mirror) */}
      {activeModule === 'mirror' && (
        <div className="bg-bg-tertiary border-b border-border-primary py-3 px-6 overflow-hidden transition-colors duration-300">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-orange-500" />
                <span className="text-[10px] uppercase font-bold text-text-muted-dark">Recursive Reasoning</span>
              </div>
              <div className="flex items-center gap-2">
                <Target className="w-3 h-3 text-blue-500" />
                <span className="text-[10px] uppercase font-bold text-text-muted-dark">Bias Suppression</span>
              </div>
              <div className="flex items-center gap-2 text-green-500">
                <ShieldCheck className="w-3 h-3" />
                <span className="text-[10px] uppercase font-bold">Stable R&D Build</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-10 flex flex-col min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeModule === 'mirror' && (
            <motion.div
              key="mirror"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 flex flex-col"
            >
              <div className="mb-8">
                <h1 className="text-4xl font-bold tracking-tighter mb-2">Initialize Cognitive Profile</h1>
                <p className="text-text-muted text-lg leading-relaxed max-w-2xl">Step into the Mirror. Through scenario-based stress tests, we will map your OCEAN personality traits to calibrate your personal AI shard.</p>
              </div>
              <div className="flex-1 min-h-[500px]">
                <Mirror
                  messages={mirrorMessages}
                  setMessages={setMirrorMessages}
                  onComplete={handleMirrorComplete}
                />
              </div>
            </motion.div>
          )}

          {activeModule === 'tailor' && scores && (
            <motion.div
              key="tailor"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex-1 flex flex-col"
            >
              <div className="mb-8 flex items-end justify-between uppercase tracking-widest text-[10px] font-bold text-orange-500">
                <span>Phase 2: Synthesis Complete</span>
                <span className="text-text-muted-dark">Bridge Active</span>
              </div>
              <div className="flex-1">
                <Tailor scores={scores} onNext={() => setActiveModule('playground')} />
              </div>
            </motion.div>
          )}

          {activeModule === 'playground' && scores && (
            <motion.div
              key="playground"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex-1 flex flex-col"
            >
              <div className="mb-6">
                <h2 className="text-3xl font-bold tracking-tight">Interfacing with Aligned Intelligence</h2>
                <p className="text-text-muted mt-1">Directives mapped. Prompt fatigue eliminated. Communicate with your matched model.</p>
              </div>
              <div className="flex-1 min-h-0">
                <Playground
                  scores={scores}
                  messages={playgroundMessages}
                  setMessages={setPlaygroundMessages}
                  setScores={setScores}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Branding */}
      <footer className="h-10 border-t border-border-primary px-6 flex items-center justify-between text-[9px] uppercase tracking-[0.3em] font-bold text-text-muted-darker bg-bg-primary transition-colors duration-300">
        <div className="flex gap-4">
          <span>Tyler J. Stahl</span>
          <span className="text-border-primary">/</span>
          <span>Cognitive Bridge v1.0.4-BETA</span>
        </div>
        <div className="flex gap-4">
          <span className="text-orange-500/50">Model: Gemini 3.1 Pro // Flash</span>
          <span className="text-border-primary">/</span>
          <span>Procedural Skills Engine</span>
        </div>
      </footer>
    </div>
  );
}
