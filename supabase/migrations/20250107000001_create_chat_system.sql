-- Create chat_conversations table
CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  doctor_chat_enabled BOOLEAN DEFAULT false, -- Doctor controls this
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(patient_id, doctor_id)
);

-- Create chat_messages_new table (separate from existing chat_messages)
CREATE TABLE public.chat_messages_new (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'voice', 'document', 'image'
  content TEXT, -- For text messages
  file_url TEXT, -- For voice messages, documents, images
  file_name TEXT, -- Original filename
  file_size INTEGER, -- File size in bytes
  file_type TEXT, -- MIME type
  voice_duration INTEGER, -- Duration in seconds for voice messages
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create chat_participants table for tracking online status
CREATE TABLE public.chat_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT false,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Enable RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages_new ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chat_conversations
CREATE POLICY "Users can view their own conversations" 
ON public.chat_conversations 
FOR SELECT 
USING (auth.uid() = patient_id OR auth.uid() = doctor_id);

CREATE POLICY "Users can insert their own conversations" 
ON public.chat_conversations 
FOR INSERT 
WITH CHECK (auth.uid() = patient_id OR auth.uid() = doctor_id);

CREATE POLICY "Doctors can update chat settings" 
ON public.chat_conversations 
FOR UPDATE 
USING (auth.uid() = doctor_id);

-- RLS Policies for chat_messages_new
CREATE POLICY "Users can view messages in their conversations" 
ON public.chat_messages_new 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversations 
    WHERE id = conversation_id 
    AND (patient_id = auth.uid() OR doctor_id = auth.uid())
  )
);

CREATE POLICY "Users can insert messages in their conversations" 
ON public.chat_messages_new 
FOR INSERT 
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.chat_conversations 
    WHERE id = conversation_id 
    AND (patient_id = auth.uid() OR doctor_id = auth.uid())
    AND is_active = true
    AND (doctor_id = auth.uid() OR doctor_chat_enabled = true)
  )
);

CREATE POLICY "Users can update their own messages" 
ON public.chat_messages_new 
FOR UPDATE 
USING (sender_id = auth.uid());

-- RLS Policies for chat_participants
CREATE POLICY "Users can view participants in their conversations" 
ON public.chat_participants 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.chat_conversations 
    WHERE id = conversation_id 
    AND (patient_id = auth.uid() OR doctor_id = auth.uid())
  )
);

CREATE POLICY "Users can update their own participant status" 
ON public.chat_participants 
FOR UPDATE 
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own participant record" 
ON public.chat_participants 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.chat_conversations 
    WHERE id = conversation_id 
    AND (patient_id = auth.uid() OR doctor_id = auth.uid())
  )
);

-- Create indexes for better performance
CREATE INDEX idx_chat_conversations_patient_id ON public.chat_conversations(patient_id);
CREATE INDEX idx_chat_conversations_doctor_id ON public.chat_conversations(doctor_id);
CREATE INDEX idx_chat_messages_new_conversation_id ON public.chat_messages_new(conversation_id);
CREATE INDEX idx_chat_messages_new_created_at ON public.chat_messages_new(created_at);
CREATE INDEX idx_chat_participants_conversation_id ON public.chat_participants(conversation_id);
CREATE INDEX idx_chat_participants_user_id ON public.chat_participants(user_id);

-- Function to automatically create conversation when appointment is approved
CREATE OR REPLACE FUNCTION create_chat_conversation_on_appointment_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create conversation if appointment is being approved
  IF NEW.approval_status = 'approved' AND (OLD.approval_status IS NULL OR OLD.approval_status != 'approved') THEN
    INSERT INTO public.chat_conversations (patient_id, doctor_id, appointment_id, is_active, doctor_chat_enabled)
    VALUES (NEW.patient_id, NEW.doctor_id, NEW.id, true, false)
    ON CONFLICT (patient_id, doctor_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic conversation creation
CREATE TRIGGER trigger_create_chat_conversation
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION create_chat_conversation_on_appointment_approval();
