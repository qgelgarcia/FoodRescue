import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type ChatConversation = {
  id: string;
  title: string;
  message_count: number;
  created_at: string;
  updated_at: string;
};

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  request_id: string;
};

export type ChatContextMessage = Pick<ChatMessage, 'role' | 'content'>;

export class ChatStorageError extends Error {
  constructor(readonly code = 'CHAT_STORAGE_UNAVAILABLE') {
    super(code);
  }
}

const conversationFields = 'id,title,message_count,created_at,updated_at';
const messageFields = 'id,role,content,created_at,request_id';
const ownedMessageFields = `${messageFields},chat_conversations!inner(user_id)`;
let serviceClient: SupabaseClient | undefined;

function getServiceClient(): SupabaseClient {
  if (serviceClient) return serviceClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new ChatStorageError();
  serviceClient = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      fetch: (input, init = {}) => fetch(input, {
        ...init,
        signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000),
      }),
    },
  });
  return serviceClient;
}

function failOnError(error: unknown): void {
  if (error) throw new ChatStorageError();
}

export function createChatStorage(client: () => SupabaseClient = getServiceClient) {
  return {
    async getUser(token: string): Promise<string | null> {
      const { data, error } = await client().auth.getUser(token);
      if (error) {
        const authError = error as { code?: string; status?: number };
        if ([400, 401, 403].includes(authError.status ?? 0)
          || authError.code === 'bad_jwt' || authError.code === 'invalid_jwt') return null;
        throw new ChatStorageError();
      }
      return data.user?.id ?? null;
    },

    async isActive(userId: string): Promise<boolean> {
      const { data, error } = await client().from('profiles').select('status').eq('id', userId).maybeSingle();
      failOnError(error);
      return data?.status === 'active';
    },

    async listConversations(userId: string): Promise<ChatConversation[]> {
      const { data, error } = await client().from('chat_conversations').select(conversationFields)
        .eq('user_id', userId).order('updated_at', { ascending: false }).limit(100);
      failOnError(error);
      return (data ?? []) as ChatConversation[];
    },

    async createConversation(userId: string): Promise<ChatConversation> {
      const { data, error } = await client().rpc('create_chat_conversation', { p_owner: userId });
      if (error) {
        const message = (error as { message?: string }).message ?? '';
        if (message.includes('CHAT_CONVERSATION_LIMIT')) throw new ChatStorageError('CHAT_CONVERSATION_LIMIT');
        if (message.includes('CHAT_INACTIVE')) throw new ChatStorageError('CHAT_INACTIVE');
        throw new ChatStorageError();
      }
      return data as ChatConversation;
    },

    async getConversation(userId: string, conversationId: string): Promise<ChatConversation | null> {
      const { data, error } = await client().from('chat_conversations').select(conversationFields)
        .eq('id', conversationId).eq('user_id', userId).maybeSingle();
      failOnError(error);
      return data as ChatConversation | null;
    },

    async listMessages(userId: string, conversationId: string): Promise<ChatMessage[]> {
      const { data, error } = await client().from('chat_messages').select(ownedMessageFields)
        .eq('chat_conversations.user_id', userId).eq('conversation_id', conversationId)
        .order('sequence_no', { ascending: true }).limit(40);
      failOnError(error);
      return (data ?? []).map(({ chat_conversations: _owner, ...message }) => message) as ChatMessage[];
    },

    async findExchange(userId: string, conversationId: string, requestId: string): Promise<ChatMessage[]> {
      const { data, error } = await client().from('chat_messages').select(ownedMessageFields)
        .eq('chat_conversations.user_id', userId).eq('conversation_id', conversationId).eq('request_id', requestId)
        .order('sequence_no', { ascending: true });
      failOnError(error);
      return (data ?? []).map(({ chat_conversations: _owner, ...message }) => message) as ChatMessage[];
    },

    async getHistory(userId: string, conversationId: string): Promise<ChatContextMessage[]> {
      const { data, error } = await client().from('chat_messages')
        .select('role,content,sequence_no,chat_conversations!inner(user_id)')
        .eq('chat_conversations.user_id', userId).eq('conversation_id', conversationId)
        .order('sequence_no', { ascending: true }).limit(40);
      failOnError(error);
      return (data ?? []).slice(-16).map(({ chat_conversations: _owner, ...message }) => message) as ChatContextMessage[];
    },

    async saveExchange(userId: string, conversationId: string, requestId: string, message: string,
      response: string, expectedCount: number): Promise<{ conversation: ChatConversation; messages: ChatMessage[] }> {
      const { data, error } = await client().rpc('save_chat_exchange', {
        p_owner: userId,
        p_conversation_id: conversationId,
        p_request_id: requestId,
        p_message: message,
        p_response: response,
        p_expected_count: expectedCount,
      });
      if (error) {
        const message = (error as { message?: string }).message ?? '';
        for (const code of ['CHAT_STALE', 'CHAT_LIMIT', 'CHAT_REQUEST_ID_REUSED', 'CHAT_INACTIVE', 'CHAT_NOT_FOUND']) {
          if (message.includes(code)) throw new ChatStorageError(code);
        }
        throw new ChatStorageError();
      }
      return data as { conversation: ChatConversation; messages: ChatMessage[] };
    },

    async deleteConversation(userId: string, conversationId: string): Promise<boolean> {
      const { data, error } = await client().from('chat_conversations').delete()
        .eq('id', conversationId).eq('user_id', userId).select('id');
      failOnError(error);
      return (data ?? []).length > 0;
    },
  };
}
