import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../context/UserContext';

type Role = 'cloud' | 'tech' | 'dev';

// Nav links in AppLayout already hide routes a role can't use, but hiding a link
// doesn't stop someone typing the URL directly — the route itself must also check
// the role, or /app/settings etc. render for anyone with a session.
export default function RoleRoute({ allow }: { allow: Role[] }) {
  const { user } = useUser();
  if (!user?.role || !allow.includes(user.role)) return <Navigate to="/app/home" replace />;
  return <Outlet />;
}
