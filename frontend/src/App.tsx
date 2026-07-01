import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import ProtectedRoute from './routes/ProtectedRoute';
import PublicRoute    from './routes/PublicRoute';

import Landing  from './pages/Landing';
import Login    from './pages/Login';
import Register from './pages/Register';
import Lobby    from './pages/Lobby';

import OnboardingLayout, {
  OnboardingIntro,
  OnboardingTeam,
  OnboardingProject,
  OnboardingAwsSetup,
  OnboardingCluster,
  OnboardingEnvironments,
  OnboardingApplications,
} from './pages/Onboarding';

import AppLayout    from './pages/app/AppLayout';
import Home         from './pages/app/Home';
import AppDetail    from './pages/app/AppDetail';
import EnvDetail    from './pages/app/EnvDetail';
import Environments from './pages/app/Environments';
import Deploy       from './pages/app/Deploy';
import Approval     from './pages/app/Approval';
import Execution    from './pages/app/Execution';
import Rollback     from './pages/app/Rollback';
import History      from './pages/app/History';
import Events       from './pages/app/Events';
import Health       from './pages/app/Health';
import Logs         from './pages/app/Logs';
import Pods         from './pages/app/Pods';
import Approvals    from './pages/app/Approvals';
import Team         from './pages/app/Team';
import AddMember    from './pages/app/AddMember';
import Settings     from './pages/app/Settings';
import HowItWorks   from './pages/app/HowItWorks';

export default function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <Routes>
          <Route path="/" element={<Landing />} />

          <Route element={<PublicRoute />}>
            <Route path="/login"    element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/lobby" element={<Lobby />} />

            {/* Onboarding — Cloud Engineer flow */}
            <Route path="/onboarding" element={<OnboardingLayout />}>
              <Route index            element={<OnboardingIntro />} />
              <Route path="team"        element={<OnboardingTeam />} />
              <Route path="project"     element={<OnboardingProject />} />
              <Route path="aws-setup"   element={<OnboardingAwsSetup />} />
              <Route path="cluster"     element={<OnboardingCluster />} />
              <Route path="environments" element={<OnboardingEnvironments />} />
              <Route path="applications" element={<OnboardingApplications />} />
            </Route>

            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Navigate to="home" replace />} />
              <Route path="home"          element={<Home />} />
              <Route path="environments"  element={<Environments />} />
              <Route path="approvals"     element={<Approvals />} />
              <Route path="team"          element={<Team />} />
              <Route path="team/add"      element={<AddMember />} />
              <Route path="settings"      element={<Settings />} />
              <Route path="history"       element={<History />} />
              <Route path="how"           element={<HowItWorks />} />
              <Route path=":app"               element={<AppDetail />} />
              <Route path=":app/:env"          element={<EnvDetail />} />
              <Route path=":app/:env/deploy"   element={<Deploy />} />
              <Route path=":app/:env/approval" element={<Approval />} />
              <Route path=":app/:env/exec"     element={<Execution />} />
              <Route path=":app/:env/rollback" element={<Rollback />} />
              <Route path=":app/:env/events"   element={<Events />} />
              <Route path=":app/:env/health"   element={<Health />} />
              <Route path=":app/:env/logs"     element={<Logs />} />
              <Route path=":app/:env/pods"     element={<Pods />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </UserProvider>
    </BrowserRouter>
  );
}
