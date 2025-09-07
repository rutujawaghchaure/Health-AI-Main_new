import { useAuth } from '@/hooks/useAuth';
import PatientDashboard from '@/components/patient/PatientDashboard';
import DoctorDashboard from '@/components/doctor/DoctorDashboard';
import ProfileSetup from '@/components/ProfileSetup';

export default function Dashboard() {
  const { profile } = useAuth();

  if (!profile) {
    return <div>Loading...</div>;
  }

  // Check if profile needs completion
  const needsProfileSetup = !profile.first_name || !profile.last_name;

  if (needsProfileSetup) {
    return <ProfileSetup />;
  }

  return (
    <div className="min-h-screen bg-background">
      {profile.role === 'patient' ? <PatientDashboard /> : <DoctorDashboard />}
    </div>
  );
}