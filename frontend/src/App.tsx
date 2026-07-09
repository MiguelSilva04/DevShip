import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import ProtectedRoute from './routes/ProtectedRoute';
import PublicRoute    from './routes/PublicRoute';
import RoleRoute      from './routes/RoleRoute';

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
  OnboardingArgocdMetrics,
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
          <Route element={<PublicRoute />}>
            <Route path="/"          element={<Landing />} />
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
              <Route path="cluster"         element={<OnboardingCluster />} />
              <Route path="argocd-metrics"  element={<OnboardingArgocdMetrics />} />
              <Route path="environments"    element={<OnboardingEnvironments />} />
              <Route path="applications" element={<OnboardingApplications />} />
            </Route>

            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Navigate to="home" replace />} />
              <Route path="home"          element={<Home />} />

              <Route element={<RoleRoute allow={['cloud']} />}>
                <Route path="environments"  element={<Environments />} />
                <Route path="settings"      element={<Settings />} />
              </Route>

              <Route element={<RoleRoute allow={['cloud', 'tech']} />}>
                <Route path="approvals"        element={<Approvals />} />
                <Route path="approvals/:reqId" element={<Approval />} />
                <Route path="team/add"         element={<AddMember />} />
              </Route>

              <Route element={<RoleRoute allow={['cloud', 'tech', 'dev']} />}>
                <Route path="team" element={<Team />} />
              </Route>

              <Route path="how"           element={<HowItWorks />} />
              <Route path=":appId"                         element={<AppDetail />} />
              <Route path=":appId/:aeId"                   element={<EnvDetail />} />
              <Route path=":appId/:aeId/deploy"            element={<Deploy />} />
              <Route path=":appId/:aeId/exec/:reqId"       element={<Execution />} />
              <Route path=":appId/:aeId/history"           element={<History />} />
              <Route path=":appId/:aeId/rollback"          element={<Rollback />} />
              <Route path=":appId/:aeId/events"            element={<Events />} />
              <Route path=":appId/:aeId/health"            element={<Health />} />
              <Route path=":appId/:aeId/logs"              element={<Logs />} />
              <Route path=":appId/:aeId/pods"              element={<Pods />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </UserProvider>
    </BrowserRouter>
  );
}
