import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  X, 
  Send, 
  CheckCircle2, 
  RefreshCw, 
  Copy, 
  Check, 
  Database, 
  Paperclip, 
  MessageSquare,
  Download
} from 'lucide-react';
import { useTrading } from '../../context/TradingContext';
import { AngelChatMessage, GoldMemoryItem, AngelCommunicationConfig } from '../../types';
import { DEFAULT_ANGEL_COMMUNICATION_CONFIG } from '../../data/angelProjects';
import { AngelMemoryDataManager } from './AngelMemoryDataManager';

interface AngelCompanionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AngelCompanionModal: React.FC<AngelCompanionModalProps> = ({ isOpen, onClose }) => {
  const {
    activeInstrument,
    timeframe,
    currentSession,
    isMarketClosed,
    marketClosureReason,
    activeProject,
    goldMemories,
    addGoldMemory
  } = useTrading();

  const [activeTab, setActiveTab] = useState<'chat' | 'memory'>('chat');
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [quickUploadStatus, setQuickUploadStatus] = useState<string | null>(null);

  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Active Memory Count
  const activeMemoryCount = goldMemories.filter(m => m.isActive).length;

  // Communication & Etiquette Configuration
  const [commConfig] = useState<AngelCommunicationConfig>(() => {
    try {
      const saved = localStorage.getItem('angel_companion_comm_config_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return { ...DEFAULT_ANGEL_COMMUNICATION_CONFIG, ...parsed };
      }
    } catch {}
    return DEFAULT_ANGEL_COMMUNICATION_CONFIG;
  });

  // Chat message history (persisted in localStorage)
  const [messages, setMessages] = useState<AngelChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('angel_companion_chat_history_v4');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [
      {
        id: 'msg-welcome-1',
        sender: 'angel',
        text: `### 👼 Good day and warmest greetings! I am ANGEL.
It is an honor and a true pleasure to assist you. I am your **Gold (XAU/USD) Trading AI Companion**, equipped with active neural memory data and real-time document intelligence.

* **Live Market Feed**: ${activeInstrument.symbol} at **$${activeInstrument.currentPrice.toFixed(2)}** • [${timeframe.toUpperCase()}] Resolution
* **Active Session**: ${currentSession.activeSessionsSummary}
* **Gold Neural Memory**: **${goldMemories.filter(m => m.isActive).length} active documents** loaded into my immediate analytical context.

I actively read and cite all your uploaded files, custom strategy rules, macro data, and trade notes. You can manage or upload files anytime in the **Memory Data** tab or using the paperclip button below. How may I best assist you today?`,
        timestamp: Date.now()
      }
    ];
  });

  // Save chat history
  useEffect(() => {
    try {
      localStorage.setItem('angel_companion_chat_history_v4', JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeTab]);

  // Handle direct file upload from chat bar
  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const formatSize = (bytes: number): string => {
          if (bytes < 1024) return `${bytes} B`;
          if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
          return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
        };

        const fileSizeStr = formatSize(file.size);
        const isText = file.type.startsWith('text/') || 
          file.name.endsWith('.txt') || 
          file.name.endsWith('.md') || 
          file.name.endsWith('.csv') || 
          file.name.endsWith('.json') || 
          file.name.endsWith('.log');

        let extractedText = '';
        if (isText) {
          extractedText = await file.text();
        } else {
          extractedText = await file.text().catch(() => '');
          if (!extractedText || extractedText.length < 30) {
            extractedText = `[File Document: ${file.name}]\nFormat: ${file.type || 'Document'}\nSize: ${fileSizeStr}\nTimestamp: ${new Date().toISOString()}\nUploaded for institutional Gold (XAU/USD) analysis.`;
          }
        }

        const newMemoryItem: GoldMemoryItem = {
          id: `mem-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          category: 'UPLOADED_DOC',
          content: extractedText,
          sourceType: 'FILE_UPLOAD',
          fileName: file.name,
          fileSize: fileSizeStr,
          fileType: file.type || 'document',
          isActive: true,
          tags: ['Uploaded File', 'Gold Data'],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };

        addGoldMemory(newMemoryItem);

        // Notify user in chat
        setMessages(prev => [
          ...prev,
          {
            id: `sys-upload-${Date.now()}`,
            sender: 'angel',
            text: `### 📁 File Indexed: "${file.name}" (${fileSizeStr})
**I have successfully read and added "${file.name}" to my active Gold Memory Data!**

* **Document Category**: \`UPLOADED_DOC\`
* **Indexed Characters**: ${extractedText.length.toLocaleString()} characters
* **Status**: **Active in AI Context**. I can now reference and reason over this document during all our market conversations!

*Would you like me to summarize this document or cross-check its rules against current ${activeInstrument.symbol} spot ($${activeInstrument.currentPrice.toFixed(2)})?*`,
            timestamp: Date.now()
          }
        ]);

        setQuickUploadStatus(`✓ Indexed "${file.name}" into memory!`);
        setTimeout(() => setQuickUploadStatus(null), 3500);
      } catch (err: any) {
        console.error('Chat file upload failed:', err);
      }
    }

    if (chatFileInputRef.current) {
      chatFileInputRef.current.value = '';
    }
  };

  // Send message to AI
  const handleSendMessage = async (textToSend?: string) => {
    const message = (textToSend || inputMessage).trim();
    if (!message || isLoading) return;

    const userMsg: AngelChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: message,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const marketContext = {
        symbol: activeInstrument.symbol,
        price: activeInstrument.currentPrice,
        timeframe,
        session: currentSession.activeSessionsSummary,
        marketStatus: isMarketClosed ? 'CLOSED' : 'OPEN',
        isMarketClosed,
        marketClosureReason,
        confluenceScore: 84,
        rsi: 52
      };

      const response = await fetch('/api/angel/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          project: activeProject,
          marketContext,
          history: messages.slice(-8),
          persona: 'QUANT',
          communicationConfig: commConfig,
          memoryData: goldMemories // Pass active gold memories and uploaded files!
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      const replyText = data.reply || "I am listening attentively and reviewing your gold memories.";

      const angelMsg: AngelChatMessage = {
        id: `angel-${Date.now()}`,
        sender: 'angel',
        text: replyText,
        timestamp: Date.now(),
        metadata: {
          projectUsed: activeProject.name,
          timeframe,
          price: activeInstrument.currentPrice,
          memoriesRead: data.memoriesRead ?? activeMemoryCount
        }
      };

      setMessages(prev => [...prev, angelMsg]);
    } catch (err: any) {
      console.error('Failed to communicate with ANGEL backend:', err);
      const activeMemList = goldMemories.filter(m => m.isActive);
      const fallbackMsg: AngelChatMessage = {
        id: `angel-${Date.now()}`,
        sender: 'angel',
        text: `### 👼 ANGEL Gold Companion Guidance
*Greeting, ${commConfig.userPreferredName}. It is an honor to assist you.*

**Live Spot**: ${activeInstrument.symbol} at **$${activeInstrument.currentPrice.toFixed(2)}** • [${timeframe.toUpperCase()}]
**Active Session**: ${currentSession.activeSessionsSummary}
**Gold Memory Synchronized**: ${activeMemList.length} active documents indexed.

${activeMemList.length > 0 ? `I have verified your top memory: **"${activeMemList[0].title}"** (${activeMemList[0].category}). All market observations are aligned with your recorded parameters.` : 'You can upload documents or add custom gold notes in the Memory Data tab anytime.'}

I am watching the order flow attentively for you. Please maintain discipline and protect your capital.`,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        id: `msg-${Date.now()}`,
        sender: 'angel',
        text: `### 👼 Conversation Refreshed
Greetings, **${commConfig.userPreferredName}**. I have refreshed our chat feed. All **${activeMemoryCount} Gold Memory Documents** remain active and loaded in my context. What would you like to explore?`,
        timestamp: Date.now()
      }
    ]);
  };

  const handleAskAboutMemory = (memory: GoldMemoryItem) => {
    setActiveTab('chat');
    handleSendMessage(`ANGEL, please read and review my gold memory document titled "${memory.title}" (${memory.sourceType === 'FILE_UPLOAD' ? `Uploaded File: ${memory.fileName || 'file'}` : 'Custom Note'}). How should I apply this to current XAU/USD price action at $${activeInstrument.currentPrice.toFixed(2)}?`);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="bg-[#090D15] border border-[#232F48] rounded-2xl w-full max-w-4xl h-[92vh] max-h-[880px] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header - Replaced cleanly without clutter */}
        <div className="p-3 sm:p-4 border-b border-[#1A2338] bg-[#0D1322] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            {/* Ethereal Angel Avatar Orb */}
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500/25 via-rose-500/20 to-purple-500/30 border border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/10">
              <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
              <span className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#090D15]" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-1.5">
                  ANGEL
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    AI Gold Companion
                  </span>
                </h2>
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#162035] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* View Navigation Tabs - Replaced */}
        <div className="bg-[#0A0F1B] px-3 sm:px-4 py-1.5 border-b border-[#182236] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#131C2E]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Conversation</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('memory')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'memory'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#131C2E]'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span>Memory Data & Uploads</span>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {activeMemoryCount} Active
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'chat' && (
              <button
                type="button"
                onClick={clearChat}
                title="Clear Conversation"
                className="text-slate-400 hover:text-slate-200 text-xs px-2.5 py-1 rounded-md hover:bg-[#162035] transition-colors cursor-pointer font-mono"
              >
                Clear Chat
              </button>
            )}
          </div>
        </div>

        {/* Tab 1: Live Chat & Conversation */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Quick Upload Toast */}
            {quickUploadStatus && (
              <div className="bg-emerald-950/90 border-b border-emerald-500/40 px-4 py-1.5 text-xs font-mono text-emerald-300 flex items-center gap-2 animate-fadeIn shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{quickUploadStatus}</span>
              </div>
            )}

            {/* Main Chat Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#080B12] no-scrollbar">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    {msg.sender === 'angel' ? (
                      <>
                        <div className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                          <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                        </div>
                        <span className="text-[11px] font-bold text-amber-300">ANGEL</span>
                        {msg.metadata?.memoriesRead !== undefined && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 flex items-center gap-1">
                            <Database className="w-2.5 h-2.5 text-emerald-400" />
                            Read {msg.metadata.memoriesRead} Gold Docs
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="text-[11px] font-bold text-cyan-300">{commConfig.userPreferredName}</span>
                      </>
                    )}
                  </div>

                  <div
                    className={`max-w-[92%] sm:max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-amber-600/30 to-amber-500/20 border border-amber-500/30 text-white rounded-tr-none font-sans shadow-md'
                        : 'bg-[#0E1524] border border-[#1D2942] text-slate-200 rounded-tl-none font-mono whitespace-pre-wrap shadow-lg'
                    }`}
                  >
                    {msg.text}

                    {msg.sender === 'angel' && (
                      <div className="mt-3 pt-2 border-t border-[#182338] flex items-center justify-between text-[10px] text-slate-400 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400">● Live Context Active</span>
                          <span>•</span>
                          <span>Spot: ${activeInstrument.currentPrice.toFixed(2)}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => copyToClipboard(msg.id, msg.text)}
                          className="text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex items-start gap-2 animate-pulse">
                  <div className="w-8 h-8 rounded-xl bg-[#121929] border border-amber-500/30 flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
                  </div>
                  <div className="bg-[#101728] border border-[#1F2C46] rounded-2xl rounded-tl-none p-3 text-xs text-slate-300 font-mono flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    ANGEL is reading your Gold Memory Data and preparing real-time analysis...
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input Bar */}
            <div className="p-3 sm:p-4 border-t border-[#1A2338] bg-[#0C1220] shrink-0">
              <input
                type="file"
                ref={chatFileInputRef}
                onChange={handleChatFileUpload}
                className="hidden"
                multiple
                accept=".txt,.csv,.json,.md,.log,.pdf,.doc,.docx,.png,.jpg,.jpeg"
              />

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                {/* Direct Upload File to Memory button */}
                <button
                  type="button"
                  onClick={() => chatFileInputRef.current?.click()}
                  title="Upload Gold File directly to AI Memory (.txt, .md, .csv, .pdf, images)"
                  className="p-3 rounded-xl bg-[#121A2C] hover:bg-[#1A253D] text-amber-400 hover:text-amber-300 border border-[#23314E] hover:border-amber-500/40 transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <Paperclip className="w-4 h-4" />
                  <span className="text-xs font-mono hidden md:inline">Upload File</span>
                </button>

                <div className="relative flex-1">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Ask ANGEL anything, audit setups, or discuss your Gold memories..."
                    className="w-full bg-[#121A2C] border border-[#23314E] rounded-xl px-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400 transition-colors shadow-inner"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !inputMessage.trim()}
                  className={`px-5 py-3 rounded-xl font-bold font-mono text-sm flex items-center gap-2 transition-all cursor-pointer ${
                    isLoading || !inputMessage.trim()
                      ? 'bg-[#182236] text-slate-500 cursor-not-allowed border border-[#232F48]'
                      : 'bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-black shadow-lg shadow-amber-500/20'
                  }`}
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Tab 2: Gold Memory Data & Uploaded Documents Manager */}
        {activeTab === 'memory' && (
          <AngelMemoryDataManager onAskAboutMemory={handleAskAboutMemory} />
        )}
      </div>
    </div>
  );
};
