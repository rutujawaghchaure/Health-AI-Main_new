import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserCircle } from 'lucide-react';

export default function ProfileSetup() {
  const { profile, updateProfile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const [basicInfo, setBasicInfo] = useState({
    first_name: profile?.first_name || '',
    last_name: profile?.last_name || '',
    phone: profile?.phone || ''
  });

  const [doctorInfo, setDoctorInfo] = useState({
    specialization: '',
    license_number: '',
    years_of_experience: '',
    education: '',
    consultation_fee: '',
    bio: ''
  });

  const [patientInfo, setPatientInfo] = useState({
    date_of_birth: '',
    gender: '',
    blood_type: '',
    allergies: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    medical_history: ''
  });

  const handleBasicInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await updateProfile(basicInfo);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Success",
        description: "Basic information updated successfully"
      });
    }
    setIsLoading(false);
  };

  const handleRoleSpecificSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (profile?.role === 'doctor') {
        const { error } = await supabase
          .from('doctor_profiles')
          .insert({
            user_id: profile.user_id,
            specialization: doctorInfo.specialization,
            license_number: doctorInfo.license_number,
            years_of_experience: parseInt(doctorInfo.years_of_experience),
            education: doctorInfo.education,
            consultation_fee: parseFloat(doctorInfo.consultation_fee),
            bio: doctorInfo.bio
          });

        if (error) throw error;
      } else {
        const allergiesArray = patientInfo.allergies ? patientInfo.allergies.split(',').map(a => a.trim()) : [];
        
        const { error } = await supabase
          .from('patient_profiles')
          .insert({
            user_id: profile.user_id,
            date_of_birth: patientInfo.date_of_birth || null,
            gender: patientInfo.gender || null,
            blood_type: patientInfo.blood_type || null,
            allergies: allergiesArray,
            emergency_contact_name: patientInfo.emergency_contact_name || null,
            emergency_contact_phone: patientInfo.emergency_contact_phone || null,
            medical_history: patientInfo.medical_history || null
          });

        if (error) throw error;
      }

      toast({
        title: "Success",
        description: "Profile setup completed successfully"
      });

      // Refresh the page to reload the dashboard
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <UserCircle className="h-16 w-16 mx-auto text-blue-600 mb-4" />
          <h1 className="text-3xl font-bold text-gray-900">Complete Your Profile</h1>
          <p className="text-gray-600 mt-2">Let's set up your {profile?.role} profile</p>
        </div>

        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Please provide your basic details</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBasicInfoSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={basicInfo.first_name}
                    onChange={(e) => setBasicInfo(prev => ({ ...prev, first_name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={basicInfo.last_name}
                    onChange={(e) => setBasicInfo(prev => ({ ...prev, last_name: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={basicInfo.phone}
                  onChange={(e) => setBasicInfo(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Updating...' : 'Update Basic Info'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Role-specific Information */}
        <Card>
          <CardHeader>
            <CardTitle>
              {profile?.role === 'doctor' ? 'Doctor Information' : 'Patient Information'}
            </CardTitle>
            <CardDescription>
              {profile?.role === 'doctor' 
                ? 'Professional details and credentials' 
                : 'Medical history and personal details'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleRoleSpecificSubmit} className="space-y-4">
              {profile?.role === 'doctor' ? (
                <>
                  <div>
                    <Label htmlFor="specialization">Specialization</Label>
                    <Input
                      id="specialization"
                      value={doctorInfo.specialization}
                      onChange={(e) => setDoctorInfo(prev => ({ ...prev, specialization: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="license_number">Medical License Number</Label>
                    <Input
                      id="license_number"
                      value={doctorInfo.license_number}
                      onChange={(e) => setDoctorInfo(prev => ({ ...prev, license_number: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="years_of_experience">Years of Experience</Label>
                      <Input
                        id="years_of_experience"
                        type="number"
                        value={doctorInfo.years_of_experience}
                        onChange={(e) => setDoctorInfo(prev => ({ ...prev, years_of_experience: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="consultation_fee">Consultation Fee ($)</Label>
                      <Input
                        id="consultation_fee"
                        type="number"
                        step="0.01"
                        value={doctorInfo.consultation_fee}
                        onChange={(e) => setDoctorInfo(prev => ({ ...prev, consultation_fee: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="education">Education</Label>
                    <Textarea
                      id="education"
                      value={doctorInfo.education}
                      onChange={(e) => setDoctorInfo(prev => ({ ...prev, education: e.target.value }))}
                      placeholder="Medical school, residency, fellowships, etc."
                    />
                  </div>
                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={doctorInfo.bio}
                      onChange={(e) => setDoctorInfo(prev => ({ ...prev, bio: e.target.value }))}
                      placeholder="Brief professional bio..."
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="date_of_birth">Date of Birth</Label>
                      <Input
                        id="date_of_birth"
                        type="date"
                        value={patientInfo.date_of_birth}
                        onChange={(e) => setPatientInfo(prev => ({ ...prev, date_of_birth: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="gender">Gender</Label>
                      <Select value={patientInfo.gender} onValueChange={(value) => setPatientInfo(prev => ({ ...prev, gender: value }))}>
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
                  </div>
                  <div>
                    <Label htmlFor="blood_type">Blood Type</Label>
                    <Select value={patientInfo.blood_type} onValueChange={(value) => setPatientInfo(prev => ({ ...prev, blood_type: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select blood type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A+">A+</SelectItem>
                        <SelectItem value="A-">A-</SelectItem>
                        <SelectItem value="B+">B+</SelectItem>
                        <SelectItem value="B-">B-</SelectItem>
                        <SelectItem value="AB+">AB+</SelectItem>
                        <SelectItem value="AB-">AB-</SelectItem>
                        <SelectItem value="O+">O+</SelectItem>
                        <SelectItem value="O-">O-</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="allergies">Allergies (comma-separated)</Label>
                    <Input
                      id="allergies"
                      value={patientInfo.allergies}
                      onChange={(e) => setPatientInfo(prev => ({ ...prev, allergies: e.target.value }))}
                      placeholder="e.g., peanuts, shellfish, latex"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="emergency_contact_name">Emergency Contact Name</Label>
                      <Input
                        id="emergency_contact_name"
                        value={patientInfo.emergency_contact_name}
                        onChange={(e) => setPatientInfo(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="emergency_contact_phone">Emergency Contact Phone</Label>
                      <Input
                        id="emergency_contact_phone"
                        type="tel"
                        value={patientInfo.emergency_contact_phone}
                        onChange={(e) => setPatientInfo(prev => ({ ...prev, emergency_contact_phone: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="medical_history">Medical History</Label>
                    <Textarea
                      id="medical_history"
                      value={patientInfo.medical_history}
                      onChange={(e) => setPatientInfo(prev => ({ ...prev, medical_history: e.target.value }))}
                      placeholder="Any relevant medical history, conditions, medications..."
                    />
                  </div>
                </>
              )}
              <Button type="submit" disabled={isLoading} className="w-full">
                {isLoading ? 'Saving...' : 'Complete Profile Setup'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}