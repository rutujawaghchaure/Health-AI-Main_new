-- Add additional fields to appointments table for comprehensive patient data collection
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS patient_full_name TEXT,
ADD COLUMN IF NOT EXISTS patient_age INTEGER,
ADD COLUMN IF NOT EXISTS patient_gender TEXT,
ADD COLUMN IF NOT EXISTS patient_contact_number TEXT,
ADD COLUMN IF NOT EXISTS patient_email TEXT,
ADD COLUMN IF NOT EXISTS disease_type TEXT,
ADD COLUMN IF NOT EXISTS problem_description TEXT,
ADD COLUMN IF NOT EXISTS preferred_consultation_type TEXT,
ADD COLUMN IF NOT EXISTS uploaded_files TEXT[], -- Array of file URLs
ADD COLUMN IF NOT EXISTS consultation_category TEXT, -- 'first_time' or 'follow_up'
ADD COLUMN IF NOT EXISTS emergency_level TEXT,
ADD COLUMN IF NOT EXISTS insurance_details TEXT,
ADD COLUMN IF NOT EXISTS appointment_date_formatted TEXT; -- For display purposes

-- Create index for better performance on new fields
CREATE INDEX IF NOT EXISTS idx_appointments_disease_type ON public.appointments(disease_type);
CREATE INDEX IF NOT EXISTS idx_appointments_consultation_category ON public.appointments(consultation_category);
CREATE INDEX IF NOT EXISTS idx_appointments_emergency_level ON public.appointments(emergency_level);
