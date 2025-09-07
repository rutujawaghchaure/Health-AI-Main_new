import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Stethoscope, Users, Brain, Shield, Video, MessageSquare } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Stethoscope className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">HealthCare AI</span>
            </div>
            <Button onClick={() => navigate('/auth')}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            AI-Powered Healthcare
            <span className="text-blue-600"> Diagnostics</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Experience the future of healthcare with our AI-driven diagnostic platform. 
            Connect with certified doctors, get instant AI health analysis, and manage your 
            health records seamlessly.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/auth')}>
              Join as Patient
            </Button>
            <Button variant="outline" size="lg" onClick={() => navigate('/auth')}>
              Join as Doctor
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Comprehensive Healthcare Solutions
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <Brain className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">AI Diagnostics</h3>
              <p className="text-gray-600">
                Advanced AI analyzes symptoms and medical reports for accurate preliminary diagnostics.
              </p>
            </div>
            <div className="text-center p-6">
              <Video className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Video Consultations</h3>
              <p className="text-gray-600">
                Connect with certified doctors through secure video calls for real-time consultations.
              </p>
            </div>
            <div className="text-center p-6">
              <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Secure Records</h3>
              <p className="text-gray-600">
                Your health records are encrypted and securely stored with easy download options.
              </p>
            </div>
            <div className="text-center p-6">
              <MessageSquare className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Chat Support</h3>
              <p className="text-gray-600">
                24/7 AI chatbot support for immediate health queries and guidance.
              </p>
            </div>
            <div className="text-center p-6">
              <Users className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Appointment Booking</h3>
              <p className="text-gray-600">
                Easy online appointment scheduling with automatic notifications.
              </p>
            </div>
            <div className="text-center p-6">
              <Stethoscope className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Expert Doctors</h3>
              <p className="text-gray-600">
                Connect with verified healthcare professionals across various specializations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Transform Your Healthcare Experience?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of patients and doctors already using our platform.
          </p>
          <Button size="lg" variant="secondary" onClick={() => navigate('/auth')}>
            Get Started Today
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <Stethoscope className="h-8 w-8 text-blue-400" />
            <span className="ml-2 text-xl font-bold">HealthCare AI</span>
          </div>
          <p className="text-gray-400">
            © 2024 HealthCare AI. All rights reserved. Revolutionizing healthcare through technology.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
