import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import Home from './pages/Home';
import Sectors from './pages/Sectors';
import Samples from './pages/Samples';
import Profile from './pages/Profile';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/sectors" element={<Sectors />} />
        <Route path="/samples" element={<Samples />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  );
}
