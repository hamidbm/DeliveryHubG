import React, { RefObject } from 'react';
import { WorkItemAttachment } from '../types';

interface WorkItemAttachmentsPanelProps {
  attachments: WorkItemAttachment[];
  uploading: boolean;
  onTriggerUpload: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  onDelete: (assetId?: string) => void;
  onReplace: (assetId: string, file: File) => void;
}

const WorkItemAttachmentsPanel: React.FC<WorkItemAttachmentsPanelProps> = ({
  attachments,
  uploading,
  onTriggerUpload,
  onFileChange,
  fileInputRef,
  onDelete,
  onReplace
}) => {
  return (
    <div className="p-10 space-y-8 animate-fadeIn">
      <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex justify-between items-center mb-8">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Artifact Vault</h4>
          <button
            onClick={onTriggerUpload}
            disabled={uploading}
            className="px-5 py-2 bg-slate-900 text-white text-[9px] font-black uppercase rounded-xl hover:bg-blue-600 transition-all"
          >
            {uploading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-cloud-arrow-up mr-2"></i>}
            {uploading ? 'Processing...' : 'Upload Docs'}
          </button>
          <input type="file" ref={fileInputRef} className="hidden" multiple onChange={onFileChange} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(attachments || []).map((file, i) => (
            <div key={i} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group relative">
              <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-2xl text-blue-500 shadow-sm">
                <i className={`fas ${file.type.includes('image') ? 'fa-file-image' : file.type.includes('pdf') ? 'fa-file-pdf' : 'fa-file-lines'}`}></i>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800 truncate mb-0.5">{file.name}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase">{(file.size / 1024).toFixed(1)} KB • {new Date(file.createdAt).toLocaleDateString()}</p>
                {file.url && file.type.startsWith('image') && (
                  <img src={file.url} alt={file.name} className="mt-3 max-h-40 rounded-lg border border-slate-200 bg-white" />
                )}
                {file.url && file.type.includes('pdf') && (
                  <iframe src={file.url} title={file.name} className="mt-3 w-full h-48 rounded-lg border border-slate-200 bg-white" />
                )}
              </div>
              <div className="flex items-center gap-2">
                {file.url && (
                  <a href={file.url} className="text-slate-300 hover:text-blue-600 transition-colors" target="_blank" rel="noreferrer">
                    <i className="fas fa-download text-xs"></i>
                  </a>
                )}
                <label className={`text-slate-300 hover:text-blue-600 transition-colors ${file.assetId ? 'cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}>
                  <i className="fas fa-rotate text-xs"></i>
                  <input
                    type="file"
                    className="hidden"
                    disabled={!file.assetId}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && file.assetId) onReplace(file.assetId, f);
                    }}
                  />
                </label>
                <button
                  disabled={!file.assetId}
                  onClick={() => onDelete(file.assetId)}
                  className={`text-slate-300 hover:text-red-600 transition-colors ${file.assetId ? '' : 'opacity-40 cursor-not-allowed'}`}
                >
                  <i className="fas fa-trash text-xs"></i>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkItemAttachmentsPanel;
