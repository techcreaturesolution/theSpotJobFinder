import OpenAI from 'openai';
import { env } from '../../config/env.js';

let client;

export function llmEnabled() {
  return Boolean(env.openaiApiKey);
}

export async function llmJson(system, user, { maxTokens = 800 } = {}) {
  if (!llmEnabled()) return null;
  client ||= new OpenAI({ apiKey: env.openaiApiKey });
  const res = await client.chat.completions.create({
    model: env.openaiModel,
    temperature: 0.2,
    max_tokens: maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  const text = res.choices?.[0]?.message?.content;
  return text ? JSON.parse(text) : null;
}
