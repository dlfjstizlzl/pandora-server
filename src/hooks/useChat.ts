import { useEffect, useState, useRef, useCallback } from 'react';
import { ChannelMessage, ChannelPresenceEvent } from '@heroiclabs/nakama-js';
import {
  joinChatChannel,
  subscribeChannelMessages,
  subscribeChannelPresence,
  getSocket
} from '../lib/nakama';
import { useChatStore } from '../store/useChatStore';

type UseChatReturn = {
  messages: ChannelMessage[];
  sendMessage: (content: string) => Promise<void>;
  onlineCount: number;
  isLoading: boolean;
  error: string | null;
};

export function useChat(channelId: string, type: 1 | 2 = 1): UseChatReturn {
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep track of the actual channel ID returned by Nakama (it might differ slightly or be useful to store)
  const actualChannelIdRef = useRef<string | null>(null);
  const { isConnected } = useChatStore();

  useEffect(() => {
    if (!isConnected || !channelId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    // 1. Join Channel
    joinChatChannel(channelId, type)
      .then(({ channel, messages: history }) => {
        if (!isMounted) return;

        actualChannelIdRef.current = channel.id;
        // Nakama returns presences in the join response too (if requested), but we just track count dynamically usually.
        // Or we can use channel.presences if available.
        // For now start with 1 (self) or based on presences length if provided.
        setOnlineCount(channel.presences ? channel.presences.length : 1);

        // Initial messages
        setMessages(history);
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Failed to join chat:", err);
        setError("Failed to join chat channel.");
        setIsLoading(false);
      });

    // 2. Subscribe to new messages
    const unsubMsg = subscribeChannelMessages((msg) => {
      const currentChannelId = actualChannelIdRef.current;

      // 간단하고 명확한 채널 매칭 - 현재 채널의 메시지만 처리
      if (!currentChannelId || msg.channel_id !== currentChannelId) {
        return; // 다른 채널 메시지는 무시
      }

      console.log('[useChat] Message received for current channel:', {
        messageId: msg.message_id,
        channelId: msg.channel_id,
        senderId: msg.sender_id
      });

      setMessages((prev) => {
        // 중복 체크 - 이미 있는 메시지는 무시
        if (prev.some(m => m.message_id === msg.message_id)) {
          console.log('[useChat] Duplicate message ignored:', msg.message_id);
          return prev;
        }
        return [...prev, msg];
      });
    });

    // 3. Subscribe to presence changes
    const unsubPresence = subscribeChannelPresence((evt) => {
      const currentChannelId = actualChannelIdRef.current;
      const isMatch = (currentChannelId && evt.channel_id === currentChannelId) || evt.channel_id === channelId;

      if (isMatch) {
        setOnlineCount((prev) => {
          const joins = evt.joins ? evt.joins.length : 0;
          const leaves = evt.leaves ? evt.leaves.length : 0;
          return Math.max(0, prev + joins - leaves);
        });
      }
    });

    return () => {
      isMounted = false;
      unsubMsg();
      unsubPresence();
      // Optional: Leave channel if needed, but per requirements we just "stay connected".
      // Usually good practice to leave if no longer looking at it, but requirement says "Global Socket Connection... stay connected".
      // It doesn't explicitly say "Stay in the room forever", but for standard chat apps we might leave the room on unmount.
      // However, to keep it simple and per "persistence" rules, we just stop listening.
      // If we want to actively leave: getSocket()?.leaveChat(actualChannelIdRef.current);
    };
  }, [channelId, type, isConnected]);

  const sendMessage = useCallback(async (content: string) => {
    if (!actualChannelIdRef.current || !content.trim()) return;

    const socket = getSocket();
    if (!socket) {
      setError("Socket disconnected");
      return;
    }

    try {
      const msgAck = await socket.writeChatMessage(actualChannelIdRef.current, { content: content });
      // Note: writeChatMessage returns an ack, but the message itself will come back via onchannelmessage (if we listen to self)
      // or we can optimistically append it. 
      // Nakama usually echoes back the message to the sender via onchannelmessage as well.
      // So we don't need to manually append here to avoid duplication, UNLESS we want instant optimistic UI.
      // Let's rely on the echo for consistency first.
    } catch (err) {
      console.error("Failed to send message:", err);
      setError("Failed to send message");
    }
  }, []);

  return { messages, sendMessage, onlineCount, isLoading, error };
}
