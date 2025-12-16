import { Client, Session, Socket, Channel, ChannelMessage, ChannelPresenceEvent } from '@heroiclabs/nakama-js';

type NakamaConnection = {
  client: Client;
  socket: Socket;
  session: Session;
};

// 캐시 저장소
const cache: Record<string, Promise<NakamaConnection>> = {};

// 글로벌 참조 (소켓/세션은 앱 전역에서 단일 인스턴스로 사용)
let globalClient: Client | null = null;
let globalSession: Session | null = null;
let globalSocket: Socket | null = null;
let connectedDeviceId: string | null = null;
let dispatcherSocket: Socket | null = null; // 현재 디스패처가 연결된 소켓 인스턴스

const channelMessageHandlers = new Set<(msg: ChannelMessage) => void>();
const channelPresenceHandlers = new Set<(evt: ChannelPresenceEvent) => void>();

const isSocketOpen = (socket: Socket | null) => {
  if (!socket) return false;
  const adapter = (socket as any).adapter;
  if (adapter && typeof adapter.isOpen === 'function') {
    try {
      return Boolean(adapter.isOpen());
    } catch {
      return false;
    }
  }
  return false;
};

const clearConnectionState = (deviceId?: string | null) => {
  if (deviceId && cache[deviceId]) {
    delete cache[deviceId];
  }
  globalClient = null;
  globalSession = null;
  globalSocket = null;
  connectedDeviceId = null;
  dispatcherSocket = null;
};

// 환경 변수 로드 및 정리
const rawHost = import.meta.env.VITE_NAKAMA_HOST || 'localhost';
const host = rawHost.replace(/^https?:\/\//, '').replace(/\/+$/, '');
const useSSL = (import.meta.env.VITE_NAKAMA_USE_SSL || 'false').toLowerCase() === 'true';

// ⚠️ 수정 1: Port는 숫자가 아니라 '문자열'로 처리하는 게 안전합니다.
const port = import.meta.env.VITE_NAKAMA_PORT || (useSSL ? '443' : '7350');
const serverKey = import.meta.env.VITE_NAKAMA_KEY || 'defaultkey';

// ⚠️ 수정 2: ID 추출 로직 강화 (Firebase 객체가 통째로 들어오는 것 방지)
function normalizeId(value: unknown): string {
  if (!value) return '';

  // 1. 이미 문자열이면 공백 제거 후 리턴
  if (typeof value === 'string') return value.trim();

  // 2. 객체라면 uid나 id 필드를 찾음 (Firebase User 객체 대응)
  if (typeof value === 'object') {
    const obj = value as any;
    // Firebase는 .uid, 일반 객체는 .id일 수 있음
    const extracted = obj.uid || obj.id;
    if (typeof extracted === 'string') return extracted.trim();
  }

  // 3. 그래도 안 되면 강제 형변환
  return String(value).trim();
}

export function getNakamaConnection(uid: unknown): Promise<NakamaConnection> {
  // ID 정제
  const deviceId = normalizeId(uid);

  // 🛡️ 방어 코드: ID가 없으면 즉시 에러
  if (!deviceId) {
    console.error("❌ Nakama Error: deviceId is empty or invalid.", uid);
    return Promise.reject(new Error('Missing device id for Nakama authentication'));
  }

  // 캐싱
  const cacheKey = deviceId;
  if (cache[cacheKey]) return cache[cacheKey];

  cache[cacheKey] = (async () => {
    try {
      // 1. 클라이언트 생성
      const client = new Client(serverKey, host, port, useSSL);

      console.log('🔌 [Nakama] Connecting...', {
        host,
        port,
        useSSL,
        deviceIdType: typeof deviceId, // 타입 확인용 로그
        deviceId: deviceId,            // 실제 값 확인용 로그
      });

      // 2. 인증 (기기 ID 방식) — JS SDK는 positional 인자를 기대하므로 문자열만 전달
      const session = await client.authenticateDevice(deviceId, true);

      console.log("✅ [Nakama] Auth Success:", session.user_id);

      // 3. 소켓 연결
      const socket = client.createSocket(useSSL, false);
      await socket.connect(session, true);
      console.log("✅ [Nakama] Socket Connected");

      return { client, socket, session };
    } catch (err) {
      console.error("🔥 [Nakama] Connection Failed:", err);
      delete cache[cacheKey]; // 실패 시 캐시 삭제 (재시도 가능하게)
      throw err;
    }
  })();

  return cache[cacheKey];
}

function installSocketDispatchers(socket: Socket) {
  if (dispatcherSocket === socket) return;

  dispatcherSocket = socket;
  console.log('[Nakama] Installing socket dispatchers...');

  socket.onchannelmessage = (msg) => {
    console.log(`[Nakama] onchannelmessage received. Channel: ${msg.channel_id}, Code: ${msg.code}, Content:`, msg.content);
    console.log(`[Nakama] Dispatching to ${channelMessageHandlers.size} handlers.`);

    if (channelMessageHandlers.size === 0) {
      console.warn('[Nakama] No handlers registered! Message dropped.');
    }

    channelMessageHandlers.forEach((fn) => {
      try {
        fn(msg);
      } catch (err) {
        console.error('[Nakama] onchannelmessage handler error', err);
      }
    });
  };
  socket.onchannelpresence = (evt) => {
    console.log('[Nakama] onchannelpresence received:', evt);
    channelPresenceHandlers.forEach((fn) => {
      try {
        fn(evt);
      } catch (err) {
        console.error('[Nakama] onchannelpresence handler error', err);
      }
    });
  };
  socket.ondisconnect = (evt) => {
    console.warn('[Nakama] Socket Disconnected:', evt);
    clearConnectionState(connectedDeviceId);
  };
  socket.onerror = (err) => {
    console.error('[Nakama] Socket Error:', err);
    clearConnectionState(connectedDeviceId);
  };
}

export async function connectSocket(uid: unknown): Promise<Socket> {
  const deviceId = normalizeId(uid);
  if (!deviceId) throw new Error('Missing device id for Nakama socket');

  // reuse if already connected for same device
  if (globalSocket && connectedDeviceId === deviceId && isSocketOpen(globalSocket)) {
    return globalSocket;
  }

  const { client, socket, session } = await getNakamaConnection(deviceId);

  try {
    if (!isSocketOpen(socket)) {
      await socket.connect(session, true);
    }
  } catch (err) {
    clearConnectionState(deviceId);
    throw err;
  }

  globalClient = client;
  globalSession = session;
  globalSocket = socket;
  connectedDeviceId = deviceId;
  installSocketDispatchers(socket);
  return socket;
}

export function getSocket(): Socket | null {
  return globalSocket;
}

export function getUserId(): string | null {
  return globalSession?.user_id || null;
}

export function resetNakamaConnection(uid: unknown) {
  const deviceId = normalizeId(uid);
  if (!deviceId) return;
  const existing = cache[deviceId];
  if (existing) {
    existing
      .then(({ socket }) => {
        try {
          if (typeof (socket as any).close === 'function') {
            (socket as any).close();
          } else {
            socket.disconnect(false);
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => undefined);
  }
  clearConnectionState(deviceId);
  console.log('[Nakama] Connection reset.');
}

export async function joinDMChannel(
  uid: unknown,
  otherUid: unknown,
): Promise<{ channelId: string; messages: ChannelMessage[]; socket: Socket }> {
  const deviceId = normalizeId(uid);
  const targetId = normalizeId(otherUid);

  if (!deviceId || !targetId) {
    throw new Error('Missing user id for chat channel');
  }

  const socket = await connectSocket(deviceId);
  const { client, session } = await getNakamaConnection(deviceId);

  // 채팅방 입장 (1:1 DM) — room형으로 두 UID를 정렬해 동일 채널 사용
  const roomName = ['dm', deviceId, targetId].sort().join('_');
  // 1 = Room, persistence = true, hidden = false
  const channel = await socket.joinChat(roomName, 1, true, false);

  // 이전 메시지 내역 불러오기 (50개)
  const history = await client.listChannelMessages(session, channel.id, 50, false);

  return { channelId: channel.id, messages: history.messages || [], socket };
}

export async function joinChatChannel(
  channelId: string,
  type: 1 | 2,
): Promise<{ channel: Channel; messages: ChannelMessage[]; socket: Socket }> {
  if (!globalSession || !connectedDeviceId) {
    // If not manually connected, try to auto-connect if we have a stored session or something,
    // but for now, we rely on App.tsx calling connectSocket first.
    // Ideally we should try to recover the connection here if possible using the stored user ID if known,
    // but globalSession being null means we probably need authentication again.
    throw new Error('Socket not connected. Call connectSocket after login.');
  }
  const socket = await connectSocket(connectedDeviceId);
  const client = globalClient!;
  const session = globalSession!;

  // type: 1 = Room, 2 = Direct Message, 3 = Group
  // persistence: true (Important for history)
  // hidden: false
  const channel = await socket.joinChat(channelId, type, true, false);

  // History fetching: limit 50, forward=true (false -> fetch latest first usually)
  // Actually listChannelMessages 4th arg is 'forward'.
  // If we want "last 50 messages", we usually want them in reverse chronological order or just latest.
  // Nakama: listChannelMessages(session, channelId, limit, forward?, cursor?)
  // forward=false (default) => returns newest messages first? Or returns closest to now?
  // Actually forward=true means oldest to newest.
  // Fetching history usually we want the latest messages.
  const history = await client.listChannelMessages(session, channel.id, 50, false);

  // Nakama returns history.messages in order.
  // If forward was false (default), they are usually latest?
  // Let's stick to default behavior which is usually appropriate for chat history (newest 50).

  return { channel, messages: history.messages || [], socket };
}

export function subscribeChannelMessages(handler: (msg: ChannelMessage) => void) {
  channelMessageHandlers.add(handler);
  return () => channelMessageHandlers.delete(handler);
}

export function subscribeChannelPresence(handler: (evt: ChannelPresenceEvent) => void) {
  channelPresenceHandlers.add(handler);
  return () => channelPresenceHandlers.delete(handler);
}
