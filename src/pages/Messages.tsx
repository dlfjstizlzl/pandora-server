import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { Loader2, Send, Users, ArrowLeft, CheckCheck, Clock3 } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuthStore } from '../store/useAuth';
import { getOrCreateProfile } from '../lib/profile';
import { fetchLinks } from '../lib/links';
import { useNavigate, useParams } from 'react-router-dom';
import { getNakamaConnection, joinDMChannel, resetNakamaConnection, subscribeChannelMessages, connectSocket } from '../lib/nakama';
import { useToastStore } from '../store/useToast';
import type { ChannelMessage } from '@heroiclabs/nakama-js';
import { PandoraAvatar } from '../components/ui/PandoraAvatar';

type Message = {
  id: string;
  text: string;
  fromUid?: string | null;
  toUid?: string | null;
  conversationId?: string;
  createdAt?: { seconds: number; nanoseconds: number } | null;
  createdAtMs?: number;
};

type Profile = {
  uid: string;
  displayName: string;
  email?: string | null;
};

const conversationKey = (a: string, b: string) => [a, b].sort().join('_');

type Conversation = {
  id: string;
  otherUid: string;
  lastText?: string;
  lastAt?: number;
};

type LastSeenMap = Record<string, number>;

const cacheKeyFor = (currentUid: string, otherUid: string) => `pandora_dm_cache_${currentUid}_${otherUid}`;

const messageTimeMs = (msg?: Message) => {
  if (!msg) return 0;
  if (typeof msg.createdAtMs === 'number' && !Number.isNaN(msg.createdAtMs)) return msg.createdAtMs;
  if (msg.createdAt && typeof msg.createdAt.seconds === 'number') {
    return msg.createdAt.seconds * 1000 + (msg.createdAt.nanoseconds || 0) / 1e6;
  }
  return 0;
};

const loadCachedMessages = (currentUid?: string | null, otherUid?: string | null): Message[] => {
  if (!currentUid || !otherUid) return [];
  try {
    const raw = localStorage.getItem(cacheKeyFor(currentUid, otherUid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as Message[]).map((m) => {
      const ts = messageTimeMs(m);
      return {
        ...m,
        createdAtMs: ts,
      };
    });
  } catch {
    return [];
  }
};

const persistMessages = (currentUid?: string | null, otherUid?: string | null, list: Message[] = []) => {
  if (!currentUid || !otherUid) return;
  const capped = list.slice(-200); // keep last 200 locally
  localStorage.setItem(cacheKeyFor(currentUid, otherUid), JSON.stringify(capped));
};

const channelMessageToMessage = (m: ChannelMessage): Message => {
  const content = m.content as any;
  const createdMs =
    typeof m.create_time === 'string'
      ? Date.parse(m.create_time) || Date.now()
      : Date.now();
  return {
    id: m.message_id,
    text: typeof content?.text === 'string' ? content.text : '',
    fromUid: content?.fromUid || m.sender_id,
    toUid: content?.toUid || content?.targetUid || null,
    createdAt: {
      seconds: Math.floor(createdMs / 1000),
      nanoseconds: Math.floor((createdMs % 1000) * 1e6),
    },
    createdAtMs: createdMs,
  };
};

export default function Messages() {
  const { user } = useAuthStore();
  const { uid: paramUid } = useParams();
  const navigate = useNavigate();
  const pushToast = useToastStore((s) => s.pushToast);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Profile[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [linkedOnly, setLinkedOnly] = useState(false);
  const [links, setLinks] = useState<string[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pendingMessages, setPendingMessages] = useState<Message[]>([]);
  const pendingRef = useRef<Message[]>([]);
  const [channelId, setChannelId] = useState<string | null>(null);
  const socketRef = useRef<import('@heroiclabs/nakama-js').Socket | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [reconnectKey, setReconnectKey] = useState(0);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const lastIncomingRef = useRef<{ fromUid?: string | null; text?: string; ts: number } | null>(null);
  const lastSentRef = useRef<{ text: string; ts: number } | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [lastSeen, setLastSeen] = useState<LastSeenMap>({});
  const channelIdToOtherRef = useRef<Map<string, string>>(new Map());
  const otherUidToChannelRef = useRef<Map<string, string>>(new Map());
  const backgroundJoinsRef = useRef<Map<string, { channelId: string; leave: () => void }>>(new Map());
  const refreshedConversationsRef = useRef<boolean>(false);
  const formatTime = (msg?: Message | null) => {
    const ms = msg ? messageTimeMs(msg) : 0;
    if (!ms) return '';
    return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const isSocketReady = () => {
    const adapter = (socketRef.current as any)?.adapter;
    if (adapter && typeof adapter.isOpen === 'function') {
      try {
        return Boolean(adapter.isOpen());
      } catch {
        return false;
      }
    }
    return Boolean(socketRef.current);
  };

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      await getOrCreateProfile({
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      });
      const linked = await fetchLinks(user.uid);
      setLinks(linked.map((l) => l.targetUid));
    };
    load().catch(() => undefined);
  }, [user]);

  useEffect(() => {
    // live list of all profiles to pick as contacts
    const unsub = onSnapshot(collection(db, 'profiles'), (snap) => {
      const list = snap.docs.map((d) => d.data() as Profile);
      setContacts(list);
    });
    return () => unsub();
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, selected]);

  // Load last seen from localStorage
  useEffect(() => {
    if (!user) return;
    const key = `pandora_dm_seen_${user.uid}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        setLastSeen(JSON.parse(raw));
      } catch {
        setLastSeen({});
      }
    }
  }, [user]);

  const updateLastSeen = (otherUid: string) => {
    if (!user || !otherUid) return;
    const key = `pandora_dm_seen_${user.uid}`;
    setLastSeen((prev) => {
      const next = { ...prev, [otherUid]: Date.now() };
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };

  // Nakama channel join + live messages
  useEffect(() => {
    if (!user || !selected) return;
    let unsub: (() => void) | null = null;
    let unsubMsg: (() => void) | null = null;
    setLoading(true);
    setConnectError(null);
    setChannelId(null);
    const cached = loadCachedMessages(user.uid, selected);
    if (cached.length) {
      messageIdsRef.current = new Set(cached.map((m) => m.id));
      setMessages(cached);
    }
    joinDMChannel(user.uid, selected)
      .then(({ channelId: cid, messages: history, socket }) => {
        setChannelId(cid);
        socketRef.current = socket;
        channelIdToOtherRef.current.set(cid, selected);
        otherUidToChannelRef.current.set(selected, cid);

        const merged = history.map((m) => channelMessageToMessage(m));

        const dedup = new Map<string, Message>();
        [...cached, ...merged].forEach((m) => {
          if (m?.id) dedup.set(m.id, m);
        });
        const sorted = Array.from(dedup.values()).sort((a, b) => messageTimeMs(a) - messageTimeMs(b));
        messageIdsRef.current = new Set(sorted.map((m) => m.id));
        setMessages(sorted);
        setLoading(false);
        updateLastSeen(selected);

      const handler = (m: ChannelMessage) => {
        if (m.channel_id !== cid) return;
        const incomingId = m.message_id;
        if (messageIdsRef.current.has(incomingId)) return;

        const incoming = channelMessageToMessage(m);

        // 추가 중복 방지: 같은 보낸이/같은 텍스트가 1초 내 두 번 오면 스킵
        const nowTs = messageTimeMs(incoming) || Date.now();
        const last = lastIncomingRef.current;
        if (last && last.fromUid === incoming.fromUid && last.text === incoming.text && Math.abs(nowTs - last.ts) < 1000) {
          return;
        }
        lastIncomingRef.current = { fromUid: incoming.fromUid, text: incoming.text, ts: nowTs };

        setMessages((prev) => {
          const withoutLocal =
            incoming.fromUid === user?.uid ? prev.filter((msg) => !msg.id.startsWith('local-')) : prev;
          messageIdsRef.current.add(incomingId);
          return [...withoutLocal, incoming].sort((a, b) => messageTimeMs(a) - messageTimeMs(b));
        });
      };

        unsubMsg = subscribeChannelMessages(handler);
        unsub = () => {
          unsubMsg?.();
          // Keep channel membership to continue receiving messages globally; just drop listener
          // socket.leaveChat(cid);
        };
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Failed to connect to chat.';
        setConnectError(msg);
        setLoading(false);
      });
    return () => {
      if (unsub) unsub();
      if (unsubMsg) unsubMsg();
      socketRef.current = null;
    };
  }, [user, selected, reconnectKey]);

  // Reset composer when switching threads
  useEffect(() => {
    setText('');
    setSendError(null);
  }, [selected]);

  // Conversation list from contacts/links (Nakama-only messaging, Firestore for profiles)
  useEffect(() => {
    if (!user) return;
    const base = linkedOnly ? contacts.filter((c) => links.includes(c.uid)) : contacts.filter((c) => c.uid !== user.uid);
    const mapped: Conversation[] = base.map((c) => {
      const cached = loadCachedMessages(user.uid, c.uid);
      const last = cached[cached.length - 1];
      return {
        id: conversationKey(user.uid, c.uid),
        otherUid: c.uid,
        lastText: last?.text,
        lastAt: messageTimeMs(last),
      };
    }).sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
    setConversations(mapped);
  }, [contacts, links, linkedOnly, user]);

  // Background-join conversations for realtime list updates (limited to first 10)
  useEffect(() => {
    if (!user) return;
    const active = new Set<string>();
    const joinAll = async () => {
      for (const conv of conversations.slice(0, 10)) {
        active.add(conv.otherUid);
        if (otherUidToChannelRef.current.has(conv.otherUid)) continue;
        try {
          const { channelId, socket } = await joinDMChannel(user.uid, conv.otherUid);
          channelIdToOtherRef.current.set(channelId, conv.otherUid);
          otherUidToChannelRef.current.set(conv.otherUid, channelId);
          backgroundJoinsRef.current.set(conv.otherUid, {
            channelId,
            leave: () => {
              socket.leaveChat(channelId);
              channelIdToOtherRef.current.delete(channelId);
              otherUidToChannelRef.current.delete(conv.otherUid);
            },
          });
        } catch {
          // ignore join failures for background updates
        }
      }
      // cleanup joins no longer needed
      backgroundJoinsRef.current.forEach((entry, uid) => {
        if (!active.has(uid)) {
          entry.leave();
          backgroundJoinsRef.current.delete(uid);
        }
      });
    };
    joinAll();
  }, [conversations, user]);

  // On entering Messages, refresh last message snapshots by fetching recent history (for conversations not already mapped)
  useEffect(() => {
    if (!user || refreshedConversationsRef.current || conversations.length === 0) return;
    let cancelled = false;
    const refresh = async () => {
      for (const conv of conversations.slice(0, 10)) {
        if (otherUidToChannelRef.current.has(conv.otherUid)) continue;
        try {
          const { channelId, messages, socket } = await joinDMChannel(user.uid, conv.otherUid);
          if (cancelled) {
            socket.leaveChat(channelId);
            continue;
          }
          const latest = messages[messages.length - 1];
          if (latest) {
            const content = latest.content as any;
            const text = typeof content?.text === 'string' ? content.text : '';
            const createdMs = latest.create_time ? Date.parse(latest.create_time) : Date.now();
            setConversations((prev) => {
              const next = prev.map((c) =>
                c.otherUid === conv.otherUid
                  ? { ...c, lastText: text, lastAt: createdMs }
                  : c,
              );
              return [...next].sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
            });
          }
          socket.leaveChat(channelId);
        } catch {
          // ignore failures
        }
      }
      refreshedConversationsRef.current = true;
    };
    refresh();
    return () => {
      cancelled = true;
    };
  }, [conversations, user]);

  // Ensure socket is connected when Messages mounts (safety for reloads)
  useEffect(() => {
    if (!user) return;
    connectSocket(user.uid).catch(() => undefined);
  }, [user]);

  // 간헐적 연결 체크: 소켓이 조용히 끊어지면 자동 재조인
  useEffect(() => {
    if (!user || !selected) return;
    const id = window.setInterval(() => {
      if (!isSocketReady()) {
        setReconnectKey((k) => k + 1);
      }
    }, 10000);
    return () => window.clearInterval(id);
  }, [user, selected]);

  const send = async () => {
    if (!text.trim() || !user || !selected || sending) return;
    if (!channelId || !socketRef.current || !isSocketReady()) {
      setSendError('Chat is reconnecting. Please try again in a moment.');
      setReconnectKey((k) => k + 1);
      return;
    }
    setSending(true);
    setSendError(null);
    
    const messageText = text.trim();
    const now = Date.now();
    if (lastSentRef.current && lastSentRef.current.text === messageText && now - lastSentRef.current.ts < 800) {
      setSending(false);
      return;
    }
    lastSentRef.current = { text: messageText, ts: now };
    
    // Optimistic local message for instant UI/preview
    const localId = `local-${Date.now()}`;
    const optimistic: Message = {
      id: localId,
      text: messageText,
      fromUid: user.uid,
      createdAt: { seconds: Math.floor(now / 1000), nanoseconds: Math.floor((now % 1000) * 1e6) },
      createdAtMs: now,
    };
    setMessages((prev) => {
      const next = [...prev, optimistic].sort((a, b) => messageTimeMs(a) - messageTimeMs(b));
      messageIdsRef.current.add(localId);
      return next;
    });

    try {
      if (!channelId || !socketRef.current) {
        throw new Error('Not connected to chat channel yet.');
      }
      
      // 🔑 핵심: content에 실제 Firebase UID를 포함
      await socketRef.current.writeChatMessage(channelId, { 
        text: messageText,
        fromUid: user.uid,  // 커스텀 필드로 실제 UID 전송
        toUid: selected,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message.';
      setSendError(message);
      setReconnectKey((k) => k + 1);
      // rollback optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== localId));
      messageIdsRef.current.delete(localId);
    } finally {
      setSending(false);
      setText('');
    }
  };

  const selectedProfile = useMemo(() => contacts.find((c) => c.uid === selected), [contacts, selected]);
  const conversationProfiles = useMemo(() => {
    const map = new Map<string, Profile>();
    contacts.forEach((c) => map.set(c.uid, c));
    return map;
  }, [contacts]);

  // Update conversation preview (last message) for selected chat
  useEffect(() => {
    if (!selected || messages.length === 0) return;
    const last = messages[messages.length - 1];
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.otherUid === selected
          ? {
              ...c,
              lastText: last.text,
              lastAt: messageTimeMs(last) || Date.now(),
            }
          : c,
      );
      return [...updated].sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
    });
  }, [messages, selected]);

  // Global listener to keep conversation list in sync with incoming messages
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeChannelMessages((msg) => {
      const content = msg.content as any;
      const text = typeof content?.text === 'string' ? content.text : '';
      const fromUid = content?.fromUid || msg.sender_id;
      const toUid = content?.toUid || content?.targetUid || '';
      const otherUid =
        channelIdToOtherRef.current.get(msg.channel_id) ||
        (fromUid === user.uid ? toUid : fromUid);
      if (!otherUid) return;
      const createdMs = msg.create_time ? Date.parse(msg.create_time) : Date.now();
      setConversations((prev) => {
        const next = prev.map((c) =>
          c.otherUid === otherUid
            ? {
                ...c,
                lastText: text,
                lastAt: createdMs,
              }
            : c,
        );
        return [...next].sort((a, b) => (b.lastAt || 0) - (a.lastAt || 0));
      });
      if (selected !== otherUid) {
        const sender = msg.sender_id === user.uid ? 'You' : otherUid;
        pushToast({
          title: 'New message',
          description: `${sender}: ${text.slice(0, 80)}`,
        });
      }
    });
    return () => unsub();
  }, [user, selected, pushToast]);

  // Persist messages locally per conversation so history survives navigation
  useEffect(() => {
    if (!user || !selected) return;
    persistMessages(user.uid, selected, messages);
  }, [messages, selected, user]);

  useEffect(() => {
    if (paramUid) {
      setSelected(paramUid);
    }
    if (paramUid) {
      updateLastSeen(paramUid);
    }
  }, [paramUid]);

  const renderConversations = () => {
    if (!user) return null;
    if (conversations.length === 0) {
      return <div className="text-sm text-pandora-muted">No conversations yet. Start one from contacts.</div>;
    }
    return (
      <div className="space-y-2 w-full">
        {conversations.map((conv) => {
          const profile = conversationProfiles.get(conv.otherUid);
          const label = profile?.displayName || profile?.email || conv.otherUid.slice(0, 8);
          const time = conv.lastAt ? new Date(conv.lastAt).toLocaleTimeString() : '';
          const hasUnread = lastSeen[conv.otherUid] ? (conv.lastAt || 0) > lastSeen[conv.otherUid] : Boolean(conv.lastAt);
          return (
            <button
              key={conv.id}
              onClick={() => {
                setSelected(conv.otherUid);
                navigate(`/messages/${conv.otherUid}`);
                updateLastSeen(conv.otherUid);
              }}
              className={`w-full text-left border px-3 py-3 rounded-2xl flex items-center justify-between transition ${
                selected === conv.otherUid
                  ? 'text-pandora-text border-white/30 bg-gradient-to-r from-pandora-accent-from to-pandora-accent-to shadow-[0_12px_32px_-10px_rgba(165,180,252,0.75)]'
                  : 'border-pandora-border text-pandora-text hover:border-pandora-accent-to hover:bg-white/5'
              }`}
            >
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{label}</div>
                <div className="text-xs text-pandora-muted truncate flex items-center gap-2">
                  {conv.lastText || 'No message'}
                  {hasUnread && <span className="w-2 h-2 rounded-full bg-pandora-accent-to/80 inline-block" />}
                </div>
              </div>
              {time && <span className="text-[10px] text-pandora-muted">{time}</span>}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full flex-1 min-h-[calc(100vh-60px)] h-[calc(100vh-60px)] flex flex-col gap-0 overscroll-contain overflow-hidden">

      {/* Conversation list */}
      {!selected && (
        <div className="border border-pandora-border bg-pandora-surface/90 rounded-2xl p-4 space-y-3 backdrop-blur flex-1 overflow-y-auto w-full mt-0">
          <div className="flex items-center gap-2 text-xs uppercase text-pandora-muted">
            <Users size={14} /> Conversations
          </div>
          <div className="flex items-center gap-3 text-xs text-pandora-text">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={linkedOnly} onChange={(e) => setLinkedOnly(e.target.checked)} />
              Linked only
            </label>
          </div>
          {renderConversations()}
        </div>
      )}

      {/* Chat screen */}
      {selected && (
        <div className="w-full border border-pandora-border bg-pandora-surface/90 rounded-3xl p-3 lg:p-4 flex flex-col backdrop-blur flex-1 min-h-0 overscroll-contain overflow-hidden">
          <div className="flex items-center gap-3 text-sm text-pandora-text mb-2 pl-2 md:pl-0 pr-1 justify-start">
            <button
              onClick={() => {
                setSelected(null);
                navigate('/messages');
              }}
              className="p-1.5 border border-pandora-border/60 rounded-full text-pandora-text hover:border-pandora-accent-to hover:bg-white/5"
            >
              <ArrowLeft size={16} />
            </button>
            <PandoraAvatar username={selectedProfile?.displayName || selected || 'User'} size="sm" />
            <span className="font-semibold truncate text-base md:text-sm">{selectedProfile?.displayName || selected}</span>
          </div>
          <div className="flex-1 min-h-0 grid grid-rows-[1fr_auto] gap-2">
            <div
              ref={messagesContainerRef}
              className="overflow-y-auto space-y-3 border border-pandora-border p-3 lg:p-4 bg-pandora-bg/80 rounded-2xl [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
              {loading && (
                <div className="flex items-center gap-2 text-pandora-muted text-sm">
                  <Loader2 size={16} className="animate-spin" /> Loading messages...
                </div>
              )}
              {connectError && (
                <div className="text-sm text-pandora-pink flex items-center justify-between gap-3">
                  <span>Chat 연결에 실패했어요: {connectError}</span>
                  <button
                    className="text-xs px-3 py-1 rounded-full border border-pandora-border hover:border-pandora-accent-to"
                    onClick={() => {
                      setChannelId(null);
                      setConnectError(null);
                      setLoading(true);
                      resetNakamaConnection(user?.uid);
                      setReconnectKey((k) => k + 1);
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}
              {!loading && messages.length === 0 && <p className="text-sm text-pandora-muted">No messages here yet.</p>}
              {messages.map((msg) => {
                const mine = msg.fromUid === user?.uid;
                const isPending = msg.id.startsWith('local-');
                const created = formatTime(msg);
                const isRead =
                  mine &&
                  selected &&
                  lastSeen[selected] &&
                  messageTimeMs(msg) > 0 &&
                  lastSeen[selected]! >= messageTimeMs(msg);
                return (
                  <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                        mine
                          ? 'bg-gradient-to-r from-pandora-accent-from to-pandora-accent-to text-pandora-bg'
                          : 'border border-pandora-border text-pandora-text bg-pandora-surface/80'
                      }`}
                    >
                      <p className="whitespace-pre-line break-words">{msg.text}</p>
                      <div className={`flex items-center justify-end gap-1 text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-pandora-muted'}`}>
                        {created && <span>{created}</span>}
                        {mine && (isPending ? <Clock3 size={12} /> : isRead ? <CheckCheck size={12} /> : <Clock3 size={12} />)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border border-pandora-border/60 bg-pandora-surface/95 rounded-2xl z-10 shadow-[0_-8px_24px_-18px_rgba(0,0,0,0.6)] p-2 mb-1">
              <div className="relative flex items-center gap-2">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !/Mobi|Android/i.test(navigator.userAgent)) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  className="flex-1 h-14 bg-pandora-bg/85 border border-pandora-border/80 text-pandora-text text-sm pr-14 pl-3 py-3 rounded-2xl font-mono placeholder:text-pandora-muted focus:outline-none focus:border-pandora-accent-to"
                  placeholder="Type a direct message..."
                />
                <button
                  onClick={send}
                  disabled={!text.trim() || sending}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 border border-white/10 bg-gradient-to-r from-pandora-accent-from to-pandora-accent-to text-pandora-bg font-semibold rounded-full hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center"
                >
                  {sending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                </button>
              </div>
              {sendError && <p className="text-xs text-pandora-pink mt-1">{sendError}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
