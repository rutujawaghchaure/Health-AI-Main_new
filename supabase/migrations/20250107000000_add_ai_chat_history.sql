-- Modify chat_messages table to make appointment_id optional for AI chats
ALTER TABLE public.chat_messages ALTER COLUMN appointment_id DROP NOT NULL;

-- Add a new column to distinguish AI chat messages
ALTER TABLE public.chat_messages ADD COLUMN chat_type TEXT DEFAULT 'appointment'; -- 'appointment' or 'ai_assistant'

-- Update RLS policies to allow AI chat messages
CREATE POLICY "Users can view their own AI chat messages" 
ON public.chat_messages 
FOR SELECT 
USING (auth.uid() = sender_id);

CREATE POLICY "Users can insert their own AI chat messages" 
ON public.chat_messages 
FOR INSERT 
WITH CHECK (auth.uid() = sender_id);

-- Create index for better performance
CREATE INDEX idx_chat_messages_sender_id ON public.chat_messages(sender_id);
CREATE INDEX idx_chat_messages_chat_type ON public.chat_messages(chat_type);
