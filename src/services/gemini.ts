/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI } from "@google/genai";
import { Message } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function chatWithGemini(
  messages: Message[],
  systemInstruction?: string,
  modelName: string = "gemini-3-flash-preview"
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

    return response.text || "";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "I encountered an error connecting to the intelligence bridge.";
  }
}

export async function* chatWithGeminiStream(
  messages: Message[],
  systemInstruction?: string,
  modelName: string = "gemini-3-flash-preview"
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

    for await (const chunk of stream) {
      yield chunk.text || "";
    }
  } catch (error) {
    console.error("Gemini Streaming Error:", error);
    yield "Error connecting to the stream.";
  }
}
