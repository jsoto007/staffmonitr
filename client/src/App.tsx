import { Route, Routes } from 'react-router-dom';
import { AccountProvider } from './context/AccountContext';
import { Layout } from './components/Layout';
import { CalendarPage } from './pages/Calendar';
import { Dashboard } from './pages/Dashboard';
import { KidsPage } from './pages/Kids';
import { LandingPage } from './pages/LandingPage';
import { OpenShiftsPage } from './pages/OpenShifts';
import { SignInPage } from './pages/SignIn';
import { SignUpPage } from './pages/SignUp';
import { AdminPanel } from './pages/AdminPanel';
import { ProjectionSettingsPage } from './pages/ProjectionSettings';

function App() {
  return (
    <AccountProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        <Route
          path="/dashboard"
          element={
            <Layout>
              <Dashboard />
            </Layout>
          }
        />
        <Route
          path="/calendar/projection"
          element={
            <Layout>
              <CalendarPage />
            </Layout>
          }
        />
        <Route
          path="/calendar/projection-settings"
          element={
            <Layout>
              <ProjectionSettingsPage />
            </Layout>
          }
        />
        <Route
          path="/kids"
          element={
            <Layout>
              <KidsPage />
            </Layout>
          }
        />
        <Route
          path="/open-shifts"
          element={
            <Layout>
              <OpenShiftsPage />
            </Layout>
          }
        />
        <Route
          path="/admin"
          element={
            <Layout>
              <AdminPanel />
            </Layout>
          }
        />
      </Routes>
    </AccountProvider>
  );
}

export default App;
