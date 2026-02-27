import OpenAI from "openai";
import { env } from "./env";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY() });
  }
  return client;
}
