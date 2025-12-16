import { Routes, Route, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { Layout } from './components/layout/Layout';
import Home from './pages/Home';
import Sectors from './pages/Sectors';
import Samples from './pages/Samples';
import Profile from './pages/Profile';
import Messages from './pages/Messages';
import Settings from './pages/Settings';
import Search from './pages/Search';
import Admin from './pages/Admin';
import UserProfile from './pages/UserProfile';
import TransmissionDetail from './pages/TransmissionDetail';
import { useAuthStore } from './store/useAuth';
import { connectSocket, joinDMChannel, subscribeChannelMessages } from './lib/nakama';
import { useChatStore } from './store/useChatStore';
import { ToastStack } from './components/ui/ToastStack';
import { useToastStore } from './store/useToast';

export default function App() {
  const { user } = useAuthStore();
  const { setSocketStatus } = useChatStore();
  const location = useLocation();
  const pushToast = useToastStore((s) => s.pushToast);
  const joinedRefs = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    connectSocket(user.uid)
      .then(() => setSocketStatus(true))
      .catch(() => setSocketStatus(false));
  }, [user, setSocketStatus]);

  // Global toast for incoming messages when not on the messages screen
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeChannelMessages((msg) => {
      if (location.pathname.startsWith('/messages')) return;
      const content = msg.content as any;
      const text = typeof content?.text === 'string' ? content.text : '';
      const fromUid = content?.fromUid || msg.sender_id;
      const toUid = content?.toUid || content?.targetUid || '';
      const isMine = fromUid === user.uid;
      const otherUid = isMine ? toUid : fromUid;
      if (!otherUid) return;
      const sender =
        content?.displayName ||
        content?.nickname ||
        content?.username ||
        (isMine ? 'You' : otherUid) ||
        'Someone';
      const href = `/messages/${otherUid}`;
      pushToast({
        title: 'New message',
        description: `${sender}: ${text.slice(0, 80) || 'Sent a message'}`,
        href,
      });
    });
    return () => unsub();
  }, [location.pathname, pushToast, user]);

  // Background-join cached conversations so messages arrive on any screen
  useEffect(() => {
    if (!user) return;
    const prefix = `pandora_dm_cache_${user.uid}_`;
    const others: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const otherUid = key.slice(prefix.length);
        if (otherUid) others.push(otherUid);
      }
    }
    const limited = others.slice(0, 10);
    const joinAll = async () => {
      for (const other of limited) {
        if (joinedRefs.current.has(other)) continue;
        try {
          await joinDMChannel(user.uid, other);
          joinedRefs.current.add(other);
        } catch {
          // ignore failures silently
        }
      }
    };
    joinAll();
  }, [user, location.pathname]);

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/sectors" element={<Sectors />} />
          <Route path="/samples" element={<Samples />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/u/:uid" element={<UserProfile />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/messages/:uid" element={<Messages />} />
          <Route path="/t/:id" element={<TransmissionDetail />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/search" element={<Search />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Home />} />
        </Route>
      </Routes>
      <ToastStack />
    </>
  );
}
