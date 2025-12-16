import { create } from 'zustand';

type ChatState = {
  isConnected: boolean;
  activeChannelId: string | null;
  setSocketStatus: (connected: boolean) => void;
  setActiveChannel: (channelId: string | null) => void;
};

export const useChatStore = create<ChatState>((set) => ({
  isConnected: false,
  activeChannelId: null,
  setSocketStatus: (connected) => set({ isConnected: connected }),
  setActiveChannel: (channelId) => set({ activeChannelId: channelId }),
}));
