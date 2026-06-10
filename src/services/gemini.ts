/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Message } from "../types";
import { db, auth } from "./firebase";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Constants for retry logic
const MAX_ATTEMPTS_PER_MODEL = 2;
const RETRY_DELAY_MS = 1000;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface ModelInfo {
  name: string;
  version: number;
  isPro: boolean;
  isFlash: boolean;
  isLite: boolean;
  isPreview: boolean;
}

export function parseModelName(name: string): ModelInfo {
  const cleanName = name.replace(/^models\//, '').toLowerCase();
  
  // Extract version number (e.g. gemini-3.5-flash -> 3.5, gemini-3.1-pro-preview -> 3.1)
  const versionMatch = cleanName.match(/gemini-(\d+(?:\.\d+)?)/);
  const version = versionMatch ? parseFloat(versionMatch[1]) : 0;
  
  const isPro = cleanName.includes('pro');
  const isFlash = cleanName.includes('flash') && !cleanName.includes('lite');
  const isLite = cleanName.includes('lite') || cleanName.includes('flash-lite');
  const isPreview = cleanName.includes('preview');
  
  return {
    name,
    version,
    isPro,
    isFlash,
    isLite,
    isPreview,
  };
}

export let activeModelsCache: string[] = [];
let isFetchingModels = false;

export async function refreshActiveModelsList(apiKey?: string) {
  if (isFetchingModels) return;
  isFetchingModels = true;
  try {
    const key = apiKey || process.env.GEMINI_API_KEY || '';
    if (!key) return;
    const client = new GoogleGenAI({ apiKey: key });
    const response = await client.models.list();
    const list: string[] = [];
    if (response) {
      if (typeof (response as any)[Symbol.asyncIterator] === 'function') {
        for await (const m of (response as any)) {
          const name = m.name || '';
          const actions = m.supportedActions || [];
          if (name.startsWith('models/gemini-') && actions.includes('generateContent')) {
            list.push(name);
          }
        }
      } else if (Array.isArray(response)) {
        for (const m of response) {
          const name = m.name || '';
          const actions = m.supportedActions || [];
          if (name.startsWith('models/gemini-') && actions.includes('generateContent')) {
            list.push(name);
          }
        }
      } else if (typeof response === 'object') {
        const modelsArray = (response as any).models || (response as any).list;
        if (Array.isArray(modelsArray)) {
          for (const m of modelsArray) {
            const name = m.name || '';
            const actions = m.supportedActions || [];
            if (name.startsWith('models/gemini-') && actions.includes('generateContent')) {
              list.push(name);
            }
          }
        }
      }
    }
    if (list.length > 0) {
      activeModelsCache = list;
      console.log("Dynamically loaded active Gemini models:", activeModelsCache);
    }
  } catch (error) {
    console.error("Failed to dynamically fetch active Gemini models:", error);
  } finally {
    isFetchingModels = false;
  }
}

// Start fetching on service initialization
refreshActiveModelsList();

export function getDynamicModelFallbacks(requestedModel: string): string[] {
  const fullName = requestedModel.startsWith('models/') ? requestedModel : `models/${requestedModel}`;
  
  const staticProFallbacks = [
    'gemini-3.1-pro-preview',
    'gemini-3-pro-preview',
    'gemini-2.5-pro',
    'gemini-1.5-pro',
    'gemini-2.5-flash',
    'gemini-1.5-flash'
  ];
  
  const staticFlashFallbacks = [
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-1.5-flash'
  ];

  const getStaticFallback = (list: string[]) => {
    const fullList = list.map(m => m.startsWith('models/') ? m : `models/${m}`);
    const filtered = fullList.filter(m => m !== fullName);
    const result = [fullName, ...filtered];
    
    const originalHasPrefix = requestedModel.startsWith('models/');
    // Limit to at most 6 models to prevent excessive retry fallback loops
    return result.map(name => originalHasPrefix ? name : name.replace(/^models\//, '')).slice(0, 6);
  };

  // If cache is empty, return static fallbacks
  if (activeModelsCache.length === 0) {
    if (fullName.includes('pro')) {
      return getStaticFallback(staticProFallbacks);
    }
    return getStaticFallback(staticFlashFallbacks);
  }

  try {
    const reqInfo = parseModelName(fullName);
    const parsedCache = activeModelsCache.map(m => parseModelName(m));
    
    const proModels = parsedCache.filter(m => m.isPro);
    const flashModels = parsedCache.filter(m => m.isFlash);
    const liteModels = parsedCache.filter(m => m.isLite);
    
    const sortModels = (a: ModelInfo, b: ModelInfo) => {
      if (a.version !== b.version) {
        return b.version - a.version;
      }
      if (a.isPreview && !b.isPreview) return 1;
      if (!a.isPreview && b.isPreview) return -1;
      return 0;
    };
    
    proModels.sort(sortModels);
    flashModels.sort(sortModels);
    liteModels.sort(sortModels);
    
    const fallbacks: string[] = [fullName];
    
    if (reqInfo.isPro) {
      // 1. Pro models with version <= requested version
      const lowerPro = proModels.filter(m => m.version <= reqInfo.version && m.name !== fullName);
      fallbacks.push(...lowerPro.map(m => m.name));
      
      // 2. Then Flash models with version <= requested version
      const lowerFlash = flashModels.filter(m => m.version <= reqInfo.version);
      fallbacks.push(...lowerFlash.map(m => m.name));
    } else {
      // It's a Flash or Lite model
      // 1. Flash models with version <= requested version
      const lowerFlash = flashModels.filter(m => m.version <= reqInfo.version && m.name !== fullName);
      fallbacks.push(...lowerFlash.map(m => m.name));
      
      // 2. Then Lite models with version <= requested version
      const lowerLite = liteModels.filter(m => m.version <= reqInfo.version);
      fallbacks.push(...lowerLite.map(m => m.name));
      
      // 3. Then Pro models as ultimate fallbacks
      const lowerPro = proModels.filter(m => m.version <= reqInfo.version);
      fallbacks.push(...lowerPro.map(m => m.name));
    }
    
    // Absolute fallback: add remaining models to guarantee backup
    const remaining = parsedCache.filter(m => !fallbacks.includes(m.name));
    remaining.sort(sortModels);
    fallbacks.push(...remaining.map(m => m.name));
    
    const originalHasPrefix = requestedModel.startsWith('models/');
    const finalFallbacks = fallbacks.map(name => {
      return originalHasPrefix ? name : name.replace(/^models\//, '');
    });
    
    // Limit to at most 6 models to prevent excessive retry fallback loops
    return Array.from(new Set(finalFallbacks)).slice(0, 6);
  } catch (err) {
    console.error("Error building dynamic fallback list, reverting to static list:", err);
    if (fullName.includes('pro')) {
      return getStaticFallback(staticProFallbacks);
    }
    return getStaticFallback(staticFlashFallbacks);
  }
}

export function isTransientError(error: any): boolean {
  if (!error) return false;
  
  if (error.code === 503 || error.status === 503) return true;
  
  if (error.error) {
    if (error.error.code === 503 || error.error.status === 503) return true;
    if (typeof error.error.message === 'string') {
      const msg = error.error.message.toLowerCase();
      if (msg.includes('503') || msg.includes('unavailable') || msg.includes('high demand')) {
        return true;
      }
    }
  }

  const msg = String(error.message || error).toLowerCase();
  if (msg.includes('503') || msg.includes('unavailable') || msg.includes('high demand') || msg.includes('temporarily unavailable')) {
    return true;
  }
  
  return false;
}

export function isProjectWideError(error: any): boolean {
  if (!error) return false;
  
  const status = error.status || error.code || (error.error && (error.error.status || error.error.code));
  if (status === 403) return true;
  
  const msg = String(error.message || (error.error && error.error.message) || error).toLowerCase();
  if (
    msg.includes('spending cap') ||
    msg.includes('api key') ||
    msg.includes('billing') ||
    msg.includes('quota') ||
    msg.includes('resource_exhausted') ||
    msg.includes('credentials')
  ) {
    return true;
  }
  
  return false;
}

export async function logTokenUsage(data: {
  modelName: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  feature?: string;
}) {
  try {
    const userId = auth.currentUser?.uid || "guest";
    await addDoc(collection(db, "token_usage"), {
      userId,
      model: data.modelName,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      totalTokens: data.totalTokens,
      feature: data.feature || "unknown",
      timestamp: serverTimestamp(),
    });
  } catch (error) {
    console.error("Failed to log token usage to Firestore:", error);
  }
}

export async function chatWithGemini(
  messages: Message[],
  systemInstruction?: string,
  modelName: string = "gemini-3-flash-preview",
  feature?: string
): Promise<string> {
  if (activeModelsCache.length === 0) {
    refreshActiveModelsList();
  }

  const modelsToTry = getDynamicModelFallbacks(modelName);
  
  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      try {
        console.log(`Attempting chatWithGemini with model: ${model} (attempt ${attempt}/${MAX_ATTEMPTS_PER_MODEL})`);
        const response = await ai.models.generateContent({
          model: model,
          contents: messages.map(m => ({
            role: m.role === 'system' ? 'user' : m.role,
            parts: [{ text: m.content }]
          })),
          config: {
            systemInstruction: systemInstruction,
          },
        });

        // Extract and log token usage
        const usage = response.usageMetadata;
        if (usage) {
          logTokenUsage({
            modelName: model,
            promptTokens: usage.promptTokenCount ?? 0,
            completionTokens: usage.candidatesTokenCount ?? 0,
            totalTokens: usage.totalTokenCount ?? 0,
            feature
          });
        }

        return response.text || "";
      } catch (error) {
        console.error(`Error on model ${model} (attempt ${attempt}):`, error);
        
        if (isProjectWideError(error)) {
          console.error("Project-wide error encountered (billing/credentials/quota). Aborting model fallback.");
          return "I encountered an error connecting to the intelligence bridge.";
        }
        
        const isTransient = isTransientError(error);
        const isLastAttemptForModel = attempt === MAX_ATTEMPTS_PER_MODEL;
        const isLastModel = model === modelsToTry[modelsToTry.length - 1];
        
        if (isTransient && !isLastAttemptForModel) {
          console.warn(`Transient error detected. Retrying ${model} in ${RETRY_DELAY_MS}ms...`);
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        
        if (isLastModel && isLastAttemptForModel) {
          console.error("Gemini API Error (all fallbacks failed):", error);
          return "I encountered an error connecting to the intelligence bridge.";
        }
        
        console.warn(`Switching from ${model} to next fallback model...`);
        break; // break out of the attempt loop to move to the next model
      }
    }
  }

  return "I encountered an error connecting to the intelligence bridge.";
}

export async function* chatWithGeminiStream(
  messages: Message[],
  systemInstruction?: string,
  modelName: string = "gemini-3-flash-preview",
  feature?: string,
  onFallback?: (failedModel: string, nextModel: string) => void
): AsyncGenerator<string, void, unknown> {
  if (activeModelsCache.length === 0) {
    refreshActiveModelsList();
  }

  const modelsToTry = getDynamicModelFallbacks(modelName);
  let chunksYielded = 0;

  try {
    for (const model of modelsToTry) {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
        try {
          console.log(`Attempting chatWithGeminiStream with model: ${model} (attempt ${attempt}/${MAX_ATTEMPTS_PER_MODEL})`);
          const stream = await ai.models.generateContentStream({
            model: model,
            contents: messages.map(m => ({
              role: m.role === 'system' ? 'user' : m.role,
              parts: [{ text: m.content }]
            })),
            config: {
              systemInstruction: systemInstruction,
            },
          });

          let finalUsageMetadata: any = null;

          for await (const chunk of stream) {
            if (chunk.usageMetadata) {
              finalUsageMetadata = chunk.usageMetadata;
            }
            const text = chunk.text || "";
            if (text) {
              yield text;
              chunksYielded++;
            }
          }

          if (finalUsageMetadata) {
            logTokenUsage({
              modelName: model,
              promptTokens: finalUsageMetadata.promptTokenCount ?? 0,
              completionTokens: finalUsageMetadata.candidatesTokenCount ?? 0,
              totalTokens: finalUsageMetadata.totalTokenCount ?? 0,
              feature
            });
          }
          
          return; // Successfully finished streaming
        } catch (error) {
          console.error(`Streaming error on model ${model} (attempt ${attempt}):`, error);
          
          // If we have already yielded some chunks to the client, we cannot retry/fallback
          // because we would duplicate/corrupt the response.
          if (chunksYielded > 0) {
            console.error("Error occurred mid-stream. Cannot retry/fallback as chunks were already yielded.");
            yield "\n[Stream interrupted due to connection error]";
            return;
          }
          
          if (isProjectWideError(error)) {
            console.error("Project-wide streaming error encountered (billing/credentials/quota). Aborting model fallback.");
            throw error;
          }
          
          const isTransient = isTransientError(error);
          const isLastAttemptForModel = attempt === MAX_ATTEMPTS_PER_MODEL;
          const isLastModel = model === modelsToTry[modelsToTry.length - 1];
          
          if (isTransient && !isLastAttemptForModel) {
            console.warn(`Transient streaming error detected. Retrying ${model} in ${RETRY_DELAY_MS}ms...`);
            await sleep(RETRY_DELAY_MS);
            continue;
          }
          
          if (isLastModel && isLastAttemptForModel) {
            throw error; // Propagate to outer try-catch
          }
          
          const nextModelIndex = modelsToTry.indexOf(model) + 1;
          const nextModel = modelsToTry[nextModelIndex] || 'unknown';
          console.warn(`Switching from ${model} to next fallback model for streaming...`);
          if (onFallback) {
            onFallback(model, nextModel);
          }
          break; // Try next model
        }
      }
    }
  } catch (finalError) {
    console.error("Gemini Streaming Error (all fallbacks failed):", finalError);
    yield "Error connecting to the stream.";
  }
}
