import { Navigate, Route, Routes } from 'react-router-dom';
import { AccountProvider } from './context/AccountContext';
import { Layout } from './components/Layout';
import { CalendarPage } from './pages/Calendar';
import { Dashboard } from './pages/Dashboard';
import { RosterPage } from './pages/Kids';
import { LandingPage } from './pages/LandingPage';
import { OpenShiftsPage } from './pages/OpenShifts';
import { SignInPage } from './pages/SignIn';
import { SignUpPage } from './pages/SignUp';
import { AdminPanel } from './pages/AdminPanel';
import { ProjectionSettingsPage } from './pages/ProjectionSettings';
import { StaffMatrixPage } from './pages/StaffMatrix';
import { StaffSettingsPage } from './pages/StaffSettings';

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
          path="/calendar/staff-matrix"
          element={
            <Layout>
              <StaffMatrixPage />
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
          path="/roster"
          element={
            <Layout>
              <RosterPage />
            </Layout>
          }
        />
        <Route path="/kids" element={<Navigate to="/roster" replace />} />
        <Route
          path="/staff"
          element={
            <Layout>
              <StaffSettingsPage />
            </Layout>
          }
        />
        <Route path="/staff-settings" element={<Navigate to="/staff" replace />} />
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
