import { Bell, Check, X, AlertCircle, Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { Button } from './button';
import { Badge } from './badge';
import { Card, CardContent } from './card';
import { Notification } from '@/hooks/useNotifications';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    default:
      return <Info className="h-4 w-4 text-blue-600" />;
  }
};

const getNotificationBadgeVariant = (type: string) => {
  switch (type) {
    case 'success':
      return 'default' as const;
    case 'warning':
      return 'secondary' as const;
    case 'error':
      return 'destructive' as const;
    default:
      return 'outline' as const;
  }
};

export default function NotificationItem({ notification, onMarkAsRead, onDelete }: NotificationItemProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <Card className={`transition-all duration-200 ${!notification.is_read ? 'border-l-4 border-l-blue-500 bg-blue-50/50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <div className="mt-1">
              {getNotificationIcon(notification.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h4 className={`text-sm font-medium ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                  {notification.title}
                </h4>
                <Badge variant={getNotificationBadgeVariant(notification.type)} className="text-xs">
                  {notification.type}
                </Badge>
              </div>
              <p className={`text-sm ${!notification.is_read ? 'text-gray-800' : 'text-gray-600'}`}>
                {notification.message}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {formatDate(notification.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1 ml-2">
            {!notification.is_read && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMarkAsRead(notification.id)}
                className="h-8 w-8 p-0"
                title="Mark as read"
              >
                <Check className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(notification.id)}
              className="h-8 w-8 p-0 text-gray-400 hover:text-red-600"
              title="Delete notification"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

