/**
 * Dev-only tool: lists the models this OPENAI_API_KEY can actually reach,
 * so OPENAI_MODEL is chosen against a live catalogue rather than a guessed
 * slug — the same discipline NVIDIA_MODEL was picked with in Prompt 7.
 *   npx tsx --env-file=.env.local scripts/list-openai-models.ts
 * Never imported by production code.
 */
import OpenAI from "openai"

async function main() {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  const page = await client.models.list()
  const ids = page.data.map((m) => m.id).sort()
  const chat = ids.filter((id) => /^(gpt|o\d|chatgpt)/.test(id) && !/(embedding|tts|whisper|dall-e|moderation|audio|realtime|image|transcribe|search|codex)/.test(id))
  console.log(`Total models visible: ${ids.length}`)
  console.log(`\nChat-capable candidates (${chat.length}):`)
  chat.forEach((id) => console.log(`  ${id}`))
}

main().catch((err) => {
  console.error(err?.message ?? err)
  process.exit(1)
})
