import { Spinner } from "@nakama/ui/spinner";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/use-auth";
import { PAGE_PATHS } from "@/lib/navigation";
export function AuthGuard() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-svh items-center justify-center bg-background">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" />;
  }
  if (
    user?.mfaRequired &&
    !user.mfaEnrolled &&
    location.pathname !== PAGE_PATHS.settings
  ) {
    return <Navigate replace to={PAGE_PATHS.settings} />;
  }

  return <Outlet />;
}
