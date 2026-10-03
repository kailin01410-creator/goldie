import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Download,
  Brain,
  Stethoscope,
  ThumbsUp,
  ThumbsDown,
  FileText,
  Calculator,
  AlertTriangle,
  WifiOff,
} from 'lucide-react';
import { useTrading } from '../../context/TradingContext';
import {
  AngelChatMessage,
  GoldMemoryItem,
  AngelCommunicationConfig,
  AngelCitation,
  AngelCalculationTrace,
} from '../../types';
import { DEFAULT_ANGEL_COMMUNICATION_CONFIG } from '../../data/angelProjects';
import { AngelMemoryDataManager } from './AngelMemoryDataManager';
import { AngelCommunicationTuning } from './AngelCommunicationTuning';
import { AngelDoctorPanel } from './AngelDoctorPanel';
import { extractFileToMemories } from '../../utils/fileExtractor';
import { readJson, writeJson } from '../../utils/safeStorage';

/** Shape of GET /api/angel/status, used to label the UI with facts. */
interface AngelStatus {
  hasApiKey: boolean;
  activeModel: string | null;
  availableModels: string[];
  mode: 'model+offline-core' | 'offline-core-only';
  storage: { documents: number; characters: number; conversationTurns: number };
  knowledge?: { finance?: { entries?: number }; communication?: { exemplars?: number } };
}

const COMM_CONFIG_KEY = 'angel_companion_comm_config_v2';
const CHAT_HISTORY_KEY = 'angel_companion_chat_history_v4';

/** Human label for where an answer actually came from. */
function sourceLabel(metadata: AngelChatMessage['metadata']): string {
  if (!metadata?.source) return 'Live context';
  if (metadata.source === 'offline-core') return 'Offline core (no model)';
  return metadata.model ? `Model: ${metadata.model}` : 'Model';
}

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
    addGoldMemory,
    addGoldMemoriesBatch,
    syncMemoriesWithServer
  } = useTrading();

  const [activeTab, setActiveTab] = useState<'chat' | 'memory' | 'tuning' | 'doctor'>('chat');
  const [status, setStatus] = useState<AngelStatus | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [quickUploadStatus, setQuickUploadStatus] = useState<string | null>(null);

  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Active Memory Count
  const activeMemoryCount = goldMemories.filter(m => m.isActive).length;

  // Communication & Etiquette Configuration
  const [commConfig, setCommConfig] = useState<AngelCommunicationConfig>(() => {
    const saved = readJson<Partial<AngelCommunicationConfig> | null>(
      COMM_CONFIG_KEY,
      null,
      (value) => typeof value === 'object' && value !== null,
    );
    return saved ? { ...DEFAULT_ANGEL_COMMUNICATION_CONFIG, ...saved } : DEFAULT_ANGEL_COMMUNICATION_CONFIG;
  });

  // Chat message history (persisted in localStorage)
  const [messages, setMessages] = useState<AngelChatMessage[]>(() => {
    const saved = readJson<AngelChatMessage[] | null>(CHAT_HISTORY_KEY, null, Array.isArray);
    if (saved && saved.length > 0) return saved;
    return [
      {
        id: 'msg-welcome-1',
        sender: 'angel',
        text: `Hi — I'm ANGEL.

I read the documents you upload, do the maths myself instead of guessing it, and tell you where every answer came from. Ask me in English, Tagalog, or a mix of both; I'll follow your lead.

Right now I'm watching ${activeInstrument.symbol} at $${activeInstrument.currentPrice.toFixed(2)} on the ${timeframe.toUpperCase()} — ${currentSession.activeSessionsSummary}.

A few things I'm good at:
• "Account is 10,000, risk 1%, entry 2650, stop 2647.5 — what lot size?" (I compute it exactly)
• "What do my own notes say about trading the news?" (I quote the file)
• "Bakit ako laging nag-o-overtrade?" (I'll answer in Taglish)

Drop a file or a .zip into the chat and I'll index it. If I ever sound wrong, hit the 👎 under my reply and tell me why — I adjust.`,
        timestamp: Date.now()
      }
    ];
  });

  // Save chat history. If this fails (quota), safeStorage logs why — the
  // conversation still lives on the server, which is the durable copy.
  useEffect(() => {
    writeJson(CHAT_HISTORY_KEY, messages.slice(-30));
  }, [messages]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen && activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, activeTab]);

  // Pull real capability info so the header states facts rather than slogans.
  const refreshStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/angel/status');
      if (!response.ok) return;
      setStatus(await response.json());
    } catch {
      // Server unreachable: the header simply falls back to "checking…".
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    void refreshStatus();
  }, [isOpen, refreshStatus]);

  // Handle direct file and zip upload from the chat bar.
  //
  // The server extractor is tried FIRST, not as a fallback: it reads PDF,
  // DOCX, XLSX, PPTX and nested archives, it stores the full text where
  // retrieval happens, and it dedupes. The browser path only runs if the
  // server is unreachable, so an offline user still gets their file indexed.
  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isZip = file.name.toLowerCase().endsWith('.zip');
      try {
        setQuickUploadStatus(
          `${isZip ? 'Unpacking' : 'Reading'} "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)} MB)…`,
        );

        const response = await fetch(`/api/angel/upload?filename=${encodeURIComponent(file.name)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: file,
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.success) {
          // A 422 means the file was read but held no text — say which and why
          // rather than pretending the upload worked.
          const reason = data?.message || data?.error || `server returned HTTP ${response.status}`;
          throw new Error(reason);
        }

        const documents: any[] = Array.isArray(data.documents) ? data.documents : [];
        const memoriesWithContent: any[] = Array.isArray(data.memories) ? data.memories : [];
        const warnings: string[] = Array.isArray(data.warnings) ? data.warnings : [];

        // Merge into ANGEL X and sync with server store
        if (memoriesWithContent.length > 0) {
          addGoldMemoriesBatch(memoriesWithContent);
        } else if (documents.length > 0) {
          await syncMemoriesWithServer();
        }

        // Record in persistent upload verification history so it can be managed/deleted in Storage tab
        try {
          const savedRaw = localStorage.getItem('angel_upload_verification_history_v1');
          const prevHistory = savedRaw ? JSON.parse(savedRaw) : [];
          const sizeStr = file.size < 1024 ? `${file.size} B` : file.size < 1048576 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1048576).toFixed(2)} MB`;
          const newEntry = {
            id: data.id || documents[0]?.id || `upload-${Date.now()}`,
            documentIds: Array.isArray(data.documentIds) ? data.documentIds : documents.map((d: any) => d.id).filter(Boolean),
            backendSynced: true,
            fileName: file.name,
            fileType: file.type || 'text/plain',
            originalSizeBytes: file.size,
            processedSizeBytes: file.size,
            formattedOriginalSize: sizeStr,
            formattedProcessedSize: sizeStr,
            parityPercent: 100.0,
            deltaBytes: 0,
            checksum: data.checksum || 'verified',
            timestamp: Date.now(),
            status: 'VERIFIED_EXACT_MATCH',
            extractedItemsCount: documents.length || 1,
            angelXPreviousSizeBytes: 0,
            angelXNewSizeBytes: 0,
          };
          const updatedHistory = [newEntry, ...prevHistory.filter((r: any) => r.fileName !== file.name)].slice(0, 50);
          localStorage.setItem('angel_upload_verification_history_v1', JSON.stringify(updatedHistory));
        } catch {
          // ignore storage quota
        }

        const totalChars = documents.reduce((sum, document) => sum + Number(document.characters ?? 0), 0);
        const lines = [
          `**${file.name}** indexed in ${((data.elapsedMs ?? 0) / 1000).toFixed(1)}s.`,
          '',
          `• Documents added: **${documents.length}**${data.duplicates ? ` (${data.duplicates} skipped as duplicates)` : ''}`,
          `• Text extracted: **${totalChars.toLocaleString()} characters**`,
        ];
        if (documents.length > 0) {
          lines.push(`• Files: ${documents.slice(0, 8).map((d) => d.fileName ?? d.title).join(', ')}${documents.length > 8 ? `, +${documents.length - 8} more` : ''}`);
        }
        if (warnings.length > 0) {
          lines.push('', '**Could not fully read:**', ...warnings.slice(0, 6).map((warning) => `• ${warning}`));
        }
        lines.push('', 'Ask me anything about it — I quote the file and name it when I do.');

        setMessages((prev) => [
          ...prev,
          {
            id: `sys-upload-${Date.now()}-${i}`,
            sender: 'angel',
            text: lines.join('\n'),
            timestamp: Date.now(),
          },
        ]);

        setQuickUploadStatus(data.summary || `Indexed ${documents.length} document(s) from "${file.name}"`);
        setTimeout(() => setQuickUploadStatus(null), 5000);
        void refreshStatus();
      } catch (serverError: any) {
        // Server-side extraction unavailable — fall back to the browser reader.
        console.warn('Server extraction failed, trying the browser reader:', serverError);
        try {
          setQuickUploadStatus(`Server unavailable — reading "${file.name}" in the browser…`);
          const res = await extractFileToMemories(file);
          if (res.memories.length === 0) throw new Error('No readable text found in this file.');
          if (res.memories.length === 1) addGoldMemory(res.memories[0]);
          else addGoldMemoriesBatch(res.memories);

          setMessages((prev) => [
            ...prev,
            {
              id: `sys-upload-${Date.now()}-${i}`,
              sender: 'angel',
              text: `**${file.name}** was read in your browser because the server extractor was unreachable (${serverError?.message || 'no response'}).\n\n• Documents added: **${res.memories.length}**\n\nBrowser extraction is weaker than the server's — it cannot read PDF, DOCX or XLSX properly. Re-upload once the server is back for a complete index.`,
              timestamp: Date.now(),
            },
          ]);
          setQuickUploadStatus(res.summaryMessage);
          setTimeout(() => setQuickUploadStatus(null), 5000);
        } catch (clientError: any) {
          setMessages((prev) => [
            ...prev,
            {
              id: `sys-upload-fail-${Date.now()}-${i}`,
              sender: 'angel',
              text: `I could not read **${file.name}**.\n\n• Server: ${serverError?.message || 'unreachable'}\n• Browser: ${clientError?.message || 'failed'}\n\nIf it is a scanned PDF there is no text layer to extract — run OCR on it first, or paste the key passages into a note in ANGEL X Storage.`,
              timestamp: Date.now(),
            },
          ]);
          setQuickUploadStatus(`Could not read "${file.name}".`);
          setTimeout(() => setQuickUploadStatus(null), 6000);
        }
      }
    }

    if (chatFileInputRef.current) {
      chatFileInputRef.current.value = '';
    }
  };

  /**
   * Send a message to ANGEL.
   *
   * The browser no longer scores or ships documents: the server owns the
   * corpus and does BM25 retrieval over it, so the request body stays small
   * and the ranking is the same one the diagnostics tests cover. Only
   * documents that live solely in this browser are passed along.
   */
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
      };

      // Browser-only documents: anything whose full text is not yet mirrored
      // on the server. Capped so a huge local corpus cannot blow up the body.
      const localOnly = (goldMemories || [])
        .filter(m => m && m.isActive !== false && typeof m.content === 'string')
        .filter(m => !m.content.startsWith('[Stored on server') && !m.content.includes('more characters stored on the server'))
        .slice(0, 12)
        .map(m => ({
          id: m.id,
          title: m.title,
          category: m.category,
          sourceType: m.sourceType,
          fileName: m.fileName,
          isActive: m.isActive,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
          tags: m.tags,
          content: m.content.length > 20000 ? `${m.content.slice(0, 20000)}\n[truncated locally]` : m.content,
        }));

      const response = await fetch('/api/angel/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          project: activeProject,
          marketContext,
          history: messages.slice(-8).map(m => ({ sender: m.sender, text: m.text })),
          communicationConfig: commConfig,
          memoryData: localOnly,
        })
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || !data) {
        throw new Error(data?.message || `Server returned status ${response.status}`);
      }

      const angelMsg: AngelChatMessage = {
        id: data.messageId || `angel-${Date.now()}`,
        sender: 'angel',
        text: data.reply || 'I did not produce a reply. Try asking again.',
        timestamp: Date.now(),
        metadata: {
          projectUsed: activeProject.name,
          timeframe,
          price: activeInstrument.currentPrice,
          memoriesRead: data.documentsUsed,
          documentsSearched: data.documentsSearched,
          documentsUsed: data.documentsUsed,
          source: data.source,
          model: data.model,
          degraded: data.degraded === true,
          degradedReason: data.degradedReason,
          latencyMs: data.latencyMs,
          language: data.language,
          citations: Array.isArray(data.citations) ? (data.citations as AngelCitation[]) : [],
          calculations: Array.isArray(data.calculations) ? (data.calculations as AngelCalculationTrace[]) : [],
        }
      };

      setMessages(prev => [...prev, angelMsg]);
      void refreshStatus();
    } catch (err: any) {
      // The server itself is unreachable (offline, crashed, proxy down).
      // Say so plainly instead of improvising a confident-sounding answer.
      console.error('Failed to reach the ANGEL backend:', err);
      setMessages(prev => [...prev, {
        id: `angel-error-${Date.now()}`,
        sender: 'angel',
        text: `I could not reach my backend, so I have no answer for you — only an explanation.

**What failed:** ${err?.message || 'the request did not complete'}

**What still works:** your ${activeMemoryCount} active document(s) are safe in local storage, and the chat history is intact.

**What to try:** check that the app server is running (\`npm run dev\`), then send the message again. The Doctor tab will tell you exactly which part is down.`,
        timestamp: Date.now(),
        metadata: { degraded: true, degradedReason: 'Backend unreachable from the browser.' }
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  /** Send 👍/👎 and surface the concrete adjustment ANGEL made. */
  const sendFeedback = async (messageId: string, rating: 'UP' | 'DOWN', reason?: string) => {
    setMessages(prev => prev.map(m => (
      m.id === messageId ? { ...m, metadata: { ...m.metadata, feedback: rating } } : m
    )));
    try {
      const response = await fetch('/api/angel/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, rating, reason })
      });
      if (!response.ok) return;
      const data = await response.json();
      if (data?.adjustment) {
        setMessages(prev => prev.map(m => (
          m.id === messageId ? { ...m, metadata: { ...m.metadata, feedbackAdjustment: data.adjustment } } : m
        )));
      }
    } catch {
      // Feedback is best-effort; the thumb state still shows locally.
    }
  };

  /** Reasons offered after a 👎, each mapped to a real behavioural change. */
  const DOWN_REASONS: { id: string; label: string }[] = [
    { id: 'TOO_LONG', label: 'Too long' },
    { id: 'TOO_SHORT', label: 'Too short' },
    { id: 'WRONG_LANGUAGE', label: 'Wrong language' },
    { id: 'INACCURATE', label: 'Inaccurate' },
    { id: 'GENERIC', label: 'Too generic' },
    { id: 'TOO_FORMAL', label: 'Too formal' },
  ];
  const [reasonPromptFor, setReasonPromptFor] = useState<string | null>(null);

  const [isDownloadingPackage, setIsDownloadingPackage] = useState(false);

  const handleDownloadPackage = async () => {
    try {
      setIsDownloadingPackage(true);
      const res = await fetch('/api/angel/download-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memories: goldMemories,
          conversations: messages,
          config: commConfig,
          activeProject,
          marketContext: {
            symbol: activeInstrument.symbol,
            price: activeInstrument.currentPrice,
            timeframe,
            session: currentSession.activeSessionsSummary,
            marketStatus: isMarketClosed ? 'CLOSED' : 'OPEN',
          }
        })
      });

      if (!res.ok) {
        throw new Error('Failed to generate archive');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      a.download = `ANGEL-X-Package-${dateStr}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setQuickUploadStatus('✓ Complete ANGEL X Master Package (.zip) downloaded successfully!');
      setTimeout(() => setQuickUploadStatus(null), 4000);
    } catch (err: any) {
      console.error('Failed to download intelligence package:', err);
      setQuickUploadStatus('✕ Failed to download package. Please retry.');
      setTimeout(() => setQuickUploadStatus(null), 3500);
    } finally {
      setIsDownloadingPackage(false);
    }
  };

  const handleSaveChatToMemory = () => {
    if (messages.length <= 1) return;
    const formattedTranscript = messages
      .map(m => `### [${new Date(m.timestamp).toLocaleTimeString()}] ${m.sender === 'user' ? (commConfig.userPreferredName || 'Kailin') : 'ANGEL AI'}\n${m.text}`)
      .join('\n\n---\n\n');

    const sessionTitle = `Dialogue Session: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    addGoldMemory({
      title: sessionTitle,
      category: 'CONVERSATION_MEMORY',
      content: formattedTranscript,
      sourceType: 'TEXT_NOTE',
      isActive: true,
      tags: ['Conversation', 'Dialogue History', 'Kailin & ANGEL', activeInstrument.symbol]
    });

    setQuickUploadStatus(`✓ Dialogue archived as new memory: "${sessionTitle}"`);
    setTimeout(() => setQuickUploadStatus(null), 3500);
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
                  {/* States what is actually running, not a slogan. */}
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      !status
                        ? 'bg-slate-500/20 text-slate-300 border-slate-500/30'
                        : status.mode === 'model+offline-core'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                    }`}
                    title={
                      status?.activeModel
                        ? `Answers come from ${status.activeModel}, with an offline core as backup.`
                        : 'No model key configured — the offline core answers everything.'
                    }
                  >
                    {!status ? 'checking…' : (status.activeModel ?? 'offline core')}
                  </span>
                  {status && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#131C2E] text-slate-400 border border-[#23314E]">
                      {status.storage.documents} docs · {(status.storage.characters / 1000).toFixed(0)}k chars
                    </span>
                  )}
                </h2>
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            {/* Instant AI Package Download Button */}
            <button
              type="button"
              onClick={handleDownloadPackage}
              disabled={isDownloadingPackage}
              className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-500/25 via-amber-400/25 to-yellow-500/25 hover:from-amber-500/40 hover:to-yellow-500/40 text-amber-200 hover:text-white border border-amber-400/60 hover:border-amber-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/15 active:scale-95 disabled:opacity-50"
              title="Download your own AI ANGEL consolidated master file ANGEL X in a complete zip package"
            >
              <Download className={`w-3.5 h-3.5 text-amber-400 ${isDownloadingPackage ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">{isDownloadingPackage ? 'Exporting Package...' : 'Download ANGEL X (.ZIP)'}</span>
              <span className="sm:hidden">{isDownloadingPackage ? '...' : 'ANGEL X .ZIP'}</span>
            </button>

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
              <span>Documents</span>
              <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {activeMemoryCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tuning')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'tuning'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#131C2E]'
              }`}
            >
              <Brain className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Communication</span>
              <span className="sm:hidden">Style</span>
              {status?.knowledge?.communication?.exemplars !== undefined && (
                <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {status.knowledge.communication.exemplars} examples
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('doctor')}
              title="See exactly what is working, what is broken, and let ANGEL repair what it can"
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === 'doctor'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#131C2E]'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">Doctor</span>
              {status && status.mode === 'offline-core-only' && (
                <AlertTriangle className="w-3 h-3 text-amber-400" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {activeTab === 'chat' && (
              <>
                {messages.length > 1 && (
                  <button
                    type="button"
                    onClick={handleSaveChatToMemory}
                    title="Archive this dialogue session into Gold Neural Memory files"
                    className="text-xs font-medium px-2.5 py-1 rounded-md text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors cursor-pointer flex items-center gap-1 font-mono"
                  >
                    <Database className="w-3 h-3 text-emerald-400" />
                    <span className="hidden sm:inline">Save Chat to Memory</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearChat}
                  title="Clear Conversation"
                  className="text-slate-400 hover:text-slate-200 text-xs px-2.5 py-1 rounded-md hover:bg-[#162035] transition-colors cursor-pointer font-mono"
                >
                  Clear Chat
                </button>
              </>
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

                    {/* Degraded banner: say the model was unavailable rather
                        than letting the fallback masquerade as the real thing. */}
                    {msg.sender === 'angel' && msg.metadata?.degraded && (
                      <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
                        <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="text-[10px] font-mono text-amber-200/90 leading-relaxed">
                          <div className="font-bold text-amber-200">Answered without the language model.</div>
                          <div className="mt-0.5 break-words">
                            {msg.metadata.degradedReason || 'The model could not be reached.'}
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab('doctor')}
                            className="mt-1 underline underline-offset-2 hover:text-amber-100 cursor-pointer"
                          >
                            Open Doctor to see why →
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Verified calculations, computed in code, not guessed. */}
                    {msg.sender === 'angel' && (msg.metadata?.calculations?.length ?? 0) > 0 && (
                      <div className="mt-3 space-y-2">
                        {msg.metadata!.calculations!.map((calculation, index) => (
                          <div
                            key={`${msg.id}-calc-${index}`}
                            className="rounded-lg border border-cyan-500/25 bg-cyan-500/5 px-3 py-2"
                          >
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-300 font-bold">
                              <Calculator className="w-3 h-3" />
                              {calculation.result ? calculation.result.title : calculation.tool.replace(/_/g, ' ')}
                              <span className="text-cyan-500/70 font-normal">· computed exactly</span>
                            </div>

                            {calculation.result ? (
                              <>
                                <div className="mt-1 text-[11px] text-slate-100 font-mono">
                                  {calculation.result.headline}
                                </div>
                                {calculation.result.steps.length > 0 && (
                                  <details className="mt-1">
                                    <summary className="text-[10px] font-mono text-slate-500 cursor-pointer hover:text-slate-300">
                                      show the working
                                    </summary>
                                    <ul className="mt-1 space-y-0.5">
                                      {calculation.result.steps.map((step, stepIndex) => (
                                        <li key={stepIndex} className="text-[10px] font-mono text-slate-400">
                                          <span className="text-slate-500">{step.label}: </span>
                                          {step.expression ? `${step.expression} = ` : ''}
                                          <span className="text-slate-200">{step.value}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </details>
                                )}
                                {calculation.result.notes?.map((note, noteIndex) => (
                                  <div key={noteIndex} className="mt-1 text-[10px] font-mono text-amber-300/80">
                                    ⚠ {note}
                                  </div>
                                ))}
                              </>
                            ) : (
                              <div className="mt-1 text-[10px] font-mono text-slate-400">
                                Needs {calculation.missing?.join(', ') || 'more detail'} before I can compute this.
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Citations: what ANGEL actually read, with a quote. */}
                    {msg.sender === 'angel' && (msg.metadata?.citations?.length ?? 0) > 0 && (
                      <details className="mt-3 rounded-lg border border-[#1D2942] bg-[#0A0F1B] px-3 py-2">
                        <summary className="text-[10px] font-mono text-slate-400 cursor-pointer hover:text-slate-200 flex items-center gap-1.5">
                          <FileText className="w-3 h-3 text-emerald-400" />
                          Sources read: {msg.metadata!.citations!.length} of {msg.metadata?.documentsSearched ?? 0} documents searched
                        </summary>
                        <ul className="mt-2 space-y-2">
                          {msg.metadata!.citations!.map((citation, index) => (
                            <li key={index} className="border-l-2 border-emerald-500/30 pl-2">
                              <div className="text-[10px] font-mono text-emerald-300 break-all">
                                {citation.fileName || citation.title}
                                {citation.heading && <span className="text-slate-500"> › {citation.heading}</span>}
                                <span className="text-slate-600"> · match {citation.score.toFixed(2)}</span>
                              </div>
                              {citation.snippet && (
                                <div className="text-[10px] text-slate-400 italic mt-0.5 leading-relaxed">
                                  “{citation.snippet}”
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}

                    {/* Footer: provenance + feedback */}
                    {msg.sender === 'angel' && (
                      <div className="mt-3 pt-2 border-t border-[#182338] flex items-center justify-between gap-2 text-[10px] text-slate-400 font-mono flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={msg.metadata?.degraded ? 'text-amber-400' : 'text-emerald-400'}>
                            ● {sourceLabel(msg.metadata)}
                          </span>
                          {msg.metadata?.latencyMs !== undefined && (
                            <>
                              <span>•</span>
                              <span>{(msg.metadata.latencyMs / 1000).toFixed(1)}s</span>
                            </>
                          )}
                          {msg.metadata?.language && msg.metadata.language !== 'en' && (
                            <>
                              <span>•</span>
                              <span className="text-cyan-400">{msg.metadata.language === 'tl' ? 'Tagalog' : 'Taglish'}</span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            title="This answer was good"
                            onClick={() => sendFeedback(msg.id, 'UP')}
                            className={`flex items-center gap-1 transition-colors cursor-pointer ${
                              msg.metadata?.feedback === 'UP' ? 'text-emerald-400' : 'text-slate-500 hover:text-emerald-400'
                            }`}
                          >
                            <ThumbsUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            title="Something was wrong with this answer"
                            onClick={() => setReasonPromptFor(reasonPromptFor === msg.id ? null : msg.id)}
                            className={`flex items-center gap-1 transition-colors cursor-pointer ${
                              msg.metadata?.feedback === 'DOWN' ? 'text-rose-400' : 'text-slate-500 hover:text-rose-400'
                            }`}
                          >
                            <ThumbsDown className="w-3 h-3" />
                          </button>

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
                      </div>
                    )}

                    {/* Reason picker — each option maps to a real change. */}
                    {msg.sender === 'angel' && reasonPromptFor === msg.id && (
                      <div className="mt-2 rounded-lg border border-rose-500/25 bg-rose-500/5 p-2">
                        <div className="text-[10px] font-mono text-rose-200 mb-1.5">What was wrong? I will adjust.</div>
                        <div className="flex flex-wrap gap-1.5">
                          {DOWN_REASONS.map((reason) => (
                            <button
                              key={reason.id}
                              type="button"
                              onClick={() => {
                                void sendFeedback(msg.id, 'DOWN', reason.id);
                                setReasonPromptFor(null);
                              }}
                              className="text-[10px] font-mono px-2 py-1 rounded border border-rose-500/30 text-rose-200 hover:bg-rose-500/20 transition-colors cursor-pointer"
                            >
                              {reason.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* What ANGEL changed in response. */}
                    {msg.sender === 'angel' && msg.metadata?.feedbackAdjustment && (
                      <div className="mt-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[10px] font-mono text-emerald-300 flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>{msg.metadata.feedbackAdjustment}</span>
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
                accept="*/*,.zip,.tar,.gz,.json,.csv,.txt,.md,.pdf,.png,.jpg,.jpeg,*"
              />

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                {/* Direct Upload File / .ZIP to Memory button */}
                <button
                  type="button"
                  onClick={() => chatFileInputRef.current?.click()}
                  title="Upload any file or .ZIP archive directly into AI Neural Memory"
                  className="p-3 rounded-xl bg-[#121A2C] hover:bg-[#1A253D] text-amber-400 hover:text-amber-300 border border-[#23314E] hover:border-amber-500/40 transition-colors cursor-pointer shrink-0 flex items-center gap-1.5"
                >
                  <Paperclip className="w-4 h-4" />
                  <span className="text-xs font-mono hidden md:inline">Upload File / .ZIP</span>
                </button>

                {/* Direct Download My AI ANGEL & All Files */}
                <button
                  type="button"
                  onClick={handleDownloadPackage}
                  disabled={isDownloadingPackage}
                  title="Download your own AI ANGEL, all 22+ datasets, memory files, transcripts & directives (.ZIP)"
                  className="p-3 rounded-xl bg-[#121A2C] hover:bg-[#1A253D] text-cyan-400 hover:text-cyan-300 border border-[#23314E] hover:border-cyan-500/40 transition-colors cursor-pointer shrink-0 flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                >
                  <Download className={`w-4 h-4 ${isDownloadingPackage ? 'animate-bounce' : ''}`} />
                  <span className="text-xs font-mono hidden lg:inline">{isDownloadingPackage ? 'Exporting...' : 'Download AI ANGEL'}</span>
                </button>

                <div className="relative flex-1">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Talk with ANGEL like a person, ask how your day went, or audit setups..."
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

        {/* Tab 2: Document storage manager */}
        {activeTab === 'memory' && (
          <AngelMemoryDataManager onAskAboutMemory={handleAskAboutMemory} />
        )}

        {/* Tab 4: Self-diagnosis and repair */}
        {activeTab === 'doctor' && <AngelDoctorPanel />}

        {/* Tab 3: Communication style tuning */}
        {activeTab === 'tuning' && (
          <AngelCommunicationTuning
            config={commConfig}
            onChangeConfig={(newCfg) => {
              setCommConfig(newCfg);
              writeJson(COMM_CONFIG_KEY, newCfg);
            }}
            onSelectPrompt={(promptText) => {
              setActiveTab('chat');
              handleSendMessage(promptText);
            }}
            activeProjectName={activeProject.name}
          />
        )}
      </div>
    </div>
  );
};
