import { onRequest } from "firebase-functions/v2/https";
import { GoogleGenAI } from "@google/genai";

// Initialize GoogleGenAI in vertexai mode.
// It will automatically read GCP project and location configuration from environment or ADC.
const ai = new GoogleGenAI({
  vertexai: true,
  project: process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT_ID,
  location: "us-central1"
});

export const chatProxy = onRequest({ cors: true }, async (req, res) => {
  try {
    const { messages, systemInstruction, modelName, stream } = req.body;

    if (!Array.isArray(messages)) {
      res.status(400).send("Bad Request: 'messages' array is required.");
      return;
    }

    // Clean up the model name. Vertex AI models should be referred by their base names.
    // E.g., if it starts with "models/", strip it.
    let cleanModel = modelName || "gemini-2.5-flash";
    cleanModel = cleanModel.replace(/^models\//, "");

    const ALLOWED_MODELS = [
      "gemini-2.5-flash",
      "gemini-2.5-pro",
      "gemini-1.5-flash",
      "gemini-1.5-pro"
    ];

    if (!ALLOWED_MODELS.includes(cleanModel)) {
      res.status(400).send(`Bad Request: Model '${cleanModel}' is not allowed.`);
      return;
    }

    const contents = messages.map((m: any) => ({
      role: m.role === "system" ? "user" : m.role,
      parts: [{ text: m.content }]
    }));

    if (stream) {
      // Set headers for Server-Sent Events (SSE) streaming
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      });

      const responseStream = await ai.models.generateContentStream({
        model: cleanModel,
        contents,
        config: {
          systemInstruction
        }
      });

      for await (const chunk of responseStream) {
        const text = chunk.text || "";
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } else {
      const response = await ai.models.generateContent({
        model: cleanModel,
        contents,
        config: {
          systemInstruction
        }
      });

      res.status(200).json({ text: response.text || "" });
    }
  } catch (error: any) {
    console.error("Vertex AI Proxy Error:", error);
    
    // If headers are already sent, we write the error inside the event stream
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error.message || String(error) })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message || String(error) });
    }
  }
});
