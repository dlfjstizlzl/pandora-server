import { Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
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
import { connectSocket } from './lib/nakama';
import { useChatStore } from './store/useChatStore';
import { ToastStack } from './components/ui/ToastStack';

export default function App() {
  const { user } = useAuthStore();
  const { setSocketStatus } = useChatStore();

  useEffect(() => {
    if (!user) return;
    connectSocket(user.uid)
      .then(() => setSocketStatus(true))
      .catch(() => setSocketStatus(false));
  }, [user, setSocketStatus]);

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
