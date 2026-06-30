import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export default function PublicRoute() {
  const { token, user } = useUser();
  if (token || user) return <Navigate to="/lobby" replace />;
  return <Outlet />;
}
