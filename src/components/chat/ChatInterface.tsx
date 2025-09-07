import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { 
  Send, 
  Mic, 
  MicOff, 
  Paperclip, 
  Download, 
  Play, 
  Pause,
  Volume2,
  FileText,
  Image as ImageIcon,
  Video,
  File
} from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: 'text' | 'voice' | 'document' | 'image';
  content?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  file_type?: string;
  voice_duration?: number;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
  sender_role?: 'patient' | 'doctor';
}

interface ChatConversation {
  id: string;
  patient_id: string;
  doctor_id: string;
  appointment_id?: string;
  is_active: boolean;
  doctor_chat_enabled: boolean;
  created_at: string;
  patient_name?: string;
  doctor_name?: string;
}

interface ChatInterfaceProps {
  conversation: ChatConversation;
  currentUserRole: 'patient' | 'doctor';
  onClose?: () => void;
}

export default function ChatInterface({ conversation, currentUserRole, onClose }: ChatInterfaceProps) {
  const { user, profile } = useAuth();
  const { createNotification } = useNotifications();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const otherUserId = currentUserRole === 'patient' ? conversation.doctor_id : conversation.patient_id;
  const otherUserName = currentUserRole === 'patient' ? conversation.doctor_name : conversation.patient_name;

  useEffect(() => {
    loadMessages();
    setupRealtimeSubscription();
    updateOnlineStatus(true);
    
    // Update online status every 30 seconds
    const interval = setInterval(() => {
      updateOnlineStatus(true);
    }, 30000);

    return () => {
      clearInterval(interval);
      updateOnlineStatus(false);
    };
  }, [conversation.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages_new')
        .select(`
          *,
          sender:profiles!chat_messages_new_sender_id_fkey(first_name, last_name, role)
        `)
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const formattedMessages = data?.map(msg => ({
        ...msg,
        sender_name: `${msg.sender?.first_name} ${msg.sender?.last_name}`,
        sender_role: msg.sender?.role
      })) || [];

      setMessages(formattedMessages);
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({ description: 'Failed to load messages', variant: 'destructive' });
    }
  };

  const setupRealtimeSubscription = () => {
    const subscription = supabase
      .channel(`chat_${conversation.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages_new',
        filter: `conversation_id=eq.${conversation.id}`
      }, (payload) => {
        const newMessage = payload.new as ChatMessage;
        // Fetch sender info
        supabase
          .from('profiles')
          .select('first_name, last_name, role')
          .eq('user_id', newMessage.sender_id)
          .single()
          .then(({ data }) => {
            if (data) {
              setMessages(prev => [...prev, {
                ...newMessage,
                sender_name: `${data.first_name} ${data.last_name}`,
                sender_role: data.role
              }]);
            }
          });
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const updateOnlineStatus = async (online: boolean) => {
    try {
      await supabase
        .from('chat_participants')
        .upsert({
          conversation_id: conversation.id,
          user_id: user?.id,
          is_online: online,
          last_seen: new Date().toISOString()
        }, { onConflict: 'conversation_id,user_id' });
    } catch (error) {
      console.error('Error updating online status:', error);
    }
  };

  const sendMessage = async (type: 'text' | 'voice' | 'document' | 'image', content?: string, fileUrl?: string, fileName?: string, fileSize?: number, fileType?: string, voiceDuration?: number) => {
    if (!user || !conversation.is_active) return;

    try {
      const { error } = await supabase
        .from('chat_messages_new')
        .insert({
          conversation_id: conversation.id,
          sender_id: user.id,
          message_type: type,
          content: content || null,
          file_url: fileUrl || null,
          file_name: fileName || null,
          file_size: fileSize || null,
          file_type: fileType || null,
          voice_duration: voiceDuration || null
        });

      if (error) throw error;

      // Create notification for the other user
      const senderName = profile?.first_name && profile?.last_name 
        ? `${profile.first_name} ${profile.last_name}` 
        : (currentUserRole === 'doctor' ? 'Dr. Unknown' : 'Patient');
      
      const messagePreview = type === 'text' 
        ? (content || 'Sent a message')
        : type === 'voice' 
        ? 'Sent a voice message'
        : type === 'image'
        ? 'Sent an image'
        : type === 'document'
        ? `Sent a file: ${fileName || 'document'}`
        : 'Sent a message';

      // Create notification for the recipient
      await supabase.from('notifications').insert({
        user_id: otherUserId,
        title: 'New Message',
        message: `${senderName} sent you a message: ${messagePreview}`,
        type: 'info',
        appointment_id: conversation.appointment_id || null
      });

      if (type === 'text') {
        setNewMessage('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ description: 'Failed to send message', variant: 'destructive' });
    }
  };

  const handleTextSend = () => {
    if (newMessage.trim()) {
      sendMessage('text', newMessage.trim());
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const audioChunks: Blob[] = [];
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Upload audio file
        setIsUploading(true);
        try {
          const fileName = `voice_${Date.now()}.webm`;
          const { data, error } = await supabase.storage
            .from('chat-files')
            .upload(`voice/${fileName}`, audioBlob, {
              contentType: 'audio/webm'
            });

          if (error) throw error;

          const { data: { publicUrl } } = supabase.storage
            .from('chat-files')
            .getPublicUrl(`voice/${fileName}`);

          // Get audio duration
          const audio = new Audio(audioUrl);
          audio.onloadedmetadata = () => {
            const duration = Math.round(audio.duration);
            sendMessage('voice', undefined, publicUrl, fileName, audioBlob.size, 'audio/webm', duration);
            setIsUploading(false);
          };
        } catch (error) {
          console.error('Error uploading voice message:', error);
          toast({ description: 'Failed to send voice message', variant: 'destructive' });
          setIsUploading(false);
        }
        
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({ description: 'Microphone access denied', variant: 'destructive' });
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playVoiceMessage = (audioUrl: string, messageId: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    audio.onplay = () => setIsPlaying(messageId);
    audio.onended = () => setIsPlaying(null);
    audio.onerror = () => {
      setIsPlaying(null);
      toast({ description: 'Failed to play voice message', variant: 'destructive' });
    };
    
    audio.play();
  };

  const stopVoiceMessage = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(null);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileName = `${file.type.startsWith('image/') ? 'images' : 'documents'}/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('chat-files')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-files')
        .getPublicUrl(fileName);

      const messageType = file.type.startsWith('image/') ? 'image' : 'document';
      sendMessage(messageType, undefined, publicUrl, file.name, file.size, file.type);
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({ description: 'Failed to upload file', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
    if (fileType.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (fileType.includes('pdf')) return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarFallback>
                {otherUserName?.split(' ').map(n => n[0]).join('').toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{otherUserName}</CardTitle>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span className="text-sm text-gray-500">
                  {isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
          {onClose && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Close
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[70%] ${message.sender_id === user?.id ? 'order-2' : 'order-1'}`}>
                {message.sender_id !== user?.id && (
                  <div className="text-xs text-gray-500 mb-1">
                    {message.sender_name} ({message.sender_role === 'doctor' ? 'Dr.' : 'Patient'})
                  </div>
                )}
                
                <div
                  className={`px-3 py-2 rounded-lg ${
                    message.sender_id === user?.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {message.message_type === 'text' && (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                  
                  {message.message_type === 'voice' && (
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant={isPlaying === message.id ? "destructive" : "outline"}
                        onClick={() => {
                          if (isPlaying === message.id) {
                            stopVoiceMessage();
                          } else {
                            playVoiceMessage(message.file_url!, message.id);
                          }
                        }}
                        className="h-8 w-8 p-0"
                      >
                        {isPlaying === message.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <div className="flex items-center space-x-1">
                        <Volume2 className="h-4 w-4" />
                        <span className="text-sm">
                          {message.voice_duration}s
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {(message.message_type === 'document' || message.message_type === 'image') && (
                    <div className="space-y-2">
                      {message.message_type === 'image' && (
                        <img
                          src={message.file_url}
                          alt={message.file_name}
                          className="max-w-full h-auto rounded"
                          style={{ maxHeight: '200px' }}
                        />
                      )}
                      <div className="flex items-center space-x-2">
                        {getFileIcon(message.file_type || '')}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{message.file_name}</p>
                          <p className="text-xs opacity-75">
                            {formatFileSize(message.file_size || 0)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(message.file_url, '_blank')}
                          className="h-8 w-8 p-0"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className={`text-xs text-gray-500 mt-1 ${message.sender_id === user?.id ? 'text-right' : 'text-left'}`}>
                  {formatTime(message.created_at)}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t p-4 flex-shrink-0">
          {!conversation.is_active && (
            <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              Chat is currently disabled by the doctor.
            </div>
          )}
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={!conversation.is_active || isUploading}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              onKeyPress={(e) => e.key === 'Enter' && handleTextSend()}
              disabled={!conversation.is_active}
              className="flex-1"
            />
            
            <Button
              variant={isRecording ? "destructive" : "outline"}
              size="sm"
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onMouseLeave={stopRecording}
              disabled={!conversation.is_active || isUploading}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            
            <Button
              onClick={handleTextSend}
              disabled={!newMessage.trim() || !conversation.is_active || isUploading}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          {isUploading && (
            <div className="mt-2 text-sm text-gray-500">Uploading...</div>
          )}
        </div>
      </CardContent>

      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileUpload}
        accept="image/*,.pdf,.doc,.docx,.txt"
        className="hidden"
      />
    </Card>
  );
}

