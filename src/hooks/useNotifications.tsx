import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  appointment_id: string | null;
  created_at: string;
}

export interface NotificationStats {
  total: number;
  unread: number;
  byType: {
    info: number;
    warning: number;
    error: number;
    success: number;
  };
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<NotificationStats>({
    total: 0,
    unread: 0,
    byType: { info: 0, warning: 0, error: 0, success: 0 }
  });

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      const notificationData = data as Notification[];
      setNotifications(notificationData);

      // Calculate stats
      const unreadCount = notificationData.filter(n => !n.is_read).length;
      const byType = {
        info: notificationData.filter(n => n.type === 'info').length,
        warning: notificationData.filter(n => n.type === 'warning').length,
        error: notificationData.filter(n => n.type === 'error').length,
        success: notificationData.filter(n => n.type === 'success').length,
      };

      setStats({
        total: notificationData.length,
        unread: unreadCount,
        byType
      });
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return;
      }

      // Update local state
      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );

      // Update stats
      setStats(prev => ({
        ...prev,
        unread: Math.max(0, prev.unread - 1)
      }));
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return;
      }

      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true }))
      );

      // Update stats
      setStats(prev => ({
        ...prev,
        unread: 0
      }));
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) {
        console.error('Error deleting notification:', error);
        return;
      }

      // Update local state
      const deletedNotification = notifications.find(n => n.id === notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      // Update stats
      if (deletedNotification && !deletedNotification.is_read) {
        setStats(prev => ({
          ...prev,
          total: prev.total - 1,
          unread: Math.max(0, prev.unread - 1),
          byType: {
            ...prev.byType,
            [deletedNotification.type]: Math.max(0, prev.byType[deletedNotification.type] - 1)
          }
        }));
      } else if (deletedNotification) {
        setStats(prev => ({
          ...prev,
          total: prev.total - 1,
          byType: {
            ...prev.byType,
            [deletedNotification.type]: Math.max(0, prev.byType[deletedNotification.type] - 1)
          }
        }));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const createNotification = async (notification: {
    title: string;
    message: string;
    type?: 'info' | 'warning' | 'error' | 'success';
    appointment_id?: string;
  }) => {
    if (!user) return { error: 'No user logged in' };

    try {
      const { data, error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          title: notification.title,
          message: notification.message,
          type: notification.type || 'info',
          appointment_id: notification.appointment_id || null,
          is_read: false
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating notification:', error);
        return { error };
      }

      // Add to local state
      setNotifications(prev => [data as Notification, ...prev]);

      // Update stats
      setStats(prev => ({
        total: prev.total + 1,
        unread: prev.unread + 1,
        byType: {
          ...prev.byType,
          [notification.type || 'info']: prev.byType[notification.type || 'info'] + 1
        }
      }));

      return { data };
    } catch (err) {
      console.error('Error creating notification:', err);
      return { error: err };
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [user]);

  return {
    notifications,
    loading,
    stats,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    createNotification
  };
};

