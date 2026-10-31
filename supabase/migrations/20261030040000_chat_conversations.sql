create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) between 1 and 80),
  message_count integer not null default 0 check (message_count between 0 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index chat_conversations_owner_updated on public.chat_conversations (user_id, updated_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  request_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  sequence_no integer not null check (sequence_no between 1 and 40),
  content text not null,
  created_at timestamptz not null default now(),
  unique (conversation_id, request_id, role),
  unique (conversation_id, sequence_no),
  check (
    (role = 'user' and char_length(content) between 1 and 2000)
    or (role = 'assistant' and char_length(content) between 1 and 8000)
  )
);

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

create policy chat_conversations_select_own on public.chat_conversations
  for select to authenticated using (user_id = auth.uid());
create policy chat_conversations_delete_own on public.chat_conversations
  for delete to authenticated using (user_id = auth.uid());
create policy chat_messages_select_own on public.chat_messages
  for select to authenticated using (
    exists (
      select 1 from public.chat_conversations c
      where c.id = chat_messages.conversation_id and c.user_id = auth.uid()
    )
  );

revoke all on public.chat_conversations, public.chat_messages from public, anon, authenticated;
grant select, delete on public.chat_conversations to authenticated;
grant select on public.chat_messages to authenticated;
grant all on public.chat_conversations, public.chat_messages to service_role;

create or replace function public.save_chat_exchange(
  p_owner uuid,
  p_conversation_id uuid,
  p_request_id uuid,
  p_message text,
  p_response text,
  p_expected_count integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_conversation public.chat_conversations%rowtype;
  v_user_message public.chat_messages%rowtype;
  v_assistant_message public.chat_messages%rowtype;
  v_existing_count integer;
  v_title text;
begin
  if p_owner is null or p_conversation_id is null or p_request_id is null
     or p_expected_count is null or p_expected_count < 0 then
    raise exception 'CHAT_INVALID_INPUT';
  end if;
  if p_message is null or char_length(p_message) not between 1 and 2000
     or p_response is null or char_length(p_response) not between 1 and 8000 then
    raise exception 'CHAT_INVALID_INPUT';
  end if;

  select c.* into v_conversation
  from public.chat_conversations c
  where c.id = p_conversation_id and c.user_id = p_owner
  for update;
  if not found then raise exception 'CHAT_NOT_FOUND'; end if;

  if not exists (select 1 from public.profiles p where p.id = p_owner and p.status = 'active') then
    raise exception 'CHAT_INACTIVE';
  end if;

  select count(*) into v_existing_count
  from public.chat_messages m
  where m.conversation_id = p_conversation_id and m.request_id = p_request_id;
  if v_existing_count > 0 then
    if v_existing_count <> 2 then raise exception 'CHAT_STORAGE_CORRUPT'; end if;
    select m.* into v_user_message from public.chat_messages m
    where m.conversation_id = p_conversation_id and m.request_id = p_request_id and m.role = 'user';
    select m.* into v_assistant_message from public.chat_messages m
    where m.conversation_id = p_conversation_id and m.request_id = p_request_id and m.role = 'assistant';
    if v_user_message.content is distinct from p_message then raise exception 'CHAT_REQUEST_ID_REUSED'; end if;
    return jsonb_build_object(
      'conversation', jsonb_build_object(
        'id', v_conversation.id, 'title', v_conversation.title,
        'message_count', v_conversation.message_count,
        'created_at', v_conversation.created_at, 'updated_at', v_conversation.updated_at
      ),
      'messages', jsonb_build_array(
        jsonb_build_object('id', v_user_message.id, 'role', v_user_message.role,
          'content', v_user_message.content, 'created_at', v_user_message.created_at,
          'request_id', v_user_message.request_id),
        jsonb_build_object('id', v_assistant_message.id, 'role', v_assistant_message.role,
          'content', v_assistant_message.content, 'created_at', v_assistant_message.created_at,
          'request_id', v_assistant_message.request_id)
      )
    );
  end if;

  if v_conversation.message_count <> p_expected_count then raise exception 'CHAT_STALE'; end if;
  if v_conversation.message_count + 2 > 40 then raise exception 'CHAT_LIMIT'; end if;

  insert into public.chat_messages (conversation_id, request_id, role, sequence_no, content)
  values (p_conversation_id, p_request_id, 'user', p_expected_count + 1, p_message)
  returning * into v_user_message;
  insert into public.chat_messages (conversation_id, request_id, role, sequence_no, content)
  values (p_conversation_id, p_request_id, 'assistant', p_expected_count + 2, p_response)
  returning * into v_assistant_message;

  v_title := left(regexp_replace(btrim(p_message), '[[:cntrl:]]+', ' ', 'g'), 80);
  if v_conversation.message_count = 0 then
    v_title := coalesce(nullif(v_title, ''), 'New conversation');
  else
    v_title := v_conversation.title;
  end if;

  update public.chat_conversations c
  set title = v_title, message_count = c.message_count + 2, updated_at = clock_timestamp()
  where c.id = p_conversation_id
  returning c.* into v_conversation;

  return jsonb_build_object(
    'conversation', jsonb_build_object(
      'id', v_conversation.id, 'title', v_conversation.title,
      'message_count', v_conversation.message_count,
      'created_at', v_conversation.created_at, 'updated_at', v_conversation.updated_at
    ),
    'messages', jsonb_build_array(
      jsonb_build_object('id', v_user_message.id, 'role', v_user_message.role,
        'content', v_user_message.content, 'created_at', v_user_message.created_at,
        'request_id', v_user_message.request_id),
      jsonb_build_object('id', v_assistant_message.id, 'role', v_assistant_message.role,
        'content', v_assistant_message.content, 'created_at', v_assistant_message.created_at,
        'request_id', v_assistant_message.request_id)
    )
  );
end;
$$;

revoke all on function public.save_chat_exchange(uuid, uuid, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.save_chat_exchange(uuid, uuid, uuid, text, text, integer)
  to service_role;

create or replace function public.create_chat_conversation(p_owner uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_count integer;
  v_conversation public.chat_conversations%rowtype;
begin
  if p_owner is null then raise exception 'CHAT_INVALID_INPUT'; end if;
  select p.status into v_status from public.profiles p where p.id = p_owner for update;
  if not found or v_status <> 'active' then raise exception 'CHAT_INACTIVE'; end if;

  select count(*) into v_count from public.chat_conversations c where c.user_id = p_owner;
  if v_count >= 100 then raise exception 'CHAT_CONVERSATION_LIMIT'; end if;

  insert into public.chat_conversations (user_id) values (p_owner) returning * into v_conversation;
  return jsonb_build_object(
    'id', v_conversation.id, 'title', v_conversation.title,
    'message_count', v_conversation.message_count,
    'created_at', v_conversation.created_at, 'updated_at', v_conversation.updated_at
  );
end;
$$;

revoke all on function public.create_chat_conversation(uuid) from public, anon, authenticated;
grant execute on function public.create_chat_conversation(uuid) to service_role;
