/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Message } from "../types";
import { db, auth } from "./firebase";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

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
) {
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: messages.map(m => ({
        role: m.role === 'system' ? 'user' : m.role, // System instructions are separate in this SDK
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
        modelName,
        promptTokens: usage.promptTokenCount ?? 0,
        completionTokens: usage.candidatesTokenCount ?? 0,
        totalTokens: usage.totalTokenCount ?? 0,
        feature
      });
    }

    return response.text || "";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I encountered an error connecting to the intelligence bridge.";
  }
}

export async function* chatWithGeminiStream(
  messages: Message[],
  systemInstruction?: string,
  modelName: string = "gemini-3-flash-preview",
  feature?: string
) {
  try {
    const stream = await ai.models.generateContentStream({
      model: modelName,
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
      yield chunk.text || "";
    }

    if (finalUsageMetadata) {
      logTokenUsage({
        modelName,
        promptTokens: finalUsageMetadata.promptTokenCount ?? 0,
        completionTokens: finalUsageMetadata.candidatesTokenCount ?? 0,
        totalTokens: finalUsageMetadata.totalTokenCount ?? 0,
        feature
      });
    }
  } catch (error) {
    console.error("Gemini Streaming Error:", error);
    yield "Error connecting to the stream.";
  }
}
