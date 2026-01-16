
import React, { useState, useEffect } from 'react';
import { ArchitectureDiagram, DiagramFormat, Application, Bundle } from '../types';

interface ArchitectureDiagramsProps {
  applications: Application[];
  bundles: Bundle[];
}

const ArchitectureDiagrams: React.FC<ArchitectureDiagramsProps> = ({ applications, bundles }) => {
  const [diagrams, setDiagrams] = useState<ArchitectureDiagram[]>([]);
  const [isDesignerOpen, setIsDesignerOpen] = useState(false);
  const [editingDiagram, setEditingDiagram] = useState<Partial<ArchitectureDiagram> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Mock existing diagrams
    const mock: ArchitectureDiagram[] = [
      {
        _id: 'd1',
        title: 'Core Banking Flow v2',
        format: DiagramFormat.MERMAID,
        content: 'graph TD\n  A[Client] --> B[API Gateway]\n  B --> C{Auth}\n  C -->|Pass| D[Ledger Service]\n  C -->|Fail| E[Reject]',
        status: 'VERIFIED',
        createdBy: 'Alex Architect',
        updatedAt: new Date().toISOString()
      },
      {
        _id: 'd2',
        title: 'Cloud Infrastructure Plan 2026',
        format: DiagramFormat.DRAWIO,
        content: '<xml>...</xml>',
        status: 'DRAFT',
        createdBy: 'Alex Architect',
        updatedAt: new Date().toISOString()
      }
    ];
    setDiagrams(mock);
  }, []);

  const openDesigner = (diag?: ArchitectureDiagram) => {
    setEditingDiagram(diag || {
      title: 'New Architecture Diagram',
      format: DiagramFormat.MERMAID,
      content: 'graph TD\n  Start --> Process\n  Process --> End',
      status: 'DRAFT'
    });
    setIsDesignerOpen(true);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {!isDesignerOpen ? (
        <div className="space-y-10">
          <header className="flex justify-between items-end">
            <div>
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Architecture Canvas</h2>
              <p className="text-slate-400 font-medium text-lg">Visual blueprints, system sequence flows, and mind maps.</p>
            </div>
            <div className="flex gap-3">
               <button className="px-6 py-3 bg-white border border-slate-200 text-slate-600 text-[10px] font-black rounded-2xl uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-2">
                 <i className="fas fa-cloud-arrow-up"></i> Upload Draw.io
               </button>
               <button 
                onClick={() => openDesigner()}
                className="px-8 py-3 bg-slate-900 text-white text-[10px] font-black rounded-2xl shadow-xl hover:bg-blue-600 transition-all uppercase tracking-widest flex items-center gap-2"
               >
                 <i className="fas fa-magic"></i> Launch Designer
               </button>
            </div>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {diagrams.map(diag => (
              <div key={diag._id} className="bg-white border border-slate-200 rounded-[2.5rem] p-8 hover:shadow-2xl transition-all group cursor-pointer" onClick={() => openDesigner(diag)}>
                 <div className="flex justify-between items-start mb-6">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${
                      diag.format === DiagramFormat.MERMAID ? 'bg-indigo-500' : 'bg-emerald-500'
                    }`}>
                       <i className={`fas ${diag.format === DiagramFormat.MERMAID ? 'fa-code' : 'fa-pencil-ruler'}`}></i>
                    </div>
                    <span className={`px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest border ${
                      diag.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                      {diag.status}
                    </span>
                 </div>
                 <h4 className="text-lg font-black text-slate-800 mb-2 group-hover:text-blue-600 transition-colors">{diag.title}</h4>
                 <div className="flex items-center gap-3 mb-6">
                    <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{diag.format}</span>
                    <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                    <span className="text-[10px] font-bold text-slate-400">Updated {new Date(diag.updatedAt).toLocaleDateString()}</span>
                 </div>
                 <div className="h-32 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center overflow-hidden">
                    <i className="fas fa-image text-slate-200 text-3xl opacity-50"></i>
                 </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ArchitectureDesigner 
          diagram={editingDiagram!} 
          onClose={() => setIsDesignerOpen(false)} 
          bundles={bundles}
          applications={applications}
        />
      )}
    </div>
  );
};

const ArchitectureDesigner: React.FC<{ 
  diagram: Partial<ArchitectureDiagram>; 
  onClose: () => void;
  bundles: Bundle[];
  applications: Application[];
}> = ({ diagram, onClose, bundles, applications }) => {
  const [code, setCode] = useState(diagram.content || '');
  const [title, setTitle] = useState(diagram.title || '');
  const [format, setFormat] = useState<DiagramFormat>(diagram.format || DiagramFormat.MERMAID);
  const [saving, setSaving] = useState(false);

  return (
    <div className="fixed inset-0 z-[200] bg-white flex flex-col animate-fadeIn">
      <header className="px-10 py-5 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-100"><i className="fas fa-times"></i></button>
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1">Architecture Designer</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="text-2xl font-black text-slate-800 border-none p-0 focus:ring-0 outline-none bg-transparent w-[400px]" placeholder="Untitled Flow" />
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 mr-4 shadow-inner">
            {Object.values(DiagramFormat).map(fmt => (
              <button 
                key={fmt}
                onClick={() => setFormat(fmt)}
                className={`px-4 py-2 text-[9px] font-black uppercase rounded-lg transition-all ${format === fmt ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
              >
                {fmt}
              </button>
            ))}
          </div>
          <button className="px-10 py-3.5 bg-slate-900 text-white rounded-2xl shadow-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3">
            <i className="fas fa-save"></i> Commit to Registry
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden bg-slate-50">
        {/* Editor Pane */}
        <div className="w-1/3 flex flex-col bg-slate-900 shadow-2xl relative z-10">
           <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between bg-black/20">
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Source Editor</span>
              <div className="flex gap-2">
                 <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                 <div className="w-2 h-2 rounded-full bg-amber-500/50"></div>
                 <div className="w-2 h-2 rounded-full bg-emerald-500/50"></div>
              </div>
           </div>
           <textarea 
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 w-full bg-transparent text-emerald-400 font-mono text-sm p-8 outline-none resize-none custom-scrollbar"
            placeholder="Enter Mermaid.js logic here..."
           />
           <div className="p-6 bg-black/20 border-t border-white/5">
              <h5 className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-2">Editor Quick-Links</h5>
              <div className="flex flex-wrap gap-2">
                 <button className="px-3 py-1 bg-white/5 rounded-lg text-[8px] text-slate-400 hover:text-white transition-colors">Sequence Diagram</button>
                 <button className="px-3 py-1 bg-white/5 rounded-lg text-[8px] text-slate-400 hover:text-white transition-colors">Class Topology</button>
                 <button className="px-3 py-1 bg-white/5 rounded-lg text-[8px] text-slate-400 hover:text-white transition-colors">User Journey</button>
              </div>
           </div>
        </div>

        {/* Preview Pane */}
        <div className="flex-1 overflow-hidden flex flex-col">
           <div className="px-10 py-6 border-b border-slate-200 bg-white/50 backdrop-blur flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Live Canvas</span>
                 <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[8px] font-black uppercase">Auto-Rendering</div>
              </div>
              <div className="flex gap-2">
                 <button className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 shadow-sm flex items-center justify-center transition-all"><i className="fas fa-magnifying-glass-plus"></i></button>
                 <button className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 shadow-sm flex items-center justify-center transition-all"><i className="fas fa-expand"></i></button>
                 <button className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 shadow-sm flex items-center justify-center transition-all"><i className="fas fa-download"></i></button>
              </div>
           </div>
           
           <div className="flex-1 overflow-auto p-20 flex items-center justify-center custom-scrollbar">
              <div className="bg-white rounded-[3rem] p-16 shadow-[0_50px_100px_rgba(0,0,0,0.05)] border border-slate-100 min-w-[600px] min-h-[400px] flex flex-col items-center justify-center relative overflow-hidden">
                 <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '30px 30px' }}></div>
                 
                 {/* This would normally render the mermaid diagram */}
                 <div className="text-center relative z-10">
                    <pre className="text-slate-400 font-bold mb-10 text-lg opacity-40">Visualizer Core Online</pre>
                    <div className="space-y-4">
                       <div className="h-1 bg-blue-600 w-32 mx-auto rounded-full"></div>
                       <div className="h-1 bg-blue-200 w-24 mx-auto rounded-full"></div>
                    </div>
                    <p className="mt-10 text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Rendering logic for {format}...</p>
                 </div>
              </div>
           </div>
        </div>

        {/* Sidebar Metadata */}
        <aside className="w-80 border-l border-slate-200 bg-white p-8 space-y-10 overflow-y-auto custom-scrollbar">
           <div>
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><i className="fas fa-link"></i> Mapping Context</h4>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Business Cluster</label>
                    <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-xs font-bold text-slate-700">
                       <option value="">Cross-Bundle</option>
                       {bundles.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Context</label>
                    <select className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 text-xs font-bold text-slate-700">
                       <option value="">Full Cluster Scope</option>
                       {applications.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
                    </select>
                 </div>
              </div>
           </div>

           <div className="pt-10 border-t border-slate-50">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2"><i className="fas fa-robot"></i> AI Reviewer</h4>
              <div className="bg-blue-50 border border-blue-100 rounded-[1.5rem] p-6 space-y-4">
                 <p className="text-[10px] text-blue-700 font-medium leading-relaxed italic">"Diagram appears healthy. Suggested: Add more detail to the Ledger Service interface definitions."</p>
                 <button className="w-full py-2 bg-blue-600 text-white text-[9px] font-black uppercase rounded-lg shadow-lg">Refresh AI Insights</button>
              </div>
           </div>
        </aside>
      </div>
      
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default ArchitectureDiagrams;
