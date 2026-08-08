import OpenAI from "openai"

import { env } from "@/lib/env"

export function createNvidiaClient(): OpenAI {
  return new OpenAI({
    baseURL: "https://integrate.api.nvidia.com/v1",
    apiKey: env.NVIDIA_API_KEY,
  })
}

export const NVIDIA_MODEL = env.NVIDIA_MODEL
