/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, User, Bot, Sparkles, Brain, Loader2, ListTodo } from 'lucide-react';
import { Message, OceanScores } from '../types';
import { MIRROR_SYSTEM_PROMPT } from '../constants';
import { chatWithGeminiStream } from '../services/gemini';

interface MirrorProps {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  onComplete: (scores: OceanScores) => void;
}

export default function Mirror({ messages, setMessages, onComplete }: MirrorProps) {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Estimate progress based on model messages (excluding the first one)
  // Target is roughly 5 scenarios
  const scenarioCount = messages.filter(m => m.role === 'model' && m.content.length > 0).length;
  const maxScenarios = 5;
  const progressPercent = Math.min((scenarioCount / maxScenarios) * 100, 100);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    let modelResponse = '';
    setMessages(prev => [...prev, { role: 'model', content: '' }]);

    const stream = chatWithGeminiStream([...messages, userMessage], MIRROR_SYSTEM_PROMPT);

    for await (const chunk of stream) {
      modelResponse += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, content: modelResponse }];
      });

      // Check for JSON scores in the stream
      if (modelResponse.includes('JSON_SCORES:')) {
        const jsonMatch = modelResponse.match(/JSON_SCORES:\s*(?:```json)?\s*({[\s\S]*?})\s*(?:```)?/);
        if (jsonMatch) {
          try {
            const scoresStr = jsonMatch[1].trim();
            const scores = JSON.parse(scoresStr);
            onComplete(scores);
            break;
          } catch (e) {
            console.error("Failed to parse scores:", e);
          }
        }
      }
    }

    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a] text-white font-sans border border-[#333] rounded-xl overflow-hidden shadow-2xl relative">
      <div className="sticky top-0 z-20 p-4 bg-[#252525]/95 backdrop-blur-sm border-b border-[#333] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-medium tracking-tight text-white">The Mirror</h2>
            <p className="text-xs text-gray-400 uppercase tracking-widest">Psychometric Diagnostic</p>
          </div>
        </div>
        
        <div className="flex flex-col items-end gap-1 min-w-[120px]">
          <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-gray-500">
            <ListTodo className="w-3 h-3" />
            <span>Alignment {Math.min(scenarioCount, maxScenarios)} / {maxScenarios}</span>
          </div>
          <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              className="h-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"
            />
          </div>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth pt-6"
      >
        <AnimatePresence initial={false}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  m.role === 'user' ? 'bg-blue-600' : 'bg-gray-700'
                }`}>
                  {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-[#2d2d2d] text-gray-200 rounded-tl-none border border-[#444]'
                }`}>
                  {m.content.split('JSON_SCORES:')[0]}
                  {m.content.includes('JSON_SCORES:') && (
                    <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg flex items-center gap-3 animate-pulse">
                      <Sparkles className="text-green-500 w-4 h-4" />
                      <span className="text-green-400 font-medium">Cognitive mapping complete.</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#2d2d2d] p-4 rounded-2xl rounded-tl-none border border-[#444] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              <span className="text-xs text-gray-500 italic">Hermes is analyzing...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 bg-[#252525] border-t border-[#333] flex flex-col gap-4">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Respond to the scenario..."
            className="w-full bg-[#1a1a1a] border border-[#444] rounded-full py-3 px-6 pr-12 text-sm focus:outline-none focus:border-orange-500 transition-colors"
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="absolute right-2 p-2 bg-orange-500 rounded-full hover:bg-orange-600 disabled:opacity-50 disabled:bg-gray-600 transition-all shadow-lg"
          >
            <Send className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="border-t border-[#333] pt-3">
          <div className="text-[10px] uppercase font-bold tracking-widest text-gray-500 mb-2 flex items-center gap-1.5 justify-center">
            <Sparkles className="w-3 h-3 text-orange-500" />
            Skip diagnostic using a pre-calibrated test profile:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              onClick={() => onComplete({ openness: 50, conscientiousness: 50, extroversion: 90, agreeableness: 50, neuroticism: 85 })}
              disabled={isLoading}
              className="p-3 rounded-xl border border-[#3c3c3c] bg-[#1a1a1a]/60 hover:bg-[#2c2c2c] hover:border-orange-500 text-left transition-all disabled:opacity-50 group flex flex-col justify-between cursor-pointer"
            >
              <div className="text-[10px] font-bold text-orange-400 uppercase tracking-wide group-hover:text-orange-300 transition-colors">High Extroversion and Neuroticism</div>
              <div className="text-[9px] text-gray-400 mt-1 italic leading-tight">Dampens hyper-reactive anxiety. Provides steady, structural ground.</div>
            </button>
            
            <button
              onClick={() => onComplete({ openness: 50, conscientiousness: 50, extroversion: 15, agreeableness: 50, neuroticism: 90 })}
              disabled={isLoading}
              className="p-3 rounded-xl border border-[#3c3c3c] bg-[#1a1a1a]/60 hover:bg-[#2c2c2c] hover:border-yellow-500 text-left transition-all disabled:opacity-50 group flex flex-col justify-between cursor-pointer"
            >
              <div className="text-[10px] font-bold text-yellow-400 uppercase tracking-wide group-hover:text-yellow-300 transition-colors">Low Extroversion, High Neuroticism</div>
              <div className="text-[9px] text-gray-400 mt-1 italic leading-tight">Enlists high-energy motivation, active encouragement & structure.</div>
            </button>

            <button
              onClick={() => onComplete({ openness: 50, conscientiousness: 15, extroversion: 50, agreeableness: 90, neuroticism: 50 })}
              disabled={isLoading}
              className="p-3 rounded-xl border border-[#3c3c3c] bg-[#1a1a1a]/60 hover:bg-[#2c2c2c] hover:border-purple-500 text-left transition-all disabled:opacity-50 group flex flex-col justify-between cursor-pointer"
            >
              <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wide group-hover:text-purple-300 transition-colors">Low Conscientiousness, High Agreeableness</div>
              <div className="text-[9px] text-gray-400 mt-1 italic leading-tight">Counteracts consensus seeking. Mandates precision & clear definitions.</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
