import { useRef, useEffect, useState } from 'react';
import { Send, Users, Loader2 } from 'lucide-react';
import { useChat } from '../../hooks/useChat';
import { getUserId } from '../../lib/nakama';

interface ChatRoomProps {
  channelId: string;
  type?: 1 | 2; // 1 = Room, 2 = DM
  title?: string;
  subtitle?: string;
  className?: string;
}

export function ChatRoom({ channelId, type = 1, title, subtitle, className = '' }: ChatRoomProps) {
  const { messages, sendMessage, onlineCount, isLoading } = useChat(channelId, type);
  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const myUserId = getUserId();

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    await sendMessage(inputValue);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Helper to parse message content (assuming it's JSON like { "content": "..." })
  const parseContent = (contentString: string) => {
    try {
      const parsed = JSON.parse(contentString);
      return parsed.content || contentString;
    } catch {
      return contentString;
    }
  };

  // Helper to format time
  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex flex-col h-[600px] border border-pandora-border bg-pandora-bg rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-pandora-border bg-pandora-surface/50 backdrop-blur-sm">
        <div>
          <h3 className="text-sm font-semibold text-pandora-text">{title || 'Chat Room'}</h3>
          {subtitle && <p className="text-xs text-pandora-muted">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2 text-xs text-pandora-muted bg-black/20 px-2 py-1 rounded-full">
          <Users size={12} />
          <span>{onlineCount} Online</span>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-black/5" ref={scrollRef}>
        {isLoading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-pandora-muted">
            <Loader2 className="animate-spin mr-2" size={16} />
            Loading messages...
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === myUserId;
            const content = parseContent(msg.content);

            return (
              <div key={msg.message_id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className={`flex flex-col max-w-[80%] ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* Name (only for others) */}
                  {!isMe && (
                    <span className="text-[10px] text-pandora-muted mb-1 ml-1">
                      {msg.username || 'Unknown'}
                    </span>
                  )}

                  {/* Bubble */}
                  <div
                    className={`px-4 py-2 rounded-2xl text-sm ${isMe
                        ? 'bg-blue-600 text-white rounded-tr-none' // My bubble
                        : 'bg-gray-800 text-gray-100 rounded-tl-none' // Others bubble
                      }`}
                  >
                    {content}
                  </div>

                  {/* Timestamp */}
                  <span className="text-[10px] text-pandora-muted mt-1 px-1 opacity-70">
                    {formatTime(msg.create_time)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-xs text-pandora-muted mt-10">
            No messages yet. Say hello!
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-pandora-border bg-pandora-surface">
        <div className="flex items-center gap-2 bg-pandora-bg border border-pandora-border rounded-full px-4 py-2 focus-within:border-pandora-accent-to transition">
          <input
            className="flex-1 bg-transparent text-sm text-pandora-text placeholder:text-pandora-muted focus:outline-none"
            placeholder="Type a message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="text-pandora-muted hover:text-pandora-accent-to disabled:opacity-50 transition"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
