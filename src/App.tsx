/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Layers, Dna, ArrowRight, Zap, Target, ShieldCheck, Github, User as UserIcon } from 'lucide-react';
import { ModuleId, OceanScores, Message, ComparisonMessage } from './types';
import { INITIAL_OCEAN, INITIAL_MIRROR_MESSAGE } from './constants';
import Mirror from './components/Mirror';
import Tailor from './components/Tailor';
import Playground from './components/Playground';
import FeedbackModal from './components/FeedbackModal';

import { auth, googleProvider, db, logAnalyticsEvent } from './services/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleId>('mirror');
  const [scores, setScores] = useState<OceanScores | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Theme state initialized from localStorage
  const [isLightMode, setIsLightMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      return saved !== 'dark';
    }
    return true;
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
    { role: 'model', content: INITIAL_MIRROR_MESSAGE }
  ]);
  const [playgroundMessages, setPlaygroundMessages] = useState<ComparisonMessage[]>([]);

  // Refs to capture the latest state in the onAuthStateChanged closure
  const scoresRef = useRef(scores);
  const mirrorMessagesRef = useRef(mirrorMessages);
  const playgroundMessagesRef = useRef(playgroundMessages);
  const activeModuleRef = useRef(activeModule);

  useEffect(() => { scoresRef.current = scores; }, [scores]);
  useEffect(() => { mirrorMessagesRef.current = mirrorMessages; }, [mirrorMessages]);
  useEffect(() => { playgroundMessagesRef.current = playgroundMessages; }, [playgroundMessages]);
  useEffect(() => { 
    activeModuleRef.current = activeModule;
    logAnalyticsEvent('module_viewed', { module_id: activeModule });
  }, [activeModule]);

  // Firestore save wrapper (stream-settlement optimized)
  const saveToCloud = async (
    updatedScores: OceanScores | null,
    updatedMirror: Message[],
    updatedPlayground: ComparisonMessage[],
    updatedModule: ModuleId
  ) => {
    if (!auth.currentUser) return;
    try {
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userDocRef, {
        scores: updatedScores,
        mirrorMessages: updatedMirror,
        playgroundMessages: updatedPlayground.map(msg => ({
          user: msg.user,
          aligned: msg.aligned,
          unaligned: msg.unaligned,
          loading: false
        })),
        activeModule: updatedModule,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to save session to cloud:", error);
    }
  };

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        logAnalyticsEvent('auth_state_changed', { status: 'logged_in' });
        // Check for existing cloud profile
        const userDocRef = doc(db, 'users', currentUser.uid);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            setScores(data.scores || null);
            setMirrorMessages(data.mirrorMessages || []);
            setPlaygroundMessages(data.playgroundMessages || []);
            setActiveModule(data.activeModule || 'mirror');
          } else {
            // New user: Migrate local guest session to Cloud
            await setDoc(userDocRef, {
              scores: scoresRef.current,
              mirrorMessages: mirrorMessagesRef.current,
              playgroundMessages: playgroundMessagesRef.current.map(msg => ({
                user: msg.user,
                aligned: msg.aligned,
                unaligned: msg.unaligned,
                loading: false
              })),
              activeModule: activeModuleRef.current,
              updatedAt: serverTimestamp()
            });
          }
        } catch (error) {
          console.error("Error restoring/migrating session:", error);
        }
      } else {
        setUser(null);
        logAnalyticsEvent('auth_state_changed', { status: 'logged_out' });
        // Clean slate on disconnect / local guest mode
        setScores(null);
        setMirrorMessages([
          { role: 'model', content: INITIAL_MIRROR_MESSAGE }
        ]);
        setPlaygroundMessages([]);
        setActiveModule('mirror');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Google Sign-In failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out failed:", error);
    }
  };

  const handleMirrorComplete = (newScores: OceanScores) => {
    setScores(newScores);
    setActiveModule('tailor');
    saveToCloud(newScores, mirrorMessages, playgroundMessages, 'tailor');
  };

  const handleMirrorSave = (updatedMirrorMessages: Message[]) => {
    setMirrorMessages(updatedMirrorMessages);
    saveToCloud(scores, updatedMirrorMessages, playgroundMessages, activeModule);
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
          <span className="font-bold tracking-tight text-sm sm:text-lg">COGNITIVE BRIDGE <span className="hidden sm:inline-block text-[10px] font-mono text-orange-500 ml-1 border border-orange-500/30 px-1 rounded uppercase">v1.0</span></span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-8 mr-2">
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

          {/* Connection Status Bar */}
          <div className="flex items-center gap-2 px-2 py-1.5 sm:px-3 rounded-lg bg-bg-tertiary border border-border-primary text-[10px] uppercase font-bold tracking-wider select-none shadow-sm">
            <span className={`w-1.5 h-1.5 rounded-full ${user ? 'bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]'}`} />
            <span className={`hidden sm:inline ${user ? 'text-green-400' : 'text-amber-500'}`}>
              {user ? 'Cloud Synced' : 'Local Guest'}
            </span>
          </div>

          {/* Profile Calibration Header / Connect Action */}
          {user ? (
            <div className="flex items-center bg-bg-tertiary border border-border-primary rounded-xl p-1 sm:pl-3 sm:pr-2 sm:py-1 select-none shadow-sm">
              <div className="hidden sm:flex flex-col items-end mr-3">
                <span className="text-[10px] font-bold text-text-primary truncate max-w-[100px]" title={user.displayName || user.email || ''}>
                  {user.displayName || user.email?.split('@')[0]}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-[9px] text-text-muted hover:text-red-400 transition-colors uppercase font-bold tracking-wider cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
              <button
                onClick={handleLogout}
                title="Click to Disconnect"
                className="cursor-pointer group relative flex items-center justify-center"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="profile" className="w-7 h-7 rounded-lg border border-border-secondary object-cover group-hover:border-red-500/50 transition-colors" />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center border border-border-secondary text-white text-xs font-bold group-hover:border-red-500/50 transition-colors">
                    {(user.displayName || user.email || '?')[0].toUpperCase()}
                  </div>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              className="flex items-center justify-center gap-2 p-2 sm:px-3.5 sm:py-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[10px] font-bold uppercase tracking-wider transition-all shadow-lg shadow-orange-600/10 cursor-pointer border border-orange-500/20"
              title="Login to Save Results"
            >
              <UserIcon className="w-3.5 h-3.5 text-orange-200 sm:hidden" />
              <Brain className="w-3.5 h-3.5 text-orange-200 hidden sm:inline" />
              <span className="hidden sm:inline">Login to Save Results</span>
            </button>
          )}

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

      {/* Mobile/Tablet Secondary Navigation */}
      <div className="flex md:hidden bg-bg-secondary border-b border-border-primary px-4 py-2.5 justify-around items-center sticky top-16 z-40 transition-colors duration-300">
        {[
          { id: 'mirror', label: '1. Mirror', active: activeModule === 'mirror' },
          { id: 'tailor', label: '2. Tailor', active: activeModule === 'tailor', disabled: !scores },
          { id: 'playground', label: '3. Bridge', active: activeModule === 'playground', disabled: !scores },
        ].map((step) => (
          <button
            key={step.id}
            onClick={() => !step.disabled && setActiveModule(step.id as ModuleId)}
            disabled={step.disabled}
            className={`text-[10px] uppercase tracking-[0.15em] font-bold transition-all px-3.5 py-1.5 rounded-full cursor-pointer ${
              step.active
                ? 'text-text-primary bg-bg-surface border border-border-secondary'
                : step.disabled
                ? 'text-text-muted-darker cursor-not-allowed opacity-50'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            {step.label}
          </button>
        ))}
      </div>

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
                <h1 className="text-4xl font-bold tracking-tighter mb-2">Make Your AI Fit You</h1>
                <p className="text-text-muted text-lg leading-relaxed max-w-2xl">You get along with certain people better than others. It's the same with your AI assistants. Answer a few questions and we'll map your OCEAN personality traits to make your AI fit YOU. (Or, pick one of the examples below to skip ahead!)</p>
              </div>
              <div className="flex-1 min-h-[500px]">
                <Mirror
                  messages={mirrorMessages}
                  setMessages={setMirrorMessages}
                  onComplete={handleMirrorComplete}
                  onSaveSession={handleMirrorSave}
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
                <Tailor
                  scores={scores}
                  onNext={() => {
                    setActiveModule('playground');
                    saveToCloud(scores, mirrorMessages, playgroundMessages, 'playground');
                  }}
                />
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
                  onSaveSession={(updatedPlayground, updatedScores) => {
                    const finalScores = updatedScores || scores;
                    if (updatedScores) {
                      setScores(updatedScores);
                    }
                    saveToCloud(finalScores, mirrorMessages, updatedPlayground, activeModule);
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Branding */}
      <footer className="h-auto md:h-10 border-t border-border-primary px-6 py-4 md:py-0 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0 text-[9px] uppercase tracking-[0.3em] font-bold text-text-muted-darker bg-bg-primary transition-colors duration-300">
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 md:gap-4 text-center">
          <a
            href="https://www.linkedin.com/in/tyler-j-stahl"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-text-primary transition-colors"
          >
            Tyler J. Stahl
          </a>          <span className="text-border-primary">/</span>
          <span>Cognitive Bridge v1.0.4-BETA</span>
          <span className="text-border-primary">/</span>
          <button
            onClick={() => setIsFeedbackOpen(true)}
            className="text-orange-500 hover:text-orange-400 transition-colors cursor-pointer"
          >
            Leave Feedback
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 md:gap-4 text-center">
          <span className="text-orange-500/50">Model: Gemini 3.1 Pro // Flash</span>
          <span className="text-border-primary">/</span>
          <span>Procedural Skills Engine</span>
        </div>
      </footer>

      <FeedbackModal isOpen={isFeedbackOpen} onClose={() => setIsFeedbackOpen(false)} />
    </div>
  );
}
