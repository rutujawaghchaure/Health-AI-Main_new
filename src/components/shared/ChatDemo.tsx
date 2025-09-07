import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Send, FileText, User, Clock } from 'lucide-react';

interface DemoMessage {
  id: string;
  content: string;
  sender: 'patient' | 'doctor';
  timestamp: string;
  type: 'text' | 'file';
}

export default function ChatDemo() {
  const [messages, setMessages] = useState<DemoMessage[]>([
    {
      id: '1',
      content: 'Hello Dr. Johnson, I wanted to discuss my recent test results.',
      sender: 'patient',
      timestamp: '10:30 AM',
      type: 'text'
    },
    {
      id: '2',
      content: 'Hi Sarah! I\'ve reviewed your lab results. Everything looks good overall. Would you like to schedule a follow-up appointment?',
      sender: 'doctor',
      timestamp: '10:32 AM',
      type: 'text'
    },
    {
      id: '3',
      content: 'That\'s great news! Yes, I\'d like to schedule a follow-up. Also, I\'ve uploaded my blood pressure readings from this week.',
      sender: 'patient',
      timestamp: '10:35 AM',
      type: 'text'
    }
  ]);
  
  const [newMessage, setNewMessage] = useState('');

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    
    const message: DemoMessage = {
      id: Date.now().toString(),
      content: newMessage,
      sender: 'patient',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'text'
    };
    
    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Doctor-Patient Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.sender === 'patient' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  message.sender === 'patient'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <div className="flex items-center gap-2 text-xs opacity-70 mb-1">
                  <User className="h-3 w-3" />
                  {message.sender === 'patient' ? 'You' : 'Dr. Johnson'}
                </div>
                <div className="text-sm">{message.content}</div>
                <div className="flex items-center gap-1 text-xs opacity-50 mt-1">
                  <Clock className="h-3 w-3" />
                  {message.timestamp}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Message Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 min-h-[40px] max-h-[120px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />
            <Button 
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}