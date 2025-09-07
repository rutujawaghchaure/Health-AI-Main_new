import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export default function DoctorProfile() {
  const { profile, user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [doctor, setDoctor] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingBasic, setSavingBasic] = useState(false);
  const [savingDoctor, setSavingDoctor] = useState(false);

  const [basicInfo, setBasicInfo] = useState({ first_name: '', last_name: '', phone: '' });
  const [doctorInfo, setDoctorInfo] = useState({
    specialization: '',
    license_number: '',
    years_of_experience: '',
    education: '',
    consultation_fee: '',
    bio: ''
  });

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('doctor_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      setDoctor(data || null);
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
    if (doctor) {
      setDoctorInfo({
        specialization: doctor.specialization || '',
        license_number: doctor.license_number || '',
        years_of_experience: doctor.years_of_experience?.toString?.() || '',
        education: doctor.education || '',
        consultation_fee: doctor.consultation_fee != null ? String(doctor.consultation_fee) : '',
        bio: doctor.bio || ''
      });
    }
  }, [doctor]);

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

  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingDoctor(true);
    const payload = {
      user_id: user.id,
      specialization: doctorInfo.specialization,
      license_number: doctorInfo.license_number,
      years_of_experience: doctorInfo.years_of_experience ? parseInt(doctorInfo.years_of_experience) : null,
      education: doctorInfo.education || null,
      consultation_fee: doctorInfo.consultation_fee ? parseFloat(doctorInfo.consultation_fee) : null,
      bio: doctorInfo.bio || null
    };
    const { error } = await supabase.from('doctor_profiles').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      toast({ description: 'Failed to save doctor details.' });
    } else {
      toast({ description: 'Doctor details saved.' });
      setDoctor({ ...(doctor || {}), ...payload });
    }
    setSavingDoctor(false);
  };

  if (!profile) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>
              Dr. {profile.first_name} {profile.last_name}
            </CardTitle>
            <CardDescription>
              {doctor?.specialization || 'Specialization not set'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-sm text-gray-500">Loading profile...</div>
            ) : (
              <div className="space-y-8">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">Status:</span>
                  <Badge variant="outline">{profile.status}</Badge>
                  {doctor?.is_verified ? <Badge>Verified</Badge> : <Badge variant="outline">Not Verified</Badge>}
                </div>

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

                <form onSubmit={handleSaveDoctor} className="space-y-4">
                  <div className="text-sm font-medium">Doctor Details</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="specialization">Specialization</Label>
                      <Input id="specialization" value={doctorInfo.specialization} onChange={(e) => setDoctorInfo(v => ({ ...v, specialization: e.target.value }))} required />
                    </div>
                    <div>
                      <Label htmlFor="license_number">License Number</Label>
                      <Input id="license_number" value={doctorInfo.license_number} onChange={(e) => setDoctorInfo(v => ({ ...v, license_number: e.target.value }))} required />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="years_of_experience">Years of Experience</Label>
                      <Input id="years_of_experience" type="number" value={doctorInfo.years_of_experience} onChange={(e) => setDoctorInfo(v => ({ ...v, years_of_experience: e.target.value }))} />
                    </div>
                    <div>
                      <Label htmlFor="consultation_fee">Consultation Fee ($)</Label>
                      <Input id="consultation_fee" type="number" step="0.01" value={doctorInfo.consultation_fee} onChange={(e) => setDoctorInfo(v => ({ ...v, consultation_fee: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="education">Education</Label>
                    <Textarea id="education" value={doctorInfo.education} onChange={(e) => setDoctorInfo(v => ({ ...v, education: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea id="bio" value={doctorInfo.bio} onChange={(e) => setDoctorInfo(v => ({ ...v, bio: e.target.value }))} />
                  </div>
                  <Button type="submit" disabled={savingDoctor}>{savingDoctor ? 'Saving...' : 'Save Doctor Details'}</Button>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 