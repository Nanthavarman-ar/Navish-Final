import React from 'react';

export function Footer() {
  return (
    <footer className="border-t border-slate-700 py-12 bg-slate-900/50 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid md:grid-cols-3 gap-8">
          <div>
            <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent mb-4">
              NAVIZ
            </div>
            <p className="text-gray-400">
              Next-generation 3D asset management platform
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-white">Contact</h4>
            <ul className="space-y-2 text-gray-400">
              <li>
                <a href="mailto:navishstudioarchitects@gmail.com" className="hover:text-cyan-400 transition-colors">
                  navishstudioarchitects@gmail.com
                </a>
              </li>
              <li><a href="#" className="hover:text-cyan-400 transition-colors">Documentation</a></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold mb-4 text-white">Legal</h4>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#" className="hover:text-cyan-400 transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-cyan-400 transition-colors">Terms</a></li>
              <li><a href="#" className="hover:text-cyan-400 transition-colors">Security</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-700 mt-12 pt-8 text-center text-gray-400">
          <p>&copy; 2025 NAVIZ. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
