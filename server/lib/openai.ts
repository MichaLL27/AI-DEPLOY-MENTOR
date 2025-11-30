import OpenAI from "openai";

// Initialize OpenAI with the provided API key
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.warn("OPENAI_API_KEY is not set. AI features will fail.");
}

export const openai = new OpenAI({
  apiKey: apiKey,
});
