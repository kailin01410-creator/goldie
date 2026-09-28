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
  Table
} from 'lucide-react';
import { useTrading } from '../../context/TradingContext';
import { GoldMemoryItem, GoldMemoryCategory } from '../../types';
import { extractFileToMemories } from '../../utils/fileExtractor';
import { 
  ANGEL_X_MASTER_FILE, 
  ANGEL_X_CONTENT, 
  mergeAllMemoriesIntoAngelX, 
  expandAngelXStorage 
} from '../../data/goldMemoryData';
import { formatBytes, getUtf8ByteLength } from '../../data/angelStorageExpander';

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
  { id: 'ch-24', title: 'Chapter 24: Allocated Physical Blank Data Storage Blocks & Memory Registers', category: 'STORAGE' }
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
  const [viewingMemory, setViewingMemory] = useState<GoldMemoryItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [isExpandingStorage, setIsExpandingStorage] = useState(false);

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

  // Handle file and zip upload: extract and immediately fold into ANGEL X
  const processUploadedFile = async (file: File) => {
    try {
      const isZip = file.name.toLowerCase().endsWith('.zip') || file.type.includes('zip');
      setUploadStatus(isZip ? `Unpacking and integrating archive "${file.name}" into ANGEL X...` : `Reading and merging "${file.name}" into ANGEL X...`);

      let extractedMemories: any[] = [];
      let summaryMsg = '';

      try {
        const result = await extractFileToMemories(file);
        extractedMemories = result.memories;
        summaryMsg = result.summaryMessage;
      } catch (browserExtractErr) {
        console.warn('Browser extraction failed, delegating to high-capacity server engine:', browserExtractErr);
        setUploadStatus(`Processing "${file.name}" via high-capacity server engine...`);
        const serverRes = await fetch(`/api/angel/upload?filename=${encodeURIComponent(file.name)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: file
        });
        if (!serverRes.ok) {
          throw new Error(`Server returned HTTP ${serverRes.status}`);
        }
        const data = await serverRes.json();
        if (!data.success || !Array.isArray(data.memories) || data.memories.length === 0) {
          throw new Error(data.message || 'No readable data extracted from file');
        }
        extractedMemories = data.memories;
        summaryMsg = data.summary || `✓ Integrated ${data.memories.length} item(s) from "${file.name}" into ANGEL X`;
      }

      if (extractedMemories.length > 0) {
        // Merge directly with the existing ANGEL X file
        const merged = mergeAllMemoriesIntoAngelX([...goldMemories, ...extractedMemories]);
        addGoldMemory(merged);
        consolidateAllIntoAngelX();
      }

      setUploadStatus(`✓ Successfully merged "${file.name}" into the single master storage file: ANGEL X!`);
      setTimeout(() => {
        setUploadStatus(null);
      }, 5000);
    } catch (err: any) {
      console.error('File upload error:', err);
      setUploadStatus(`Upload notice: ${err.message || 'Could not parse file'}`);
      setTimeout(() => setUploadStatus(null), 6000);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        processUploadedFile(files[i]);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
      for (let i = 0; i < files.length; i++) {
        processUploadedFile(files[i]);
      }
    }
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
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

          {/* Upload and auto-merge into ANGEL X */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#16233B] hover:bg-[#1E3052] text-amber-300 hover:text-white border border-amber-500/40 hover:border-amber-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
            title="Upload any file (.zip, .txt, .pdf, .csv, .md, images) to merge into ANGEL X"
          >
            <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Merge File into ANGEL X</span>
            <span className="md:hidden">Add File</span>
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
          {/* 🚀 STORAGE MAXIMIZER TOOLBAR (REAL DATA, CODE, JSON & BLANK DATA)          */}
          {/* ========================================================================= */}
          <div className="bg-[#090E1A] border border-[#1E2E4A] rounded-xl p-3.5 sm:p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Maximize2 className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                  Maximize Physical File Storage (Real Code, JSON & Blank Data)
                </h4>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Genuinely expands physical byte size on disk & download
              </span>
            </div>

            <p className="text-[11px] text-slate-300">
              Select any data block to append real quantitative code, institutional JSON databases, or allocated blank zero-byte buffers to maximize file capacity:
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleExpandStorage('BLANK_DATA', 250)}
                disabled={isExpandingStorage}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#142036] hover:bg-[#1E3052] text-amber-300 hover:text-white border border-amber-500/40 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Append 250 KB of indexed blank zero-byte storage registers"
              >
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span>+250 KB Blank Data Registers</span>
              </button>

              <button
                type="button"
                onClick={() => handleExpandStorage('CODE', 300)}
                disabled={isExpandingStorage}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#142036] hover:bg-[#1E3052] text-cyan-300 hover:text-white border border-cyan-500/40 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Append real TypeScript, Python and MQL5 trading algorithms"
              >
                <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>+Real Code Algorithms</span>
              </button>

              <button
                type="button"
                onClick={() => handleExpandStorage('JSON', 300)}
                disabled={isExpandingStorage}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#142036] hover:bg-[#1E3052] text-purple-300 hover:text-white border border-purple-500/40 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Append structured institutional macroeconomic JSON dictionary"
              >
                <Table className="w-3.5 h-3.5 text-purple-400" />
                <span>+Machine JSON Dataset</span>
              </button>

              <button
                type="button"
                onClick={() => handleExpandStorage('BLANK_DATA', 1000)}
                disabled={isExpandingStorage}
                className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-[#142036] hover:bg-[#1E3052] text-emerald-300 hover:text-white border border-emerald-500/40 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Append 1 full Megabyte of blank data memory matrices"
              >
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>+1.0 MB Blank Storage Space</span>
              </button>

              <button
                type="button"
                onClick={() => handleExpandStorage('MAXIMIZED_ALL', 2000)}
                disabled={isExpandingStorage}
                className="px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-gradient-to-r from-amber-500/30 to-yellow-500/30 hover:from-amber-500/45 hover:to-yellow-500/45 text-amber-200 hover:text-white border border-amber-400/60 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                title="Maximize storage with Code + JSON + 2MB Blank Data registers"
              >
                <Zap className="w-3.5 h-3.5 text-amber-300" />
                <span>+2.0 MB Full Maximized Suite</span>
              </button>
            </div>
          </div>

          {/* Unified Architecture Summary & Tags */}
          <div className="flex flex-wrap gap-2">
            {(angelXFile.tags || []).map((tag, idx) => (
              <span key={idx} className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-[#131D31] text-slate-300 border border-[#22314E] flex items-center gap-1">
                <Tag className="w-2.5 h-2.5 text-amber-400" />
                <span>{tag}</span>
              </span>
            ))}
          </div>

          {/* Consolidated Chapter Directory & Interactive Navigation within ANGEL X */}
          <div className="bg-[#090D16] border border-[#1A263D] rounded-xl p-3.5 sm:p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                  Integrated Chapters Inside ANGEL X ({matchingChapters.length})
                </h4>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Click any chapter to view
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {matchingChapters.map((ch, idx) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setSelectedChapter(ch.title);
                    setViewingMemory(angelXFile);
                  }}
                  className="flex items-center gap-2 p-2 rounded-lg bg-[#0E1524] hover:bg-[#152035] border border-[#1A253A] hover:border-amber-500/40 text-left transition-all cursor-pointer group"
                >
                  <span className="w-5 h-5 rounded bg-[#162136] text-[10px] font-mono font-bold text-amber-400 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-slate-950 transition-colors">
                    {idx}
                  </span>
                  <span className="text-[11px] text-slate-300 group-hover:text-white font-mono truncate flex-1">
                    {ch.title}
                  </span>
                </button>
              ))}
            </div>
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

            {/* Quick Chapter Selector inside Modal */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 border-b border-[#152035]">
              <button
                type="button"
                onClick={() => setSelectedChapter(null)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-mono shrink-0 cursor-pointer ${
                  selectedChapter === null
                    ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                    : 'text-slate-400 hover:text-white bg-[#0D1424] border border-[#172236]'
                }`}
              >
                Full Document (All Chapters)
              </button>
              {MASTER_CHAPTERS.map(ch => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setSelectedChapter(ch.title)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono shrink-0 cursor-pointer truncate max-w-[200px] ${
                    selectedChapter === ch.title
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                      : 'text-slate-400 hover:text-white bg-[#0D1424] border border-[#172236]'
                  }`}
                  title={ch.title}
                >
                  {ch.title.split(':')[0]}
                </button>
              ))}
            </div>

            {/* Document Body */}
            <div className="flex-1 overflow-y-auto bg-[#070A10] border border-[#182338] rounded-xl p-4 sm:p-5 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
              {viewingMemory.content}
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
    </div>
  );
};
