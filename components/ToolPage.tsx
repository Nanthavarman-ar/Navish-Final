import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardDescription, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useApp } from '../contexts/AppContext';
import { toolPageDefinitions, ToolPageId } from './toolPageDefinitions';

const ToolPage: React.FC<{ page: ToolPageId }> = ({ page }) => {
  const { setCurrentPage } = useApp();
  const navigate = useNavigate();
  const definition = toolPageDefinitions[page];

  if (!definition) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <Card className="max-w-md w-full bg-slate-800/60 border border-slate-700">
          <CardHeader>
            <CardTitle className="text-xl">Tool not found</CardTitle>
            <CardDescription className="text-gray-300">
              The requested tool page is not available yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button onClick={() => setCurrentPage('tools-features')}>Back to Tools</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { title, description, focus, highlights, status, workspaceFeature } = definition;

  return (
    <div className="min-h-screen bg-slate-900 text-white py-10 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="border-slate-600 text-slate-200 hover:border-cyan-400 hover:text-white"
            onClick={() => setCurrentPage('tools-features')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Tools & Features
          </Button>
          {status && <Badge variant="outline">{status}</Badge>}
        </div>

        <Card className="bg-slate-800/60 border border-slate-700 shadow-xl">
          <CardHeader>
            <CardTitle className="text-3xl font-semibold text-white">{title}</CardTitle>
            <CardDescription className="text-gray-300 text-base max-w-3xl">{description}</CardDescription>
            {focus && <p className="text-sm text-gray-400 mt-2">{focus}</p>}
          </CardHeader>
          <CardContent className="space-y-4">
            {highlights && highlights.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-white">What you can explore</h3>
                <ul className="mt-3 grid gap-2 text-gray-300">
                  {highlights.map((bullet) => (
                    <li key={bullet} className="flex items-start gap-2">
                      <span className="text-cyan-400">-</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!workspaceFeature && (
              <p className="text-sm text-amber-400/90 bg-amber-950/30 border border-amber-900/50 rounded-md px-3 py-2">
                This capability isn&apos;t available as a standalone workspace toggle yet - it's described here for reference.
              </p>
            )}

            <div className="flex flex-wrap gap-3 pt-3">
              {workspaceFeature && (
                // Previously every one of these 33 tool pages was a dead end - no
                // button here ever actually launched the real feature, even though
                // most of them already exist and work inside the Babylon workspace.
                // This hands the flag to enable straight to BabylonWorkspace via a
                // query param it reads on mount (see BabylonWorkspace.tsx).
                <Button
                  className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400"
                  onClick={() => navigate(`/workspace?feature=${workspaceFeature}`)}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in Workspace
                </Button>
              )}
              <Button variant="outline" className="border-slate-600 text-slate-200 hover:border-cyan-400 hover:text-white" onClick={() => setCurrentPage('tools-features')}>
                Open Tools Collection
              </Button>
              <Button variant="ghost" onClick={() => setCurrentPage('home')}>
                Back to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ToolPage;
