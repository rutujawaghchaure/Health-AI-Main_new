import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import DoctorProfile from "./pages/DoctorProfile";
import PatientProfile from "./pages/PatientProfile";
import Consultation from "./pages/Consultation";
import AIChat from "./pages/AIChat";
import MessagesPage from '@/pages/doctor/MessagesPage';
import RecordsPage from '@/pages/doctor/RecordsPage';
import NotificationsPage from '@/pages/doctor/NotificationsPage';


const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/doctor/messages" element={ <ProtectedRoute>
                <MessagesPage />
              </ProtectedRoute>} />
            <Route path="/doctor/records" element={ <ProtectedRoute>
                <RecordsPage />
              </ProtectedRoute>} />
            <Route path="/doctor/notifications" element={ <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>} />
              <Route path="/patient/messages" element={ <ProtectedRoute>
                <MessagesPage />
              </ProtectedRoute>} />
            <Route path="/patient/records" element={ <ProtectedRoute>
                <RecordsPage />
              </ProtectedRoute>} />
            <Route path="/patient/notifications" element={ <ProtectedRoute>
                <NotificationsPage />
              </ProtectedRoute>} />
            <Route path="/profile/doctor" element={
              <ProtectedRoute>
                <DoctorProfile />
              </ProtectedRoute>
            } />
            <Route path="/profile/patient" element={
              <ProtectedRoute>
                <PatientProfile />
              </ProtectedRoute>
            } />
            <Route path="/consultation" element={
              <ProtectedRoute>
                <Consultation />
              </ProtectedRoute>
            } />
            <Route path="/ai-chat" element={
              <ProtectedRoute>
                <AIChat />
              </ProtectedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
