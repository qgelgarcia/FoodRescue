import { Capacitor } from '@capacitor/core';
import { supabase, isSupabaseConfigured } from './supabase.js';
import { fetchWithTimeout } from './request.js';

const REQUEST_TIMEOUT_MS = 60_000;

export class ChatServiceError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ChatServiceError';
    this.status = status;
  }
}

function chatApiRoot() {
  const configured = import.meta.env?.VITE_API_BASE_URL?.trim();
  if (!configured) {
    if (Capacitor.isNativePlatform()) {
      throw new ChatServiceError('Chat needs a server address configured for this device.');
    }
    return '/api';
  }

  if (configured.startsWith('/') && !configured.startsWith('//')) {
    const path = configured.replace(/\/+$/, '');
    return path.endsWith('/api') ? path : `${path}/api`;
  }

  let url;
  try {
    url = new URL(configured);
  } catch {
    throw new ChatServiceError('The chat server address is invalid.');
  }
  const isLocalHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !isLocalHttp) {
    throw new ChatServiceError('The chat server must use a secure HTTPS address.');
  }
  if (url.search || url.hash || url.username || url.password) throw new ChatServiceError('The chat server address is invalid.');

  const path = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${path.endsWith('/api') ? path : `${path}/api`}`;
}

async function request(path, options = {}) {
  if (!isSupabaseConfigured()) throw new ChatServiceError('Chat is unavailable until your account service is connected.');
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw new ChatServiceError('We could not verify your session. Please sign in again.');
  if (!session?.access_token) throw new ChatServiceError('Please sign in again to use chat.', 401);

  const root = chatApiRoot();
  let response;
  try {
    response = await fetchWithTimeout(`${root}${path}`, {
      ...options,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    }, REQUEST_TIMEOUT_MS);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ChatServiceError('The assistant took too long to respond. Retry your message.');
    }
    if (globalThis.navigator?.onLine === false || /network|fetch/i.test(String(error?.message || ''))) {
      throw new ChatServiceError('We could not reach chat. Check your connection and retry.');
    }
    throw new ChatServiceError('We could not complete that chat request. Please try again.');
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json().catch(() => null) : null;
  if (!response.ok) {
    const message = response.status === 401
      ? 'Your session expired. Please sign in again.'
      : response.status === 404
        ? 'That conversation is no longer available.'
        : typeof body?.message === 'string'
          ? body.message
          : typeof body?.error === 'string'
            ? body.error
            : 'We could not complete that chat request. Please try again.';
    throw new ChatServiceError(message, response.status);
  }
  return body;
}

export async function getChatConversations() {
  const body = await request('/chat/conversations');
  if (!Array.isArray(body?.conversations)) throw new ChatServiceError('The conversation list could not be loaded.');
  return body.conversations;
}

export async function createChatConversation() {
  const body = await request('/chat/conversations', { method: 'POST', body: '{}' });
  const conversation = body?.conversation || body;
  if (!conversation?.id) throw new ChatServiceError('The new conversation was not returned by the server.');
  return conversation;
}

export async function getChatConversation(conversationId) {
  const body = await request(`/chat/conversations/${encodeURIComponent(conversationId)}`);
  if (!body?.conversation?.id || !Array.isArray(body?.messages)) {
    throw new ChatServiceError('This conversation could not be loaded.');
  }
  return { conversation: body.conversation, messages: body.messages };
}

export async function sendChatMessage(conversationId, message, requestId) {
  const body = await request(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ message, requestId }),
  });
  if (!body?.conversation?.id || !Array.isArray(body?.messages)) {
    throw new ChatServiceError('The assistant response was not returned by the server.');
  }
  return { conversation: body.conversation, messages: body.messages };
}

export async function deleteChatConversation(conversationId) {
  await request(`/chat/conversations/${encodeURIComponent(conversationId)}`, { method: 'DELETE' });
}
