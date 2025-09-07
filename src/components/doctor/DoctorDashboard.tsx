import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, Users, FileText, MessageSquare, Video, Bell, LogOut, User, Clock, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import DoctorChatList from '@/components/chat/DoctorChatList';
import NotificationsPanel from '@/components/ui/notifications-panel';
import { useNotifications } from '@/hooks/useNotifications';

// Demo imports
import ChatDemo from '@/components/shared/ChatDemo';
import NotificationDemo from '@/components/shared/NotificationDemo';
import HealthRecordsDemo from '@/components/shared/HealthRecordsDemo';

export default function DoctorDashboard() {
  const { profile, signOut, user } = useAuth();
  const { createNotification } = useNotifications();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [rejectingAppt, setRejectingAppt] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [kpis, setKpis] = useState({ todays: 0, patients: 0, hours: 0, revenue: 0 });
  const [recent, setRecent] = useState<Array<{ id: string; label: string; sub: string; tag: string }>>([]);

  const loadAppointments = async () => {
    if (!user) return;
    setLoadingAppointments(true);
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('doctor_id', user.id)
      .order('appointment_date', { ascending: true });
    const apps = (data || []) as any[];
    setAppointments(apps);
    // KPIs
    const todayStr = new Date().toDateString();
    const todays = apps.filter(a => new Date(a.appointment_date).toDateString() === todayStr).length;
    const uniquePatients = new Set(apps.map(a => a.patient_id)).size;
    // hours estimate: sum of duration_minutes/60 for today
    const hours = apps
      .filter(a => new Date(a.appointment_date).toDateString() === todayStr)
      .reduce((sum, a) => sum + (a.duration_minutes || 30) / 60, 0);
    // revenue placeholder: count approved video appts * fee if available
    let revenue = 0;
    try {
      const { data: dprof } = await supabase
        .from('doctor_profiles')
        .select('consultation_fee')
        .eq('user_id', user.id)
        .single();
      const fee = Number(dprof?.consultation_fee || 0);
      const approvedCount = apps.filter((a: any) => a.approval_status === 'approved').length;
      revenue = fee * approvedCount;
    } catch {}
    setKpis({ todays, patients: uniquePatients, hours: Math.round(hours * 10) / 10, revenue });
    // Recent activity: latest appointments
    const recentItems: Array<{ id: string; label: string; sub: string; tag: string }> = [];
    apps.slice(0, 5).forEach((a) => {
      recentItems.push({ id: a.id, label: 'Appointment', sub: new Date(a.appointment_date).toLocaleString(), tag: a.status || 'scheduled' });
    });
    setRecent(recentItems);
    setLoadingAppointments(false);
  };

  useEffect(() => {
    loadAppointments();
  }, [user]);

  useEffect(() => {
    const loadPatients = async () => {
      if (!user) return;
      setLoadingPatients(true);
      try {
        // Get appointments for this doctor with all enhanced fields
        let appointmentsData: any[] = [];
        let appointmentsError: any = null;
        
        const { data: enhancedData, error: enhancedError } = await supabase
          .from('appointments')
          .select(`
            id, 
            patient_id, 
            doctor_id,
            appointment_date, 
            duration_minutes,
            status,
            consultation_type, 
            symptoms, 
            notes,
            prescription,
            created_at,
            updated_at,
            approval_status,
            rejection_reason,
            patient_full_name,
            patient_age,
            patient_gender,
            patient_contact_number,
            patient_email,
            disease_type,
            problem_description,
            preferred_consultation_type,
            uploaded_files,
            consultation_category,
            emergency_level,
            insurance_details,
            appointment_date_formatted
          `)
          .eq('doctor_id', user.id)
          .order('appointment_date', { ascending: false });

        if (enhancedError) {
          console.error('Error fetching enhanced appointments:', enhancedError);
          // If there's an error with the enhanced query, try the basic query
          console.log('Falling back to basic appointment query...');
          const { data: basicAppointmentsData, error: basicError } = await supabase
            .from('appointments')
            .select('id, patient_id, appointment_date, consultation_type, status, symptoms, created_at')
            .eq('doctor_id', user.id)
            .order('appointment_date', { ascending: false });
          
          if (basicError) {
            console.error('Error with basic query too:', basicError);
            setPatients([]);
            setLoadingPatients(false);
            return;
          }
          
          // Use basic data
          appointmentsData = basicAppointmentsData || [];
        } else {
          // Use enhanced data
          appointmentsData = enhancedData || [];
        }

        if (appointmentsData && appointmentsData.length > 0) {
          // Get unique patient IDs
          const patientIds = Array.from(new Set(appointmentsData.map((apt: any) => apt.patient_id)));
          
          // Fetch patient profiles
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, first_name, last_name, phone')
            .in('user_id', patientIds);

          // Fetch patient medical profiles
          const { data: patientProfilesData, error: patientProfilesError } = await supabase
            .from('patient_profiles')
            .select('user_id, date_of_birth, gender, blood_type, allergies, medical_history, emergency_contact_name, emergency_contact_phone')
            .in('user_id', patientIds);

          // Log any errors
          if (profilesError) console.error('Error fetching profiles:', profilesError);
          if (patientProfilesError) console.error('Error fetching patient profiles:', patientProfilesError);

          // Create maps for easy lookup
          const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
          const patientProfilesMap = new Map(patientProfilesData?.map(p => [p.user_id, p]) || []);
          
          // Debug logging (can be removed in production)
          console.log('Loaded profiles for patients:', profilesData?.length || 0);
          console.log('Loaded patient profiles:', patientProfilesData?.length || 0);

          // Group appointments by patient and create patient objects
          const patientMap = new Map();
          
          // Process appointments sequentially to handle async operations
          for (const appointment of appointmentsData as any[]) {
            const patientId = appointment.patient_id;
            const profile = profilesMap.get(patientId);
            const patientProfile = patientProfilesMap.get(patientId);
            
            // Debug logging (can be removed in production)
            if (!profile) {
              console.log('Processing patient:', patientId, 'Profile found:', !!profile, 'PatientProfile found:', !!patientProfile);
            }
            
            if (!patientMap.has(patientId)) {
              // Calculate age from date_of_birth if available
              let age = null;
              if (patientProfile?.date_of_birth) {
                const birthDate = new Date(patientProfile.date_of_birth);
                const today = new Date();
                age = today.getFullYear() - birthDate.getFullYear();
              }

              // Try to get name from multiple sources - prioritize appointment data
              let firstName = appointment.patient_full_name?.split(' ')[0] || profile?.first_name || 'Unknown';
              let lastName = appointment.patient_full_name?.split(' ').slice(1).join(' ') || profile?.last_name || '';
              
              // If we don't have a profile, try to fetch it individually
              if (!profile && !appointment.patient_full_name) {
                console.log('No profile found for patient:', patientId, 'Trying to fetch individually...');
                try {
                  const { data: individualProfile } = await supabase
                    .from('profiles')
                    .select('user_id, first_name, last_name, phone')
                    .eq('user_id', patientId)
                    .single();
                  
                  if (individualProfile) {
                    firstName = individualProfile.first_name || 'Unknown';
                    lastName = individualProfile.last_name || '';
                    console.log('Found individual profile:', individualProfile);
                  } else {
                    // If still no profile found, show patient ID as fallback
                    firstName = `Patient ${patientId.substring(0, 8)}`;
                    lastName = '';
                    console.log('No profile found, using patient ID as name');
                  }
                } catch (error) {
                  console.error('Error fetching individual profile:', error);
                  // If there's an error, show patient ID as fallback
                  firstName = `Patient ${patientId.substring(0, 8)}`;
                  lastName = '';
                }
              }

              patientMap.set(patientId, {
                user_id: patientId,
                first_name: firstName,
                last_name: lastName,
                phone: appointment.patient_contact_number || profile?.phone || '',
                email: appointment.patient_email || '',
                age: appointment.patient_age || age,
                gender: appointment.patient_gender || patientProfile?.gender || '',
                blood_type: patientProfile?.blood_type,
                allergies: patientProfile?.allergies || [],
                medical_history: patientProfile?.medical_history,
                emergency_contact_name: patientProfile?.emergency_contact_name,
                emergency_contact_phone: patientProfile?.emergency_contact_phone,
                last_appointment_date: appointment.appointment_date,
                last_consultation_type: appointment.consultation_type,
                last_disease_type: appointment.disease_type || '',
                last_emergency_level: appointment.emergency_level || '',
                last_problem_description: appointment.problem_description || appointment.symptoms || '',
                last_preferred_consultation_type: appointment.preferred_consultation_type || '',
                last_consultation_category: appointment.consultation_category || '',
                last_insurance_details: appointment.insurance_details || '',
                last_uploaded_files: appointment.uploaded_files || [],
                last_approval_status: appointment.approval_status || '',
                last_rejection_reason: appointment.rejection_reason || '',
                last_notes: appointment.notes || '',
                last_prescription: appointment.prescription || '',
                total_appointments: 1,
                appointments: [appointment]
              });
            } else {
              const existing = patientMap.get(patientId);
              existing.total_appointments += 1;
              existing.appointments.push(appointment);
              // Update with most recent appointment data
              if (new Date(appointment.appointment_date) > new Date(existing.last_appointment_date)) {
                existing.last_appointment_date = appointment.appointment_date;
                existing.last_consultation_type = appointment.consultation_type;
                existing.last_problem_description = appointment.problem_description || appointment.symptoms || '';
                existing.last_disease_type = appointment.disease_type || '';
                existing.last_emergency_level = appointment.emergency_level || '';
                existing.last_preferred_consultation_type = appointment.preferred_consultation_type || '';
                existing.last_consultation_category = appointment.consultation_category || '';
                existing.last_insurance_details = appointment.insurance_details || '';
                existing.last_uploaded_files = appointment.uploaded_files || [];
                existing.last_approval_status = appointment.approval_status || '';
                existing.last_rejection_reason = appointment.rejection_reason || '';
                existing.last_notes = appointment.notes || '';
                existing.last_prescription = appointment.prescription || '';
                // Update basic info if available from booking
                if (appointment.patient_full_name) {
                  existing.first_name = appointment.patient_full_name.split(' ')[0] || existing.first_name;
                  existing.last_name = appointment.patient_full_name.split(' ').slice(1).join(' ') || existing.last_name;
                }
                if (appointment.patient_contact_number) existing.phone = appointment.patient_contact_number;
                if (appointment.patient_email) existing.email = appointment.patient_email;
                if (appointment.patient_age) existing.age = appointment.patient_age;
                if (appointment.patient_gender) existing.gender = appointment.patient_gender;
              }
            }
          }
          
          setPatients(Array.from(patientMap.values()));
        } else {
          setPatients([]);
        }
      } catch (error) {
        console.error('Error loading patients:', error);
        setPatients([]);
      }
      setLoadingPatients(false);
    };
    loadPatients();
  }, [user, appointments]);

  const approveAppointment = async (id: string) => {
    const appointment = appointments.find(a => a.id === id);
    if (!appointment) return;

    await supabase
      .from('appointments')
      .update({ approval_status: 'approved', rejection_reason: null } as any)
      .eq('id', id);
    
    // Create notification for patient
    await createNotification({
      title: 'Appointment Approved',
      message: `Your appointment scheduled for ${new Date(appointment.appointment_date).toLocaleString()} has been approved by Dr. ${profile?.first_name} ${profile?.last_name}.`,
      type: 'success',
      appointment_id: id
    });

    await loadAppointments();
  };

  const rejectAppointment = async () => {
    if (!rejectingAppt) return;
    
    await supabase
      .from('appointments')
      .update({ approval_status: 'rejected', rejection_reason: rejectReason, status: 'cancelled' } as any)
      .eq('id', rejectingAppt.id);
    
    // Create notification for patient
    await createNotification({
      title: 'Appointment Rejected',
      message: `Your appointment scheduled for ${new Date(rejectingAppt.appointment_date).toLocaleString()} has been rejected. Reason: ${rejectReason}`,
      type: 'error',
      appointment_id: rejectingAppt.id
    });

    setRejectingAppt(null);
    setRejectReason('');
    await loadAppointments();
  };

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'patients', label: 'Patients', icon: Users },
    { id: 'consultations', label: 'Video Calls', icon: Video },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'records', label: 'Patient Records', icon: FileText },
    { id: 'notifications', label: 'Notifications', icon: Bell }
  ];

  const handleTabChange = (tabId: string) => {
    switch (tabId) {
      case 'messages':
        navigate('/doctor/messages');
        break;
      case 'records':
        navigate('/doctor/records');
        break;
      case 'notifications':
        navigate('/doctor/notifications');
        break;
      default:
        setActiveTab(tabId);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">Doctor Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/profile/doctor')} className="text-sm text-blue-600 hover:underline">
                Dr. {profile?.first_name} {profile?.last_name}
              </button>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="p-0">
                <nav className="space-y-1">
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleTabChange(item.id)}
                        className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                          activeTab === item.id
                            ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                            : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className="h-5 w-5 mr-3" />
                        {item.label}
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            { activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Today's Appointments</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{kpis.todays}</div>
                      <p className="text-xs text-muted-foreground">Next: {appointments[0] ? new Date(appointments[0].appointment_date).toLocaleTimeString() : '—'}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Active Patients</CardTitle>
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{kpis.patients}</div>
                      <p className="text-xs text-muted-foreground">unique this period</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Hours This Week</CardTitle>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{kpis.hours}</div>
                      <p className="text-xs text-muted-foreground">estimated</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Revenue</CardTitle>
                      <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">${kpis.revenue}</div>
                      <p className="text-xs text-muted-foreground">approved sessions</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Today's Schedule</CardTitle>
                      <CardDescription>Your upcoming appointments</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {appointments.length === 0 ? (
                          <div className="text-sm text-gray-500">No appointments today</div>
                        ) : (
                          appointments.filter(a => new Date(a.appointment_date).toDateString() === new Date().toDateString()).map((a) => (
                            <div key={a.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                                <p className="font-medium">{new Date(a.appointment_date).toLocaleTimeString()}</p>
                                <p className="text-sm text-gray-500">{a.consultation_type || 'video'}</p>
                          </div>
                              <Badge>{a.status || 'scheduled'}</Badge>
                        </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Activity</CardTitle>
                      <CardDescription>Latest patient interactions</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {recent.length === 0 ? (
                          <div className="text-sm text-gray-500">No recent activity</div>
                        ) : (
                          recent.map((r) => (
                            <div key={r.id} className="flex items-start space-x-4">
                          <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                          <div>
                                <p className="text-sm font-medium">{r.label}</p>
                                <p className="text-xs text-gray-500">{r.sub}</p>
                          </div>
                              <Badge variant="outline">{r.tag}</Badge>
                        </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Common tasks and features</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Button className="h-24 flex flex-col gap-2" variant="outline">
                      <Video className="h-6 w-6" />
                      Start Video Call
                    </Button>
                    <Button className="h-24 flex flex-col gap-2" variant="outline">
                      <MessageSquare className="h-6 w-6" />
                      Send Message
                    </Button>
                    <Button className="h-24 flex flex-col gap-2" variant="outline">
                      <FileText className="h-6 w-6" />
                      View Records
                    </Button>
                    <Button className="h-24 flex flex-col gap-2" variant="outline">
                      <Calendar className="h-6 w-6" />
                      Manage Schedule
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'appointments' && (
              <Card>
                <CardHeader>
                  <CardTitle>Appointment Management</CardTitle>
                  <CardDescription>Approve or reject appointment requests</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingAppointments ? (
                    <div className="text-sm text-gray-500">Loading appointments...</div>
                  ) : appointments.length === 0 ? (
                    <div className="text-sm text-gray-500">No appointments yet.</div>
                  ) : (
                    <div className="space-y-3">
                      {appointments.map((appt) => {
                        const start = new Date(appt.appointment_date).toLocaleString();
                        return (
                          <div key={appt.id} className="p-4 border rounded-lg space-y-2">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{start} - {appt.consultation_type || 'video'}</p>
                                <p className="text-sm text-gray-500">Status: {appt.status || 'scheduled'}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant={(appt as any).approval_status === 'approved' ? undefined : 'outline'}>
                                  {(appt as any).approval_status || 'pending'}
                                </Badge>
                              </div>
                            </div>
                            {(appt as any).approval_status === 'pending' && (
                              <div className="flex items-center gap-2">
                                <Button size="sm" onClick={() => approveAppointment(appt.id)}>Approve</Button>
                                <Button size="sm" variant="outline" onClick={() => setRejectingAppt(appt)}>Reject</Button>
                              </div>
                            )}
                            {(appt as any).approval_status === 'rejected' && (appt as any).rejection_reason && (
                              <div className="text-sm text-red-600">Reason: {(appt as any).rejection_reason}</div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'patients' && (
              <Card>
                <CardHeader>
                  <CardTitle>My Patients</CardTitle>
                  <CardDescription>Approved patients with detailed information</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingPatients ? (
                    <div className="text-sm text-gray-500">Loading patients...</div>
                  ) : patients.length === 0 ? (
                    <div className="text-sm text-gray-500">No approved patients yet.</div>
                  ) : (
                    <div className="space-y-4">
                      {patients.map((patient) => (
                        <Card key={patient.user_id} className="border-l-4 border-l-blue-500">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                  <User className="w-6 h-6 text-blue-600" />
                                </div>
                                <div>
                                  <h3 className="font-semibold text-lg">
                                    {patient.first_name} {patient.last_name}
                                  </h3>
                                  <p className="text-sm text-gray-600">
                                    {patient.age && `${patient.age} years old`}
                                    {patient.gender && ` • ${patient.gender}`}
                                    {patient.blood_type && ` • Blood Type: ${patient.blood_type}`}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                  {patient.total_appointments} appointment{patient.total_appointments > 1 ? 's' : ''}
                                </Badge>
                                <Badge variant="outline">
                                  {patient.last_consultation_type || 'Unknown'}
                                </Badge>
                                {patient.last_approval_status && (
                                  <Badge 
                                    variant="outline" 
                                    className={`${
                                      patient.last_approval_status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                                      patient.last_approval_status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                      patient.last_approval_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                                      'bg-gray-50 text-gray-700 border-gray-200'
                                    }`}
                                  >
                                    {patient.last_approval_status}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                              {/* Contact Information */}
                              <div>
                                <h4 className="font-medium text-sm text-gray-700 mb-2">Contact Information</h4>
                                <div className="space-y-1 text-sm">
                                  {patient.phone && (
                                    <p><span className="text-gray-500">Phone:</span> {patient.phone}</p>
                                  )}
                                  {patient.email && (
                                    <p><span className="text-gray-500">Email:</span> {patient.email}</p>
                                  )}
                                </div>
                              </div>

                              {/* Medical Information */}
                              <div>
                                <h4 className="font-medium text-sm text-gray-700 mb-2">Medical Information</h4>
                                <div className="space-y-1 text-sm">
                                  {patient.allergies && patient.allergies.length > 0 && (
                                    <p>
                                      <span className="text-gray-500">Allergies:</span> 
                                      <span className="text-red-600 ml-1">
                                        {Array.isArray(patient.allergies) ? patient.allergies.join(', ') : patient.allergies}
                                      </span>
                                    </p>
                                  )}
                                  {patient.medical_history && (
                                    <p className="text-gray-600">
                                      <span className="text-gray-500">History:</span> 
                                      {patient.medical_history.length > 50 
                                        ? `${patient.medical_history.substring(0, 50)}...` 
                                        : patient.medical_history}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Emergency Contact */}
                              <div>
                                <h4 className="font-medium text-sm text-gray-700 mb-2">Emergency Contact</h4>
                                <div className="space-y-1 text-sm">
                                  {patient.emergency_contact_name && (
                                    <p><span className="text-gray-500">Name:</span> {patient.emergency_contact_name}</p>
                                  )}
                                  {patient.emergency_contact_phone && (
                                    <p><span className="text-gray-500">Phone:</span> {patient.emergency_contact_phone}</p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Approval Status */}
                            {patient.last_approval_status && (
                              <div className="mb-4">
                                <h4 className="font-medium text-sm text-gray-700 mb-2">Appointment Status</h4>
                                <div className="flex items-center space-x-2">
                                  <Badge 
                                    variant="outline" 
                                    className={`${
                                      patient.last_approval_status === 'approved' ? 'bg-green-50 text-green-700 border-green-200' :
                                      patient.last_approval_status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                      patient.last_approval_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                                      'bg-gray-50 text-gray-700 border-gray-200'
                                    }`}
                                  >
                                    {patient.last_approval_status}
                                  </Badge>
                                  {patient.last_rejection_reason && (
                                    <span className="text-sm text-red-600">
                                      Reason: {patient.last_rejection_reason}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Last Appointment Details */}
                            <div className="bg-gray-50 p-3 rounded-lg">
                              <h4 className="font-medium text-sm text-gray-700 mb-2">Last Appointment Details</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                <div>
                                  <span className="text-gray-500">Date:</span> 
                                  <span className="ml-1">
                                    {new Date(patient.last_appointment_date).toLocaleDateString()} at{' '}
                                    {new Date(patient.last_appointment_date).toLocaleTimeString()}
                                  </span>
                                </div>
                                {patient.last_consultation_category && (
                                  <div>
                                    <span className="text-gray-500">Type:</span> 
                                    <Badge variant="outline" className="ml-1">
                                      {patient.last_consultation_category === 'first_time' ? 'First-time' : 'Follow-up'}
                                    </Badge>
                                  </div>
                                )}
                                {patient.last_disease_type && (
                                  <div>
                                    <span className="text-gray-500">Condition:</span> 
                                    <span className="ml-1 capitalize">{patient.last_disease_type}</span>
                                  </div>
                                )}
                                {patient.last_emergency_level && (
                                  <div>
                                    <span className="text-gray-500">Priority:</span> 
                                    <Badge 
                                      variant="outline" 
                                      className={`ml-1 ${
                                        patient.last_emergency_level === 'critical' ? 'bg-red-100 text-red-700' :
                                        patient.last_emergency_level === 'high' ? 'bg-orange-100 text-orange-700' :
                                        patient.last_emergency_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-green-100 text-green-700'
                                      }`}
                                    >
                                      {patient.last_emergency_level}
                                    </Badge>
                                  </div>
                                )}
                                {patient.last_preferred_consultation_type && (
                                  <div>
                                    <span className="text-gray-500">Preferred:</span> 
                                    <span className="ml-1 capitalize">{patient.last_preferred_consultation_type}</span>
                                  </div>
                                )}
                                {patient.last_insurance_details && (
                                  <div>
                                    <span className="text-gray-500">Insurance:</span> 
                                    <span className="ml-1">{patient.last_insurance_details}</span>
                                  </div>
                                )}
                                {patient.last_problem_description && (
                                  <div className="md:col-span-2">
                                    <span className="text-gray-500">Problem Description:</span> 
                                    <p className="text-gray-600 mt-1">
                                      {patient.last_problem_description.length > 150 
                                        ? `${patient.last_problem_description.substring(0, 150)}...` 
                                        : patient.last_problem_description}
                                    </p>
                                  </div>
                                )}
                                {patient.last_uploaded_files && patient.last_uploaded_files.length > 0 && (
                                  <div className="md:col-span-2">
                                    <span className="text-gray-500">Uploaded Files:</span> 
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {patient.last_uploaded_files.map((file: string, index: number) => (
                                        <Badge key={index} variant="outline" className="text-xs">
                                          {file.split('/').pop()?.split('_').slice(1).join('_') || `File ${index + 1}`}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Notes and Prescription */}
                            {(patient.last_notes || patient.last_prescription) && (
                              <div className="mt-4">
                                <h4 className="font-medium text-sm text-gray-700 mb-2">Medical Notes</h4>
                                <div className="space-y-2">
                                  {patient.last_notes && (
                                    <div className="bg-blue-50 p-3 rounded-lg">
                                      <div className="text-sm font-medium text-blue-800 mb-1">Notes:</div>
                                      <div className="text-sm text-blue-700">{patient.last_notes}</div>
                                    </div>
                                  )}
                                  {patient.last_prescription && (
                                    <div className="bg-green-50 p-3 rounded-lg">
                                      <div className="text-sm font-medium text-green-800 mb-1">Prescription:</div>
                                      <div className="text-sm text-green-700">{patient.last_prescription}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* All Appointments History */}
                            {patient.appointments && patient.appointments.length > 1 && (
                              <div className="mt-4">
                                <h4 className="font-medium text-sm text-gray-700 mb-2">All Appointments ({patient.total_appointments})</h4>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                  {patient.appointments.slice(0, 3).map((apt: any, index: number) => (
                                    <div key={apt.id} className="bg-white p-2 rounded border text-xs">
                                      <div className="flex justify-between items-start">
                                        <div>
                                          <div className="font-medium">
                                            {new Date(apt.appointment_date).toLocaleDateString()} - {apt.consultation_type}
                                          </div>
                                          {apt.disease_type && (
                                            <div className="text-gray-600">Condition: {apt.disease_type}</div>
                                          )}
                                          {apt.emergency_level && (
                                            <div className="text-gray-600">
                                              Priority: <span className={`font-medium ${
                                                apt.emergency_level === 'critical' ? 'text-red-600' :
                                                apt.emergency_level === 'high' ? 'text-orange-600' :
                                                apt.emergency_level === 'medium' ? 'text-yellow-600' :
                                                'text-green-600'
                                              }`}>{apt.emergency_level}</span>
                                            </div>
                                          )}
                                          {apt.consultation_category && (
                                            <div className="text-gray-600">
                                              Type: {apt.consultation_category === 'first_time' ? 'First-time' : 'Follow-up'}
                                            </div>
                                          )}
                                          {apt.problem_description && (
                                            <div className="text-gray-600 mt-1">
                                              {apt.problem_description.length > 80 
                                                ? `${apt.problem_description.substring(0, 80)}...` 
                                                : apt.problem_description}
                                            </div>
                                          )}
                                        </div>
                                        <div className="flex flex-col items-end space-y-1">
                                          <Badge variant="outline" className="text-xs">
                                            {apt.status}
                                          </Badge>
                                          {apt.approval_status && (
                                            <Badge 
                                              variant="outline" 
                                              className={`text-xs ${
                                                apt.approval_status === 'approved' ? 'bg-green-50 text-green-700' :
                                                apt.approval_status === 'pending' ? 'bg-yellow-50 text-yellow-700' :
                                                apt.approval_status === 'rejected' ? 'bg-red-50 text-red-700' :
                                                'bg-gray-50 text-gray-700'
                                              }`}
                                            >
                                              {apt.approval_status}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  {patient.appointments.length > 3 && (
                                    <div className="text-center text-xs text-gray-500 py-2">
                                      +{patient.appointments.length - 3} more appointments
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center justify-end space-x-2 mt-4 pt-3 border-t">
                              <Button variant="outline" size="sm">
                                <MessageSquare className="w-4 h-4 mr-1" />
                                Chat
                              </Button>
                              <Button variant="outline" size="sm">
                                <Video className="w-4 h-4 mr-1" />
                                Video Call
                              </Button>
                              <Button variant="outline" size="sm">
                                <FileText className="w-4 h-4 mr-1" />
                                View Records
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'consultations' && (
              <Card>
                <CardHeader>
                  <CardTitle>Video Consultations</CardTitle>
                  <CardDescription>Join at your scheduled time</CardDescription>
                </CardHeader>
                <CardContent>
                  {appointments.filter(a => (a.consultation_type || 'video') === 'video').length === 0 ? (
                    <div className="text-sm text-gray-500">No video consultations scheduled.</div>
                  ) : (
                    <div className="space-y-3">
                      {appointments.filter(a => (a.consultation_type || 'video') === 'video').map((appt) => {
                        const start = new Date(appt.appointment_date).getTime();
                        const canStart = Date.now() >= start && (appt as any).approval_status === 'approved';
                        return (
                          <div key={appt.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                              <p className="font-medium">{new Date(appt.appointment_date).toLocaleString()}</p>
                              <p className="text-sm text-gray-500">Status: {appt.status || 'scheduled'} | {(appt as any).approval_status || 'pending'}</p>
                            </div>
                            <Button disabled={!canStart} onClick={() => navigate(`/consultation?appointmentId=${appt.id}`)}>
                              {canStart ? 'Start' : 'Wait'}
                            </Button>
                          </div>
                        );
                      })}
                  </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      <Dialog open={!!rejectingAppt} onOpenChange={(o) => !o && setRejectingAppt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for rejection</Label>
            <Textarea id="reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Provide a brief message for the patient" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectingAppt(null)}>Cancel</Button>
            <Button onClick={rejectAppointment} disabled={!rejectReason.trim()}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}