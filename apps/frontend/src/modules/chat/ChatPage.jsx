import LoadingState from '../../components/feedback/LoadingState';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bot,
  ChevronDown,
  Leaf,
  LoaderCircle,
  MessageCircle,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Utensils,
} from 'lucide-react';
import PageShell from '../../components/layout/PageShell';
import {
  createChatConversation,
  deleteChatConversation,
  getChatConversation,
  getChatConversations,
  sendChatMessage,
} from '../../services/chat.js';
import './ChatPage.css';

const STARTERS = [
  { label: 'Pickup questions', text: 'How do I find and claim a nearby food pickup?', icon: MessageCircle },
  { label: 'Food nutrition', text: 'What nutrients are in lentils?', icon: Leaf },
  { label: 'Balanced meal', text: 'Help me plan a balanced meal with vegetables and protein.', icon: Utensils },
];

function friendlyMessage(error) {
  return typeof error?.message === 'string' && error.message.trim()
    ? error.message
    : 'We could not complete that request. Please try again.';
}

function conversationName(conversation) {
  const name = conversation?.title;
  return typeof name === 'string' && name.trim() ? name.trim() : 'New conversation';
}

function messageRole(message) {
  return message?.role === 'user' ? 'user' : 'assistant';
}

function messageContent(message) {
  return typeof message?.content === 'string' ? message.content : '';
}

function mergeMessages(current, incoming) {
  const messages = [...current];
  const knownIds = new Set(current.map((message) => message.id).filter(Boolean));
  for (const message of incoming) {
    if (message?.id && knownIds.has(message.id)) continue;
    if (message?.id) knownIds.add(message.id);
    messages.push(message);
  }
  return messages;
}

function makeRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) throw new Error('This device cannot create a secure message ID.');
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function sortConversations(conversations) {
  return [...conversations].sort((a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0));
}

export default function ChatPage({ userProfile }) {
  const accountId = userProfile?.id || userProfile?.user_id || '';
  const accountIdRef = useRef(accountId);
  accountIdRef.current = accountId;

  const [conversations, setConversations] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const activeThreadIdRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [announceMessages, setAnnounceMessages] = useState(false);
  const [draft, setDraft] = useState('');
  const draftRef = useRef('');
  const [conversationsLoading, setConversationsLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [listError, setListError] = useState('');
  const [threadError, setThreadError] = useState('');
  const [sendError, setSendError] = useState('');
  const [failedRequest, setFailedRequest] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const sendingRef = useRef(false);
  const creatingRef = useRef(false);
  const nearBottomRef = useRef(true);
  const forceScrollRef = useRef(false);
  const messageViewportRef = useRef(null);
  const textareaRef = useRef(null);
  const cancelDeleteRef = useRef(null);
  const deleteTriggerRef = useRef(null);
  const newChatButtonRef = useRef(null);
  const deleteDialogWasOpenRef = useRef(false);

  const isCurrent = (generation, expectedAccount = accountId) => mountedRef.current
    && generationRef.current === generation
    && accountIdRef.current === expectedAccount;
  const isLiveAccount = (expectedAccount) => mountedRef.current && accountIdRef.current === expectedAccount;

  const setActiveThread = (id) => {
    activeThreadIdRef.current = id;
    setActiveThreadId(id);
  };

  const loadThread = useCallback(async (threadId) => {
    const generation = ++generationRef.current;
    const expectedAccount = accountId;
    setActiveThread(threadId);
    setMessages([]);
    setAnnounceMessages(false);
    setMessagesLoading(true);
    setThreadError('');
    setSendError('');
    setFailedRequest(null);
    forceScrollRef.current = false;
    try {
      const result = await getChatConversation(threadId);
      if (!isCurrent(generation, expectedAccount)) return;
      setConversations((current) => sortConversations([
        result.conversation,
        ...current.filter((conversation) => conversation.id !== result.conversation.id),
      ]));
      setMessages(result.messages);
      nearBottomRef.current = true;
    } catch (error) {
      if (isCurrent(generation, expectedAccount)) setThreadError(friendlyMessage(error));
    } finally {
      if (isCurrent(generation, expectedAccount)) setMessagesLoading(false);
    }
  }, [accountId]);

  const loadConversationList = useCallback(async () => {
    const generation = ++generationRef.current;
    const expectedAccount = accountId;
    setConversationsLoading(true);
    setListError('');
    setThreadError('');
    setConversations([]);
    setMessages([]);
    setAnnounceMessages(false);
    setMessagesLoading(false);
    draftRef.current = '';
    setDraft('');
    setActiveThread(null);
    setFailedRequest(null);
    setSendError('');
    sendingRef.current = false;
    creatingRef.current = false;
    setSending(false);
    setCreatingThread(false);
    setDeleting(false);
    setDeleteTarget(null);
    setDeleteError('');

    try {
      const rows = sortConversations(await getChatConversations());
      if (!isCurrent(generation, expectedAccount)) return;
      setConversations(rows);
      setConversationsLoading(false);
      if (rows.length) void loadThread(rows[0].id);
    } catch (error) {
      if (isCurrent(generation, expectedAccount)) {
        setListError(friendlyMessage(error));
        setConversationsLoading(false);
      }
    }
  }, [accountId, loadThread]);

  useEffect(() => {
    mountedRef.current = true;
    void loadConversationList();
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      sendingRef.current = false;
      creatingRef.current = false;
    };
  }, [loadConversationList]);

  useEffect(() => {
    const viewport = messageViewportRef.current;
    if (!viewport || messagesLoading || (!nearBottomRef.current && !forceScrollRef.current)) return;
    viewport.scrollTop = viewport.scrollHeight;
    nearBottomRef.current = true;
    forceScrollRef.current = false;
  }, [messages, messagesLoading, activeThreadId]);

  useEffect(() => {
    if (deleteTarget) {
      cancelDeleteRef.current?.focus();
      deleteDialogWasOpenRef.current = true;
    } else if (deleteDialogWasOpenRef.current) {
      const target = deleteTriggerRef.current?.isConnected ? deleteTriggerRef.current : newChatButtonRef.current;
      target?.focus();
      deleteDialogWasOpenRef.current = false;
    }
  }, [deleteTarget]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
  }, [draft]);

  const activeConversation = conversations.find((conversation) => conversation.id === activeThreadId) || null;
  const isBusy = sending || creatingThread || deleting;

  async function handleNewChat() {
    if (isBusy || creatingRef.current) return;
    creatingRef.current = true;
    setCreatingThread(true);
    setListError('');
    setThreadError('');
    const generation = generationRef.current;
    const expectedAccount = accountId;
    try {
      const conversation = await createChatConversation();
      if (!isCurrent(generation, expectedAccount)) return;
      setConversations((current) => sortConversations([
        conversation,
        ...current.filter((item) => item.id !== conversation.id),
      ]));
      creatingRef.current = false;
      setCreatingThread(false);
      void loadThread(conversation.id);
    } catch (error) {
      if (isCurrent(generation, expectedAccount)) setListError(friendlyMessage(error));
    } finally {
      if (isLiveAccount(expectedAccount)) {
        creatingRef.current = false;
        setCreatingThread(false);
      }
    }
  }

  function changeDraft(value) {
    draftRef.current = value;
    setDraft(value);
    if (failedRequest && value.trim() !== failedRequest.message) setFailedRequest(null);
  }

  async function sendMessage(retryRequest = null) {
    if (sendingRef.current || conversationsLoading) return;
    const originalDraft = draftRef.current;
    const message = retryRequest?.message || originalDraft.trim();
    if (!message) return;

    const previousFailure = retryRequest || (failedRequest?.message === message ? failedRequest : null);
    let request;
    try {
      request = previousFailure || { message, requestId: makeRequestId() };
    } catch (error) {
      setSendError(friendlyMessage(error));
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setSendError('');
    setListError('');
    forceScrollRef.current = true;
    const generation = generationRef.current;
    const expectedAccount = accountId;
    let conversationId = activeThreadIdRef.current;

    try {
      if (!conversationId) {
        const conversation = await createChatConversation();
        if (!isCurrent(generation, expectedAccount)) return;
        conversationId = conversation.id;
        setActiveThread(conversationId);
        setConversations((current) => sortConversations([
          conversation,
          ...current.filter((item) => item.id !== conversation.id),
        ]));
      }

      const result = await sendChatMessage(conversationId, message, request.requestId);
      if (!isCurrent(generation, expectedAccount)) return;
      setConversations((current) => sortConversations([
        result.conversation,
        ...current.filter((item) => item.id !== result.conversation.id),
      ]));
      setMessages((current) => mergeMessages(current, result.messages));
      setAnnounceMessages(true);
      setFailedRequest(null);
      if (draftRef.current.trim() === message && draftRef.current === originalDraft) {
        draftRef.current = '';
        setDraft('');
      }
    } catch (error) {
      if (isCurrent(generation, expectedAccount)) {
        setFailedRequest(request);
        setSendError(friendlyMessage(error));
      }
    } finally {
      if (isCurrent(generation, expectedAccount)) {
        sendingRef.current = false;
        setSending(false);
      }
    }
  }

  function submitMessage(event) {
    event.preventDefault();
    void sendMessage();
  }

  function handleComposerKeyDown(event) {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void sendMessage();
  }

  async function confirmDelete() {
    if (!deleteTarget || isBusy || messagesLoading) return;
    const targetId = deleteTarget;
    const generation = generationRef.current;
    const expectedAccount = accountId;
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteChatConversation(targetId);
      if (!isCurrent(generation, expectedAccount)) return;
      const remaining = conversations.filter((conversation) => conversation.id !== targetId);
      setConversations(remaining);
      setDeleteTarget(null);
      setDeleting(false);
      if (activeThreadIdRef.current === targetId) {
        setActiveThread(null);
        setMessages([]);
        setAnnounceMessages(false);
        setThreadError('');
        setFailedRequest(null);
        if (remaining[0]) void loadThread(remaining[0].id);
      }
    } catch (error) {
      if (isCurrent(generation, expectedAccount)) setDeleteError(friendlyMessage(error));
    } finally {
      if (isLiveAccount(expectedAccount)) setDeleting(false);
    }
  }

  function handleDeleteDialogKeyDown(event) {
    if (event.key === 'Escape' && !deleting) {
      setDeleteTarget(null);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...event.currentTarget.querySelectorAll('button:not(:disabled)')];
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      event.preventDefault();
    } else if (event.shiftKey && (document.activeElement === first || !event.currentTarget.contains(document.activeElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !event.currentTarget.contains(document.activeElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  function chooseStarter(text) {
    changeDraft(text);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  return (
    <PageShell>
      <div className="chat-viewport">
        <main className="chat-shell" aria-labelledby="chat-page-title">
          <header className="chat-header">
            <div className="chat-brand">
              <span className="chat-brand-icon" aria-hidden="true"><Sparkles size={19} /></span>
              <div className="chat-brand-copy">
                <h1 id="chat-page-title">FoodRescue Assistant</h1>
                <span>Food, nutrition, and everyday meals</span>
              </div>
              <span className="chat-ai-badge"><span /> AI guide</span>
            </div>
            <div className="chat-header-actions">
              <label className="chat-mobile-selector">
                <span className="sr-only">Choose a conversation</span>
                <select
                  value={activeThreadId || ''}
                  disabled={isBusy || conversationsLoading}
                  onChange={(event) => event.target.value && void loadThread(event.target.value)}
                >
                  {!conversations.length && <option value="">No saved conversations</option>}
                  {conversations.map((conversation) => (
                    <option key={conversation.id} value={conversation.id}>{conversationName(conversation)}</option>
                  ))}
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </label>
              <button ref={newChatButtonRef} className="chat-new-button" type="button" aria-label="New chat" onClick={handleNewChat} disabled={isBusy || conversationsLoading}>
                {creatingThread ? <LoaderCircle size={16} className="chat-spinner" /> : <Plus size={16} />}
                <span>New chat</span>
              </button>
            </div>
          </header>

          <div className="chat-body">
            <aside className="chat-sidebar" aria-label="Saved conversations">
              <div className="chat-sidebar-heading">
                <span>Conversations</span>
                <span className="chat-count">{conversations.length}</span>
              </div>
              {conversationsLoading ? (
                <p className="chat-list-message" role="status">Loading conversations…</p>
              ) : listError ? (
                <div className="chat-list-message chat-list-error" role="alert">
                  <span>{listError}</span>
                  <button type="button" onClick={() => void loadConversationList()}>Try again</button>
                </div>
              ) : conversations.length ? (
                <div className="chat-conversation-list">
                  {conversations.map((conversation) => (
                    <button
                      key={conversation.id}
                      type="button"
                      className={`chat-conversation-item${activeThreadId === conversation.id ? ' is-active' : ''}`}
                      aria-current={activeThreadId === conversation.id ? 'true' : undefined}
                      disabled={isBusy}
                      onClick={() => void loadThread(conversation.id)}
                    >
                      <MessageCircle size={16} aria-hidden="true" />
                      <span>{conversationName(conversation)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="chat-list-message">Your saved conversations will appear here.</p>
              )}
              <div className="chat-sidebar-note"><ShieldCheck size={15} /><span>Your conversations are saved to your account.</span></div>
            </aside>

            <section className="chat-main" aria-label="FoodRescue conversation">
              <div className="chat-thread-bar">
                <div className="chat-thread-title">
                  <span className="chat-thread-status" aria-hidden="true"><span /></span>
                  <span>{activeConversation ? conversationName(activeConversation) : 'A fresh start'}</span>
                </div>
                {activeConversation && (
                  <button
                    className="chat-delete-button"
                    type="button"
                    ref={deleteTriggerRef}
                    aria-label={`Delete conversation: ${conversationName(activeConversation)}`}
                    title="Delete conversation"
                    disabled={isBusy || messagesLoading}
                    onClick={() => { setDeleteError(''); setDeleteTarget(activeConversation.id); }}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <div
                ref={messageViewportRef}
                className="chat-message-viewport"
                onScroll={(event) => {
                  const element = event.currentTarget;
                  nearBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 88;
                }}
              >
                {conversationsLoading || messagesLoading ? (
                  <LoadingState label="Loading your conversation" onRetry={() => activeThreadId ? loadThread(activeThreadId) : loadConversationList()} />
                ) : threadError ? (
                  <LoadingState error={threadError} onRetry={() => activeThreadId ? loadThread(activeThreadId) : loadConversationList()} />
                ) : messages.length ? (
                  <div className="chat-message-log" role="log" aria-live={announceMessages ? 'polite' : 'off'} aria-relevant="additions text" aria-busy={messagesLoading || sending}>
                    {messages.map((message, index) => {
                      const role = messageRole(message);
                      const content = messageContent(message);
                      return (
                        <article className={`chat-message is-${role}`} key={message.id || `${activeThreadId}-${role}-${index}`}>
                          <span className="chat-message-avatar" aria-hidden="true">{role === 'user' ? 'Y' : <Bot size={16} />}</span>
                          <div className="chat-message-body">
                            <div className="chat-message-author">{role === 'user' ? 'You' : 'FoodRescue Assistant'}</div>
                            <div className="chat-message-bubble">{content}</div>
                            {message.created_at && <time className="chat-message-time" dateTime={message.created_at}>{new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>}
                          </div>
                        </article>
                      );
                    })}
                    {sending && <div className="chat-pending" role="status"><span className="chat-pending-dots" /> Assistant is thinking</div>}
                  </div>
                ) : (
                  <div className="chat-welcome">
                    <span className="chat-welcome-icon"><Sparkles size={21} /></span>
                    <h2>What can I help with?</h2>
                    <p className="chat-welcome-copy">Ask about FoodRescue, food nutrition, or everyday meals.</p>
                    <div className="chat-starters" aria-label="Suggested questions">
                      {STARTERS.map(({ label, text, icon: Icon }) => (
                        <button key={label} type="button" onClick={() => chooseStarter(text)} disabled={isBusy}>
                          <Icon size={15} /><span>{label}</span>
                        </button>
                      ))}
                    </div>
                    <div className="chat-privacy-note"><ShieldCheck size={15} /><span>Messages are saved to your account and sent to our AI provider. Avoid sharing private health details.</span></div>
                    {sending && <div className="chat-pending" role="status"><span className="chat-pending-dots" /> Sending your question</div>}
                  </div>
                )}
              </div>

              {threadError === '' && listError !== '' && conversationsLoading === false && !activeThreadId && (
                <div className="chat-inline-error chat-mobile-list-error" role="alert">{listError} <button type="button" onClick={() => void loadConversationList()}>Retry</button></div>
              )}

              <div className="chat-composer-area">
                {sendError && (
                  <div className="chat-inline-error" role="alert">
                    <span>{sendError}</span>
                    {failedRequest && <button type="button" onClick={() => void sendMessage(failedRequest)} disabled={isBusy}>Retry message</button>}
                  </div>
                )}
                <form className="chat-composer" onSubmit={submitMessage}>
                  <label className="sr-only" htmlFor="chat-message-input">Message the FoodRescue Assistant</label>
                  <textarea
                    id="chat-message-input"
                    ref={textareaRef}
                    rows={1}
                    maxLength={2000}
                    value={draft}
                    placeholder="Ask a question…"
                    disabled={conversationsLoading || messagesLoading || Boolean(threadError) || isBusy}
                    onChange={(event) => changeDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                  />
                  <button className="chat-send-button" type="submit" aria-label="Send message" disabled={!draft.trim() || isBusy || conversationsLoading || messagesLoading || Boolean(threadError)}>
                    {sending ? <LoaderCircle size={17} className="chat-spinner" /> : <Send size={17} />}
                  </button>
                </form>
                <div className="chat-composer-footer">
                  <span>Nutrition estimates, not medical advice.</span>
                  <span>{draft.length}/2000</span>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>

      {deleteTarget && (
        <div className="chat-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteTarget(null); }}>
          <section
            className="chat-delete-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="chat-delete-title"
            aria-describedby="chat-delete-description"
            onKeyDown={handleDeleteDialogKeyDown}
          >
            <span className="chat-delete-icon"><Trash2 size={19} /></span>
            <h2 id="chat-delete-title">Delete this conversation?</h2>
            <p id="chat-delete-description">This permanently removes the saved conversation and its messages.</p>
            {deleteError && <p className="chat-delete-error" role="alert">{deleteError}</p>}
            <div className="chat-delete-actions">
              <button ref={cancelDeleteRef} type="button" className="chat-delete-cancel" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button type="button" className="chat-delete-confirm" onClick={() => void confirmDelete()} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete conversation'}
              </button>
            </div>
          </section>
        </div>
      )}
    </PageShell>
  );
}
