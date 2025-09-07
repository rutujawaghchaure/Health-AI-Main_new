import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import NotificationDemo from '@/components/shared/NotificationDemo';

export default function NotificationsPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Stay updated with important alerts</CardDescription>
      </CardHeader>
      <CardContent>
        <NotificationDemo />
      </CardContent>
    </Card>
  );
}