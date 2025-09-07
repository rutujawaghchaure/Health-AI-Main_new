import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ChatDemo from '@/components/shared/ChatDemo';

export default function MessagesPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Patient Messages</CardTitle>
        <CardDescription>Communication with your patients</CardDescription>
      </CardHeader>
      <CardContent>
        <ChatDemo />
      </CardContent>
    </Card>
  );
}