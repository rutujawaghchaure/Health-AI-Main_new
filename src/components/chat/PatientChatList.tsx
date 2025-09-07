import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MessageSquare, Clock, User } from 'lucide-react';
import ChatInterface from './ChatInterface';

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
  last_message?: {
    content: string;
    created_at: string;
    sender_id: string;
  };
  unread_count?: number;
}

export default function PatientChatList() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<ChatConversation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
    setupRealtimeSubscription();
  }, [user]);

  const loadConversations = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Get conversations
      const { data: conversationsData, error: conversationsError } = await supabase
        .from('chat_conversations')
        .select(`
          *,
          doctor:profiles!chat_conversations_doctor_id_fkey(first_name, last_name, role)
        `)
        .eq('patient_id', user.id)
        .eq('is_active', true)
        .order('updated_at', { ascending: false });

      if (conversationsError) {
        // If table doesn't exist, show setup message
        if (conversationsError.code === 'PGRST116' || conversationsError.message.includes('relation "chat_conversations" does not exist')) {
          setLoading(false);
          return;
        }
        throw conversationsError;
      }

      // Get last messages and unread counts for each conversation
      const conversationsWithMessages = await Promise.all(
        (conversationsData || []).map(async (conv) => {
          // Get last message
          const { data: lastMessage } = await supabase
            .from('chat_messages_new')
            .select('content, created_at, sender_id')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Get unread count
          const { count: unreadCount } = await supabase
            .from('chat_messages_new')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .eq('sender_id', conv.doctor_id)
            .eq('is_read', false);

          return {
            ...conv,
            doctor_name: `${conv.doctor?.first_name} ${conv.doctor?.last_name}`,
            last_message: lastMessage,
            unread_count: unreadCount || 0
          };
        })
      );

      setConversations(conversationsWithMessages);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user) return;

    const subscription = supabase
      .channel(`patient_chat_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_conversations',
        filter: `patient_id=eq.${user.id}`
      }, () => {
        loadConversations();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages_new'
      }, () => {
        loadConversations();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  };

  const formatLastMessageTime = (timestamp?: string) => {
    if (!timestamp) return '';
    
    const now = new Date();
    const messageTime = new Date(timestamp);
    const diffInHours = (now.getTime() - messageTime.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return messageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // 7 days
      return messageTime.toLocaleDateString([], { weekday: 'short' });
    } else {
      return messageTime.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const truncateMessage = (message?: string, maxLength: number = 50) => {
    if (!message) return 'No messages yet';
    return message.length > maxLength ? `${message.substring(0, maxLength)}...` : message;
  };

  if (selectedConversation) {
    return (
      <ChatInterface
        conversation={selectedConversation}
        currentUserRole="patient"
        onClose={() => setSelectedConversation(null)}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <MessageSquare className="h-5 w-5" />
          <span>Messages</span>
        </CardTitle>
        <CardDescription>
          Chat with your doctors
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading conversations...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Chat system is being set up</p>
            <p className="text-sm text-gray-400 mt-2">
              The messaging feature is ready but needs database setup. Please run the database migrations to enable chat functionality.
            </p>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800 font-medium">To enable chat:</p>
              <p className="text-sm text-blue-700 mt-1">
                1. Run: <code className="bg-blue-100 px-2 py-1 rounded">npx supabase db reset</code>
              </p>
              <p className="text-sm text-blue-700">
                2. Or apply the chat migrations manually
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedConversation(conversation)}
              >
                <Avatar>
                  <AvatarFallback>
                    {conversation.doctor_name?.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900 truncate">
                      Dr. {conversation.doctor_name}
                    </h4>
                    <div className="flex items-center space-x-2">
                      {conversation.unread_count! > 0 && (
                        <Badge variant="destructive" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                          {conversation.unread_count}
                        </Badge>
                      )}
                      <span className="text-xs text-gray-500">
                        {formatLastMessageTime(conversation.last_message?.created_at)}
                      </span>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 truncate">
                    {truncateMessage(conversation.last_message?.content)}
                  </p>
                  
                  <div className="flex items-center space-x-2 mt-1">
                    {conversation.doctor_chat_enabled ? (
                      <Badge variant="default" className="text-xs">
                        Chat Enabled
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Chat Disabled
                      </Badge>
                    )}
                    
                    {!conversation.is_active && (
                      <Badge variant="outline" className="text-xs">
                        Inactive
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
