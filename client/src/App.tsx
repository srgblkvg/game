import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import ArenaPage from './pages/Arena/ArenaPage';
import ShopPage from './pages/ShopPage';
import JobsPage from './pages/JobsPage';
import HistoryPage from './pages/HistoryPage';
import AccountPage from './pages/AdminPanel/AccountPage';
import AdminPanel from './pages/AdminPanel/AdminPanel';
import AdminRegisterPage from './pages/AdminRegisterPage';
import ChatPanel from './components/chat/ChatPanel';
import Header from './components/Header';
import ProfilePage from './pages/ProfilePage';
import ScrollToTop from './components/ScrollToTop';
import RatingPage from './pages/RatingPage';
import CraftPage from './pages/CraftPage';

function App() {
  const { user } = useAuth();

  return (
    <BrowserRouter>
      <ScrollToTop />
      <Header />
      <div style={{
        maxWidth: '1024px',
        margin: '0 auto',
        padding: '0 1rem',
        boxSizing: 'border-box',
        width: '100%',
      }}>
        <Routes>
          <Route path="/login" element={user ? (user.role === 'admin' ? <Navigate to="/adminpanel" /> : <Navigate to="/" />) : <LoginPage />} />
          <Route path="/register" element={user ? <Navigate to="/" /> : <RegisterPage />} />
          <Route path="/" element={user ? (user.role === 'admin' ? <Navigate to="/adminpanel" /> : <HomePage />) : <Navigate to="/login" />} />
          <Route path="/profile/:userId" element={user?.role === 'player' ? <ProfilePage /> : <Navigate to="/login" />} />
          <Route path="/arena" element={user?.role === 'player' ? <ArenaPage /> : <Navigate to="/login" />} />
          <Route path="/shop" element={user?.role === 'player' ? <ShopPage /> : <Navigate to="/login" />} />
          <Route path="/jobs" element={user?.role === 'player' ? <JobsPage /> : <Navigate to="/login" />} />
          <Route path="/history" element={user?.role === 'player' ? <HistoryPage /> : <Navigate to="/login" />} />
          <Route path="/account" element={user?.role === 'player' ? <AccountPage /> : <Navigate to="/login" />} />
          <Route path="/rating" element={user?.role === 'player' ? <RatingPage /> : <Navigate to="/login" />} />
          <Route path="/craft" element={user?.role === 'player' ? <CraftPage /> : <Navigate to="/login" />} />
          <Route path="/admin/register" element={<AdminRegisterPage />} />
          <Route path="/adminpanel" element={user?.role === 'admin' ? <AdminPanel /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </div>
      <ChatPanel key={user?.id} />
    </BrowserRouter>
  );
}

export default App;