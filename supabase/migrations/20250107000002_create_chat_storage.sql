-- Create storage bucket for chat files
INSERT INTO storage.buckets (id, name, public) VALUES ('chat-files', 'chat-files', true);

-- Create storage policies for chat files
CREATE POLICY "Users can upload chat files" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'chat-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view chat files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'chat-files' AND
  (
    auth.uid()::text = (storage.foldername(name))[1] OR
    EXISTS (
      SELECT 1 FROM public.chat_conversations cc
      JOIN public.chat_messages_new cm ON cc.id = cm.conversation_id
      WHERE cm.file_url LIKE '%' || name || '%'
      AND (cc.patient_id = auth.uid() OR cc.doctor_id = auth.uid())
    )
  )
);

CREATE POLICY "Users can delete their own chat files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'chat-files' AND
  auth.uid()::text = (storage.foldername(name))[1]
);


