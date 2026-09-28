import JSZip from 'jszip';
import { GoldMemoryItem, GoldMemoryCategory } from '../types';

export interface ExtractedMemoryResult {
  memories: Omit<GoldMemoryItem, 'id' | 'createdAt' | 'updatedAt'>[];
  summaryMessage: string;
  filesProcessed: number;
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// Check if a file extension or mime type is text/code/readable
const isReadableTextFile = (name: string, type: string): boolean => {
  const lower = name.toLowerCase();
  const textExtensions = [
    '.txt', '.md', '.markdown', '.json', '.csv', '.tsv', '.log',
    '.xml', '.html', '.htm', '.css', '.js', '.jsx', '.ts', '.tsx',
    '.py', '.sql', '.yaml', '.yml', '.ini', '.env', '.cfg', '.conf',
    '.sh', '.bash', '.r', '.m', '.mq4', '.mq5', '.mqh', '.pine',
    '.tex', '.rtf'
  ];

  if (type.startsWith('text/') || type.includes('json') || type.includes('xml')) {
    return true;
  }

  return textExtensions.some(ext => lower.endsWith(ext));
};

// Guess appropriate category based on filename and contents
const inferCategory = (name: string, content: string): GoldMemoryCategory => {
  const lower = (name + ' ' + content.slice(0, 500)).toLowerCase();
  if (lower.includes('strategy') || lower.includes('rule') || lower.includes('smc') || lower.includes('ict') || lower.includes('entry') || lower.includes('exit')) {
    return 'STRATEGY_RULES';
  }
  if (lower.includes('macro') || lower.includes('cpi') || lower.includes('fomc') || lower.includes('fed') || lower.includes('dxy') || lower.includes('dollar')) {
    return 'MACRO_FUNDAMENTALS';
  }
  if (lower.includes('level') || lower.includes('support') || lower.includes('resistance') || lower.includes('pivot') || lower.includes('fib')) {
    return 'KEY_LEVELS';
  }
  if (lower.includes('journal') || lower.includes('trade') || lower.includes('pnl') || lower.includes('profit') || lower.includes('loss')) {
    return 'TRADE_JOURNAL';
  }
  if (lower.includes('conversation') || lower.includes('chat') || lower.includes('transcript')) {
    return 'CONVERSATION_MEMORY';
  }
  return 'UPLOADED_DOC';
};

// Safe text extractor for a browser File
export const extractFileToMemories = async (file: File): Promise<ExtractedMemoryResult> => {
  const fileName = file.name;
  const isZip = fileName.toLowerCase().endsWith('.zip') || file.type.includes('zip');

  if (isZip) {
    return await extractZipToMemories(file);
  }

  // Handle single non-zip file
  const fileSizeStr = formatSize(file.size);
  const isText = isReadableTextFile(fileName, file.type);

  if (isText) {
    const rawText = await file.text();
    // Safety cap to avoid extreme memory freezing while retaining huge documents
    const content = rawText.length > 500000 
      ? rawText.slice(0, 500000) + `\n\n[... Truncated for memory performance. Total original size: ${fileSizeStr} ...]`
      : rawText;

    const memory: Omit<GoldMemoryItem, 'id' | 'createdAt' | 'updatedAt'> = {
      title: fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
      category: inferCategory(fileName, content),
      content,
      sourceType: 'FILE_UPLOAD',
      fileName,
      fileSize: fileSizeStr,
      fileType: file.type || 'text/plain',
      isActive: true,
      tags: ['Uploaded File', fileName.split('.').pop()?.toUpperCase() || 'DOC']
    };

    return {
      memories: [memory],
      summaryMessage: `✓ Indexed "${fileName}" (${fileSizeStr}) into AI memory`,
      filesProcessed: 1
    };
  }

  // If image file
  if (file.type.startsWith('image/')) {
    const memory: Omit<GoldMemoryItem, 'id' | 'createdAt' | 'updatedAt'> = {
      title: `Chart / Image: ${fileName}`,
      category: 'UPLOADED_DOC',
      content: `[Visual Chart / Image: ${fileName} (${fileSizeStr})]\nUploaded image file indexed into ANGEL's knowledge context for Gold (XAU/USD) chart analysis.\nTimestamp: ${new Date().toISOString()}`,
      sourceType: 'FILE_UPLOAD',
      fileName,
      fileSize: fileSizeStr,
      fileType: file.type,
      isActive: true,
      tags: ['Chart Image', 'Visual Snapshot']
    };

    return {
      memories: [memory],
      summaryMessage: `✓ Registered image "${fileName}" into AI memory`,
      filesProcessed: 1
    };
  }

  // Other documents (PDF, Word, binary, etc.)
  let textFallback = '';
  try {
    const attempted = await file.text();
    const printable = attempted.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
    if (printable.length > 80) {
      textFallback = printable.slice(0, 30000);
    }
  } catch {}

  const content = textFallback.length > 100
    ? textFallback
    : `[Document File: ${fileName}]\nType: ${file.type || 'Document'}\nSize: ${fileSizeStr}\nCataloged on: ${new Date().toLocaleString()}\nThis document is indexed in ANGEL's memory base and ready for institutional analysis.`;

  const memory: Omit<GoldMemoryItem, 'id' | 'createdAt' | 'updatedAt'> = {
    title: fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
    category: inferCategory(fileName, content),
    content,
    sourceType: 'FILE_UPLOAD',
    fileName,
    fileSize: fileSizeStr,
    fileType: file.type || 'application/octet-stream',
    isActive: true,
    tags: ['Gold Document', fileName.split('.').pop()?.toUpperCase() || 'FILE']
  };

  return {
    memories: [memory],
    summaryMessage: `✓ Cataloged "${fileName}" (${fileSizeStr}) into AI memory`,
    filesProcessed: 1
  };
};

// Safe extractor for .zip files (handles backups, multi-file packages, strategy libraries)
export const extractZipToMemories = async (file: File | Blob): Promise<ExtractedMemoryResult> => {
  try {
    const zip = await JSZip.loadAsync(file);
    const results: Omit<GoldMemoryItem, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    let databaseRestoredCount = 0;

    // 1. Check if this is an ANGEL backup zip containing 'all-memories-database.json'
    const dbEntry = zip.file('all-memories-database.json') || zip.file('memories.json');
    if (dbEntry) {
      try {
        const dbJsonText = await dbEntry.async('text');
        const parsed = JSON.parse(dbJsonText);
        if (Array.isArray(parsed) && parsed.length > 0) {
          for (const item of parsed) {
            if (item && item.title && item.content) {
              results.push({
                title: item.title,
                category: item.category || 'STRATEGY_RULES',
                content: item.content,
                sourceType: item.sourceType || 'FILE_UPLOAD',
                fileName: item.fileName || 'restored-memory.json',
                fileSize: item.fileSize || 'Database Item',
                fileType: item.fileType || 'application/json',
                isActive: item.isActive !== false,
                tags: Array.isArray(item.tags) ? item.tags : ['Restored', 'Backup']
              });
              databaseRestoredCount++;
            }
          }
        }
      } catch (err) {
        console.warn('Failed to parse all-memories-database.json from zip:', err);
      }
    }

    // 2. Extract every individual file inside the zip (excluding system metadata like __MACOSX)
    const entries = Object.keys(zip.files);
    let extractedFileCount = 0;

    for (const relativePath of entries) {
      const zipEntry = zip.files[relativePath];
      
      // Skip directories and Mac archive metadata
      if (zipEntry.dir || relativePath.includes('__MACOSX') || relativePath.includes('.DS_Store') || relativePath.includes('Thumbs.db')) {
        continue;
      }

      // If we already parsed all-memories-database.json, don't duplicate it as a raw doc
      if (databaseRestoredCount > 0 && (relativePath === 'all-memories-database.json' || relativePath === 'memories.json')) {
        continue;
      }

      const entryName = relativePath.split('/').pop() || relativePath;

      try {
        if (isReadableTextFile(entryName, '')) {
          const text = await zipEntry.async('text');
          const cleanText = text.length > 300000 
            ? text.slice(0, 300000) + `\n\n[... Truncated for memory performance. Total original size: ${formatSize(text.length)} ...]`
            : text;

          results.push({
            title: entryName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
            category: inferCategory(entryName, cleanText),
            content: cleanText,
            sourceType: 'FILE_UPLOAD',
            fileName: entryName,
            fileSize: formatSize(text.length),
            fileType: 'text/plain',
            isActive: true,
            tags: ['ZIP Extracted', entryName.split('.').pop()?.toUpperCase() || 'DOC']
          });
          extractedFileCount++;
        } else {
          // Binary or non-text document inside zip
          results.push({
            title: entryName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
            category: 'UPLOADED_DOC',
            content: `[Archive Document: ${entryName}]\nExtracted from zip package.\nPath inside archive: ${relativePath}\nIndexed into ANGEL's knowledge base.`,
            sourceType: 'FILE_UPLOAD',
            fileName: entryName,
            fileSize: 'Archive Member',
            fileType: 'application/octet-stream',
            isActive: true,
            tags: ['ZIP Extracted', 'Document']
          });
          extractedFileCount++;
        }
      } catch (entryErr) {
        console.warn(`Could not extract ${relativePath} from zip:`, entryErr);
      }
    }

    if (results.length === 0) {
      throw new Error('No readable files found inside the .zip archive.');
    }

    const summary = databaseRestoredCount > 0
      ? `✓ Successfully restored ${databaseRestoredCount} neural memories from ZIP database!`
      : `✓ Unpacked and indexed ${extractedFileCount} file(s) from "${'name' in file ? (file as File).name : 'archive.zip'}" into AI memory!`;

    return {
      memories: results,
      summaryMessage: summary,
      filesProcessed: results.length
    };
  } catch (err: any) {
    console.warn('Browser zip extraction encountered issue, attempting server-side extraction fallback:', err);
    try {
      const fileName = 'name' in file ? (file as File).name : 'archive.zip';
      const serverRes = await fetch(`/api/angel/upload?filename=${encodeURIComponent(fileName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file
      });
      if (serverRes.ok) {
        const data = await serverRes.json();
        if (data && data.success && Array.isArray(data.memories) && data.memories.length > 0) {
          return {
            memories: data.memories,
            summaryMessage: data.summary || `✓ Server unpacked ${data.extractedCount || data.memories.length} files from archive`,
            filesProcessed: data.extractedCount || data.memories.length
          };
        }
      }
    } catch (serverErr) {
      console.warn('Server upload fallback error:', serverErr);
    }
    throw new Error(err?.message || 'Failed to unpack .zip archive. Please ensure it is a valid zip file.');
  }
};
