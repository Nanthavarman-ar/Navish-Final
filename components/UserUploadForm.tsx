import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../contexts/SubscriptionContext';
import type { UserSubscription } from '../contexts/SubscriptionContext';
import { useApp } from '../contexts/AppContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Upload } from 'lucide-react';
import { supabase, projectId } from '../supabase/client';

const functionsBaseUrl = `https://${projectId}.supabase.co/functions/v1/make-server-cf230d31`;

interface UploadFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
}

const SUPPORTED_FORMATS = ['.glb', '.gltf', '.fbx', '.obj', '.stl', '.ply'];

export function UserUploadForm({ subscription }: { subscription: UserSubscription }) {
  const navigate = useNavigate();
  const { setSelectedModel } = useApp();
  const { refreshSubscription } = useSubscription();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const remaining = subscription.uploadLimit === -1 ? '∞' : Math.max(0, subscription.uploadLimit - subscription.uploadsUsed);

  const handleFileSelect = (fileList: FileList | null) => {
    if (!fileList) return;
    const valid: UploadFile[] = [];
    Array.from(fileList).forEach(file => {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (SUPPORTED_FORMATS.includes(ext) && file.size <= 500 * 1024 * 1024) {
        valid.push({ file, id: Math.random().toString(36).slice(2), progress: 0, status: 'pending' });
      }
    });
    setFiles(prev => [...prev, ...valid]);
  };

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const startUpload = async () => {
    if (files.length === 0 || !title) {
      alert('Add a title and select files.');
      return;
    }
    if (subscription.uploadLimit !== -1 && subscription.uploadsUsed + files.length > subscription.uploadLimit) {
      alert(`Upload limit reached. You can upload ${remaining} more.`);
      return;
    }
    setIsUploading(true);
    const firstFile = files[0].file;
    const firstId = files[0].id;
    let modelUrl: string | undefined;

    try {
      // 1. Try real backend upload
      const formData = new FormData();
      formData.append('file', firstFile);
      formData.append('title', title);
      formData.append('description', description);
      formData.append('tags', '');
      formData.append('assignedClients', JSON.stringify([]));
      formData.append('uploaderRole', 'client');

      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) {
        throw new Error('Authentication required');
      }

      setFiles(prev => prev.map(f => f.id === firstId ? { ...f, status: 'uploading' as const, progress: 30 } : f));

      const response = await fetch(
        `${functionsBaseUrl}/upload-model`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
          body: formData,
        }
      );

      setFiles(prev => prev.map(f => f.id === firstId ? { ...f, progress: 90 } : f));

      if (response.ok) {
        const data = await response.json().catch(() => ({}));
        modelUrl = data?.model?.signedUrl ?? data?.modelUrl ?? data?.url;
      } else {
        throw new Error('Upload API failed');
      }
    } catch {
      setFiles(prev => prev.map(f =>
        f.id === firstId ? { ...f, status: 'error' } : f
      ));
    }

    try {
      if (!modelUrl) {
        throw new Error('Model URL missing from upload response');
      }
      setFiles(prev => prev.map(f => ({ ...f, status: 'complete' as const, progress: 100 })));

      const model = {
        id: `user_${Date.now()}`,
        name: title,
        description,
        modelUrl,
        format: firstFile.name.split('.').pop()?.toLowerCase() || 'glb',
      };
      setSelectedModel(model);
      refreshSubscription();
      navigate('/workspace');
    } catch {
      alert('Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Upload Your 3D Model</CardTitle>
          <CardDescription className="text-gray-400">
            {subscription.uploadLimit === -1 ? 'Unlimited uploads' : `${remaining} uploads remaining`} · {subscription.tier} plan
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-white">Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Model name" className="bg-slate-700 border-slate-600 text-white" />
          </div>
          <div>
            <Label className="text-white">Description (optional)</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe your model" className="bg-slate-700 border-slate-600 text-white" />
          </div>
          <div>
            <Label className="text-white">Files</Label>
            <div
              className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center cursor-pointer hover:border-cyan-500 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-400">Drop files or click to browse</p>
              <p className="text-xs text-gray-500 mt-1">glb, gltf, fbx, obj, stl, ply · Max 500MB</p>
              <input ref={fileInputRef} type="file" multiple accept={SUPPORTED_FORMATS.join(',')} className="hidden" onChange={e => handleFileSelect(e.target.files)} />
            </div>
          </div>
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map(f => (
                <div key={f.id} className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                  <span className="text-sm text-white truncate">{f.file.name}</span>
                  <div className="flex items-center gap-2">
                    {f.status === 'uploading' && <Progress value={f.progress} className="w-20" />}
                    {f.status === 'complete' && <Badge className="bg-green-600">Done</Badge>}
                    <Button variant="ghost" size="sm" onClick={() => removeFile(f.id)} className="text-red-400">Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button onClick={startUpload} disabled={isUploading || files.length === 0 || !title} className="w-full bg-cyan-600 hover:bg-cyan-700">
            {isUploading ? 'Uploading...' : 'Upload & Open in Workspace'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
