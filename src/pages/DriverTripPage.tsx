import { useParams, useNavigate, Navigate } from "react-router-dom";
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider";
import { DriverTripInterface } from "@/components/tracking/DriverTripInterface";

export default function DriverTripPage() {
  const { routeId } = useParams<{ routeId: string }>();
  const navigate = useNavigate();

  if (!routeId) return <Navigate to="/driver" replace />;

  return (
    <GoogleMapsProvider>
      <div className="min-h-[100dvh] bg-background">
        <DriverTripInterface routeId={routeId} onClose={() => navigate("/driver")} />
      </div>
    </GoogleMapsProvider>
  );
}
