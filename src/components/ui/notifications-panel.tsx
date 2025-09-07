import { useState } from 'react';
import { Bell, Check, Trash2, Filter } from 'lucide-react';
import { Button } from './button';
import { Badge } from './badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import NotificationItem from './notification-item';

interface NotificationsPanelProps {
  className?: string;
}

export default function NotificationsPanel({ className }: NotificationsPanelProps) {
  const { notifications, loading, stats, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread' | 'info' | 'warning' | 'error' | 'success'>('all');

  const filteredNotifications = notifications.filter(notification => {
    switch (filter) {
      case 'unread':
        return !notification.is_read;
      case 'info':
      case 'warning':
      case 'error':
      case 'success':
        return notification.type === filter;
      default:
        return true;
    }
  });

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <span>Notifications</span>
          </CardTitle>
          <CardDescription>Loading notifications...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bell className="h-5 w-5" />
            <CardTitle>Notifications</CardTitle>
            {stats.unread > 0 && (
              <Badge variant="destructive" className="ml-2">
                {stats.unread}
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {stats.unread > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          {stats.total} total notifications • {stats.unread} unread
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Filter */}
        <div className="mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ({stats.total})</SelectItem>
                <SelectItem value="unread">Unread ({stats.unread})</SelectItem>
                <SelectItem value="info">Info ({stats.byType.info})</SelectItem>
                <SelectItem value="warning">Warning ({stats.byType.warning})</SelectItem>
                <SelectItem value="error">Error ({stats.byType.error})</SelectItem>
                <SelectItem value="success">Success ({stats.byType.success})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {filter === 'all' ? 'No notifications yet' : `No ${filter} notifications`}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={markAsRead}
                onDelete={deleteNotification}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

