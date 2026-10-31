import { Router, type Request, type Response } from 'express';
import { containsCredential } from '../chat/policy.js';
import { answerChat, ChatProviderError } from '../chat/provider.js';
import { ChatStorageError, createChatStorage } from '../chat/storage.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const messageLimit = 2000;
const maxMessages = 40;
const requestsPerMinute = 10;
const requestsPerDay = 100;
const limiterCapacity = 4096;
const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;

type Storage = ReturnType<typeof createChatStorage>;
type ChatRequest = Request & { chatUserId?: string };

export function createChatRouter(dependencies: {
  storage?: Storage;
  answer?: typeof answerChat;
  now?: () => number;
} = {}) {
  const storage = dependencies.storage ?? createChatStorage();
  const answer = dependencies.answer ?? answerChat;
  const now = dependencies.now ?? Date.now;
  const router = Router();
  const inFlight = new Set<string>();
  // ponytail: process-local 10/min and 100/day guard; use shared storage before horizontal scaling.
  const attempts = new Map<string, { minuteAt: number; minuteCount: number; dayAt: number; dayCount: number }>();

  router.use(async (request: ChatRequest, response: Response, next) => {
    const authorization = request.get('authorization') ?? '';
    const match = /^Bearer ([^\s]+)$/i.exec(authorization);
    if (!match) {
      response.status(401).json({ error: 'AUTH_REQUIRED', message: 'Sign in to use chat.' });
      return;
    }
    try {
      const userId = await storage.getUser(match[1]);
      if (!userId) {
        response.status(401).json({ error: 'AUTH_REQUIRED', message: 'Your session is invalid or expired.' });
        return;
      }
      if (!await storage.isActive(userId)) {
        response.status(403).json({ error: 'ACCOUNT_INACTIVE', message: 'An active account is required to use chat.' });
        return;
      }
      request.chatUserId = userId;
      next();
    } catch {
      response.status(503).json({ error: 'CHAT_UNAVAILABLE', message: 'Chat is temporarily unavailable.' });
    }
  });

  router.get('/conversations', async (request: ChatRequest, response: Response) => {
    try {
      response.json({ conversations: await storage.listConversations(request.chatUserId!) });
    } catch {
      unavailable(response);
    }
  });

  router.post('/conversations', async (request: ChatRequest, response: Response) => {
    if (!emptyObject(request.body)) {
      response.status(400).json({ error: 'INVALID_BODY', message: 'Conversation creation does not accept fields.' });
      return;
    }
    if (!takeRateToken(attempts, request.chatUserId!, now())) return rateLimited(response);
    try {
      response.status(201).json({ conversation: await storage.createConversation(request.chatUserId!) });
    } catch (error) {
      if (error instanceof ChatStorageError && error.code === 'CHAT_CONVERSATION_LIMIT') {
        response.status(409).json({ error: error.code, message: 'You have reached the 100 saved conversation limit.' });
        return;
      }
      if (error instanceof ChatStorageError && error.code === 'CHAT_INACTIVE') {
        response.status(403).json({ error: error.code, message: 'An active account is required to use chat.' });
        return;
      }
      unavailable(response);
    }
  });

  router.get('/conversations/:id', async (request: ChatRequest, response: Response) => {
    if (!uuidPattern.test(request.params.id)) return invalidId(response);
    try {
      const conversation = await storage.getConversation(request.chatUserId!, request.params.id);
      if (!conversation) return notFound(response);
      const messages = await storage.listMessages(request.chatUserId!, request.params.id);
      response.json({ conversation, messages: messages ?? [] });
    } catch {
      unavailable(response);
    }
  });

  router.delete('/conversations/:id', async (request: ChatRequest, response: Response) => {
    if (!uuidPattern.test(request.params.id)) return invalidId(response);
    try {
      if (!await storage.deleteConversation(request.chatUserId!, request.params.id)) return notFound(response);
      response.status(204).end();
    } catch {
      unavailable(response);
    }
  });

  router.post('/conversations/:id/messages', async (request: ChatRequest, response: Response) => {
    if (!uuidPattern.test(request.params.id)) return invalidId(response);
    if (!isMessageBody(request.body)) {
      response.status(400).json({ error: 'INVALID_BODY', message: 'Send a message and requestId only.' });
      return;
    }
    const { message, requestId } = request.body;
    if (!message.trim() || message.length > messageLimit || message.includes('\0') || !uuidPattern.test(requestId)) {
      response.status(400).json({ error: 'INVALID_MESSAGE', message: 'Message must contain 1 to 2,000 characters and requestId must be a UUID.' });
      return;
    }
    if (containsCredential(message)) {
      response.status(400).json({ error: 'INVALID_MESSAGE', message: 'Do not share passwords, API keys or sign-in tokens in chat.' });
      return;
    }

    const userId = request.chatUserId!;
    if (inFlight.has(userId)) {
      response.status(409).json({ error: 'CHAT_BUSY', message: 'A chat response is already being prepared for this account.' });
      return;
    }
    if (!takeRateToken(attempts, userId, now())) {
      return rateLimited(response);
    }
    inFlight.add(userId);

    try {
      const conversation = await storage.getConversation(userId, request.params.id);
      if (!conversation) return notFound(response);

      const existing = await storage.findExchange(userId, conversation.id, requestId);
      if (existing.length) {
        const userMessage = existing.find((item) => item.role === 'user');
        const assistantMessage = existing.find((item) => item.role === 'assistant');
        if (existing.length !== 2 || !userMessage || !assistantMessage) return unavailable(response);
        if (userMessage.content !== message) {
          response.status(409).json({ error: 'REQUEST_ID_REUSED', message: 'This requestId has already been used.' });
          return;
        }
        response.json({ conversation, messages: [userMessage, assistantMessage] });
        return;
      }
      if (conversation.message_count + 2 > maxMessages) {
        response.status(409).json({ error: 'CHAT_LIMIT', message: 'This conversation has reached its message limit.' });
        return;
      }

      const history = await storage.getHistory(userId, conversation.id);
      let responseText: string;
      const controller = new AbortController();
      const abortOnDisconnect = () => {
        if (!response.writableEnded) controller.abort();
      };
      response.once('close', abortOnDisconnect);
      try {
        responseText = await answer(history.map(({ role, content }) => ({ role, content })), message, controller.signal);
      } catch (error) {
        if (response.destroyed) return;
        if (error instanceof ChatProviderError) {
          const status = [400, 429, 503, 504].includes(error.status) ? error.status : 503;
          response.status(status).json({ error: status === 400 ? 'INVALID_MESSAGE' : 'CHAT_UNAVAILABLE', message: error.message });
        } else {
          unavailable(response);
        }
        return;
      } finally {
        response.off('close', abortOnDisconnect);
      }
      if (!responseText.trim() || responseText.length > 8000 || responseText.includes('\0')) {
        unavailable(response);
        return;
      }

      const saved = await storage.saveExchange(userId, conversation.id, requestId, message, responseText,
        conversation.message_count);
      response.json(saved);
    } catch (error) {
      if (error instanceof ChatStorageError) {
        const status: Record<string, number> = {
          CHAT_STALE: 409,
          CHAT_LIMIT: 409,
          CHAT_REQUEST_ID_REUSED: 409,
          CHAT_NOT_FOUND: 404,
          CHAT_INACTIVE: 403,
        };
        if (error.code in status) {
          response.status(status[error.code]).json({
            error: error.code,
            message: error.code === 'CHAT_STALE' ? 'This conversation changed. Refresh and try again.'
              : error.code === 'CHAT_NOT_FOUND' ? 'Conversation not found.'
                : error.code === 'CHAT_INACTIVE' ? 'An active account is required to use chat.'
                  : error.code === 'CHAT_LIMIT' ? 'This conversation has reached its message limit.'
                    : 'This requestId has already been used.',
          });
          return;
        }
      }
      unavailable(response);
    } finally {
      inFlight.delete(userId);
    }
  });

  return router;
}

function takeRateToken(limits: Map<string, { minuteAt: number; minuteCount: number; dayAt: number; dayCount: number }>,
  userId: string, timestamp: number): boolean {
  for (const [id, window] of limits) {
    if (timestamp - window.dayAt >= dayMs) limits.delete(id);
  }
  let budget = limits.get(userId);
  if (!budget) {
    if (limits.size >= limiterCapacity) return false;
    budget = { minuteAt: timestamp, minuteCount: 0, dayAt: timestamp, dayCount: 0 };
    limits.set(userId, budget);
  } else {
    if (timestamp - budget.dayAt >= dayMs) {
      budget.dayAt = timestamp;
      budget.dayCount = 0;
    }
    if (timestamp - budget.minuteAt >= minuteMs) {
      budget.minuteAt = timestamp;
      budget.minuteCount = 0;
    }
  }
  if (budget.minuteCount >= requestsPerMinute || budget.dayCount >= requestsPerDay) return false;
  budget.minuteCount += 1;
  budget.dayCount += 1;
  return true;
}

function isMessageBody(value: unknown): value is { message: string; requestId: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return Object.keys(body).length === 2 && Object.hasOwn(body, 'message') && Object.hasOwn(body, 'requestId')
    && typeof body.message === 'string' && typeof body.requestId === 'string';
}

function emptyObject(value: unknown): boolean {
  return value === undefined || Boolean(value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === 0);
}

function invalidId(response: Response) {
  return response.status(400).json({ error: 'INVALID_ID', message: 'The conversation ID must be a UUID.' });
}

function notFound(response: Response) {
  return response.status(404).json({ error: 'NOT_FOUND', message: 'Conversation not found.' });
}

function rateLimited(response: Response) {
  return response.status(429).json({ error: 'RATE_LIMITED', message: 'Please wait before sending another chat message.' });
}

function unavailable(response: Response) {
  return response.status(503).json({ error: 'CHAT_UNAVAILABLE', message: 'Chat is temporarily unavailable.' });
}

export const chatRouter = createChatRouter();
