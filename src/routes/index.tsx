import { createBrowserRouter } from 'react-router-dom';
import DoctorDashboard from '@/components/doctor/DoctorDashboard';
import MessagesPage from '@/pages/doctor/MessagesPage';
import RecordsPage from '@/pages/doctor/RecordsPage';
import NotificationsPage from '@/pages/doctor/NotificationsPage';

export const router = createBrowserRouter([
  {
    path: '/doctor',
    element: <DoctorDashboard />,
  },
  {
    path: '/doctor/messages',
    element: <MessagesPage />,
  },
  {
    path: '/doctor/records',
    element: <RecordsPage />,
  },
  {
    path: '/doctor/notifications',
    element: <NotificationsPage />,
  }
]);