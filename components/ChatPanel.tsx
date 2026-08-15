import React, { useState, useEffect, useRef } from 'react';
import { X, Send, MessageSquare } from 'lucide-react';
import { Button } from './ui/button';
import { showToast } from './utils/toast';
import type { CollabManager, ChatMessage, CollabEvent } from './CollabManager';

interface ChatPanelProps {
  collabManager: CollabManager | null;
  onClose: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ collabManager, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => collabManager?.getChatHistory() || []);
  const [draft, setDraft] = useState('');
  const [isConnected, setIsConnected] = useState(() => collabManager?.getIsConnected() ?? false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!collabManager) return;
    const listener = (event: CollabEvent) => {
      if (event.type === 'chat_message' && event.data) {
        setMessages((prev) => [...prev, event.data as ChatMessage]);
      }
      if (event.type === 'user_joined' || event.type === 'user_left') {
        setIsConnected(collabManager.getIsConnected());
      }
    };
    collabManager.addEventListener(listener);
    // Connection may complete asynchronously after this panel mounts - poll briefly
    // rather than only trusting the initial snapshot taken at mount time.
    const pollId = setInterval(() => setIsConnected(collabManager.getIsConnected()), 1000);
    return () => {
      collabManager.removeEventListener(listener);
      clearInterval(pollId);
    };
  }, [collabManager]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!draft.trim() || !collabManager) return;
    const sent = collabManager.sendChatMessage(draft);
    if (sent) {
      setDraft('');
    } else {
      showToast.error('Message not sent', 'Not connected to the collaboration room yet');
    }
  };

  const currentUserId = collabManager?.getCurrentUser()?.id;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 max-w-[90vw] h-96 max-h-[70vh] bg-gray-900/95 border border-cyan-500/20 rounded-lg shadow-2xl text-white flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-semibold text-sm">Chat</h3>
          {collabManager && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-technical ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" aria-label="Close chat">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {!collabManager && (
          <div className="text-center text-gray-500 text-sm py-8">
            Join Multi User mode first to chat with others in this workspace.
          </div>
        )}
        {collabManager && messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm py-8">No messages yet - say hello!</div>
        )}
        {messages.map((msg, i) => {
          const isMine = msg.userId === currentUserId;
          return (
            <div key={i} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
              {!isMine && <span className="text-xs text-cyan-400 mb-0.5">{msg.userName}</span>}
              <div className={`max-w-[85%] px-3 py-1.5 rounded-lg text-sm ${isMine ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-gray-100'}`}>
                {msg.text}
              </div>
              <span className="text-[10px] text-gray-500 mt-0.5 font-technical">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-gray-700 flex gap-2 shrink-0">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
          placeholder={collabManager ? 'Type a message...' : 'Join Multi User first'}
          disabled={!collabManager}
          className="flex-1 bg-slate-800 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
        />
        <Button size="sm" onClick={handleSend} disabled={!collabManager || !draft.trim()}>
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default ChatPanel;
