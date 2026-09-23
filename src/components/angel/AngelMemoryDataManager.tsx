import React, { useState, useRef } from 'react';
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
  HardDrive
} from 'lucide-react';
import { useTrading } from '../../context/TradingContext';
import { GoldMemoryItem, GoldMemoryCategory } from '../../types';

interface AngelMemoryDataManagerProps {
  onAskAboutMemory?: (memory: GoldMemoryItem) => void;
}

const CATEGORY_LABELS: Record<GoldMemoryCategory, { label: string; color: string }> = {
  STRATEGY_RULES: { label: 'Strategy & Rules', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  MACRO_FUNDAMENTALS: { label: 'Macro & Fundamentals', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  KEY_LEVELS: { label: 'Key Price Levels', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  TRADE_JOURNAL: { label: 'Trade Journal', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  UPLOADED_DOC: { label: 'Uploaded Document', color: 'text-blue-400 bg-blue-500/10 border-blue-500/30' },
  CONVERSATION_MEMORY: { label: 'Conversation Memory', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
  CUSTOM_DATA: { label: 'Custom Gold Data', color: 'text-rose-400 bg-rose-500/10 border-rose-500/30' },
};

export const AngelMemoryDataManager: React.FC<AngelMemoryDataManagerProps> = ({ onAskAboutMemory }) => {
  const { 
    goldMemories, 
    addGoldMemory, 
    deleteGoldMemory, 
    toggleGoldMemoryActive,
    clearAllGoldMemories 
  } = useTrading();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewingMemory, setViewingMemory] = useState<GoldMemoryItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  // New Memory Form State
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<GoldMemoryCategory>('STRATEGY_RULES');
  const [formContent, setFormContent] = useState('');
  const [formTags, setFormTags] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeCount = goldMemories.filter(m => m.isActive).length;
  const totalCharacters = goldMemories
    .filter(m => m.isActive)
    .reduce((acc, m) => acc + (m.content?.length || 0), 0);

  // Handle file upload and extraction
  const processUploadedFile = async (file: File) => {
    try {
      setUploadStatus(`Processing ${file.name}...`);
      
      const formatSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
      };

      const fileSizeStr = formatSize(file.size);
      const isTextOrCode = file.type.startsWith('text/') || 
        file.name.endsWith('.txt') || 
        file.name.endsWith('.md') || 
        file.name.endsWith('.csv') || 
        file.name.endsWith('.json') || 
        file.name.endsWith('.log');

      if (isTextOrCode) {
        const text = await file.text();
        addGoldMemory({
          title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          category: 'UPLOADED_DOC',
          content: text,
          sourceType: 'FILE_UPLOAD',
          fileName: file.name,
          fileSize: fileSizeStr,
          fileType: file.type || 'text/plain',
          isActive: true,
          tags: ['Gold File', file.name.split('.').pop()?.toUpperCase() || 'DOC']
        });
        setUploadStatus(`✓ Successfully indexed "${file.name}" into ANGEL's memory!`);
      } else if (file.type.startsWith('image/')) {
        // Read image file metadata and preview
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          addGoldMemory({
            title: `Gold Chart Snapshot: ${file.name}`,
            category: 'UPLOADED_DOC',
            content: `[Image Document: ${file.name} (${fileSizeStr})]\nUploaded Gold Chart / Visual Pattern representation for market analysis.\nFile name: ${file.name}\nSize: ${fileSizeStr}\nTimestamp: ${new Date().toISOString()}`,
            sourceType: 'FILE_UPLOAD',
            fileName: file.name,
            fileSize: fileSizeStr,
            fileType: file.type,
            isActive: true,
            tags: ['Chart Image', 'Gold Visual', 'Snapshot']
          });
          setUploadStatus(`✓ Chart image "${file.name}" registered in ANGEL's memory!`);
        };
        reader.readAsDataURL(file);
      } else {
        // Generic document (e.g. PDF, Word, binary doc)
        const textPreview = await file.text().catch(() => '');
        const cleanContent = textPreview && textPreview.length > 50 
          ? textPreview.slice(0, 5000) 
          : `[Document File: ${file.name}]\nFormat: ${file.type || 'Binary/Document'}\nSize: ${fileSizeStr}\nUploaded on: ${new Date().toLocaleString()}\nThis gold research document is cataloged and ready for reference in ANGEL's context.`;

        addGoldMemory({
          title: file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
          category: 'UPLOADED_DOC',
          content: cleanContent,
          sourceType: 'FILE_UPLOAD',
          fileName: file.name,
          fileSize: fileSizeStr,
          fileType: file.type || 'application/octet-stream',
          isActive: true,
          tags: ['Gold Research', 'Document']
        });
        setUploadStatus(`✓ Indexed document "${file.name}" into AI memory!`);
      }

      setTimeout(() => {
        setUploadStatus(null);
      }, 4000);
    } catch (err: any) {
      console.error('File upload error:', err);
      setUploadStatus(`Upload failed: ${err.message || 'Could not parse file'}`);
      setTimeout(() => setUploadStatus(null), 4000);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        processUploadedFile(files[i]);
      }
    }
    // reset input
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

    addGoldMemory({
      title: formTitle.trim(),
      category: formCategory,
      content: formContent.trim(),
      sourceType: 'TEXT_NOTE',
      isActive: true,
      tags: parsedTags.length > 0 ? parsedTags : ['XAU/USD', 'Gold Data']
    });

    setFormTitle('');
    setFormContent('');
    setFormTags('');
    setIsAddModalOpen(false);
    setUploadStatus('✓ New gold memory note saved and ready for ANGEL to read!');
    setTimeout(() => setUploadStatus(null), 3000);
  };

  // All active and stored memories
  const filteredMemories = goldMemories;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#070A10] text-slate-200 overflow-hidden">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileInputChange} 
        className="hidden" 
        multiple 
        accept=".txt,.csv,.json,.md,.log,.pdf,.doc,.docx,.png,.jpg,.jpeg"
      />

      {/* Top Telemetry & Memory Context Banner */}
      <div className="bg-[#0B101C] px-3 sm:px-5 py-2.5 border-b border-[#1A253D] flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Database className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Gold Neural Memory Base</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                {activeCount} Active
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {goldMemories.length > 0 && (
            <button
              type="button"
              onClick={clearAllGoldMemories}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer font-mono"
              title="Clear all stored memories"
            >
              Clear All
            </button>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#16233B] hover:bg-[#1E3052] text-amber-300 hover:text-white border border-amber-500/40 hover:border-amber-400 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <UploadCloud className="w-3.5 h-3.5 text-amber-400" />
            <span>Upload File</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-amber-500/20"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Gold Data</span>
          </button>
        </div>
      </div>

      {/* Upload Notification Banner */}
      {uploadStatus && (
        <div className="bg-emerald-950/80 border-b border-emerald-500/40 px-4 py-2 text-xs font-mono text-emerald-300 flex items-center gap-2 animate-fadeIn shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{uploadStatus}</span>
        </div>
      )}

      {/* Memory Items List */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex-1 overflow-y-auto px-3 sm:px-5 pt-3 pb-4 space-y-2.5 transition-colors ${
          isDragging ? 'bg-amber-500/10 border-2 border-dashed border-amber-400' : ''
        }`}
      >
        {filteredMemories.length === 0 ? (
          <div className="bg-[#0E1524]/40 border border-[#1B273E] rounded-xl p-8 text-center my-auto">
            <Database className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No Gold Documents in Memory</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Upload files (.txt, .pdf, .csv, .md, images) or add custom notes to feed ANGEL's intelligence.
            </p>
            <div className="flex items-center justify-center gap-2 mt-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#16233B] hover:bg-[#1E3052] text-amber-300 border border-amber-500/40 cursor-pointer flex items-center gap-1.5"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                Add Gold Data
              </button>
            </div>
          </div>
        ) : (
          filteredMemories.map(item => {
            const catMeta = CATEGORY_LABELS[item.category] || CATEGORY_LABELS.CUSTOM_DATA;
            return (
              <div
                key={item.id}
                className={`bg-[#0C1220] border rounded-xl p-3.5 transition-all flex flex-col gap-2 ${
                  item.isActive 
                    ? 'border-[#22304C] hover:border-[#2F4268]' 
                    : 'border-[#172033] opacity-60'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[#141E33] border border-[#233354] flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                      {item.sourceType === 'FILE_UPLOAD' ? (
                        <FileText className="w-4 h-4 text-cyan-400" />
                      ) : (
                        <Database className="w-4 h-4 text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-bold text-white truncate">
                          {item.title}
                        </h4>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${catMeta.color}`}>
                          {catMeta.label}
                        </span>
                        {item.sourceType === 'FILE_UPLOAD' && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            📁 {item.fileName || 'File'} ({item.fileSize || 'Doc'})
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono mt-0.5">
                        <span>Updated: {new Date(item.updatedAt).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{item.content.length.toLocaleString()} characters</span>
                        {item.tags && item.tags.length > 0 && (
                          <>
                            <span>•</span>
                            <div className="flex items-center gap-1">
                              <Tag className="w-2.5 h-2.5" />
                              <span>{item.tags.join(', ')}</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Active in AI context toggle */}
                    <button
                      type="button"
                      onClick={() => toggleGoldMemoryActive(item.id)}
                      className={`px-2 py-1 rounded text-[11px] font-mono flex items-center gap-1 transition-colors cursor-pointer border ${
                        item.isActive 
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25'
                          : 'bg-[#151D2F] text-slate-400 border-[#232F48] hover:text-slate-300'
                      }`}
                      title={item.isActive ? 'Active in AI memory context' : 'Disabled from AI context'}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${item.isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
                      <span>{item.isActive ? 'Active' : 'Muted'}</span>
                    </button>

                    {/* Ask ANGEL about this */}
                    {onAskAboutMemory && (
                      <button
                        type="button"
                        onClick={() => onAskAboutMemory(item)}
                        className="p-1.5 rounded text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 border border-amber-500/20 transition-colors cursor-pointer"
                        title="Ask ANGEL to review this document"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {/* View Full Document */}
                    <button
                      type="button"
                      onClick={() => setViewingMemory(item)}
                      className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#1A253D] transition-colors cursor-pointer"
                      title="View content"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Remove "${item.title}" from ANGEL's memory?`)) {
                          deleteGoldMemory(item.id);
                        }
                      }}
                      className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Delete memory"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Content Snippet */}
                <div 
                  onClick={() => setViewingMemory(item)}
                  className="bg-[#080C14] rounded-lg p-2 text-xs font-mono text-slate-300 border border-[#162035] line-clamp-2 cursor-pointer hover:border-slate-600 transition-colors"
                >
                  {item.content}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL 1: Add New Gold Data */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0B101C] border border-[#243354] rounded-xl w-full max-w-lg p-4 sm:p-5 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#1A253D] pb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Add Gold Data to AI Memory</h3>
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
                <label className="text-slate-400 font-mono mb-1 block">Document / Setup Title</label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g., Gold London Session Sweep Rules or Key $4,400 Level Playbook"
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
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k} className="bg-[#0E1524] text-white">
                        {v.label}
                      </option>
                    ))}
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
                  <span>Data Content & Trading Knowledge</span>
                  <span className="text-[10px] text-amber-400">ANGEL will read this text verbatim</span>
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
                  Save to AI Memory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: View Document Full Content */}
      {viewingMemory && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0B101C] border border-[#253556] rounded-xl w-full max-w-2xl max-h-[85vh] p-4 sm:p-6 shadow-2xl flex flex-col gap-3">
            <div className="flex items-start justify-between border-b border-[#1A253D] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">{viewingMemory.title}</h3>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${CATEGORY_LABELS[viewingMemory.category]?.color}`}>
                    {CATEGORY_LABELS[viewingMemory.category]?.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  {viewingMemory.sourceType === 'FILE_UPLOAD' ? `File: ${viewingMemory.fileName}` : 'Manual Note'} • Updated {new Date(viewingMemory.updatedAt).toLocaleString()}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setViewingMemory(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-[#162238]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-[#070A10] border border-[#182338] rounded-lg p-3 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
              {viewingMemory.content}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1A253D]">
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{viewingMemory.isActive ? 'Active in ANGEL\'s neural context' : 'Muted (Inactive)'}</span>
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
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Ask ANGEL about this</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setViewingMemory(null)}
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
