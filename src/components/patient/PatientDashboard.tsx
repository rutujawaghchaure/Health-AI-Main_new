import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { Calendar, MessageSquare, FileText, Brain, Video, Bell, LogOut, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';
import PatientChatList from '@/components/chat/PatientChatList';
import NotificationsPanel from '@/components/ui/notifications-panel';
import { useNotifications } from '@/hooks/useNotifications';
import MessagesPage from '@/pages/doctor/MessagesPage';
import RecordsPage from '@/pages/doctor/RecordsPage';
import NotificationsPage from '@/pages/doctor/NotificationsPage';

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Request timed out')), ms);
    promise
      .then((val) => {
        clearTimeout(t);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(t);
        reject(err);
      });
  });
}

export default function PatientDashboard() {
  const { profile, signOut, user } = useAuth();
  const { createNotification } = useNotifications();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [bookingDoctor, setBookingDoctor] = useState<any | null>(null);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [consultationType, setConsultationType] = useState('video');
  const [symptoms, setSymptoms] = useState('');
  const [isBooking, setIsBooking] = useState(false);
  
  // Enhanced booking form state
  const [bookingForm, setBookingForm] = useState({
    patientFullName: '',
    patientAge: '',
    patientGender: '',
    patientContactNumber: '',
    patientEmail: '',
    diseaseType: '',
    problemDescription: '',
    preferredConsultationType: 'video',
    consultationCategory: 'first_time',
    emergencyLevel: '',
    insuranceDetails: '',
    uploadedFiles: [] as File[]
  });
  const [myAppointments, setMyAppointments] = useState<any[]>([]);
  const [kpis, setKpis] = useState({ upcomingCount: 0, nextTime: '', recordsCount: 0, aiCount: 0, aiLast: '' });
  const [recent, setRecent] = useState<Array<{ id: string; label: string; sub: string; tag: string }>>([]);

  // File upload handler
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setBookingForm(prev => ({
      ...prev,
      uploadedFiles: [...prev.uploadedFiles, ...files]
    }));
  };

  const removeFile = (index: number) => {
    setBookingForm(prev => ({
      ...prev,
      uploadedFiles: prev.uploadedFiles.filter((_, i) => i !== index)
    }));
  };

  useEffect(() => {
    const fetchDoctors = async () => {
      setLoadingDoctors(true);
      const { data, error } = await supabase
        .from('doctor_profiles')
        .select('*')
        .eq('is_verified', true)
        .order('created_at', { ascending: false });
      if (error) {
        console.error('Error loading doctors', error);
        toast({ description: `Failed to load doctors: ${error.message || error}` });
      } else {
        setDoctors(data || []);
      }
      setLoadingDoctors(false);
    };
    fetchDoctors();
  }, []);

  useEffect(() => {
    const fetchMyAppointments = async () => {
      if (!user) return;
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', user.id)
        .order('appointment_date', { ascending: true });
      const apps = data || [];
      setMyAppointments(apps);
      // KPIs
      const upcoming = apps.filter(a => new Date(a.appointment_date).getTime() > Date.now());
      const upcomingCount = upcoming.length;
      const nextTime = upcoming[0] ? new Date(upcoming[0].appointment_date).toLocaleString() : '';
      // Health records
      const { count: hrCount, data: recordsList } = await supabase
        .from('health_records')
        .select('*', { count: 'exact' })
        .eq('patient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3);
      // AI consultations
      const { data: aiData } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('sender_id', user.id)
        .is('appointment_id', null)
        .eq('is_ai_generated', true)
        .order('created_at', { ascending: false });
      
      const aiCnt = aiData?.length || 0;
      const aiList = aiData?.slice(0, 3) || [];
      const lastAi = aiData && aiData.length > 0 ? [{ created_at: aiData[0].created_at }] : null;
      setKpis({
        upcomingCount,
        nextTime,
        recordsCount: hrCount || 0,
        aiCount: aiCnt || 0,
        aiLast: lastAi && lastAi[0] ? new Date(lastAi[0].created_at).toLocaleString() : ''
      });
      // Recent activity build
      const recentItems: Array<{ id: string; label: string; sub: string; tag: string }> = [];
      if (apps[0]) recentItems.push({ id: apps[0].id, label: 'Appointment scheduled', sub: new Date(apps[0].appointment_date).toLocaleString(), tag: apps[0].status || 'scheduled' });
      (aiList || []).forEach((m) => recentItems.push({ id: m.id, label: 'AI Symptom Analysis', sub: new Date(m.created_at).toLocaleString(), tag: 'AI' }));
      (recordsList || []).forEach((r) => recentItems.push({ id: r.id, label: `Record: ${r.title}`, sub: new Date(r.created_at).toLocaleString(), tag: 'Record' }));
      setRecent(recentItems.slice(0, 5));
    };
    fetchMyAppointments();
  }, [user, isBooking, bookingDoctor]);

  const bookAppointment = async () => {
    if (!user || !bookingDoctor) {
      toast({ description: 'Missing user or doctor.' });
      return;
    }
    if (!appointmentDate) {
      toast({ description: 'Please select date and time.' });
      return;
    }

    // Validate required fields
    if (!bookingForm.patientFullName || !bookingForm.patientAge || !bookingForm.patientGender) {
      toast({ description: 'Please fill in all required fields.' });
      return;
    }

    // Validate date
    const parsed = Date.parse(appointmentDate);
    if (Number.isNaN(parsed)) {
      toast({ description: 'Invalid date/time. Please pick a valid date.' });
      return;
    }
    const appointmentIso = new Date(parsed).toISOString();

    try {
      setIsBooking(true);
      
      // Upload files if any
      const uploadedFileUrls: string[] = [];
      if (bookingForm.uploadedFiles.length > 0) {
        for (const file of bookingForm.uploadedFiles) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${user.id}/${Date.now()}.${fileExt}`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('chat-files')
            .upload(fileName, file);
          
          if (uploadError) {
            console.error('File upload error:', uploadError);
            continue;
          }
          
          const { data: { publicUrl } } = supabase.storage
            .from('chat-files')
            .getPublicUrl(fileName);
          
          uploadedFileUrls.push(publicUrl);
        }
      }

      const { data, error } = await supabase.from('appointments').insert({
        patient_id: user.id,
        doctor_id: bookingDoctor.user_id,
        appointment_date: appointmentIso,
        consultation_type: consultationType,
        symptoms,
        // Enhanced patient data
        patient_full_name: bookingForm.patientFullName,
        patient_age: parseInt(bookingForm.patientAge),
        patient_gender: bookingForm.patientGender,
        patient_contact_number: bookingForm.patientContactNumber,
        patient_email: bookingForm.patientEmail,
        disease_type: bookingForm.diseaseType,
        problem_description: bookingForm.problemDescription,
        preferred_consultation_type: bookingForm.preferredConsultationType,
        consultation_category: bookingForm.consultationCategory,
        emergency_level: bookingForm.emergencyLevel,
        insurance_details: bookingForm.insuranceDetails,
        uploaded_files: uploadedFileUrls,
        appointment_date_formatted: new Date(appointmentIso).toLocaleDateString()
      }).select().single();
      
      if (error) {
        console.error('Error booking appointment', error);
        toast({ description: `Booking failed: ${error.message || error}` });
      } else {
        toast({ description: 'Appointment booked successfully.' });
        
        // Create notification for patient
        await createNotification({
          title: 'Appointment Booked',
          message: `Your appointment with Dr. ${bookingDoctor.specialization} has been scheduled for ${new Date(appointmentIso).toLocaleString()}. Waiting for doctor approval.`,
          type: 'info',
          appointment_id: data.id
        });

        // Create notification for doctor
        await supabase.from('notifications').insert({
          user_id: bookingDoctor.user_id,
          title: 'New Appointment Request',
          message: `${profile?.first_name} ${profile?.last_name} has requested an appointment for ${new Date(appointmentIso).toLocaleString()}. Please review and approve.`,
          type: 'info',
          appointment_id: data.id
        });

        setBookingDoctor(null);
        setAppointmentDate('');
        setSymptoms('');
        setConsultationType('video');
        // Reset enhanced form
        setBookingForm({
          patientFullName: '',
          patientAge: '',
          patientGender: '',
          patientContactNumber: '',
          patientEmail: '',
          diseaseType: '',
          problemDescription: '',
          preferredConsultationType: 'video',
          consultationCategory: 'first_time',
          emergencyLevel: '',
          insuranceDetails: '',
          uploadedFiles: []
        });
      }
    } catch (err: any) {
      console.error('Booking error', err);
      toast({ description: err?.message ? `Booking failed: ${err.message}` : 'Booking failed. Please try again.' });
    } finally {
      setIsBooking(false);
    }
  };

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'appointments', label: 'Appointments', icon: Calendar },
    { id: 'records', label: 'Health Records', icon: FileText },
    { id: 'ai-chat', label: 'AI Assistant', icon: Brain },
    { id: 'messages', label: 'Messages', icon: MessageSquare },
    { id: 'notifications', label: 'Notifications', icon: Bell }
  ];
 const handleTabChange = (tabId: string) => {
  switch (tabId) {
    case 'messages':
      navigate('/patient/messages');
      break;
    case 'records':
      navigate('/patient/records');
      break;
    case 'notifications':
      navigate('/patient/notifications');
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
              <h1 className="text-xl font-semibold text-gray-900">Patient Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate('/profile/patient')} className="text-sm text-blue-600 hover:underline">
                Welcome, {profile?.first_name} {profile?.last_name}
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
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Upcoming Appointments</CardTitle>
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{kpis.upcomingCount}</div>
                      <p className="text-xs text-muted-foreground">{kpis.nextTime ? `Next: ${kpis.nextTime}` : 'No upcoming'}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Health Records</CardTitle>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{kpis.recordsCount}</div>
                      <p className="text-xs text-muted-foreground">{kpis.recordsCount ? 'Total records' : 'No records yet'}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">AI Consultations</CardTitle>
                      <Brain className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{kpis.aiCount}</div>
                      <p className="text-xs text-muted-foreground">{kpis.aiLast ? `Last: ${kpis.aiLast}` : 'No AI chats yet'}</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                    <CardDescription>Common tasks and features</CardDescription>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Button className="h-24 flex flex-col gap-2" variant="outline" onClick={() => setActiveTab('appointments')}>
                      <Calendar className="h-6 w-6" />
                      Book Appointment
                    </Button>
                    <Button className="h-24 flex flex-col gap-2" variant="outline" onClick={() => setActiveTab('ai-chat')}>
                      <Brain className="h-6 w-6" />
                      AI Analysis
                    </Button>
                    <Button className="h-24 flex flex-col gap-2" variant="outline" onClick={() => setActiveTab('consultations')}>
                      <Video className="h-6 w-6" />
                      Video Call
                    </Button>
                    <Button className="h-24 flex flex-col gap-2" variant="outline" onClick={() => setActiveTab('records')}>
                      <FileText className="h-6 w-6" />
                      View Records
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {recent.length === 0 ? (
                        <div className="text-sm text-gray-500">No recent activity</div>
                      ) : (
                        recent.map((item) => (
                          <div key={item.id} className="flex items-start space-x-4">
                        <div className="w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                        <div>
                              <p className="text-sm font-medium">{item.label}</p>
                              <p className="text-xs text-gray-500">{item.sub}</p>
                        </div>
                            <Badge variant="outline">{item.tag}</Badge>
                      </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'appointments' && (
              <Card>
                <CardHeader>
                  <CardTitle>My Appointments</CardTitle>
                  <CardDescription>Browse doctors and book a new appointment</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">Available Doctors</h3>
                      {loadingDoctors ? (
                        <div className="text-sm text-gray-500">Loading doctors...</div>
                      ) : doctors.length === 0 ? (
                        <div className="text-sm text-gray-500">No verified doctors available right now.</div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {doctors.map((doc) => (
                            <Card key={doc.id}>
                              <CardHeader className="pb-2">
                                <CardTitle className="text-base">{doc.specialization}</CardTitle>
                                <CardDescription>
                                  {doc.years_of_experience ? `${doc.years_of_experience} yrs experience` : 'Experience N/A'}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="flex items-center justify-between">
                                <div className="text-sm text-gray-600">
                                  {doc.consultation_fee ? (
                                    <span>Fee: ${doc.consultation_fee}</span>
                                  ) : (
                                    <span>Fee: N/A</span>
                                  )}
                                </div>
                                <Button size="sm" onClick={() => setBookingDoctor(doc)}>
                                  Book
                                </Button>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">My Requests</h3>
                      {myAppointments.length === 0 ? (
                        <div className="text-sm text-gray-500">No requests yet.</div>
                      ) : (
                        <div className="space-y-2">
                          {myAppointments.map((appt) => (
                            <div key={appt.id} className="p-3 border rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">{new Date(appt.appointment_date).toLocaleString()} - {appt.consultation_type || 'video'}</div>
                                  <div className="text-xs text-gray-500">Status: {appt.approval_status || 'pending'}</div>
                                </div>
                                <Badge variant={appt.approval_status === 'approved' ? undefined : 'outline'}>
                                  {appt.status || 'scheduled'}
                                </Badge>
                              </div>
                              {appt.approval_status === 'rejected' && appt.rejection_reason && (
                                <div className="text-xs text-red-600 mt-1">Doctor message: {appt.rejection_reason}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <Dialog open={!!bookingDoctor} onOpenChange={(open) => !open && setBookingDoctor(null)}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Book a Consultation</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-6">
                        {/* Personal Information */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Personal Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="fullName">Full Name *</Label>
                              <Input
                                id="fullName"
                                value={bookingForm.patientFullName}
                                onChange={(e) => setBookingForm(prev => ({ ...prev, patientFullName: e.target.value }))}
                                placeholder="Enter your full name"
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor="age">Age *</Label>
                              <Input
                                id="age"
                                type="number"
                                value={bookingForm.patientAge}
                                onChange={(e) => setBookingForm(prev => ({ ...prev, patientAge: e.target.value }))}
                                placeholder="Enter your age"
                                required
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="gender">Select Gender *</Label>
                              <Select value={bookingForm.patientGender} onValueChange={(value) => setBookingForm(prev => ({ ...prev, patientGender: value }))}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="male">Male</SelectItem>
                                  <SelectItem value="female">Female</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="contactNumber">Contact Number</Label>
                              <Input
                                id="contactNumber"
                                type="tel"
                                value={bookingForm.patientContactNumber}
                                onChange={(e) => setBookingForm(prev => ({ ...prev, patientContactNumber: e.target.value }))}
                                placeholder="Enter your contact number"
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                              id="email"
                              type="email"
                              value={bookingForm.patientEmail}
                              onChange={(e) => setBookingForm(prev => ({ ...prev, patientEmail: e.target.value }))}
                              placeholder="Enter your email address"
                            />
                          </div>
                        </div>

                        {/* Medical Information */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Medical Information</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="diseaseType">Select Disease Type</Label>
                              <Select value={bookingForm.diseaseType} onValueChange={(value) => setBookingForm(prev => ({ ...prev, diseaseType: value }))}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select disease type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="general">General Health</SelectItem>
                                  <SelectItem value="cardiology">Cardiology</SelectItem>
                                  <SelectItem value="dermatology">Dermatology</SelectItem>
                                  <SelectItem value="neurology">Neurology</SelectItem>
                                  <SelectItem value="orthopedics">Orthopedics</SelectItem>
                                  <SelectItem value="pediatrics">Pediatrics</SelectItem>
                                  <SelectItem value="psychiatry">Psychiatry</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="emergencyLevel">Emergency Level</Label>
                              <Select value={bookingForm.emergencyLevel} onValueChange={(value) => setBookingForm(prev => ({ ...prev, emergencyLevel: value }))}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select emergency level" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low - Routine checkup</SelectItem>
                                  <SelectItem value="medium">Medium - Urgent but not emergency</SelectItem>
                                  <SelectItem value="high">High - Requires immediate attention</SelectItem>
                                  <SelectItem value="critical">Critical - Emergency</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="problemDescription">Describe your problem...</Label>
                            <Textarea
                              id="problemDescription"
                              value={bookingForm.problemDescription}
                              onChange={(e) => setBookingForm(prev => ({ ...prev, problemDescription: e.target.value }))}
                              placeholder="Please describe your symptoms, concerns, or medical issues in detail"
                              rows={4}
                            />
                          </div>
                        </div>

                        {/* Consultation Details */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Consultation Details</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="preferredConsultationType">Preferred Consultation Type</Label>
                              <Select value={bookingForm.preferredConsultationType} onValueChange={(value) => setBookingForm(prev => ({ ...prev, preferredConsultationType: value }))}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select consultation type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="video">Video Call</SelectItem>
                                  <SelectItem value="chat">Text Chat</SelectItem>
                                  <SelectItem value="phone">Phone Call</SelectItem>
                                  <SelectItem value="in_person">In-Person</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="consultationCategory">Consultation Type</Label>
                              <div className="flex space-x-4">
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="radio"
                                    name="consultationCategory"
                                    value="first_time"
                                    checked={bookingForm.consultationCategory === 'first_time'}
                                    onChange={(e) => setBookingForm(prev => ({ ...prev, consultationCategory: e.target.value }))}
                                    className="rounded"
                                  />
                                  <span>First-time consultation</span>
                                </label>
                                <label className="flex items-center space-x-2">
                                  <input
                                    type="radio"
                                    name="consultationCategory"
                                    value="follow_up"
                                    checked={bookingForm.consultationCategory === 'follow_up'}
                                    onChange={(e) => setBookingForm(prev => ({ ...prev, consultationCategory: e.target.value }))}
                                    className="rounded"
                                  />
                                  <span>Follow-up visit</span>
                                </label>
                              </div>
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="insuranceDetails">Insurance Details (Optional)</Label>
                            <Input
                              id="insuranceDetails"
                              value={bookingForm.insuranceDetails}
                              onChange={(e) => setBookingForm(prev => ({ ...prev, insuranceDetails: e.target.value }))}
                              placeholder="Enter your insurance information"
                            />
                          </div>
                        </div>

                        {/* File Upload */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Supporting Documents</h3>
                          <div>
                            <Label htmlFor="fileUpload">Choose Files</Label>
                            <Input
                              id="fileUpload"
                              type="file"
                              multiple
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
                              onChange={handleFileUpload}
                              className="mb-2"
                            />
                            <p className="text-sm text-gray-500">
                              Upload medical reports, prescriptions, or images (PDF, DOC, JPG, PNG)
                            </p>
                            {bookingForm.uploadedFiles.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {bookingForm.uploadedFiles.map((file, index) => (
                                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                                    <span className="text-sm">{file.name}</span>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => removeFile(index)}
                                    >
                                      Remove
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Appointment Scheduling */}
                        <div className="space-y-4">
                          <h3 className="text-lg font-medium">Appointment Scheduling</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="datetime">Appointment Date *</Label>
                              <Input
                                id="datetime"
                                type="datetime-local"
                                value={appointmentDate}
                                onChange={(e) => setAppointmentDate(e.target.value)}
                                required
                              />
                            </div>
                            <div>
                              <Label htmlFor="symptoms">Additional Notes</Label>
                              <Textarea
                                id="symptoms"
                                placeholder="Any additional information for the doctor"
                                value={symptoms}
                                onChange={(e) => setSymptoms(e.target.value)}
                                rows={3}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setBookingDoctor(null)}>
                          Cancel
                        </Button>
                        <Button onClick={bookAppointment} disabled={isBooking}>
                          {isBooking ? 'Booking...' : 'Book Appointment'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            )}

            {activeTab === 'records' && (
              <Card>
                <CardHeader>
                  <CardTitle>Health Records</CardTitle>
                  <CardDescription>Your medical history and documents</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Health records management coming soon...</p>
                    <Button className="mt-4">Upload Records</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'ai-chat' && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>AI Health Assistant</CardTitle>
                    <CardDescription>Get instant health advice and symptom analysis</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <Brain className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">Chat with our AI assistant for symptom analysis and health advice</p>
                      <Button className="mt-4" onClick={() => navigate('/ai-chat')}>Open Health AI Chat</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent AI Consultations</CardTitle>
                    <CardDescription>Your recent conversations with the AI assistant</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {kpis.aiCount === 0 ? (
                      <div className="text-center py-8">
                        <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No AI consultations yet</p>
                        <p className="text-sm text-gray-400 mt-2">Start a conversation to see your chat history here</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                          <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">{kpis.aiCount}</div>
                            <div className="text-sm text-gray-600">Total Consultations</div>
                          </div>
                          <div className="text-center p-4 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">{kpis.aiLast ? 'Active' : 'None'}</div>
                            <div className="text-sm text-gray-600">Last Activity</div>
                          </div>
                          <div className="text-center p-4 bg-purple-50 rounded-lg">
                            <div className="text-2xl font-bold text-purple-600">AI</div>
                            <div className="text-sm text-gray-600">Assistant Status</div>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <h4 className="font-medium text-gray-700">Recent Activity</h4>
                          {recent.filter(item => item.tag === 'AI').map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div className="flex items-center space-x-3">
                                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                                <div>
                                  <p className="text-sm font-medium">{item.label}</p>
                                  <p className="text-xs text-gray-500">{item.sub}</p>
                                </div>
                              </div>
                              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                AI Consultation
                              </Badge>
                            </div>
                          ))}
                        </div>

                        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                          <h4 className="font-medium text-gray-700 mb-2">Quick Actions</h4>
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => navigate('/ai-chat')}>
                              <Brain className="h-4 w-4 mr-2" />
                              New Consultation
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => navigate('/ai-chat')}>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              View All Chats
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'consultations' && (
              <Card>
                <CardHeader>
                  <CardTitle>Video Consultations</CardTitle>
                  <CardDescription>Join at your scheduled time</CardDescription>
                </CardHeader>
                <CardContent>
                  {myAppointments.filter(a => (a.consultation_type || 'video') === 'video').length === 0 ? (
                    <div className="text-sm text-gray-500">No video consultations scheduled.</div>
                  ) : (
                    <div className="space-y-3">
                      {myAppointments.filter(a => (a.consultation_type || 'video') === 'video').map((appt) => {
                        const start = new Date(appt.appointment_date).getTime();
                        const canStart = Date.now() >= start && appt.approval_status === 'approved';
                        return (
                          <div key={appt.id} className="flex items-center justify-between p-4 border rounded-lg">
                            <div>
                              <p className="font-medium">{new Date(appt.appointment_date).toLocaleString()}</p>
                              <p className="text-sm text-gray-500">Status: {appt.status || 'scheduled'} | {appt.approval_status || 'pending'}</p>
                            </div>
                            <Button asChild disabled={!canStart}>
                              <Link to={`/consultation?appointmentId=${appt.id}`}>{canStart ? 'Start' : 'Wait'}</Link>
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {activeTab === 'messages' && (
              <PatientChatList />
            )}

            {activeTab === 'notifications' && (
              <NotificationsPanel />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}