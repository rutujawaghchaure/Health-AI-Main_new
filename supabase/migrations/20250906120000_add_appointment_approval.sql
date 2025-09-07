-- Add approval status enum
CREATE TYPE public.appointment_approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Add columns to appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS approval_status public.appointment_approval_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Index for filtering by approval_status
CREATE INDEX IF NOT EXISTS idx_appointments_approval_status ON public.appointments(approval_status); 