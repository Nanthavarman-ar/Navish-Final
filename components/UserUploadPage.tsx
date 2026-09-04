import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Info, ArrowLeft } from 'lucide-react';

// Client-side model uploads are admin-only - the endpoint this page's form used to post
// to (POST /upload-model) hard-requires admin role server-side with no exception for a
// subscribed client, so every upload attempt here always failed with a silent 403 no
// matter what plan was purchased. Rather than keep presenting a paid feature that can
// never actually succeed, this now tells the client the truth and points them at their
// admin instead. See ClientDashboard.tsx for the matching removal of the "Upload Model"/
// "Manage Uploads" buttons and the Payment Plan card that linked here.
export function UserUploadPage() {
  const { user } = useAuth();
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
        <Card className="bg-slate-800/50 border-cyan-600/50 max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-cyan-400 mb-4">
              <Info className="w-8 h-8" />
              <div>
                <h2 className="text-xl font-bold">Uploads are managed by your admin</h2>
                <p className="text-gray-400 text-sm">Model uploads are handled by your project administrator, not directly by client accounts.</p>
              </div>
            </div>
            <p className="text-gray-300 text-sm">
              Need a new model added to your account? Contact your project administrator and they'll upload
              and assign it to you - it'll then show up under "Assigned / Shared With Me" on your dashboard.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
