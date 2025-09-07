import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

export default function AIChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'ai'; text: string }>>([
    { role: 'ai', text: 'Hello! I am your Health AI assistant. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typingDots, setTypingDots] = useState(false);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Load chat history on component mount
  useEffect(() => {
    const loadChatHistory = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('sender_id', user.id)
          .is('appointment_id', null)
          .order('created_at', { ascending: true });
        
        if (error) {
          console.error('Error loading chat history:', error);
        } else {
          setChatHistory(data || []);
        }
      } catch (err) {
        console.error('Error loading chat history:', err);
      }
    };

    loadChatHistory();
  }, [user]);

  // Save chat message to database
  const saveChatMessage = async (message: string, isAI: boolean) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          sender_id: user.id,
          message: message,
          is_ai_generated: isAI,
          appointment_id: null,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving chat message:', error);
      }
    } catch (err) {
      console.error('Error saving chat message:', err);
    }
  };

  // Download chat history as JSON
  const downloadChatHistory = () => {
    if (chatHistory.length === 0) {
      toast({ description: 'No chat history to download' });
      return;
    }

    const chatData = {
      patient_id: user?.id,
      patient_email: user?.email,
      download_date: new Date().toISOString(),
      total_messages: chatHistory.length,
      chat_history: chatHistory.map(msg => ({
        id: msg.id,
        message: msg.message,
        is_ai_generated: msg.is_ai_generated,
        created_at: msg.created_at,
        sender_type: msg.is_ai_generated ? 'AI Assistant' : 'Patient'
      }))
    };

    const dataStr = JSON.stringify(chatData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `health-ai-chat-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast({ description: 'Chat history downloaded successfully' });
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;

    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    setLoading(true);
    setTypingDots(true);

    // Save user message to database (non-blocking)
    saveChatMessage(text, false).catch(err => console.error('Error saving user message:', err));

    try {
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await axios.post(
        'https://r0c8kgwocscg8gsokogwwsw4.zetaverse.one/ai',
        {
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: `Analyze these symptoms: ${text}` }]
            }
          ]
        },
        {
          headers: { Authorization: 'Bearer F0qRkD9BJZYFANclPItFu5Ux8MG3' },
          signal: controller.signal,
          timeout: 10000
        }
      );

      clearTimeout(timeoutId);

      const aiReply = response.data.message || "Sorry, I couldn't generate a response.";

      // Save AI response to database (non-blocking)
      saveChatMessage(aiReply, true).catch(err => console.error('Error saving AI message:', err));

      // Stop dots and prepare to type reply
      setTypingDots(false);

      // Start with empty AI message
      setMessages((m) => [...m, { role: 'ai', text: '' }]);

      // Typing effect
      let i = 0;
      const interval = setInterval(() => {
        i++;
        setMessages((m) => {
          const updated = [...m];
          updated[updated.length - 1] = { role: 'ai', text: aiReply.slice(0, i) };
          return updated;
        });

        if (i >= aiReply.length) {
          clearInterval(interval);
          // Update chat history count without full reload
          setChatHistory(prev => [...prev, 
            { sender_id: user?.id, message: text, is_ai_generated: false, created_at: new Date().toISOString() },
            { sender_id: user?.id, message: aiReply, is_ai_generated: true, created_at: new Date().toISOString() }
          ]);
        }
      }, 20); // Faster typing effect

    } catch (err) {
      console.error(err);
      setTypingDots(false);
      
      let errorMessage = '❌ Sorry, there was an error analyzing your symptoms. Please try again.';
      
      if (err.name === 'AbortError' || err.code === 'ECONNABORTED') {
        const quickResponse = getQuickResponse(text);
        errorMessage = quickResponse || '⏱️ Request timed out. Please try again or consult a healthcare provider for immediate assistance.';
      } else if (err.response?.status === 429) {
        errorMessage = '🚫 Too many requests. Please wait a moment and try again.';
      } else if (err.response?.status >= 500) {
        const quickResponse = getQuickResponse(text);
        errorMessage = quickResponse || '🔧 Server temporarily unavailable. Please try again later or consult a healthcare provider.';
      }
      
      setMessages((m) => [...m, { role: 'ai', text: errorMessage }]);
      
      // Save fallback response to database
      saveChatMessage(errorMessage, true).catch(err => console.error('Error saving fallback message:', err));
      
      // Increment retry count for potential retry
      setRetryCount(prev => prev + 1);
    } finally {
      setLoading(false);
    }
  };

  const retryLastMessage = () => {
    if (messages.length >= 2) {
      const lastUserMessage = messages[messages.length - 2];
      if (lastUserMessage.role === 'user') {
        setInput(lastUserMessage.text);
        setRetryCount(0);
        // Remove the error message and retry
        setMessages(prev => prev.slice(0, -1));
        setTimeout(() => send(), 100);
      }
    }
  };

  const getQuickResponse = (symptoms: string) => {
    const lowerSymptoms = symptoms.toLowerCase();
    
    if (lowerSymptoms.includes('fever') && lowerSymptoms.includes('headache')) {
      return "For fever and headache: Rest, stay hydrated, use cool compresses, and consider acetaminophen or ibuprofen. Monitor temperature and seek medical attention if fever persists above 101°F (38.3°C) or if symptoms worsen.";
    }
    
    if (lowerSymptoms.includes('fever')) {
      return "For fever: Rest, stay hydrated, use cool compresses, and monitor temperature. Consider fever-reducing medication. Seek medical attention if fever is above 101°F (38.3°C) or persists for more than 3 days.";
    }
    
    if (lowerSymptoms.includes('headache')) {
      return "For headache: Rest in a quiet, dark room, apply cold or warm compresses to head/neck, stay hydrated, and consider over-the-counter pain relief. Seek immediate medical attention if headache is severe, sudden, or accompanied by other concerning symptoms.";
    }
    
    if (lowerSymptoms.includes('cough')) {
      return "For cough: Stay hydrated, use humidifier, avoid irritants, and consider cough drops or honey. Seek medical attention if cough persists for more than 2 weeks or is accompanied by fever, chest pain, or difficulty breathing.";
    }
    
    return null; // No quick response available
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
            <CardTitle>Health AI Chat</CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={downloadChatHistory}
                disabled={chatHistory.length === 0}
              >
                Download Chat History ({chatHistory.length} messages)
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[60vh] overflow-y-auto space-y-3 p-2 border rounded-md bg-white">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`px-3 py-2 rounded-lg max-w-[75%] ${
                      m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}

              {/* Typing dots animation */}
              {typingDots && (
                <div className="flex justify-start">
                  <div className="px-3 py-2 rounded-lg bg-gray-100 text-gray-500 text-sm">
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      <span className="ml-2 text-xs">AI is analyzing your symptoms...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>

            <div className="mt-3 flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Describe your symptoms..."
                onKeyDown={(e) => e.key === 'Enter' && !loading && send()}
                disabled={loading}
              />
              <Button onClick={send} disabled={loading || !input.trim()}>
                {loading ? 'Sending...' : 'Send'}
              </Button>
              {retryCount > 0 && !loading && (
                <Button variant="outline" onClick={retryLastMessage} size="sm">
                  Retry
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 