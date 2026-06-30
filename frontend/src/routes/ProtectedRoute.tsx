import { Navigate, Outlet } from 'react-router-dom';
import { useUser } from '../context/UserContext';

export default function ProtectedRoute() {
  const { token, user } = useUser();
  // Allow demo mode (user set without token) or real token
  if (!token && !user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
