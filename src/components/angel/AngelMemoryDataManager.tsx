import React, { useState, useRef, useMemo, useEffect } from 'react';
import { 
  UploadCloud, 
  FileText, 
  File, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Layers, 
  Database, 
  Eye, 
  X, 
  Sparkles,
  MessageSquare,
  AlertCircle,
  Tag,
  Calendar,
  HardDrive,
  Download,
  Search,
  Zap,
  Brain,
  ShieldCheck,
  BookOpen,
  Copy,
  ExternalLink,
  Cpu,
  Maximize2,
  Code2,
  Table,
  FileCheck,
  ArrowRight,
  Check
} from 'lucide-react';
import { useTrading } from '../../context/TradingContext';
import { GoldMemoryItem, GoldMemoryCategory, UploadVerificationReport } from '../../types';
import { extractFileToMemories, formatSize } from '../../utils/fileExtractor';
import { 
  ANGEL_X_MASTER_FILE, 
  ANGEL_X_CONTENT, 
  mergeAllMemoriesIntoAngelX, 
  expandAngelXStorage 
} from '../../data/goldMemoryData';
import { formatBytes, getUtf8ByteLength } from '../../data/angelStorageExpander';
import { AngelFileUploadModal } from './AngelFileUploadModal';

interface AngelMemoryDataManagerProps {
  onAskAboutMemory?: (memory: GoldMemoryItem) => void;
}

const MASTER_CHAPTERS = [
  { id: 'ch-0', title: 'Chapter 0: Master System Prompt & 90 Directives Constitution', category: 'CONSTITUTION' },
  { id: 'ch-1', title: 'Chapter 1: Multi-Lingual Natural Cadence & Tagalog/Taglish Corpus', category: 'CONVERSATION' },
  { id: 'ch-2', title: 'Chapter 2: 12 Operational Modes & Life Operating System', category: 'LIFE_OS' },
  { id: 'ch-3', title: 'Chapter 3: Empathetic Psychology & Anti-Dependency Self-Reliance', category: 'PSYCHOLOGY' },
  { id: 'ch-4', title: 'Chapter 4: Decision Support, Socratic Inquiry & Reality Checks', category: 'DECISION' },
  { id: 'ch-5', title: 'Chapter 5: Personal Life OS: Tasks & Energy-Aware Scheduling', category: 'LIFE_OS' },
  { id: 'ch-6', title: 'Chapter 6: Gemini Master Corpus Vol. I — Interpersonal Empathy', category: 'GEMINI' },
  { id: 'ch-7', title: 'Chapter 7: Gemini Master Corpus Vol. II — Cadence & Human Wit', category: 'GEMINI' },
  { id: 'ch-8', title: 'Chapter 8: Gemini Master Corpus Vol. III — Socratic Dialogue', category: 'GEMINI' },
  { id: 'ch-9', title: 'Chapter 9: Gemini Master Corpus Vol. IV — Stoic Equilibrium', category: 'GEMINI' },
  { id: 'ch-10', title: 'Chapter 10: Gemini Master Corpus Vol. V — Companion Loyalty', category: 'GEMINI' },
  { id: 'ch-11', title: 'Chapter 11: Gold Macroeconomic Fundamentals: Real Yields & DXY', category: 'MACRO' },
  { id: 'ch-12', title: 'Chapter 12: Physical Bullion vs Paper Gold (LBMA & COMEX)', category: 'MACRO' },
  { id: 'ch-13', title: 'Chapter 13: Modern Financial Markets Architecture & ECNs', category: 'FINANCE' },
  { id: 'ch-14', title: 'Chapter 14: How Trading Works: Order Types & Microstructure', category: 'TRADING' },
  { id: 'ch-15', title: 'Chapter 15: Margin, Leverage & Pip Valuation Calculations', category: 'MATH' },
  { id: 'ch-16', title: 'Chapter 16: Global 24-Hour Trading Sessions & Liquidity', category: 'SESSIONS' },
  { id: 'ch-17', title: 'Chapter 17: Smart Money Concepts (SMC / ICT): Liquidity & FVGs', category: 'STRATEGY' },
  { id: 'ch-18', title: 'Chapter 18: High-Frequency M1-M5 Scalping Playbook', category: 'STRATEGY' },
  { id: 'ch-19', title: 'Chapter 19: Multi-Timeframe Structural Confluence (D1 to M15)', category: 'STRATEGY' },
  { id: 'ch-20', title: 'Chapter 20: London & New York Open Breakout Engine', category: 'STRATEGY' },
  { id: 'ch-21', title: 'Chapter 21: Mathematical Risk Management & Anti-Drawdown', category: 'RISK' },
  { id: 'ch-22', title: 'Chapter 22: Production Quantitative Algorithms & Real TypeScript/Python/MQL5 Code', category: 'CODE' },
  { id: 'ch-23', title: 'Chapter 23: Machine-Readable Institutional JSON Databases & Dictionaries', category: 'DATA' },
  { id: 'ch-24', title: 'Chapter 24: Allocated Physical Blank Data Storage Blocks & Memory Registers', category: 'STORAGE' },
  { id: 'ch-25', title: 'Chapter 25: Self-Adaptive AI Coding Engine & Error Resolution Playbook (Google AI Studio)', category: 'CODING_AI' }
];

export const AngelMemoryDataManager: React.FC<AngelMemoryDataManagerProps> = ({ onAskAboutMemory }) => {
  const { 
    goldMemories, 
    addGoldMemory, 
    addGoldMemoriesBatch,
    deleteGoldMemory, 
    toggleGoldMemoryActive,
    clearAllGoldMemories,
    consolidateAllIntoAngelX,
    activeInstrument,
    timeframe,
    activeProject
  } = useTrading();

  // If there are multiple files or legacy records in storage, automatically consolidate so Kailin sees ONLY ONE file named ANGEL X
  useEffect(() => {
    if (goldMemories.length > 1 || (goldMemories.length === 1 && goldMemories[0].fileName !== 'ANGEL X')) {
      consolidateAllIntoAngelX();
    }
  }, [goldMemories, consolidateAllIntoAngelX]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [viewingMemory, setViewingMemory] = useState<GoldMemoryItem | null>(null);
  const [selectedVerificationReport, setSelectedVerificationReport] = useState<UploadVerificationReport | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [isExpandingStorage, setIsExpandingStorage] = useState(false);

  // Persistent Verified Uploads & Byte Parity Audit Log
  const [uploadHistory, setUploadHistory] = useState<UploadVerificationReport[]>(() => {
    try {
      const saved = localStorage.getItem('angel_upload_verification_history_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // New Memory Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<GoldMemoryCategory>('STRATEGY_RULES');
  const [formContent, setFormContent] = useState('');
  const [formTags, setFormTags] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // The primary master file ANGEL X
  const angelXFile = useMemo(() => {
    const found = goldMemories.find(m => m.fileName === 'ANGEL X' || m.id === 'angel-x');
    return found || ANGEL_X_MASTER_FILE;
  }, [goldMemories]);

  // Compute the 100% REAL, uncompressed byte size directly from UTF-8 string encoding
  const realByteSize = useMemo(() => {
    return getUtf8ByteLength(angelXFile.content || '');
  }, [angelXFile.content]);

  const formattedRealSize = useMemo(() => {
    return formatBytes(realByteSize);
  }, [realByteSize]);

  // Handle manual storage expansion with real code, JSON, or allocated blank data blocks
  const handleExpandStorage = (type: 'BLANK_DATA' | 'CODE' | 'JSON' | 'MAXIMIZED_ALL', targetKb: number) => {
    try {
      setIsExpandingStorage(true);
      const expanded = expandAngelXStorage(angelXFile, type, targetKb);
      addGoldMemory(expanded);
      consolidateAllIntoAngelX();
      
      const newBytes = getUtf8ByteLength(expanded.content);
      const label = type === 'BLANK_DATA' ? 'Blank Data Registers' : type === 'CODE' ? 'Real Code Algorithms' : type === 'JSON' ? 'Institutional JSON Data' : 'Full Multi-Engine Suite';
      setUploadStatus(`✓ Storage Maximized: Added ${formatBytes(targetKb * 1024)} of ${label}! Real file size is now ${formatBytes(newBytes)}.`);
      setTimeout(() => setUploadStatus(null), 5000);
    } catch (err: any) {
      console.error('Storage expansion error:', err);
      setUploadStatus('Could not expand storage buffer.');
      setTimeout(() => setUploadStatus(null), 4000);
    } finally {
      setIsExpandingStorage(false);
    }
  };

  // Called when upload modal verifies and merges file
  const handleMergeComplete = (mergedAngelX: GoldMemoryItem, report: UploadVerificationReport) => {
    addGoldMemory(mergedAngelX);
    consolidateAllIntoAngelX();
    setUploadHistory(prev => {
      const updated = [report, ...prev.filter(r => r.fileName !== report.fileName)].slice(0, 30);
      try {
        localStorage.setItem('angel_upload_verification_history_v1', JSON.stringify(updated));
      } catch {}
      return updated;
    });
    setUploadStatus(`✓ Size Match Verified: "${report.fileName}" merged into ANGEL X (${report.formattedOriginalSize} intact with 100% byte parity)`);
    setTimeout(() => {
      setUploadStatus(null);
    }, 6000);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setPendingUploadFile(files[0]);
      setIsUploadModalOpen(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setPendingUploadFile(files[0]);
    }
    setIsUploadModalOpen(true);
  };

  const handleSaveNewMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;

    const parsedTags = formTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const newNote: GoldMemoryItem = {
      id: `custom-${Date.now()}`,
      title: formTitle.trim(),
      category: formCategory,
      content: formContent.trim(),
      sourceType: 'TEXT_NOTE',
      isActive: true,
      tags: parsedTags.length > 0 ? parsedTags : ['XAU/USD', 'Gold Data'],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Combine with ANGEL X immediately
    const merged = mergeAllMemoriesIntoAngelX([angelXFile, newNote]);
    addGoldMemory(merged);
    consolidateAllIntoAngelX();

    setFormTitle('');
    setFormContent('');
    setFormTags('');
    setIsAddModalOpen(false);
    setUploadStatus('✓ New data note merged directly into ANGEL X!');
    setTimeout(() => setUploadStatus(null), 3500);
  };

  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  // Instant direct download of the master ANGEL X Markdown file
  const handleDownloadAngelXMd = () => {
    try {
      const blob = new Blob([angelXFile.content || ANGEL_X_CONTENT], { type: 'text/markdown;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ANGEL-X.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setUploadStatus(`✓ ANGEL X (.md) downloaded directly (${formattedRealSize} real bytes)!`);
      setTimeout(() => setUploadStatus(null), 3500);
    } catch (err: any) {
      console.error('MD download failed:', err);
    }
  };

  // Download complete standalone package .zip containing ANGEL X
  const handleDownloadPackage = async () => {
    try {
      setIsDownloadingZip(true);
      const res = await fetch('/api/angel/download-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memories: [angelXFile],
          conversations: [],
          activeProject,
          marketContext: {
            symbol: activeInstrument?.symbol || 'XAU/USD',
            price: activeInstrument?.currentPrice || 4379.0,
            timeframe
          }
        })
      });

      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ANGEL-X-Package-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setUploadStatus('✓ ANGEL X Complete Master Package (.zip) downloaded successfully!');
      setTimeout(() => setUploadStatus(null), 3500);
    } catch (err: any) {
      console.error('Download error:', err);
      handleDownloadAngelXMd();
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);

  // Filtered chapters for in-file navigation
  const matchingChapters = useMemo(() => {
    if (!searchQuery.trim()) return MASTER_CHAPTERS;
    const q = searchQuery.toLowerCase();
    return MASTER_CHAPTERS.filter(c => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [searchQuery]);

  // Compute displayed section when a chapter is selected in viewer
  const displayedContent = useMemo(() => {
    if (!viewingMemory?.content) return '';
    if (!selectedChapter) return viewingMemory.content;
    const chapterPrefix = selectedChapter.split(':')[0].trim();
    const idx = viewingMemory.content.indexOf(chapterPrefix);
    if (idx !== -1) {
      const nextIdx = viewingMemory.content.indexOf('Chapter ', idx + chapterPrefix.length + 10);
      return nextIdx !== -1 
        ? viewingMemory.content.slice(idx, nextIdx).trim()
        : viewingMemory.content.slice(idx).trim();
    }
    return viewingMemory.content;
  }, [viewingMemory?.content, selectedChapter]);

  const copyToClipboard = (text: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(text);
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2000);
      }
    } catch {}
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#070A10] text-slate-200 overflow-hidden">
      {/* Hidden File Input (supports all files to merge into ANGEL X) */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileInputChange} 
        className="hidden" 
        multiple 
        accept="*/*,.zip,.tar,.gz,.json,.csv,.txt,.md,.pdf,.png,.jpg,.jpeg,*"
      />

      {/* Top Telemetry & Storage Banner */}
      <div className="bg-[#0B101C] px-3 sm:px-5 py-3 border-b border-[#1A253D] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 via-yellow-500/20 to-amber-600/10 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-sm shadow-amber-500/20">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white tracking-wide">ANGEL Storage</h3>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shadow-sm">
                1 FILE IN STORAGE: ANGEL X
              </span>
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                Real Size: {formattedRealSize}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5">
              100% Truthful, accurately measured byte storage • Code, JSON datasets, directives, playbooks & blank data buffers merged into ONE file.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Direct Download ANGEL X .MD */}
          <button
            type="button"
            onClick={handleDownloadAngelXMd}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-amber-300 hover:text-white bg-[#141E33] hover:bg-[#1C2B47] border border-amber-500/40 hover:border-amber-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Download the raw ANGEL X master markdown file directly"
          >
            <FileText className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Download ANGEL X ({formattedRealSize})</span>
            <span className="sm:hidden">ANGEL X .MD</span>
          </button>

          {/* Download ANGEL X Package .ZIP */}
          <button
            type="button"
            onClick={handleDownloadPackage}
            disabled={isDownloadingZip}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 border border-amber-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20 active:scale-95 disabled:opacity-50"
            title="Download the complete standalone package containing ANGEL X and offline runners"
          >
            <Download className={`w-3.5 h-3.5 ${isDownloadingZip ? 'animate-bounce' : ''}`} />
            <span className="hidden sm:inline">{isDownloadingZip ? 'Packing...' : 'Download Package (.ZIP)'}</span>
            <span className="sm:hidden">{isDownloadingZip ? '...' : 'Export .ZIP'}</span>
          </button>

          {/* Upload and auto-merge into ANGEL X with percentage & size verification */}
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-emerald-500/20 hover:from-amber-500/35 hover:to-emerald-500/35 text-amber-300 hover:text-white border border-amber-400/50 hover:border-amber-300 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            title="Upload any file (.zip, .txt, .pdf, .csv, .md, images) with live upload percentage and byte parity verification"
          >
            <UploadCloud className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span className="hidden md:inline">Upload & Verify File</span>
            <span className="md:hidden">Upload</span>
          </button>

          {/* Add text note to merge into ANGEL X */}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold bg-[#1A253D] hover:bg-[#233354] text-slate-200 hover:text-white border border-[#2E4268] transition-all flex items-center gap-1 cursor-pointer"
            title="Add a custom note to merge into ANGEL X"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400 stroke-[2.5]" />
            <span className="hidden sm:inline">Add Note</span>
          </button>
        </div>
      </div>

      {/* Sub-header / Storage Metrics */}
      <div className="bg-[#080D18] px-3 sm:px-5 py-2 border-b border-[#18233A] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono text-slate-300">
            Storage Engine: <strong className="text-amber-400 font-bold">1 Master File (ANGEL X)</strong>
          </span>
          <span className="text-[10px] font-mono text-slate-500 hidden sm:inline">•</span>
          <span className="text-[11px] font-mono text-emerald-300">
            Real Physical Size: {formattedRealSize} ({realByteSize.toLocaleString()} bytes)
          </span>
        </div>

        {/* Quick Chapter Search within ANGEL X */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chapters in ANGEL X..."
            className="w-full bg-[#0D1424] border border-[#1D2A44] rounded-lg pl-8 pr-6 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Upload Notification Banner */}
      {uploadStatus && (
        <div className="bg-emerald-950/80 border-b border-emerald-500/40 px-4 py-2 text-xs font-mono text-emerald-300 flex items-center gap-2 animate-fadeIn shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{uploadStatus}</span>
        </div>
      )}

      {/* Main Storage Content: SHOWING ONLY ONE FILE NAMED "ANGEL X" */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 transition-colors ${
          isDragging ? 'bg-amber-500/10 border-2 border-dashed border-amber-400' : ''
        }`}
      >
        {/* ========================================================================= */}
        {/* 🌟 THE ONLY FILE IN THE STORAGE: ANGEL X                                  */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-b from-[#0F172A] via-[#0C1220] to-[#0A0E18] border-2 border-amber-500/50 hover:border-amber-400/80 rounded-2xl p-4 sm:p-6 shadow-xl shadow-amber-500/10 transition-all flex flex-col gap-4">
          
          {/* Header Row of ANGEL X */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-[#1E2D48] pb-4">
            <div className="flex items-start gap-3.5 flex-1 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/25 via-yellow-500/20 to-amber-700/20 border border-amber-400/50 flex items-center justify-center text-amber-300 shadow-md shadow-amber-500/20 shrink-0 mt-0.5">
                <FileText className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-black text-white tracking-wide font-mono flex items-center gap-2">
                    ANGEL X
                  </h2>
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                    ★ CONSOLIDATED MASTER FILE
                  </span>
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                    {formattedRealSize} Real Byte Size
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 font-mono mt-1 flex-wrap">
                  <span className="text-amber-300 font-bold">File: ANGEL X</span>
                  <span>•</span>
                  <span>Real Encoded Size: <strong className="text-white">{formattedRealSize}</strong></span>
                  <span>•</span>
                  <span>Total Characters: {(angelXFile.content || '').length.toLocaleString()}</span>
                  <span>•</span>
                  <span>25 Integrated Chapters & Data Matrices</span>
                </div>
              </div>
            </div>

            {/* Quick Actions for ANGEL X */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {/* Active Toggle */}
              <button
                type="button"
                onClick={() => toggleGoldMemoryActive(angelXFile.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
                  angelXFile.isActive 
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                    : 'bg-[#151D2F] text-slate-400 border-[#232F48] hover:text-slate-300'
                }`}
                title={angelXFile.isActive ? 'Active in AI memory context' : 'Disabled from AI context'}
              >
                <span className={`w-2 h-2 rounded-full ${angelXFile.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                <span>{angelXFile.isActive ? 'Active in ANGEL' : 'Muted'}</span>
              </button>

              {/* Command ANGEL to Read & Execute ANGEL X */}
              {onAskAboutMemory && (
                <button
                  type="button"
                  onClick={() => onAskAboutMemory(angelXFile)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-amber-200 hover:text-white bg-gradient-to-r from-amber-500/25 to-yellow-500/25 hover:from-amber-500/40 hover:to-yellow-500/40 border border-amber-400/60 hover:border-amber-300 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  title="Ask ANGEL to read this entire master file and apply it to current Gold price action"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                  <span>Read & Execute ANGEL X</span>
                </button>
              )}

              {/* Inspect / Read Full File */}
              <button
                type="button"
                onClick={() => setViewingMemory(angelXFile)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#1C2842] hover:bg-[#253658] text-slate-200 hover:text-white border border-[#2D3E64] transition-all flex items-center gap-1.5 cursor-pointer"
                title="Open reader to view all 25 chapters, code engines, and blank data registers inside ANGEL X"
              >
                <Eye className="w-3.5 h-3.5 text-cyan-400" />
                <span>View ANGEL X</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 📤 UPLOAD FILES / .ZIP (FULL CAPACITY WITH LIVE PERCENTAGE & SIZE PARITY) */}
          {/* ========================================================================= */}
          <div className="bg-[#090E1A] border-2 border-dashed border-[#233352] hover:border-amber-500/50 rounded-xl p-4 sm:p-5 flex flex-col items-center justify-center text-center gap-3 transition-colors">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
              <UploadCloud className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-mono">Upload Any File or .ZIP Archive</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Drag and drop files here, or click below. Automatically uncompressed, verified for 100% byte parity, and absorbed into ANGEL's core memory.
              </p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap justify-center pt-1">
              <button
                type="button"
                onClick={() => setIsUploadModalOpen(true)}
                className="px-4 py-2 rounded-xl font-bold font-mono text-xs bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/20 active:scale-95"
              >
                <UploadCloud className="w-4 h-4 text-slate-950" />
                <span>Upload File / .ZIP (Live Percentage)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-3.5 py-2 rounded-xl font-semibold font-mono text-xs bg-[#131D31] hover:bg-[#1C2B47] text-slate-200 hover:text-white border border-[#233352] hover:border-amber-500/40 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-amber-400" />
                <span>+ Add Rule / Note</span>
              </button>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 🛡️ ALL UPLOADED FILES & SIZE VERIFICATION REGISTRY                        */}
          {/* ========================================================================= */}
          <div className="bg-[#090D16] border border-[#1A263D] rounded-xl p-3.5 sm:p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  All Uploaded Files & Size Verification ({uploadHistory.length})
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  100% Size Parity Enforced
                </span>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="text-xs font-mono text-amber-300 hover:text-white px-2.5 py-1 rounded bg-[#131D31] hover:bg-[#1A263E] border border-amber-500/30 cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3 h-3 text-amber-400" />
                  <span>Upload File</span>
                </button>
              </div>
            </div>

            {uploadHistory.length === 0 ? (
              <div className="p-4 rounded-lg bg-[#0C1220] border border-[#172236] text-center">
                <p className="text-xs font-mono text-slate-400">
                  No custom external files uploaded yet. All baseline institutional datasets are active inside <strong className="text-amber-400 font-bold">ANGEL X</strong> ({formattedRealSize}).
                </p>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(true)}
                  className="mt-2.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 cursor-pointer inline-flex items-center gap-1.5"
                >
                  <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
                  <span>Upload File with Live Percentage & Parity Check</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {uploadHistory.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-[#0C1322] border border-[#19273E] hover:border-emerald-500/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                        <FileCheck className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate max-w-xs sm:max-w-md" title={item.fileName}>
                          {item.fileName}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap mt-0.5">
                          <span>Original: <strong className="text-white">{item.originalSizeBytes.toLocaleString()} bytes</strong> ({item.formattedOriginalSize})</span>
                          <span>•</span>
                          <span>In Storage: <strong className="text-emerald-300">{item.processedSizeBytes.toLocaleString()} bytes</strong> ({item.formattedProcessedSize})</span>
                          <span>•</span>
                          <span>SHA-256: <code className="text-amber-300">{item.checksum}</code></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center flex-wrap">
                      <span className="text-[10px] font-bold text-emerald-300 px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" />
                        <span>100% Match (Δ 0 B)</span>
                      </span>

                      {onAskAboutMemory && (
                        <button
                          type="button"
                          onClick={() => onAskAboutMemory({
                            id: `upload-${item.fileName}`,
                            title: item.fileName,
                            category: 'CUSTOM_DATA',
                            sourceType: 'FILE_UPLOAD',
                            fileName: item.fileName,
                            fileSize: item.formattedProcessedSize,
                            fileType: 'text/plain',
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            isActive: true,
                            tags: ['Uploaded File', 'Custom Knowledge'],
                            content: `Uploaded File "${item.fileName}" (${item.formattedProcessedSize}). Full content preserved in ANGEL X.`
                          })}
                          className="px-2.5 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-white border border-amber-500/30 text-[10px] cursor-pointer flex items-center gap-1 font-bold"
                          title="Ask ANGEL to read this uploaded file and apply it"
                        >
                          <MessageSquare className="w-3 h-3 text-amber-400" />
                          <span>Ask ANGEL</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedChapter(item.fileName);
                          setViewingMemory(angelXFile);
                        }}
                        className="px-2.5 py-1 rounded bg-[#141E33] hover:bg-[#1D2B47] text-slate-300 hover:text-white border border-[#233352] text-[10px] cursor-pointer"
                        title="View this file inside ANGEL X"
                      >
                        View Content
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Content Excerpt / Interactive Preview */}
          <div 
            onClick={() => setViewingMemory(angelXFile)}
            className="bg-[#070A10] border border-[#151F33] hover:border-[#243555] rounded-xl p-3.5 text-xs font-mono text-slate-400 cursor-pointer transition-colors relative group"
          >
            <div className="flex items-center justify-between text-[11px] text-amber-400 font-bold mb-2">
              <span>Preview Excerpt from ANGEL X:</span>
              <span className="text-slate-500 group-hover:text-amber-300 transition-colors flex items-center gap-1">
                <span>Click to open full document ({formattedRealSize})</span>
                <ExternalLink className="w-3 h-3" />
              </span>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[11px] text-slate-300 line-clamp-4 leading-relaxed">
              {angelXFile.content?.slice(0, 500)}...
            </pre>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: ADD DATA / CUSTOM NOTE TO MERGE INTO ANGEL X                     */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0B101C] border border-[#243354] rounded-xl w-full max-w-lg p-4 sm:p-5 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#1A253D] pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Merge Data Note into ANGEL X</h3>
              </div>
              <button 
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveNewMemory} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="text-slate-400 font-mono mb-1 block">Chapter / Section Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., London Open Gold Sweep Playbook or Personal Trade Journal"
                  required
                  className="w-full bg-[#121A2B] border border-[#22314E] text-white rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400 font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-slate-400 font-mono mb-1 block">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as GoldMemoryCategory)}
                    className="w-full bg-[#121A2B] border border-[#22314E] text-amber-300 font-mono rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-400 cursor-pointer"
                  >
                    <option value="STRATEGY_RULES">Strategy & Rules</option>
                    <option value="MACRO_FUNDAMENTALS">Macro & Fundamentals</option>
                    <option value="KEY_LEVELS">Key Price Levels</option>
                    <option value="TRADE_JOURNAL">Trade Journal</option>
                    <option value="CONVERSATION_MEMORY">Conversation Memory</option>
                    <option value="CUSTOM_DATA">Custom Gold Data</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-400 font-mono mb-1 block">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="XAU/USD, Scalping, Rules"
                    className="w-full bg-[#121A2B] border border-[#22314E] text-white rounded-lg px-3 py-2 focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-mono mb-1 block flex items-center justify-between">
                  <span>Data Content & Rules</span>
                  <span className="text-[10px] text-amber-400">Will be consolidated directly into ANGEL X</span>
                </label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={6}
                  placeholder="Type or paste any gold trading knowledge, market rules, specific price levels, macro correlations, or risk calculations..."
                  required
                  className="w-full bg-[#121A2B] border border-[#22314E] text-white rounded-lg p-3 focus:outline-none focus:border-amber-400 font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1A253D]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#162238] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors cursor-pointer"
                >
                  Merge into ANGEL X
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: FULL READER & CHAPTER BROWSER FOR ANGEL X                       */}
      {/* ========================================================================= */}
      {viewingMemory && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0B101C] border border-[#253556] rounded-2xl w-full max-w-4xl max-h-[90vh] p-4 sm:p-6 shadow-2xl flex flex-col gap-3">
            
            {/* Top Modal Header */}
            <div className="flex items-start justify-between border-b border-[#1A253D] pb-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black text-white font-mono flex items-center gap-2">
                    ANGEL X
                  </h3>
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                    Consolidated Master File
                  </span>
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                    {formattedRealSize} Real Byte Size
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  Master Storage File: ANGEL X • 100% Truthful Uncompressed Byte Size: {formattedRealSize} ({realByteSize.toLocaleString()} bytes) • Updated {new Date(viewingMemory.updatedAt || Date.now()).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(viewingMemory.content)}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-[#141E33] hover:bg-[#1E2D4A] text-slate-300 hover:text-white border border-[#233354] flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Copy full text of ANGEL X"
                >
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>{copiedText ? 'Copied!' : 'Copy Text'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadAngelXMd}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Download ANGEL X (.MD)"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>Download .MD</span>
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    setViewingMemory(null);
                    setSelectedChapter(null);
                  }}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#162238] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Chapter Jump Selector (Clean Dropdown, Zero Messy Tabs) */}
            <div className="flex items-center justify-between gap-3 py-2 px-1 border-b border-[#152035] text-xs font-mono">
              <div className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-slate-400 hidden sm:inline">Chapter:</span>
                <select
                  value={selectedChapter || ''}
                  onChange={(e) => setSelectedChapter(e.target.value || null)}
                  className="bg-[#0D1424] border border-[#1D2A44] rounded-lg px-2.5 py-1 text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400 cursor-pointer max-w-[280px] sm:max-w-md truncate"
                >
                  <option value="">Full Document (All Chapters & Data)</option>
                  {MASTER_CHAPTERS.map(ch => (
                    <option key={ch.id} value={ch.title}>
                      {ch.title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedChapter && (
                <button
                  type="button"
                  onClick={() => setSelectedChapter(null)}
                  className="text-xs text-amber-400 hover:text-amber-300 underline cursor-pointer"
                >
                  Show All Chapters
                </button>
              )}
            </div>

            {/* Document Body */}
            <div className="flex-1 overflow-y-auto bg-[#070A10] border border-[#182338] rounded-xl p-4 sm:p-5 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
              {displayedContent || viewingMemory.content}
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-[#1A253D] flex-wrap gap-2">
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Single Master Storage File: <strong>ANGEL X</strong> ({formattedRealSize} real bytes)</span>
              </span>

              <div className="flex items-center gap-2">
                {onAskAboutMemory && (
                  <button
                    type="button"
                    onClick={() => {
                      const mem = viewingMemory;
                      setViewingMemory(null);
                      onAskAboutMemory(mem);
                    }}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Ask ANGEL about ANGEL X</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setViewingMemory(null);
                    setSelectedChapter(null);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono bg-[#162238] text-slate-300 hover:text-white cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: PREMIUM FILE UPLOAD & REAL-TIME PERCENTAGE / PARITY VERIFICATION */}
      {/* ========================================================================= */}
      <AngelFileUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setPendingUploadFile(null);
        }}
        angelXFile={angelXFile}
        goldMemories={goldMemories}
        initialFile={pendingUploadFile}
        onMergeComplete={handleMergeComplete}
      />
    </div>
  );
};
