import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import LoginClassicPage from './pages/LoginClassicPage';
import WikiPage from './pages/WikiPage';
import RulesPage from './pages/RulesPage';
import PrivacyPage from './pages/PrivacyPage';
import RegisterPage from './pages/RegisterPage';
import VkLoginPage from './pages/VkLoginPage';
import LogoutPage from './pages/LogoutPage';
import HomePage from './pages/HomePage';
import AdminRegisterPage from './pages/AdminRegisterPage';
import ChatPanel from './components/chat/ChatPanel';
import Header from './components/Header';
import RightSidebar from './components/RightSidebar';
import NotificationToast from './components/NotificationToast';
import ScrollToTop from './components/ScrollToTop';
import MetrikaTracker from './components/MetrikaTracker';
/* TODO: удалить после ответа поддержки VK ↓
import VkKeyboard from './components/VkKeyboard';
TODO: удалить после ответа поддержки VK ↑ */

// Ленивая загрузка тяжёлых страниц
const ArenaPage = lazy(() => import('./pages/Arena/ArenaPage'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const JobsPage = lazy(() => import('./pages/JobsPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const AccountPage = lazy(() => import('./pages/AdminPanel/AccountPage'));
const AdminPanel = lazy(() => import('./pages/AdminPanel/AdminPanel'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const RatingPage = lazy(() => import('./pages/RatingPage'));
const CraftPage = lazy(() => import('./pages/CraftPage'));
const BestiaryPage = lazy(() => import('./pages/BestiaryPage'));
const BankPage = lazy(() => import('./pages/BankPage'));
const TavernPage = lazy(() => import('./pages/TavernPage'));
const AuctionPage = lazy(() => import('./pages/AuctionPage'));
const TournamentPage = lazy(() => import('./pages/TournamentPage'));
const PremiumPage = lazy(() => import('./pages/PremiumPage'));
const GuildPage = lazy(() => import('./pages/GuildPage'));
const GuildViewPage = lazy(() => import('./pages/GuildViewPage'));
const GuildRatingPage = lazy(() => import('./pages/GuildRatingPage'));
const GuildWarPage = lazy(() => import('./pages/GuildWarPage'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'));
const CollectionsPage = lazy(() => import('./pages/CollectionsPage'));
const BattleSimPage = lazy(() => import('./pages/BattleSimPage'));
const CastlePage = lazy(() => import('./pages/CastlePage'));
const ForumPage = lazy(() => import('./pages/ForumPage'));
const ForumThreadPage = lazy(() => import('./pages/ForumThreadPage'));
const MassacrePage = lazy(() => import('./pages/MassacrePage'));

function Loading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-[var(--color-text-muted)] text-sm">Загрузка...</div>
    </div>
  );
}

function App() {
  const { user } = useAuth();

  const searchParams = new URLSearchParams(window.location.search);
  const isVkLaunch = searchParams.has('vk_user_id');

  return (
    <BrowserRouter>
      <ScrollToTop />
      <MetrikaTracker />
      <Header />
      {user?.role === 'player' && <RightSidebar />}
      <NotificationToast />
      <div style={{
        maxWidth: '1024px',
        margin: '0 auto',
        padding: '0 1rem',
        boxSizing: 'border-box',
        width: '100%',
      }}>
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/login" element={user ? (user.role === 'admin' ? <Navigate to="/adminpanel" /> : <Navigate to="/" />) : (isVkLaunch ? <VkLoginPage /> : <LoginPage />)} />
            <Route path="/vk-login" element={<VkLoginPage />} />
            <Route path="/logout" element={<LogoutPage />} />
            <Route path="/login-classic" element={user ? <Navigate to="/" /> : <LoginClassicPage />} />
            <Route path="/wiki" element={<WikiPage />} />
            <Route path="/rules" element={<RulesPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/register" element={user ? <Navigate to="/" /> : <RegisterPage />} />
            <Route path="/" element={user ? (user.role === 'admin' ? <Navigate to="/adminpanel" /> : <HomePage />) : (isVkLaunch ? <VkLoginPage /> : <Navigate to="/login" />)} />
            <Route path="/profile/:userId" element={user?.role === 'player' ? <ProfilePage /> : <Navigate to="/login" />} />
            <Route path="/arena" element={user?.role === 'player' ? <ArenaPage /> : <Navigate to="/login" />} />
            <Route path="/shop" element={user?.role === 'player' ? <ShopPage /> : <Navigate to="/login" />} />
            <Route path="/jobs" element={user?.role === 'player' ? <JobsPage /> : <Navigate to="/login" />} />
            <Route path="/history" element={user?.role === 'player' ? <HistoryPage /> : <Navigate to="/login" />} />
            <Route path="/account" element={user?.role === 'player' ? <AccountPage /> : <Navigate to="/login" />} />
            <Route path="/rating" element={user?.role === 'player' ? <RatingPage /> : <Navigate to="/login" />} />
            <Route path="/craft" element={user?.role === 'player' ? <CraftPage /> : <Navigate to="/login" />} />
            <Route path="/bestiary" element={user?.role === 'player' ? <BestiaryPage /> : <Navigate to="/login" />} />
            <Route path="/bank" element={user?.role === 'player' ? <BankPage /> : <Navigate to="/login" />} />
            <Route path="/tavern" element={user?.role === 'player' ? <TavernPage /> : <Navigate to="/login" />} />
            <Route path="/auction" element={user?.role === 'player' ? <AuctionPage /> : <Navigate to="/login" />} />
            <Route path="/tournament" element={user?.role === 'player' ? <TournamentPage /> : <Navigate to="/login" />} />
            <Route path="/premium" element={<PremiumPage />} />
            <Route path="/guild" element={user?.role === 'player' ? <GuildPage /> : <Navigate to="/login" />} />
            <Route path="/guild/rating" element={user?.role === 'player' ? <GuildRatingPage /> : <Navigate to="/login" />} />
            <Route path="/guild/war" element={user?.role === 'player' ? <GuildWarPage /> : <Navigate to="/login" />} />
            <Route path="/castle" element={user?.role === 'player' ? <CastlePage /> : <Navigate to="/login" />} />
            <Route path="/forum" element={user?.role === 'player' ? <ForumPage /> : <Navigate to="/login" />} />
            <Route path="/forum/:id" element={user?.role === 'player' ? <ForumThreadPage /> : <Navigate to="/login" />} />
            <Route path="/massacre" element={user?.role === 'player' ? <MassacrePage /> : <Navigate to="/login" />} />
            <Route path="/feedback" element={user?.role === 'player' ? <FeedbackPage /> : <Navigate to="/login" />} />
            <Route path="/collections" element={user?.role === 'player' ? <CollectionsPage /> : <Navigate to="/login" />} />
            <Route path="/guild/:id" element={user?.role === 'player' ? <GuildViewPage /> : <Navigate to="/login" />} />
            <Route path="/battle-sim" element={user?.role === 'player' || user?.role === 'admin' ? <BattleSimPage /> : <Navigate to="/login" />} />
            <Route path="/admin/register" element={<AdminRegisterPage />} />
            <Route path="/adminpanel" element={user?.role === 'admin' ? <AdminPanel /> : <Navigate to="/" />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
      </div>
      <ChatPanel key={user?.id} />
      {/* TODO: удалить после ответа поддержки VK ↓
      <VkKeyboard />
      TODO: удалить после ответа поддержки VK ↑ */}
    </BrowserRouter>
  );
}

export default App;
