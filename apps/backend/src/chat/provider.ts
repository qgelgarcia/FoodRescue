import { ANSWER_PROMPT, CLASSIFIER_PROMPT, containsCredential, fixedScopeReply, localGuard, SCOPES, SCOPE_REPLY, type ChatMessage, type ChatScope } from './policy.js';

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
export const DEFAULT_FREE_MODEL = 'nvidia/nemotron-3.5-lightning:free';
const CONNECTION_SETUP_MESSAGE = 'The AI connection needs attention. Please contact support so we can reconnect the assistant.';
type Completion = { choices?: { finish_reason?: string; message?: { content?: unknown; refusal?: unknown } }[] };
type Fetcher = typeof fetch;

export class ChatProviderError extends Error {
  constructor(public readonly status = 503, message = 'The assistant is unavailable right now. Please try again shortly.') { super(message); }
}

async function completion(system: string, messages: ChatMessage[], schema: Record<string, unknown>, maxTokens: number, signal: AbortSignal, fetcher: Fetcher): Promise<Record<string, unknown>> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey?.trim()) throw new ChatProviderError(503, CONNECTION_SETUP_MESSAGE);
  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_FREE_MODEL;
  if (model !== DEFAULT_FREE_MODEL) {
    throw new ChatProviderError(503, 'Only nvidia/nemotron-3.5-lightning:free is permitted. Please contact support to correct the assistant configuration.');
  }

  const response = await fetcher(ENDPOINT, {
    method: 'POST', signal,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'X-Title': 'FoodRescue Assistant' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...messages],
      temperature: 0.2, max_tokens: maxTokens,
      provider: { require_parameters: true, data_collection: 'deny', zdr: true, max_price: { prompt: 0, completion: 0, request: 0 } },
      response_format: { type: 'json_schema', json_schema: { name: 'foodrescue_response', strict: true, schema } },
    }),
  });
  if (!response.ok) {
    await response.body?.cancel();
    if (response.status === 404) throw new ChatProviderError(503, 'No compatible free AI server is available right now. Please try again later.');
    if ([401, 403].includes(response.status)) throw new ChatProviderError(503, CONNECTION_SETUP_MESSAGE);
    throw new ChatProviderError(response.status === 429 ? 429 : 503,
      response.status === 429 ? 'The free AI service is busy. Please wait a moment before trying again.' : undefined);
  }
  const result = await response.json() as Completion;
  const choice = result.choices?.[0];
  if (choice?.finish_reason !== 'stop' || choice.message?.refusal || typeof choice.message?.content !== 'string') throw new ChatProviderError();
  if (choice.message.content.length > 12000) throw new ChatProviderError();
  try {
    const decoded: unknown = JSON.parse(choice.message.content);
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw new Error();
    return decoded as Record<string, unknown>;
  } catch { throw new ChatProviderError(); }
}

const scopeSchema = { type: 'object', additionalProperties: false, properties: { scope: { type: 'string', enum: SCOPES } }, required: ['scope'] };
const answerSchema = { type: 'object', additionalProperties: false, properties: { scope: { type: 'string', enum: SCOPES }, answer: { type: 'string' } }, required: ['scope', 'answer'] };

function scopeOf(value: unknown): ChatScope {
  if (typeof value !== 'string' || !SCOPES.includes(value as ChatScope)) throw new ChatProviderError();
  return value as ChatScope;
}

export async function answerChat(history: ChatMessage[], message: string, externalSignal?: AbortSignal, fetcher: Fetcher = fetch): Promise<string> {
  if (typeof message !== 'string' || !message.trim() || message.length > 2000) throw new ChatProviderError(400, 'Enter a message of 1–2,000 characters.');
  if (containsCredential(message)) throw new ChatProviderError(400, 'Do not share passwords, API keys or sign-in tokens in chat.');
  const blocked = localGuard(message);
  if (blocked) return blocked;
  const context = history.slice(-16).map(item => {
    if (!['user', 'assistant'].includes(item.role) || typeof item.content !== 'string' || containsCredential(item.content)) throw new ChatProviderError();
    return { role: item.role, content: item.content.slice(0, 4000) };
  });
  const signal = externalSignal ? AbortSignal.any([externalSignal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000);
  try {
    const classified = await completion(CLASSIFIER_PROMPT, [...context, { role: 'user', content: message }], scopeSchema, 80, signal, fetcher);
    const scope = scopeOf(classified.scope);
    const refusal = fixedScopeReply(scope);
    if (refusal) return refusal;
    const result = await completion(ANSWER_PROMPT, [...context, { role: 'user', content: message }], answerSchema, 750, signal, fetcher);
    const returnedScope = scopeOf(result.scope);
    const finalRefusal = fixedScopeReply(returnedScope);
    if (finalRefusal) return finalRefusal;
    if (typeof result.answer !== 'string' || !result.answer.trim() || result.answer.length > 6000) throw new ChatProviderError();
    if (containsCredential(result.answer)) return SCOPE_REPLY;
    // Never render instructions/credential disclosure or extreme restriction as an answer.
    if (localGuard(result.answer)) return fixedScopeReply('out_of_scope')!;
    return scope === 'nutrition'
      ? `Nutrition amounts are estimates and vary by portion and preparation.\n\n${result.answer.trim()}`
      : result.answer.trim();
  } catch (error) {
    if (error instanceof ChatProviderError) throw error;
    if (signal.aborted) throw new ChatProviderError(504, 'The assistant took too long. Please try again.');
    throw new ChatProviderError();
  }
}
