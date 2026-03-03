import OpenAI from "openai";
import { wrapOpenAI } from "langsmith/wrappers/openai";
import { env } from "./env";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (!client) {
    client = wrapOpenAI(new OpenAI({ apiKey: env.OPENAI_API_KEY() }));
  }
  return client;
}
