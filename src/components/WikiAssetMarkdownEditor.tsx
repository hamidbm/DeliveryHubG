import React, { useMemo, useRef, useState } from 'react';
import { WikiAsset } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface WikiAssetMarkdownEditorProps {
  asset: WikiAsset;
  onSaveSuccess: (savedId: string) => void;
  onCancel: () => void;
  currentUser?: { name: string };
}

const WikiAssetMarkdownEditor: React.FC<WikiAssetMarkdownEditorProps> = ({
  asset,
  onSaveSuccess,
  onCancel,
}) => {
  const initialContent = useMemo(() => {
    if (asset.preview?.kind === 'markdown' && asset.preview.objectKey) {
      return asset.preview.objectKey;
    }
    return asset.content || '';
  }, [asset]);

  const [content, setContent] = useState(initialContent);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleSave = async () => {
    const id = asset._id || asset.id;
    if (!id) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/wiki/assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || 'Update failed.');
        return;
      }
      onSaveSuccess(String(id));
    } catch (err) {
      setSaveError('Network error.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col animate-fadeIn pt-[7.5rem]">
      <header className="px-10 py-5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <button
            onClick={onCancel}
            className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-100"
          >
            <i className="fas fa-times"></i>
          </button>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1">
              Editing Markdown
            </span>
            <span className="text-2xl font-black text-slate-800">{asset.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setViewMode(viewMode === 'preview' ? 'edit' : 'preview')}
            className={`px-4 py-1.5 text-[9px] font-black uppercase rounded-xl transition-all ${
              viewMode === 'preview'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-500'
            }`}
          >
            {viewMode === 'preview' ? 'Editor View' : 'Preview Artifact'}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl shadow-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 active:scale-95 transition-all"
          >
            {isSaving ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-save"></i>}
            {isSaving ? 'Updating...' : 'Update Artifact'}
          </button>
        </div>
      </header>

      {saveError && (
        <div className="px-10 py-3 text-[10px] font-black uppercase tracking-widest text-red-600 bg-red-50 border-b border-red-100">
          {saveError}
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {viewMode === 'edit' ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            ref={textAreaRef}
            className="w-full h-full p-12 text-slate-700 leading-relaxed resize-none text-lg outline-none font-medium placeholder:text-slate-300"
            placeholder="Edit markdown content..."
          />
        ) : (
          <div className="p-12 max-w-5xl mx-auto">
            <MarkdownRenderer content={content} />
          </div>
        )}
      </div>
    </div>
  );
};

export default WikiAssetMarkdownEditor;
