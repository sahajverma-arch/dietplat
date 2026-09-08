import OpenAI from "openai"

import { env } from "@/lib/env"

export function createOpenAIClient(): OpenAI {
  return new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  })
}

export const OPENAI_MODEL = env.OPENAI_MODEL
