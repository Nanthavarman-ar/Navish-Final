import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { PlanSelection } from './PlanSelection';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Lock, Upload, ArrowLeft } from 'lucide-react';
import { UserUploadForm } from './UserUploadForm';

export function UserUploadPage() {
  const { user } = useAuth();
  const { canUpload, subscription } = useSubscription();
  const navigate = useNavigate();

  if (!user || user.role !== 'client') {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="bg-slate-800/50 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between max-w-6xl mx-auto">
          <Button variant="ghost" onClick={() => navigate('/client')} className="text-gray-400 hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to My Models
          </Button>
          <h1 className="text-lg font-semibold text-white">Upload 3D Models</h1>
        </div>
      </header>

      <main className="p-6">
        {canUpload && subscription ? (
          <UserUploadForm subscription={subscription} />
        ) : (
          <div className="space-y-6">
            <Card className="bg-slate-800/50 border-amber-600/50 max-w-2xl mx-auto">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-amber-400 mb-4">
                  <Lock className="w-8 h-8" />
                  <div>
                    <h2 className="text-xl font-bold">Paid Subscription Required</h2>
                    <p className="text-gray-400 text-sm">Users need an active plan to upload 3D models. Admin has unlimited free uploads.</p>
                  </div>
                </div>
                <p className="text-gray-300 text-sm">Choose a plan below to enable uploads through secure checkout.</p>
              </CardContent>
            </Card>
            <PlanSelection />
          </div>
        )}
      </main>
    </div>
  );
}
