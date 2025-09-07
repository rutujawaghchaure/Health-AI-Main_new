import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export default function PatientProfile() {
  const { profile, user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [patient, setPatient] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingBasic, setSavingBasic] = useState(false);
  const [savingPatient, setSavingPatient] = useState(false);

  const [basicInfo, setBasicInfo] = useState({ first_name: '', last_name: '', phone: '' });
  const [patientInfo, setPatientInfo] = useState({
    date_of_birth: '',
    gender: '',
    blood_type: '',
    allergies: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    medical_history: ''
  });

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('patient_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      setPatient(data || null);
      setLoading(false);
    };
    load();
  }, [user]);

  useEffect(() => {
    if (profile) {
      setBasicInfo({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || ''
      });
    }
  }, [profile]);

  useEffect(() => {
    if (patient) {
      setPatientInfo({
        date_of_birth: patient.date_of_birth || '',
        gender: patient.gender || '',
        blood_type: patient.blood_type || '',
        allergies: Array.isArray(patient.allergies) ? patient.allergies.join(', ') : (patient.allergies || ''),
        emergency_contact_name: patient.emergency_contact_name || '',
        emergency_contact_phone: patient.emergency_contact_phone || '',
        medical_history: patient.medical_history || ''
      });
    }
  }, [patient]);

  const handleSaveBasic = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBasic(true);
    const { error } = await updateProfile({
      first_name: basicInfo.first_name,
      last_name: basicInfo.last_name,
      phone: basicInfo.phone
    } as any);
    if (error) {
      toast({ description: 'Failed to update basic info.' });
    } else {
      toast({ description: 'Basic info updated.' });
    }
    setSavingBasic(false);
  };

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingPatient(true);
    const payload = {
      user_id: user.id,
      date_of_birth: patientInfo.date_of_birth || null,
      gender: patientInfo.gender || null,
      blood_type: patientInfo.blood_type || null,
      allergies: patientInfo.allergies ? patientInfo.allergies.split(',').map(a => a.trim()) : [],
      emergency_contact_name: patientInfo.emergency_contact_name || null,
      emergency_contact_phone: patientInfo.emergency_contact_phone || null,
      medical_history: patientInfo.medical_history || null
    };
    const { error } = await supabase.from('patient_profiles').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      toast({ description: 'Failed to save patient details.' });
    } else {
      toast({ description: 'Patient details saved.' });
      setPatient({ ...(patient || {}), ...payload });
    }
    setSavingPatient(false);
  };

  if (!profile) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              {profile.first_name} {profile.last_name}
            </CardTitle>
            <CardDescription>Patient Profile</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-gray-500">Loading profile...</div>
            ) : (
              <div className="space-y-8">
                <form onSubmit={handleSaveBasic} className="space-y-4">
                  <div className="text-sm font-medium">Basic Information</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="first_name">First Name</Label>
                      <Input id="first_name" value={basicInfo.first_name} onChange={(e) => setBasicInfo(v => ({ ...v, first_name: e.target.value }))} required />
                    </div>
                    <div>
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input id="last_name" value={basicInfo.last_name} onChange={(e) => setBasicInfo(v => ({ ...v, last_name: e.target.value }))} required />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input id="phone" value={basicInfo.phone} onChange={(e) => setBasicInfo(v => ({ ...v, phone: e.target.value }))} />
                  </div>
                  <Button type="submit" disabled={savingBasic}>{savingBasic ? 'Saving...' : 'Save Basic Info'}</Button>
                </form>

                <form onSubmit={handleSavePatient} className="space-y-4">
                  <div className="text-sm font-medium">Patient Details</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="date_of_birth">Date of Birth</Label>
                      <Input id="date_of_birth" type="date" value={patientInfo.date_of_birth} onChange={(e) => setPatientInfo(v => ({ ...v, date_of_birth: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="gender">Gender</Label>
                      <Input id="gender" value={patientInfo.gender} onChange={(e) => setPatientInfo(v => ({ ...v, gender: e.target.value }))} placeholder="male/female/other" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="blood_type">Blood Type</Label>
                      <Input id="blood_type" value={patientInfo.blood_type} onChange={(e) => setPatientInfo(v => ({ ...v, blood_type: e.target.value }))} placeholder="e.g., O+" />
                    </div>
                    <div>
                      <Label htmlFor="allergies">Allergies (comma-separated)</Label>
                      <Input id="allergies" value={patientInfo.allergies} onChange={(e) => setPatientInfo(v => ({ ...v, allergies: e.target.value }))} placeholder="peanuts, shellfish" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                      <Input id="emergency_contact_name" value={patientInfo.emergency_contact_name} onChange={(e) => setPatientInfo(v => ({ ...v, emergency_contact_name: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
                      <Input id="emergency_contact_phone" value={patientInfo.emergency_contact_phone} onChange={(e) => setPatientInfo(v => ({ ...v, emergency_contact_phone: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="medical_history">Medical History</Label>
                    <Textarea id="medical_history" value={patientInfo.medical_history} onChange={(e) => setPatientInfo(v => ({ ...v, medical_history: e.target.value }))} />
                  </div>
                  <Button type="submit" disabled={savingPatient}>{savingPatient ? 'Saving...' : 'Save Patient Details'}</Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 