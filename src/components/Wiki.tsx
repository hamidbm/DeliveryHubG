import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from '../App';
import { WikiPage, WikiAsset, WikiTheme, HierarchyMode, Application, WikiSpace, Bundle, TaxonomyCategory, TaxonomyDocumentType, ReviewRecord, FeedbackPackage, AttachmentRef } from '../types';
import WikiForm from './WikiForm';
import CreateWikiPageForm from './CreateWikiPageForm';
import WikiPageDisplay from './WikiPageDisplay';
import WikiAssetDisplay from './WikiAssetDisplay';
import WikiAssetMarkdownEditor from './WikiAssetMarkdownEditor';
import MarkdownRenderer from './MarkdownRenderer';
import { canResubmitClient, canSubmitForReviewClient, isEngineeringRoleClient, isVendorRoleClient } from '../lib/authzClient';
import CommentsDrawer from './CommentsDrawer';

interface WikiProps {
  currentUser?: { name: string; role: string; email: string; };
  selSpaceId: string;
  selBundleId: string;
  selAppId: string;
  selMilestone: string;
  searchQuery: string;
  includeFeedbackAssets?: boolean;
  onIncludeFeedbackAssetsChange?: (v: boolean) => void;
  externalTrigger?: string | null;
  onTriggerProcessed?: () => void;
  bundles?: Bundle[];
  applications?: Application[];
}

interface TreeContext {
  spaceId?: string;
  bundleId?: string;
  applicationId?: string;
  milestoneId?: string;
  documentTypeId?: string;
}

const Wiki: React.FC<WikiProps> = ({ 
  currentUser,
  selSpaceId,
  selBundleId,
  selAppId,
  selMilestone,
  searchQuery,
  includeFeedbackAssets = false,
  onIncludeFeedbackAssetsChange,
  externalTrigger,
  onTriggerProcessed,
  bundles = [],
  applications = []
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [spaces, setSpaces] = useState<WikiSpace[]>([]);
  const [themes, setThemes] = useState<WikiTheme[]>([]);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [assets, setAssets] = useState<WikiAsset[]>([]);
  const [categories, setCategories] = useState<TaxonomyCategory[]>([]);
  const [docTypes, setDocTypes] = useState<TaxonomyDocumentType[]>([]);
  
  const [activeArtifact, setActiveArtifact] = useState<WikiPage | WikiAsset | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingAsset, setIsEditingAsset] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [sheetViewMode, setSheetViewMode] = useState<'tiles' | 'table'>('tiles');
  const [showSheetDashboards, setShowSheetDashboards] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [wasSidebarVisible, setWasSidebarVisible] = useState<boolean | null>(null);
  const [commentUnreadCount, setCommentUnreadCount] = useState(0);
  const [commentInitialFilter, setCommentInitialFilter] = useState<'all' | 'discussion' | 'current' | 'past'>('all');
  const [commentInitialCycleId, setCommentInitialCycleId] = useState<string | null>(null);
  const [commentInitialThreadId, setCommentInitialThreadId] = useState<string | null>(null);
  const [commentSuppressNewThread, setCommentSuppressNewThread] = useState(false);
  const [review, setReview] = useState<ReviewRecord | null>(null);
  const [feedbackPackages, setFeedbackPackages] = useState<FeedbackPackage[]>([]);
  const [reviewUpdatedAt, setReviewUpdatedAt] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDueAt, setReviewDueAt] = useState('');
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isReviewerFeedbackModalOpen, setIsReviewerFeedbackModalOpen] = useState(false);
  const [feedbackFiles, setFeedbackFiles] = useState<File[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState('');
  const [feedbackEffectiveAt, setFeedbackEffectiveAt] = useState('');
  const [reviewFeedbackFiles, setReviewFeedbackFiles] = useState<File[]>([]);
  const [reviewerNoAttachment, setReviewerNoAttachment] = useState(false);
  const [reviewUploadProgress, setReviewUploadProgress] = useState<Array<{ name: string; progress: number; status: 'pending' | 'uploading' | 'done' | 'error' }>>([]);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isReviewCollapsed, setIsReviewCollapsed] = useState(false);
  const [isReviewPanelVisible, setIsReviewPanelVisible] = useState(false);
  const [isSubmitterNotesOpen, setIsSubmitterNotesOpen] = useState(false);
  const [reviewerAssignments, setReviewerAssignments] = useState<any[]>([]);
  const [reviewToast, setReviewToast] = useState<string | null>(null);
  const [reviewToastType, setReviewToastType] = useState<'success' | 'error'>('success');
  const [reviewerSearch, setReviewerSearch] = useState('');
  const [selectedReviewerIds, setSelectedReviewerIds] = useState<string[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const reviewSectionRef = useRef<HTMLDivElement>(null);
  const reviewerNoteRef = useRef<HTMLTextAreaElement | null>(null);
  const [reviewerNoteSavedAt, setReviewerNoteSavedAt] = useState<string | null>(null);
  const [reviewerNoteDirty, setReviewerNoteDirty] = useState(false);
  const [reviewerNoteSaving, setReviewerNoteSaving] = useState(false);
  const vendorResponseRef = useRef<HTMLTextAreaElement | null>(null);
  const [vendorResponseSavedAt, setVendorResponseSavedAt] = useState<string | null>(null);
  const [vendorResponseDirty, setVendorResponseDirty] = useState(false);
  const [vendorResponseSaving, setVendorResponseSaving] = useState(false);
  const lastReviewUpdatedAtRef = useRef<string | null>(null);
  
  const [primaryGrouping, setPrimaryGrouping] = useState<'app' | 'type'>('app');
  const [showBundle, setShowBundle] = useState(true);
  const [showDocType, setShowDocType] = useState(true);
  const [showMilestone, setShowMilestone] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const [showSpace, setShowSpace] = useState(true);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [contextualMetadata, setContextualMetadata] = useState<TreeContext>({});
  const [isAiMenuOpen, setIsAiMenuOpen] = useState(false);
  const aiMenuRef = useRef<HTMLDivElement>(null);
  const aiSectionRef = useRef<HTMLDivElement>(null);
  const viewOptionsRef = useRef<HTMLDivElement>(null);
  const [isViewOptionsOpen, setIsViewOptionsOpen] = useState(false);

  type InsightType = 'summary' | 'decisions' | 'assumptions';
  type InsightState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; content: string; generatedAt: string }
    | { status: 'error'; message: string };

  type AIState = {
    isExpanded: boolean;
    isCollapsed: boolean;
    activeType: InsightType;
    insights: Record<InsightType, InsightState>;
  };

  const createEmptyAiState = (): AIState => ({
    isExpanded: false,
    isCollapsed: false,
    activeType: 'summary',
    insights: {
      summary: { status: 'idle' },
      decisions: { status: 'idle' },
      assumptions: { status: 'idle' },
    },
  });

  const [aiState, setAiState] = useState<AIState>(createEmptyAiState());
  const aiCacheRef = useRef<Record<string, AIState>>({});

  useEffect(() => {
    if (externalTrigger === 'create-wiki-artifact') {
      setIsCreating(true);
      if (onTriggerProcessed) onTriggerProcessed();
    }
  }, [externalTrigger, onTriggerProcessed]);

  useEffect(() => {
    setSheetViewMode('tiles');
    setShowSheetDashboards(false);
  }, [activeArtifact?._id, activeArtifact?.id]);

  const loadAllWikiData = useCallback(async () => {
    setLoading(true);
    try {
      const safeFetch = async (url: string) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data) ? data : [];
        } catch (e) {
          console.warn(`Wiki silent fetch fail: ${url}`, e);
          return [];
        }
      };

      const [rawSpaces, rawPages, rawAssets, rawThemes, rawCats, rawTypes] = await Promise.all([
        safeFetch('/api/wiki/spaces'),
        safeFetch('/api/wiki'),
        safeFetch(`/api/wiki/assets?includeFeedback=true`),
        safeFetch('/api/wiki/themes?active=true'),
        safeFetch('/api/taxonomy/categories?active=true'),
        safeFetch('/api/taxonomy/document-types?active=true')
      ]);
      
      setSpaces(rawSpaces);
      setPages(rawPages);
      setAssets(rawAssets);
      setThemes(rawThemes);
      setCategories(rawCats);
      setDocTypes(rawTypes);

      const urlArtifactId = searchParams.get('pageId');
      if (!urlArtifactId && rawSpaces.length > 0) {
        const rootIds = rawSpaces.map(s => `space-${String(s._id || s.id)}`);
        setExpandedNodes(new Set(rootIds));
      }
    } catch (e) { 
      console.error("Wiki Critical Init Error", e); 
    } finally { 
      setLoading(false); 
    }
  }, [searchParams]);


  useEffect(() => {
    loadAllWikiData();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (aiMenuRef.current && !aiMenuRef.current.contains(e.target as Node)) {
        setIsAiMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (viewOptionsRef.current && !viewOptionsRef.current.contains(e.target as Node)) {
        setIsViewOptionsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const resolveArtifact = useCallback((target: string, pageList: WikiPage[], assetList: WikiAsset[]): (WikiPage | WikiAsset | null) => {
    if (!target) return null;
    const page = pageList.find(p => String(p._id) === target || String(p.id) === target || p.slug === target);
    if (page) return page;
    const asset = assetList.find(a => String(a._id) === target || String(a.id) === target);
    return asset || null;
  }, []);

  useEffect(() => {
    if (loading || (pages.length === 0 && assets.length === 0)) return;
    const urlId = searchParams.get('pageId');
    if (urlId) {
      const art = resolveArtifact(urlId, pages, assets);
      if (art) {
        setActiveArtifact(art);
        const prefix = ('file' in art) ? 'asset-' : 'page-';
        setSelectedNodeId(`${prefix}${art._id || art.id}`);
        setContextualMetadata({
          spaceId: art.spaceId,
          bundleId: art.bundleId,
          applicationId: art.applicationId,
          milestoneId: art.milestoneId,
          documentTypeId: art.documentTypeId
        });
      } else {
        (async () => {
          try {
            const res = await fetch(`/api/wiki/assets?includeFeedback=true`);
            if (!res.ok) return;
            const data = await res.json();
            const candidate = Array.isArray(data)
              ? data.find((a: any) => String(a._id || a.id) === String(urlId))
              : null;
            if (candidate) {
              setActiveArtifact(candidate);
              setSelectedNodeId(`asset-${candidate._id || candidate.id}`);
              setAssets((prev) => {
                const exists = prev.some((a) => String(a._id || a.id) === String(candidate._id || candidate.id));
                return exists ? prev : [...prev, candidate];
              });
              setContextualMetadata({
                spaceId: candidate.spaceId,
                bundleId: candidate.bundleId,
                applicationId: candidate.applicationId,
                milestoneId: candidate.milestoneId,
                documentTypeId: candidate.documentTypeId
              });
              if (candidate.artifactKind === 'feedback' && !includeFeedbackAssets) {
                onIncludeFeedbackAssetsChange?.(true);
              }
            }
          } catch {}
        })();
      }
    }
  }, [searchParams, pages, assets, loading, resolveArtifact, includeFeedbackAssets, onIncludeFeedbackAssetsChange]);

  useEffect(() => {
    const threadId = searchParams.get('threadId');
    if (threadId) {
      setCommentInitialThreadId(threadId);
      setCommentInitialFilter('all');
      setIsCommentsOpen(true);
    }
  }, [searchParams]);

  const handleArtifactSelect = (art: WikiPage | WikiAsset) => {
    setActiveArtifact(art);
    setIsEditing(false);
    setIsEditingAsset(false);
    setIsAiMenuOpen(false);
    const prefix = ('file' in art) ? 'asset-' : 'page-';
    setSelectedNodeId(`${prefix}${art._id || art.id}`);
    setContextualMetadata({
      spaceId: art.spaceId,
      bundleId: art.bundleId,
      applicationId: art.applicationId,
      milestoneId: art.milestoneId,
      documentTypeId: art.documentTypeId
    });
    const params = new URLSearchParams(searchParams.toString());
    params.set('pageId', (('slug' in art && art.slug) || art._id || art.id || '') as string);
    router.push(`?${params.toString()}`);
  };

  useEffect(() => {
    if (!activeArtifact) return;
    if ('file' in activeArtifact && activeArtifact.artifactKind === 'feedback' && !includeFeedbackAssets) {
      onIncludeFeedbackAssetsChange?.(true);
    }
    const key = `${'file' in activeArtifact ? 'asset' : 'page'}:${activeArtifact._id || activeArtifact.id || ''}`;
    const cached = aiCacheRef.current[key];
    setAiState(cached ? { ...cached } : createEmptyAiState());
    const targetId = activeArtifact._id || activeArtifact.id;
    if (!targetId) return;
    fetch(`/api/wiki/insights?targetType=${'file' in activeArtifact ? 'asset' : 'page'}&targetId=${encodeURIComponent(String(targetId))}`)
      .then((res) => res.json())
      .then((data) => {
        const insights = data?.insights || {};
        const next = createEmptyAiState();
        const types: InsightType[] = ['summary', 'decisions', 'assumptions'];
        let hasAny = false;
        types.forEach((type) => {
          if (insights[type]) {
            hasAny = true;
            next.insights[type] = {
              status: 'ready',
              content: insights[type].content || '',
              generatedAt: insights[type].generatedAt || new Date().toISOString(),
            };
          }
        });
        next.isExpanded = hasAny;
        setAiState(next);
      })
      .catch(() => {});
  }, [activeArtifact?._id, activeArtifact?.id, activeArtifact?.title]);

  useEffect(() => {
    if (!activeArtifact) return;
    const key = `${'file' in activeArtifact ? 'asset' : 'page'}:${activeArtifact._id || activeArtifact.id || ''}`;
    aiCacheRef.current[key] = aiState;
  }, [aiState, activeArtifact]);

  const handleFolderSelect = (nodeId: string, context: TreeContext) => {
    setSelectedNodeId(nodeId);
    setContextualMetadata(context);
    setExpandedNodes(prev => { 
      const n = new Set(prev); 
      n.has(nodeId) ? n.delete(nodeId) : n.add(nodeId); 
      return n; 
    });
  };

  const selectAndExpandNode = (nodeId: string, context: TreeContext, ancestorIds: string[] = []) => {
    setSelectedNodeId(nodeId);
    setContextualMetadata(context);
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      ancestorIds.forEach((id) => next.add(id));
      next.add(nodeId);
      return next;
    });
  };

  const buildBreadcrumbIds = (context: TreeContext) => {
    const spaceId = context.spaceId || 'unassigned';
    const bundleId = context.bundleId || 'general';
    const appId = context.applicationId || 'no_app';
    const typeId = context.documentTypeId || 'artifact';
    const msId = context.milestoneId || 'no_milestone';

    const ids: string[] = [];
    let path = `space-${showSpace ? spaceId : 'all'}`;
    ids.push(path);

    if (showBundle) {
      path += `:bundle-${bundleId}`;
      ids.push(path);
    }

    const addApp = () => {
      if (!showApp) return;
      path += `:app-${appId}`;
      ids.push(path);
    };

    const addType = () => {
      path += `:type-${typeId}`;
      ids.push(path);
    };

    if (primaryGrouping === 'app') {
      addApp();
      if (showDocType) addType();
    } else {
      if (showDocType) addType();
      addApp();
    }

    if (showMilestone) {
      path += `:ms-${msId}`;
      ids.push(path);
    }

    return ids;
  };

  const handleBreadcrumbSelect = (level: 'space' | 'bundle' | 'app' | 'type', context: TreeContext) => {
    const ids = buildBreadcrumbIds(context);
    const spaceId = ids[0];
    const bundleId = ids.find((id) => id.includes(':bundle-')) || spaceId;
    const appId = ids.find((id) => id.includes(':app-')) || bundleId;
    const typeId = ids.find((id) => id.includes(':type-')) || appId;

    const lookup = {
      space: showSpace ? spaceId : `space-all`,
      bundle: showBundle ? bundleId : (showSpace ? spaceId : `space-all`),
      app: showApp ? appId : (showDocType ? typeId : bundleId),
      type: showDocType ? typeId : (showApp ? appId : bundleId),
    } as const;

    const targetId = lookup[level];
    const ancestorIds = ids.slice(0, ids.indexOf(targetId) + 1);
    selectAndExpandNode(targetId, context, ancestorIds);
  };

  const getAiContent = (artifact: WikiPage | WikiAsset) => {
    if ('file' in artifact) {
      if (artifact.content && artifact.content.trim()) return artifact.content;
      if (artifact.preview?.kind === 'markdown' && artifact.preview.objectKey) return artifact.preview.objectKey;
      return '';
    }
    return artifact.content;
  };

  const runAiInsight = async (type: InsightType) => {
    if (!activeArtifact) return;
    const content = getAiContent(activeArtifact);
    if (!content.trim()) {
      setAiState((prev) => ({
        ...prev,
        isExpanded: true,
        activeType: type,
        insights: {
          ...prev.insights,
          [type]: { status: 'error', message: 'AI actions require text-based content.' },
        },
      }));
      return;
    }

    setAiState((prev) => ({
      ...prev,
      isExpanded: true,
      activeType: type,
      insights: {
        ...prev.insights,
        [type]: { status: 'loading' },
      },
    }));

    try {
      if ('file' in activeArtifact) {
        const res = await fetch('/api/wiki/assets/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task: type === 'summary' ? 'summary' : type === 'decisions' ? 'key_decisions' : 'assumptions',
            title: activeArtifact.title,
            content,
            assetId: activeArtifact._id || activeArtifact.id,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'AI request failed.');
        const resultContent = data.result || '';
        setAiState((prev) => ({
          ...prev,
          insights: {
            ...prev.insights,
            [type]: {
              status: 'ready',
              content: resultContent,
              generatedAt: new Date().toISOString(),
            },
          },
        }));
        const targetId = activeArtifact._id || activeArtifact.id;
        if (targetId && resultContent) {
          await fetch('/api/wiki/insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetType: 'asset',
              targetId,
              type,
              content: resultContent,
            }),
          });
        }
      } else {
        const res = await fetch('/api/wiki/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            task: type === 'summary' ? 'summary' : type === 'decisions' ? 'key_decisions' : 'assumptions',
            title: activeArtifact.title,
            format: 'markdown',
            content,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'AI request failed.');
        const resultContent = data.result || '';
        setAiState((prev) => ({
          ...prev,
          insights: {
            ...prev.insights,
            [type]: {
              status: 'ready',
              content: resultContent,
              generatedAt: new Date().toISOString(),
            },
          },
        }));
        const targetId = activeArtifact._id || activeArtifact.id;
        if (targetId && resultContent) {
          await fetch('/api/wiki/insights', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetType: 'page',
              targetId,
              type,
              content: resultContent,
            }),
          });
        }
      }
      requestAnimationFrame(() => {
        aiSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (err: any) {
      setAiState((prev) => ({
        ...prev,
        insights: {
          ...prev.insights,
          [type]: { status: 'error', message: err?.message || 'AI request failed.' },
        },
      }));
    }
  };

  const handleCopyLink = () => {
    if (!activeArtifact) return;
    navigator.clipboard.writeText(window.location.href);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const refreshRegistry = async (activeId?: string) => {
    try {
      const [pRes, aRes] = await Promise.all([
        fetch('/api/wiki'),
        fetch(`/api/wiki/assets?includeFeedback=true`)
      ]);
      const newPages = await pRes.json();
      const newAssets = await aRes.json();
      setPages(Array.isArray(newPages) ? newPages : []);
      setAssets(Array.isArray(newAssets) ? newAssets : []);
      if (activeId) {
        const art = resolveArtifact(activeId, newPages, newAssets);
        if (art) setActiveArtifact(art);
      }
    } catch (e) {}
  };

  const treeData = useMemo(() => {
    const filteredAssets = includeFeedbackAssets
      ? assets
      : assets.filter((a) => a.artifactKind !== 'feedback');
    const allArtifacts = [
      ...pages.map(p => ({ ...p, __type: 'page' })),
      ...filteredAssets.map(a => ({ ...a, __type: 'asset' }))
    ];
    let filtered = allArtifacts;
    
    if (selSpaceId !== 'all') filtered = filtered.filter(p => String(p.spaceId) === String(selSpaceId));
    if (selBundleId !== 'all') filtered = filtered.filter(p => p.bundleId && String(p.bundleId) === String(selBundleId));
    if (selAppId !== 'all') filtered = filtered.filter(p => p.applicationId && String(p.applicationId) === String(selAppId));
    if (selMilestone !== 'all') filtered = filtered.filter(p => p.milestoneId && String(p.milestoneId) === String(selMilestone));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.title.toLowerCase().includes(q));
    }

    const tree: any[] = [];
    const findOrCreateNode = (list: any[], id: string, label: string, type: string, context: TreeContext) => {
      let node = list.find(n => n.id === id);
      if (!node) {
        node = { id, label, type: 'folder', nodeType: type, children: [], context };
        list.push(node);
      }
      return node;
    };

    if (showSpace) {
      spaces.forEach((space) => {
        const sId = String(space._id || space.id);
        const spaceName = space.name || 'Shared Space';
        const path = `space-${sId}`;
        findOrCreateNode(tree, path, spaceName, 'space', { spaceId: sId });
      });
    }

    filtered.forEach(art => {
      const sId = art.spaceId || 'unassigned';
      const bId = art.bundleId || 'general';
      const aId = art.applicationId || 'no_app';
      const dtId = art.documentTypeId || 'artifact';
      const msId = art.milestoneId || 'no_milestone';

      const spaceObj = spaces.find(s => String(s._id || s.id) === sId);
      const bundleObj = bundles.find(b => String(b._id || b.id) === bId);
      const appObj = applications.find(a => String(a._id || a.id) === aId);
      const typeObj = docTypes.find(t => String(t._id || t.id) === dtId);

      const spaceName = showSpace ? (spaceObj?.name || 'Shared Space') : 'All Spaces';
      const bundleName = bundleObj?.name || 'General';
      const appName = appObj?.name || 'App Context';
      const typeName = (art as any).documentType || typeObj?.name || 'Protocol';
      const milestoneName = msId;

      let currentLevel = tree;
      let path = "";
      const currentContext: TreeContext = { spaceId: sId, documentTypeId: dtId };

      path += `space-${showSpace ? sId : 'all'}`;
      const spaceNode = findOrCreateNode(currentLevel, path, spaceName, 'space', { ...currentContext });
      currentLevel = spaceNode.children;

      if (showBundle) {
        path += `:bundle-${bId}`;
        currentContext.bundleId = bId;
        const bundleNode = findOrCreateNode(currentLevel, path, bundleName, 'bundle', { ...currentContext });
        currentLevel = bundleNode.children;
      } else { currentContext.bundleId = bId; }

      const buildMiddle = () => {
        if (primaryGrouping === 'app') {
          if (showApp) {
            path += `:app-${aId}`;
            currentContext.applicationId = aId;
            const appNode = findOrCreateNode(currentLevel, path, appName, 'app', { ...currentContext });
            currentLevel = appNode.children;
          }
          if (showDocType) {
            path += `:type-${dtId}`;
            currentContext.documentTypeId = dtId;
            const typeNode = findOrCreateNode(currentLevel, path, typeName, 'type', { ...currentContext });
            currentLevel = typeNode.children;
          }
        } else {
          if (showDocType) {
            path += `:type-${dtId}`;
            currentContext.documentTypeId = dtId;
            const typeNode = findOrCreateNode(currentLevel, path, typeName, 'type', { ...currentContext });
            currentLevel = typeNode.children;
          }
          if (showApp) {
            path += `:app-${aId}`;
            currentContext.applicationId = aId;
            const appNode = findOrCreateNode(currentLevel, path, appName, 'app', { ...currentContext });
            currentLevel = appNode.children;
          }
        }
      };
      buildMiddle();

      if (showMilestone) {
        path += `:ms-${msId}`;
        currentContext.milestoneId = msId;
        const msNode = findOrCreateNode(currentLevel, path, milestoneName, 'milestone', { ...currentContext });
        currentLevel = msNode.children;
      } else { currentContext.milestoneId = msId; }

      currentLevel.push({
        id: `${art.__type === 'asset' ? 'asset-' : 'page-'}${art._id || art.id}`,
        label: art.title,
        type: art.__type,
        data: art,
        context: { ...currentContext }
      });
    });

    const sortTree = (list: any[]) => {
      list.sort((a, b) => {
        if (a.type !== 'folder' && b.type === 'folder') return 1;
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        return a.label.localeCompare(b.label);
      });
      list.forEach(n => { if (n.children) sortTree(n.children); });
    };
    sortTree(tree);
    return tree;
  }, [pages, assets, spaces, bundles, applications, docTypes, selSpaceId, selBundleId, selAppId, selMilestone, searchQuery, primaryGrouping, showBundle, showDocType, showMilestone, includeFeedbackAssets, showApp, showSpace]);

  const expandAllNodes = () => {
    const allIds = new Set<string>();
    const walk = (nodes: any[]) => {
      nodes.forEach((node) => {
        if (node.type === 'folder') {
          allIds.add(node.id);
          if (node.children?.length) walk(node.children);
        }
      });
    };
    walk(treeData);
    setExpandedNodes(allIds);
  };

  const collapseAllNodes = () => {
    setExpandedNodes(new Set());
  };

  const renderTreeNode = (node: any, depth = 0) => {
    const isArtifact = node.type === 'page' || node.type === 'asset';
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedNodeId === node.id;
    
    const getIcon = () => {
      if (node.type === 'page') return 'fa-file-lines';
      if (node.type === 'asset') {
        const ext = node.data?.file?.ext || '';
        if (ext === 'pdf') return 'fa-file-pdf text-red-500';
        if (['xlsx', 'xls', 'csv'].includes(ext)) return 'fa-file-excel text-emerald-600';
        if (['docx', 'doc'].includes(ext)) return 'fa-file-word text-blue-600';
        if (['pptx', 'ppt'].includes(ext)) return 'fa-file-powerpoint text-orange-500';
        if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return 'fa-file-image text-indigo-500';
        return 'fa-file-import';
      }
      switch (node.nodeType) {
        case 'space': return 'fa-rocket';
        case 'bundle': return 'fa-boxes-stacked';
        case 'app': return 'fa-cube';
        case 'milestone': return 'fa-flag-checkered';
        case 'type': return 'fa-file-contract';
        default: return 'fa-folder';
      }
    };

    return (
      <div key={node.id} className="flex flex-col">
        <button 
          onClick={() => isArtifact ? handleArtifactSelect(node.data) : handleFolderSelect(node.id, node.context)}
          className={`text-left px-3 py-2 flex items-center gap-3 rounded-xl transition-all group ${isSelected ? 'bg-blue-600 text-white shadow-xl' : 'text-slate-600 hover:bg-slate-100/60'}`} 
          style={{ marginLeft: `${depth * 10}px` }}
        >
          {!isArtifact && <i className={`fas ${isExpanded ? 'fa-caret-down' : 'fa-caret-right'} w-2 opacity-30 text-[10px]`}></i>}
          {isArtifact && <div className="w-2"></div>}
          <i className={`fas ${getIcon()} ${isSelected ? 'text-white' : 'text-slate-300 group-hover:text-blue-400'} text-[10px] w-4 text-center`}></i>
          <span className={`text-[11px] truncate ${isSelected ? 'font-black' : 'font-medium'}`}>{node.label}</span>
        </button>
        {node.children && isExpanded && (
          <div className="flex flex-col">{node.children.map((child: any) => renderTreeNode(child, depth + 1))}</div>
        )}
      </div>
    );
  };

  const canEditAssetMarkdown = (asset: WikiAsset) =>
    asset.preview?.kind === 'markdown' && Boolean(asset.preview.objectKey || asset.content);

  const currentRole = currentUser?.role;
  const currentUserId = String((currentUser as any)?.userId || (currentUser as any)?.id || '');
  const isGuestUser = String((currentUser as any)?.accountType || '').toUpperCase() === 'GUEST';
  const canEditKnowledge = !isGuestUser && Boolean(currentUserId);
  const canSubmitReview = canSubmitForReviewClient(currentRole, (currentUser as any)?.accountType);
  const canResubmitReview = canResubmitClient(currentRole, (currentUser as any)?.accountType);
  const canCloseReview = isEngineeringRoleClient(currentRole) || isVendorRoleClient(currentRole) || isAdminUser;

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const res = await fetch('/api/admin/check');
        const data = await res.json();
        setIsAdminUser(Boolean(data?.isAdmin));
      } catch {
        setIsAdminUser(false);
      }
    };
    checkAdmin();
  }, []);

  const refreshReview = async (artifact: WikiPage | WikiAsset | null) => {
    if (!artifact) return;
    setReviewLoading(true);
    try {
      const res = await fetch(`/api/reviews/by-resource?resourceType=${encodeURIComponent('file' in artifact ? 'wiki.asset' : 'wiki.page')}&resourceId=${encodeURIComponent(String(artifact._id || artifact.id))}`);
      const data = await res.json();
      setReview(data || null);
      setReviewUpdatedAt(data?.updatedAt || null);
    } catch {
      setReview(null);
      setReviewUpdatedAt(null);
    } finally {
      setReviewLoading(false);
    }
  };

  const refreshFeedbackPackages = async (artifact: WikiPage | WikiAsset | null) => {
    if (!artifact) return;
    setFeedbackLoading(true);
    try {
      const res = await fetch(`/api/feedback-packages?resourceType=${encodeURIComponent('file' in artifact ? 'wiki.asset' : 'wiki.page')}&resourceId=${encodeURIComponent(String(artifact._id || artifact.id))}`);
      const data = await res.json();
      setFeedbackPackages(Array.isArray(data) ? data : []);
    } catch {
      setFeedbackPackages([]);
    } finally {
      setFeedbackLoading(false);
    }
  };

  const refreshReviewers = async (artifact: WikiPage | WikiAsset | null) => {
    if (!artifact?.bundleId) {
      setReviewerAssignments([]);
      return;
    }
    try {
      const res = await fetch(`/api/bundle-assignments?bundleId=${encodeURIComponent(String(artifact.bundleId))}&type=assigned_cmo&active=true`);
      const data = await res.json();
      setReviewerAssignments(Array.isArray(data) ? data : []);
    } catch {
      setReviewerAssignments([]);
    }
  };

  const setReviewError = (status?: number, message?: string) => {
    let nextMessage = message || 'Action failed.';
    if (status === 403) {
      nextMessage = 'You are not authorized for this action (not a reviewer / not requester).';
    }
    if (status === 409 && (!message || message === 'Action failed.')) {
      nextMessage = 'A review cycle is already active for this resource.';
    }
    setReviewToastType('error');
    setReviewToast(nextMessage);
  };

  const handleReviewError = async (res: Response) => {
    let message = 'Action failed.';
    try {
      const data = await res.json();
      message = data?.error || message;
    } catch {}
    if (res.status === 409 && message.toLowerCase().includes('review changed since you opened it')) {
      setReviewToastType('error');
      setReviewToast('Review changed since you opened it; refreshed');
      await refreshReview(activeArtifact);
      return;
    }
    setReviewError(res.status, message);
  };

  useEffect(() => {
    if (!activeArtifact) return;
    const isFeedback = 'file' in activeArtifact && (activeArtifact.artifactKind === 'feedback' || activeArtifact.documentType === 'Feedback Document');
    if (isFeedback) {
      setReview(null);
      setFeedbackPackages([]);
      return;
    }
    refreshReview(activeArtifact);
    refreshFeedbackPackages(activeArtifact);
    refreshReviewers(activeArtifact);
  }, [activeArtifact?._id, activeArtifact?.id]);

  useEffect(() => {
    const commentsOpen = searchParams.get('comments') === '1';
    const commentTab = searchParams.get('tab');
    const cycleId = searchParams.get('cycleId');
    if (!commentsOpen || commentTab !== 'review') return;
    setWasSidebarVisible(isSidebarVisible);
    if (isSidebarVisible) setIsSidebarVisible(false);
    setCommentInitialFilter('current');
    setCommentInitialCycleId(cycleId || null);
    setCommentSuppressNewThread(true);
    setIsCommentsOpen(true);
  }, [searchParams, isSidebarVisible]);

  useEffect(() => {
    setIsReviewPanelVisible(false);
    setIsReviewCollapsed(false);
    setIsHistoryOpen(false);
    setIsSubmitterNotesOpen(false);
  }, [activeArtifact?._id, activeArtifact?.id]);

  useEffect(() => {
    setReviewerSearch('');
    setSelectedReviewerIds([]);
  }, [activeArtifact?._id, activeArtifact?.id]);

  useEffect(() => {
    if (!review?.currentCycleId) {
      if (!reviewDueAt) {
        const due = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
        setReviewDueAt(due.toISOString().slice(0, 10));
      }
      setReviewNotes('');
      return;
    }
    const currentCycle = review.cycles?.find((c) => c.cycleId === review.currentCycleId);
    if (!currentCycle) return;
    if (currentCycle.dueAt) setReviewDueAt(currentCycle.dueAt.slice(0, 10));
    if (currentCycle.notes) setReviewNotes(currentCycle.notes);
    const reviewerNote = currentCycle.reviewerNote?.body || '';
    const vendorResponse = currentCycle.vendorResponse?.body || '';
    if (reviewerNoteRef.current) {
      reviewerNoteRef.current.value = reviewerNote;
    }
    setReviewerNoteSavedAt(currentCycle.reviewerNote?.createdAt || null);
    setReviewerNoteDirty(false);
    if (vendorResponseRef.current) {
      vendorResponseRef.current.value = vendorResponse;
    }
    setVendorResponseSavedAt(currentCycle.vendorResponse?.submittedAt || null);
    setVendorResponseDirty(false);
  }, [review?.currentCycleId]);

  useEffect(() => {
    if (!review?.updatedAt || review.updatedAt === lastReviewUpdatedAtRef.current) return;
    lastReviewUpdatedAtRef.current = review.updatedAt;
    const currentCycle = review.cycles?.find((c) => c.cycleId === review.currentCycleId);
    if (!currentCycle) return;
    if (!reviewerNoteDirty) {
      if (reviewerNoteRef.current) {
        reviewerNoteRef.current.value = currentCycle.reviewerNote?.body || '';
      }
      setReviewerNoteSavedAt(currentCycle.reviewerNote?.createdAt || null);
    }
    if (!vendorResponseDirty) {
      if (vendorResponseRef.current) {
        vendorResponseRef.current.value = currentCycle.vendorResponse?.body || '';
      }
      setVendorResponseSavedAt(currentCycle.vendorResponse?.submittedAt || null);
    }
  }, [review?.updatedAt, review?.currentCycleId, reviewerNoteDirty, vendorResponseDirty]);

  useEffect(() => {
    if (!reviewToast || reviewToastType !== 'success') return;
    const timer = window.setTimeout(() => setReviewToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [reviewToast, reviewToastType]);

  const handleSubmitForReview = async () => {
    if (!activeArtifact) return;
    if (!activeArtifact.bundleId) return;
    if (reviewerAssignments.length === 0) {
      setReviewToast('No assigned CMO reviewers for this bundle. Ask admin to configure bundle assignments.');
      return;
    }
    setReviewActionLoading(true);
    try {
      const res = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
          resourceType: 'file' in activeArtifact ? 'wiki.asset' : 'wiki.page',
          resourceId: String(activeArtifact._id || activeArtifact.id),
          resourceTitle: activeArtifact.title,
          bundleId: activeArtifact.bundleId,
          notes: reviewNotes || undefined,
          dueAt: reviewDueAt ? new Date(reviewDueAt).toISOString() : undefined,
          reviewerUserIds: selectedReviewerIds.length > 0 ? selectedReviewerIds : undefined
        })
      });
      if (res.ok) {
        const data = await res.json();
        setReview(data.review || null);
        setReviewNotes('');
        setReviewDueAt('');
        setSelectedReviewerIds([]);
        setReviewToastType('success');
        setReviewToast('Review submitted');
      } else {
        await handleReviewError(res);
      }
    } finally {
      setReviewActionLoading(false);
    }
  };

  const handleReviewAction = async (action: 'feedback_sent' | 'resubmitted' | 'closed' | 'vendor_addressing') => {
    if (!activeArtifact || !review?._id || !review.currentCycleId) return;
    setReviewActionLoading(true);
    try {
      const reviewId = String(review._id);
      const cycleId = String(review.currentCycleId);
      const actionPath =
        action === 'feedback_sent'
          ? `feedback-sent`
          : action === 'resubmitted'
            ? 'resubmit'
            : action === 'vendor_addressing'
              ? 'vendor-addressing'
              : 'close';
      const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/cycles/${encodeURIComponent(cycleId)}/${actionPath}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        setReview(data.review || null);
        setReviewToastType('success');
        setReviewToast('Review updated');
        await refreshReview(activeArtifact);
      } else {
        await handleReviewError(res);
      }
    } finally {
      setReviewActionLoading(false);
    }
  };

  const handleSaveReviewerNote = async () => {
    if (!review?._id || !review.currentCycleId) return;
    const noteBody = reviewerNoteRef.current?.value ?? '';
    setReviewerNoteSaving(true);
    try {
      const res = await fetch(`/api/reviews/${encodeURIComponent(String(review._id))}/cycles/${encodeURIComponent(String(review.currentCycleId))}/reviewer-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: noteBody, ifMatchUpdatedAt: reviewUpdatedAt })
      });
      if (res.ok) {
        const data = await res.json();
        setReview(data.review || null);
        setReviewUpdatedAt(data.review?.updatedAt || null);
        const now = new Date().toISOString();
        setReviewerNoteSavedAt(now);
        setReviewerNoteDirty(false);
        setReviewToastType('success');
        setReviewToast('Reviewer note saved');
        await refreshReview(activeArtifact);
      } else {
        await handleReviewError(res);
      }
    } finally {
      setReviewerNoteSaving(false);
    }
  };

  const handleSaveVendorResponse = async () => {
    if (!review?._id || !review.currentCycleId) return;
    const responseBody = vendorResponseRef.current?.value ?? '';
    setVendorResponseSaving(true);
    try {
      const res = await fetch(`/api/reviews/${encodeURIComponent(String(review._id))}/cycles/${encodeURIComponent(String(review.currentCycleId))}/vendor-response`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: responseBody, ifMatchUpdatedAt: reviewUpdatedAt })
      });
      if (res.ok) {
        const data = await res.json();
        setReview(data.review || null);
        setReviewUpdatedAt(data.review?.updatedAt || null);
        const now = new Date().toISOString();
        setVendorResponseSavedAt(now);
        setVendorResponseDirty(false);
        setReviewToastType('success');
        setReviewToast('Vendor response saved');
        await refreshReview(activeArtifact);
      } else {
        await handleReviewError(res);
      }
    } finally {
      setVendorResponseSaving(false);
    }
  };

  const handleFeedbackImport = async () => {
    if (!activeArtifact || feedbackFiles.length === 0) return;
    setReviewActionLoading(true);
    try {
      const attachments: AttachmentRef[] = [];
      for (const file of feedbackFiles) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', file.name);
        formData.append('spaceId', activeArtifact.spaceId || '');
        if (activeArtifact.bundleId) formData.append('bundleId', activeArtifact.bundleId);
        if (activeArtifact.applicationId) formData.append('applicationId', activeArtifact.applicationId);
        if (activeArtifact.milestoneId) formData.append('milestoneId', activeArtifact.milestoneId);
        if (activeArtifact.documentTypeId) formData.append('documentTypeId', activeArtifact.documentTypeId);
        if (activeArtifact.themeKey) formData.append('themeKey', activeArtifact.themeKey);
        const res = await fetch('/api/wiki/assets', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok && data?.result?.insertedId) {
          attachments.push({
            assetId: String(data.result.insertedId),
            filename: file.name,
            mimeType: file.type,
            sizeBytes: file.size
          });
        }
      }

      if (attachments.length > 0) {
        await fetch('/api/feedback-packages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resourceType: 'file' in activeArtifact ? 'wiki.asset' : 'wiki.page',
            resourceId: String(activeArtifact._id || activeArtifact.id),
            resourceTitle: activeArtifact.title,
            attachments,
            summary: feedbackSummary || undefined,
            effectiveAt: feedbackEffectiveAt || undefined
          })
        });
      }

      setFeedbackFiles([]);
      setFeedbackSummary('');
      setFeedbackEffectiveAt('');
      setIsReviewModalOpen(false);
      refreshFeedbackPackages(activeArtifact);
      setReviewToastType('success');
      setReviewToast('Feedback attached');
    } finally {
      setReviewActionLoading(false);
    }
  };

  const handleReviewerUpload = async (cycleId: string) => {
    if (!activeArtifact || reviewFeedbackFiles.length === 0 || !review?._id) return;
    setReviewActionLoading(true);
    try {
      const reviewId = String(review._id);
      const resourceType = 'file' in activeArtifact ? 'wiki.asset' : 'wiki.page';
      const resourceId = String(activeArtifact._id || activeArtifact.id);
      const reviewedDocType = docTypes.find((t) => String(t._id || t.id) === String(activeArtifact.documentTypeId))?.name || '';
      const uploadQueue = reviewFeedbackFiles.map((file) => ({
        name: file.name,
        progress: 0,
        status: 'pending' as const
      }));
      setReviewUploadProgress(uploadQueue);

      const uploadFile = (file: File, index: number) =>
        new Promise<any>((resolve, reject) => {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('spaceId', activeArtifact.spaceId || '');
          if (activeArtifact.bundleId) formData.append('bundleId', activeArtifact.bundleId);
          if (activeArtifact.applicationId) formData.append('applicationId', activeArtifact.applicationId);
          if (activeArtifact.milestoneId) formData.append('milestoneId', activeArtifact.milestoneId);
          if (activeArtifact.documentTypeId) formData.append('documentTypeId', activeArtifact.documentTypeId);
          formData.append('resourceType', resourceType);
          formData.append('resourceId', resourceId);
          formData.append('resourceTitle', activeArtifact.title);
          if (reviewedDocType) formData.append('reviewedDocumentType', reviewedDocType);

          const xhr = new XMLHttpRequest();
          xhr.open('POST', `/api/reviews/${encodeURIComponent(reviewId)}/cycles/${encodeURIComponent(cycleId)}/attachments`);
          xhr.upload.onprogress = (evt) => {
            if (!evt.lengthComputable) return;
            const progress = Math.round((evt.loaded / evt.total) * 100);
            setReviewUploadProgress((prev) =>
              prev.map((item, idx) =>
                idx === index ? { ...item, progress, status: 'uploading' } : item
              )
            );
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setReviewUploadProgress((prev) =>
                prev.map((item, idx) =>
                  idx === index ? { ...item, progress: 100, status: 'done' } : item
                )
              );
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch {
                resolve(null);
              }
            } else {
              let errorMessage = xhr.responseText || 'Upload failed.';
              try {
                const parsed = JSON.parse(xhr.responseText);
                if (parsed?.error) errorMessage = parsed.error;
              } catch {}
              setReviewUploadProgress((prev) =>
                prev.map((item, idx) =>
                  idx === index ? { ...item, status: 'error' } : item
                )
              );
              reject({ status: xhr.status, message: errorMessage });
            }
          };
          xhr.onerror = () => {
            setReviewUploadProgress((prev) =>
              prev.map((item, idx) =>
                idx === index ? { ...item, status: 'error' } : item
              )
            );
            reject({ status: xhr.status, message: 'Upload failed.' });
          };
          xhr.send(formData);
        });

      let latestReview: any = null;
      for (let i = 0; i < reviewFeedbackFiles.length; i += 1) {
        const file = reviewFeedbackFiles[i];
        setReviewUploadProgress((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'uploading' } : item
          )
        );
        try {
          const data = await uploadFile(file, i);
          if (data?.review) latestReview = data.review;
        } catch (err: any) {
          const message = err?.message ? String(err.message) : 'Upload failed.';
          setReviewError(err?.status, message);
          break;
        }
      }

      if (latestReview) {
        setReview(latestReview || null);
        setReviewToastType('success');
        setReviewToast('Feedback uploaded');
        await refreshReview(activeArtifact);
      }
      setReviewFeedbackFiles([]);
      setIsReviewerFeedbackModalOpen(false);
      setReviewUploadProgress([]);
    } finally {
      setReviewActionLoading(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[500px] bg-white rounded-[3rem] border border-slate-100">
      <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest animate-pulse">Syncing Unified Registry...</p>
    </div>
  );

  const isFeedbackDoc = Boolean(
    activeArtifact &&
      'file' in activeArtifact &&
      (activeArtifact.artifactKind === 'feedback' || activeArtifact.documentType === 'Feedback Document')
  );

  return (
    <div className="sticky top-0 flex h-[calc(100vh-10.5rem)] bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-fadeIn">
      {isSidebarVisible && (
        <aside className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/30 shrink-0">
          <div className="px-6 py-3 bg-white border-b border-slate-100 flex items-center justify-between gap-3">
            <button
              onClick={() => setIsSidebarVisible(false)}
              className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 flex items-center justify-center"
              title="Hide sidebar"
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={expandAllNodes}
                className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 flex items-center justify-center"
                title="Expand all"
              >
                <img src="/icons/expand.gif" alt="Expand all" className="w-4 h-4" />
              </button>
              <button
                onClick={collapseAllNodes}
                className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 flex items-center justify-center"
                title="Collapse all"
              >
                <img src="/icons/collapse.gif" alt="Collapse all" className="w-4 h-4" />
              </button>
              <div className="relative" ref={viewOptionsRef}>
              <button
                onClick={() => setIsViewOptionsOpen((prev) => !prev)}
                className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 flex items-center justify-center"
                title="View options"
              >
                <img src="/icons/view.gif" alt="View options" className="w-4 h-4" />
              </button>
              {isViewOptionsOpen && (
                <div className="absolute left-full ml-3 top-0 w-80 bg-white border border-slate-200 rounded-2xl shadow-[0_20px_40px_rgba(15,23,42,0.15)] p-5 z-30">
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">View Options</div>
                  <div className="grid grid-cols-2 gap-4 text-[11px]">
                    <HierarchyToggle label="Show Spaces" active={showSpace} onToggle={setShowSpace} />
                    <HierarchyToggle label="Show Bundles" active={showBundle} onToggle={setShowBundle} />
                    <HierarchyToggle label="Show Apps" active={showApp} onToggle={setShowApp} />
                    <HierarchyToggle label="Show Doc Types" active={showDocType} onToggle={setShowDocType} />
                    <HierarchyToggle label="Show Milestones" active={showMilestone} onToggle={setShowMilestone} />
                    <HierarchyToggle label="Include Feedback" active={includeFeedbackAssets} onToggle={(v) => onIncludeFeedbackAssetsChange?.(v)} />
                  </div>
                </div>
              )}
            </div>
            </div>
          </div>
          <div className="px-6 pb-3 bg-white border-b border-slate-100">
            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
              <span className="uppercase tracking-widest text-[8px] text-slate-400">Organize By</span>
              <select
                value={primaryGrouping}
                onChange={(e) => setPrimaryGrouping(e.target.value as any)}
                className="flex-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold text-slate-600"
                title="Organize by"
              >
                <option value="app">App → Type</option>
                <option value="type">Type → App</option>
              </select>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-4 pt-2 custom-scrollbar">
            {treeData.length === 0 ? <div className="p-10 text-center text-slate-300"><p className="text-[10px] font-bold uppercase tracking-widest">Scope Empty</p></div> : treeData.map((node: any) => renderTreeNode(node))}
          </nav>
          
          <div className="p-6 border-t border-slate-100 bg-white">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-300 text-center">
              Use the top bar to create artifacts
            </div>
          </div>
        </aside>
      )}

      <main className="flex-1 overflow-y-auto bg-white relative custom-scrollbar">
        {!isSidebarVisible && <button onClick={() => setIsSidebarVisible(true)} className="absolute left-6 top-6 w-10 h-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-400 hover:text-blue-600 shadow-sm z-10 transition-all"><i className="fas fa-bars"></i></button>}

        {activeArtifact ? (
          <div
            className={`p-16 mx-auto animate-fadeIn ${isSidebarVisible ? 'max-w-5xl' : 'max-w-none w-full'}`}
          >
             <div className="sticky top-0 z-20 bg-white border-b border-slate-100 pt-6 pb-5 mb-8">
               <div className="flex flex-col gap-4">
                 <div className="flex flex-wrap items-center justify-between gap-4">
                   <nav className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
                     <button
                       onClick={() => handleBreadcrumbSelect('space', {
                         spaceId: activeArtifact.spaceId,
                         bundleId: activeArtifact.bundleId,
                         applicationId: activeArtifact.applicationId,
                         milestoneId: activeArtifact.milestoneId,
                         documentTypeId: activeArtifact.documentTypeId,
                       })}
                       className="hover:text-blue-600 transition-colors"
                     >
                       {spaces.find((s) => String(s._id || s.id) === String(activeArtifact.spaceId))?.name || 'Shared Space'}
                     </button>
                     <span>→</span>
                     <button
                       onClick={() => handleBreadcrumbSelect('bundle', {
                         spaceId: activeArtifact.spaceId,
                         bundleId: activeArtifact.bundleId,
                         applicationId: activeArtifact.applicationId,
                         milestoneId: activeArtifact.milestoneId,
                         documentTypeId: activeArtifact.documentTypeId,
                       })}
                       className="hover:text-blue-600 transition-colors"
                     >
                       {bundles.find((b) => String(b._id || b.id) === String(activeArtifact.bundleId))?.name || 'General'}
                     </button>
                     <span>→</span>
                     <button
                       onClick={() => handleBreadcrumbSelect('app', {
                         spaceId: activeArtifact.spaceId,
                         bundleId: activeArtifact.bundleId,
                         applicationId: activeArtifact.applicationId,
                         milestoneId: activeArtifact.milestoneId,
                         documentTypeId: activeArtifact.documentTypeId,
                       })}
                       className="hover:text-blue-600 transition-colors"
                     >
                       {applications.find((a) => String(a._id || a.id) === String(activeArtifact.applicationId))?.name || 'Shared'}
                     </button>
                     <span>→</span>
                     <button
                       onClick={() => handleBreadcrumbSelect('type', {
                         spaceId: activeArtifact.spaceId,
                         bundleId: activeArtifact.bundleId,
                         applicationId: activeArtifact.applicationId,
                         milestoneId: activeArtifact.milestoneId,
                         documentTypeId: activeArtifact.documentTypeId,
                       })}
                       className="hover:text-blue-600 transition-colors"
                     >
                     {(activeArtifact as any).documentType || docTypes.find((t) => String(t._id || t.id) === String(activeArtifact.documentTypeId))?.name || 'Artifact'}
                     </button>
                     <span>→</span>
                     <span className="text-slate-700">{activeArtifact.title}</span>
                   </nav>
                 <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    <span className="px-2.5 py-1 rounded-full border border-slate-200 bg-slate-50 text-slate-500">
                       Milestone {activeArtifact.milestoneId ? String(activeArtifact.milestoneId) : 'None'}
                     </span>
                     <span className="px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-500">
                       {activeArtifact.status ? String(activeArtifact.status) : 'Draft'}
                     </span>
                   </div>
                 </div>
                 <h1 className="text-4xl font-black text-slate-900 tracking-tighter">
                   {activeArtifact.title}
                 </h1>
                 <div className="flex flex-wrap items-center gap-3">
                   {isFeedbackDoc && (activeArtifact as any)?.reviewContext?.reviewedResourceId && (
                     <button
                       onClick={() => {
                         const params = new URLSearchParams(searchParams.toString());
                         params.set('tab', 'wiki');
                         params.set('pageId', String((activeArtifact as any).reviewContext.reviewedResourceId));
                         router.push(`/?${params.toString()}`);
                       }}
                       className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2"
                     >
                       <i className="fas fa-arrow-left"></i> Back
                     </button>
                   )}
                   {('file' in activeArtifact) && (activeArtifact as WikiAsset).preview?.kind === 'sheet' && (
                     <div className="inline-flex rounded-lg border border-slate-200 bg-white overflow-hidden">
                       <button
                         type="button"
                         onClick={() => {
                           setShowSheetDashboards(false);
                           setSheetViewMode('tiles');
                         }}
                         className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest transition ${
                           sheetViewMode === 'tiles' && !showSheetDashboards ? 'bg-slate-900 text-white' : 'text-slate-500'
                         }`}
                       >
                         Tiles
                       </button>
                       <button
                         type="button"
                         onClick={() => {
                           setShowSheetDashboards(false);
                           setSheetViewMode('table');
                         }}
                         className={`px-3 py-2 text-[9px] font-black uppercase tracking-widest transition ${
                           sheetViewMode === 'table' && !showSheetDashboards ? 'bg-slate-900 text-white' : 'text-slate-500'
                         }`}
                       >
                         Table
                       </button>
                     </div>
                   )}
                   {canEditKnowledge && ('content' in activeArtifact) && !('file' in activeArtifact) && (
                     <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2">
                       <i className="fas fa-edit"></i> Edit
                     </button>
                   )}
                   {canEditKnowledge && ('file' in activeArtifact) && canEditAssetMarkdown(activeArtifact as WikiAsset) && (
                     <button onClick={() => setIsEditingAsset(true)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2">
                       <i className="fas fa-pen-nib"></i> Edit
                     </button>
                   )}
                   {('file' in activeArtifact) && (
                     <button
                       onClick={() => {
                         const link = document.createElement('a');
                         link.href = `data:${activeArtifact.file.mimeType};base64,${activeArtifact.storage.objectKey}`;
                         link.download = activeArtifact.file.originalName;
                         link.click();
                       }}
                       className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2"
                     >
                       <i className="fas fa-download"></i> Download
                     </button>
                   )}
                  {('file' in activeArtifact) && (activeArtifact as WikiAsset).preview?.kind === 'sheet' && (
                    <button
                      onClick={() => setShowSheetDashboards((prev) => !prev)}
                      className={`px-4 py-2 border text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${
                        showSheetDashboards ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <i className="fas fa-chart-column"></i> Dashboards
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setWasSidebarVisible(isSidebarVisible);
                      if (isSidebarVisible) setIsSidebarVisible(false);
                      setCommentInitialFilter('all');
                      setCommentInitialCycleId(null);
                      setCommentSuppressNewThread(false);
                      setIsCommentsOpen(true);
                    }}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2 relative"
                  >
                    <i className="fas fa-comment-dots"></i> Comments
                    {commentUnreadCount > 0 && (
                      <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[9px] font-black rounded-full px-1.5 py-0.5">
                        {commentUnreadCount}
                      </span>
                    )}
                  </button>
                  {searchParams.get('returnToReview') && (
                    <button
                      onClick={() => router.push(`/activities/reviews/${encodeURIComponent(String(searchParams.get('returnToReview')))}`)}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                      ← Back to Review
                    </button>
                  )}
                  {!isFeedbackDoc && (
                    <button
                      onClick={() => {
                        setIsReviewPanelVisible((prev) => !prev);
                        setTimeout(() => {
                          reviewSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 50);
                      }}
                      className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2"
                    >
                      <i className="fas fa-clipboard-check"></i> {isReviewPanelVisible ? 'Hide Review' : 'Review'}
                    </button>
                  )}
                  <button
                    onClick={handleCopyLink}
                    title="Share"
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2"
                  >
                     <i className={`fas ${copyFeedback ? 'fa-check text-emerald-500' : 'fa-link'}`}></i>
                     {copyFeedback ? 'Link Ready' : 'Share'}
                   </button>
                   <div className="relative" ref={aiMenuRef}>
                     <button
                       onClick={() => setIsAiMenuOpen((prev) => !prev)}
                       className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2"
                     >
                       <i className="fas fa-robot"></i> AI
                     </button>
                     {isAiMenuOpen && (
                       <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-30">
                         {[
                           { id: 'summary', label: 'Generate Summary' },
                           { id: 'decisions', label: 'Key Decisions' },
                           { id: 'assumptions', label: 'Assumptions' },
                         ].map((item) => (
                           <button
                             key={item.id}
                             onClick={() => {
                               setIsAiMenuOpen(false);
                               runAiInsight(item.id as InsightType);
                             }}
                             className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
                           >
                             {item.label}
                           </button>
                         ))}
                       </div>
                     )}
                   </div>
                 </div>
               </div>
             </div>

             <section ref={aiSectionRef} className="mb-8">
               {(() => {
                 const tabs = (['summary', 'decisions', 'assumptions'] as InsightType[]).filter((key) => {
                   const state = aiState.insights[key];
                   return state.status !== 'idle';
                 });
                 if (!aiState.isExpanded && tabs.length === 0) return null;
                 return (
                   <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-6">
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2 text-slate-600">
                         <i className="fas fa-wand-magic-sparkles text-sm"></i>
                         <span className="text-[9px] font-black uppercase tracking-widest">AI Insights</span>
                       </div>
                       <div className="flex items-center gap-3">
                         <button
                           onClick={() => setAiState((prev) => ({ ...prev, isCollapsed: !prev.isCollapsed }))}
                           className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                         >
                           {aiState.isCollapsed ? 'Expand' : 'Collapse'}
                         </button>
                         <button
                           onClick={async () => {
                             if (!activeArtifact) return;
                             const targetId = activeArtifact._id || activeArtifact.id;
                             if (!targetId) return;
                             await fetch('/api/wiki/insights', {
                               method: 'DELETE',
                               headers: { 'Content-Type': 'application/json' },
                               body: JSON.stringify({
                                 targetType: 'file' in activeArtifact ? 'asset' : 'page',
                                 targetId,
                               }),
                             });
                             setAiState(createEmptyAiState());
                           }}
                           className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                         >
                           Clear
                         </button>
                       </div>
                     </div>
                     {!aiState.isCollapsed && (
                       <>
                         <div className="mt-4 flex flex-wrap gap-2">
                           {tabs.map((key) => (
                             <button
                               key={key}
                               onClick={() => setAiState((prev) => ({ ...prev, activeType: key }))}
                               className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                 aiState.activeType === key
                                   ? 'bg-slate-900 text-white border-slate-900'
                                   : 'bg-white text-slate-500 border-slate-200'
                               }`}
                             >
                               {key === 'summary' ? 'Summary' : key === 'decisions' ? 'Key Decisions' : 'Assumptions'}
                             </button>
                           ))}
                         </div>
                         <div className="mt-4 bg-white border border-slate-100 rounded-2xl p-5">
                           {(() => {
                             const state = aiState.insights[aiState.activeType];
                             if (state.status === 'loading') {
                               return <div className="text-sm text-slate-400">Generating insights...</div>;
                             }
                             if (state.status === 'error') {
                               return (
                                 <div className="text-sm text-amber-600 flex items-center justify-between gap-4">
                                   <span>{state.message}</span>
                                   <button
                                     onClick={() => runAiInsight(aiState.activeType)}
                                     className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg bg-slate-900 text-white"
                                   >
                                     Retry
                                   </button>
                                 </div>
                               );
                             }
                             if (state.status === 'ready') {
                               return <MarkdownRenderer content={state.content} />;
                             }
                             return <div className="text-sm text-slate-400">Select an AI action to populate insights.</div>;
                           })()}
                         </div>
                       </>
                     )}
                   </div>
                 );
               })()}
             </section>
             {isReviewPanelVisible && !isFeedbackDoc && (
               <section ref={reviewSectionRef} className="mb-8">
               {activeArtifact && (
                 <div className="bg-white border border-slate-200 rounded-[2rem] p-6">
                   <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2 text-slate-700">
                       <i className="fas fa-clipboard-check text-sm"></i>
                       <span className="text-[9px] font-black uppercase tracking-widest">Review</span>
                     </div>
                   <div className="flex items-center gap-3">
                     <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                       {review?.status ? review.status : 'No review'}
                     </div>
                     {review?._id && (
                       <button
                         onClick={() => router.push(`/activities/reviews/${encodeURIComponent(String(review._id))}`)}
                         className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                       >
                         Open Details
                       </button>
                     )}
                     <button
                       onClick={() => setIsReviewCollapsed((prev) => !prev)}
                       className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                     >
                         {isReviewCollapsed ? 'Expand' : 'Collapse'}
                       </button>
                     </div>
                   </div>

                   {reviewToast && (
                     <div className={`mt-4 text-xs rounded-xl px-3 py-2 border flex items-center justify-between gap-3 ${
                       reviewToastType === 'success'
                         ? 'text-emerald-600 bg-emerald-50 border-emerald-100'
                         : 'text-red-600 bg-red-50 border-red-100'
                     }`}>
                       <span>{reviewToast}</span>
                       {reviewToastType === 'error' && (
                         <button
                           onClick={() => setReviewToast(null)}
                           className="text-[10px] font-black uppercase tracking-widest text-red-500 hover:text-red-700"
                         >
                           Dismiss
                         </button>
                       )}
                     </div>
                   )}

                   {reviewLoading && (
                     <div className="mt-4 text-sm text-slate-400">Loading review status...</div>
                   )}
                   {(() => {
                     if (reviewLoading) return null;
                     if (isReviewCollapsed) return null;
                     const isPublished = ('file' in activeArtifact)
                       ? activeArtifact.status === 'Published'
                       : activeArtifact.status === 'Published';
                     const currentCycle = review?.cycles?.find((c) => c.cycleId === review.currentCycleId);
                     const isClosed = review?.status === 'closed' || currentCycle?.status === 'closed';
                     const currentCycleClosed = currentCycle?.status === 'closed';
                     const isReviewer = Boolean(currentCycle && currentUserId && currentCycle.reviewers?.some((r) => String(r.userId) === currentUserId));
                     const canVendorActions = canResubmitReview && !isReviewer;
                     const reviewerHasAttachments = Boolean(currentCycle?.feedbackAttachments?.length);
                     const feedbackSentAt = currentCycle?.feedbackSentAt ? new Date(currentCycle.feedbackSentAt).toLocaleString() : null;
                     const feedbackSentBy = currentCycle?.feedbackSentBy?.displayName || currentCycle?.feedbackSentBy?.email || null;
                     const showReviewerActions = Boolean(
                       currentCycle &&
                         isReviewer &&
                         !isClosed &&
                         (currentCycle.status === 'requested' || currentCycle.status === 'in_review')
                     );
                     const showVendorActions = Boolean(currentCycle && !isReviewer && !isClosed && canVendorActions);
                     const showReviewerNoteEditor = Boolean(showReviewerActions && currentCycle?.status === 'in_review');
                     const showReviewerNoteReadOnly = Boolean(
                       currentCycle?.reviewerNote?.body && ['feedback_sent', 'vendor_addressing', 'closed'].includes(currentCycle.status)
                     );
                     const showVendorResponseEditor = Boolean(showVendorActions && currentCycle?.status === 'vendor_addressing');
                     const showVendorResponseReadOnly = Boolean(
                       currentCycle?.vendorResponse?.body && ['feedback_sent', 'vendor_addressing', 'closed'].includes(currentCycle.status)
                     );
                     const showReadOnlyRow = Boolean(currentCycle && !isReviewer && !canVendorActions);
                     const reviewerOptions = reviewerAssignments.map((assignment: any) => ({
                       id: String(assignment.userId || assignment.user?._id || assignment.user?.id || ''),
                       label: assignment.user?.name || assignment.user?.email || assignment.userId
                     })).filter((option) => option.id);
                     const filteredReviewerOptions = reviewerOptions.filter((option) =>
                       option.label.toLowerCase().includes(reviewerSearch.toLowerCase().trim())
                     );

                     return (
                       <>
                         {!currentCycleClosed && (
                           <div className="mt-4 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                             {currentCycle ? (
                               <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center text-xs text-slate-600">
                                 <div className="font-semibold text-slate-800">Cycle #{currentCycle.number}</div>
                                 <div className="uppercase tracking-widest text-[10px] font-black text-slate-500">
                                   {currentCycle.status.replace(/_/g, ' ')}
                                 </div>
                                 <div>Requested: {new Date(currentCycle.requestedAt).toLocaleDateString()}</div>
                                 <div>Due: {currentCycle.dueAt ? new Date(currentCycle.dueAt).toLocaleDateString() : '—'}</div>
                                 <div className="flex flex-wrap gap-2">
                                   {(currentCycle.reviewers || []).map((r) => (
                                     <span key={r.userId} className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-500">
                                       {r.displayName || r.email || r.userId}
                                     </span>
                                   ))}
                                 </div>
                               </div>
                             ) : (
                               <div className="text-sm text-slate-500">No active review</div>
                             )}
                             {currentCycle && feedbackSentAt && (
                               <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                 Feedback sent {feedbackSentBy ? `by ${feedbackSentBy}` : ''} on {feedbackSentAt}
                               </div>
                             )}
                             {currentCycle && reviewerHasAttachments && (
                               <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                 Feedback attachments: {(currentCycle.feedbackAttachments || []).map((att) => (
                                   <button
                                     key={att.assetId}
                                     onClick={(e) => {
                                       e.preventDefault();
                                       const params = new URLSearchParams(searchParams.toString());
                                       params.set('tab', 'wiki');
                                       params.set('pageId', String(att.assetId));
                                       router.push(`/?${params.toString()}`);
                                     }}
                                     className="ml-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full hover:bg-blue-100"
                                   >
                                     {att.filename}
                                   </button>
                                 ))}
                               </div>
                             )}
                             {currentCycle?.notes && (
                               <div className="mt-4">
                                 <button
                                   type="button"
                                   onClick={() => setIsSubmitterNotesOpen((prev) => !prev)}
                                   className="w-full flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                                 >
                                   <span>Submitter Notes</span>
                                   <span>{isSubmitterNotesOpen ? 'Collapse' : 'Expand'}</span>
                                 </button>
                                 {!isSubmitterNotesOpen && (
                                   <div className="mt-2 text-xs text-slate-500 line-clamp-2">
                                     <MarkdownRenderer content={currentCycle.notes} />
                                   </div>
                                 )}
                                 {isSubmitterNotesOpen && (
                                   <div className="mt-2 bg-white border border-slate-100 rounded-xl p-4">
                                     <MarkdownRenderer content={currentCycle.notes} />
                                   </div>
                                 )}
                               </div>
                             )}
                             {showReviewerNoteEditor && (
                               <div className="mt-4">
                                 <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reviewer Note</div>
                                 <textarea
                                   ref={reviewerNoteRef}
                                   defaultValue={currentCycle?.reviewerNote?.body || ''}
                                   onChange={() => {
                                     if (!reviewerNoteDirty) {
                                       setReviewerNoteDirty(true);
                                     }
                                   }}
                                   className="mt-2 w-full min-h-[120px] border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white"
                                   placeholder="Optional: add a short summary and links to supporting wiki docs (Markdown supported)."
                                 />
                                 <div className="mt-3 flex items-center justify-between">
                                   <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                     {reviewerNoteDirty
                                       ? 'Unsaved changes'
                                       : reviewerNoteSavedAt
                                         ? `Saved by ${currentCycle?.reviewerNote?.createdBy?.displayName || 'Reviewer'} • ${new Date(reviewerNoteSavedAt).toLocaleString()}`
                                         : ''}
                                   </span>
                                   <button
                                     onClick={handleSaveReviewerNote}
                                     disabled={!reviewerNoteDirty || reviewerNoteSaving}
                                     className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                                   >
                                     {reviewerNoteSaving ? 'Saving...' : 'Save'}
                                   </button>
                                 </div>
                               </div>
                             )}
                             {showReviewerNoteReadOnly && (
                               <div className="mt-4">
                                 <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reviewer Note</div>
                                 <div className="mt-2 bg-white border border-slate-100 rounded-xl p-4">
                                   <MarkdownRenderer content={currentCycle.reviewerNote?.body || ''} />
                                 </div>
                               </div>
                             )}
                             {showVendorResponseEditor && (
                               <div className="mt-4">
                                 <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vendor Response</div>
                                 <textarea
                                   ref={vendorResponseRef}
                                   defaultValue={currentCycle?.vendorResponse?.body || ''}
                                   onChange={() => {
                                     if (!vendorResponseDirty) {
                                       setVendorResponseDirty(true);
                                     }
                                   }}
                                   className="mt-2 w-full min-h-[120px] border border-slate-200 rounded-xl px-3 py-2 text-sm"
                                   placeholder="Optional: summarize what you changed and any notes for reviewers (Markdown supported)."
                                 />
                                 <div className="mt-3 flex items-center justify-between">
                                   <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                     {vendorResponseDirty
                                       ? 'Unsaved changes'
                                       : vendorResponseSavedAt
                                         ? `Saved by ${currentCycle?.vendorResponse?.submittedBy?.displayName || 'Vendor'} • ${new Date(vendorResponseSavedAt).toLocaleString()}`
                                         : ''}
                                   </span>
                                   <button
                                     onClick={handleSaveVendorResponse}
                                     disabled={!vendorResponseDirty || vendorResponseSaving}
                                     className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                                   >
                                     {vendorResponseSaving ? 'Saving...' : 'Save'}
                                   </button>
                                 </div>
                               </div>
                             )}
                             {showVendorResponseReadOnly && (
                               <div className="mt-4">
                                 <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vendor Response</div>
                                 <div className="mt-2 bg-white border border-slate-100 rounded-xl p-4">
                                   <MarkdownRenderer content={currentCycle.vendorResponse?.body || ''} />
                                 </div>
                               </div>
                             )}
                           </div>
                         )}
                         {currentCycleClosed && currentCycle && (
                           <div className="mt-4 text-xs text-slate-500">
                             Latest cycle: <span className="font-semibold text-slate-700">Cycle #{currentCycle.number}</span> · CLOSED · {currentCycle.closedAt ? new Date(currentCycle.closedAt).toLocaleDateString() : '—'}
                           </div>
                         )}

                         {!showReadOnlyRow && (
                           <div className="mt-6 flex flex-wrap gap-3 items-center">
                             {!currentCycle && (
                               <button
                                 onClick={handleSubmitForReview}
                                 disabled={!canSubmitReview || !isPublished || reviewActionLoading || !activeArtifact?.bundleId || reviewerAssignments.length === 0}
                                 className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50"
                               >
                                 {reviewActionLoading ? 'Submitting...' : 'Submit for Review'}
                               </button>
                             )}
                            {showReviewerActions && currentCycle?.status !== 'feedback_sent' && (
                              <>
                                <button
                                  onClick={() => setIsReviewerFeedbackModalOpen(true)}
                                  disabled={reviewActionLoading}
                                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl"
                                >
                                  {reviewActionLoading ? 'Working...' : 'Upload Feedback'}
                                </button>
                                <button
                                  onClick={() => {
                                    setWasSidebarVisible(isSidebarVisible);
                                    if (isSidebarVisible) setIsSidebarVisible(false);
                                    setCommentInitialFilter('current');
                                    setCommentInitialCycleId(review?.currentCycleId || null);
                                    setCommentSuppressNewThread(true);
                                    setIsCommentsOpen(true);
                                  }}
                                  disabled={reviewActionLoading}
                                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl"
                                >
                                  Add Review Comment
                                </button>
                                <button
                                  onClick={() => handleReviewAction('feedback_sent')}
                                  disabled={reviewActionLoading || (!reviewerHasAttachments && !reviewerNoAttachment)}
                                  className="px-4 py-2 bg-emerald-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50"
                                >
                                  {reviewActionLoading ? 'Updating...' : 'Mark Feedback Sent'}
                                </button>
                                {!reviewerHasAttachments && (
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                                    <input
                                      type="checkbox"
                                      checked={reviewerNoAttachment}
                                      onChange={(e) => setReviewerNoAttachment(e.target.checked)}
                                    />
                                    No attachment
                                  </label>
                                )}
                              </>
                            )}
                            {showVendorActions && currentCycle?.status === 'feedback_sent' && (
                              <button
                                onClick={() => handleReviewAction('vendor_addressing')}
                                disabled={reviewActionLoading}
                                className="px-4 py-2 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl"
                              >
                                {reviewActionLoading ? 'Updating...' : 'Start Addressing'}
                              </button>
                            )}
                           {showVendorActions && (currentCycle?.status === 'feedback_sent' || currentCycle?.status === 'vendor_addressing') && (
                             <button
                               onClick={() => handleReviewAction('resubmitted')}
                               disabled={reviewActionLoading}
                               className="px-4 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50"
                             >
                                {reviewActionLoading ? 'Updating...' : 'Resubmit (New Cycle)'}
                             </button>
                           )}
                            {showVendorActions && currentCycle?.status === 'vendor_addressing' && (
                              <button
                                onClick={() => handleReviewAction('closed')}
                                disabled={reviewActionLoading}
                                className="px-4 py-2 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50"
                              >
                                {reviewActionLoading ? 'Updating...' : 'Close Cycle'}
                              </button>
                            )}
                             {isClosed && (
                               <button
                                 onClick={handleSubmitForReview}
                                 disabled={!canSubmitReview || !isPublished || reviewActionLoading || !activeArtifact?.bundleId || reviewerAssignments.length === 0}
                                 className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl disabled:opacity-50"
                               >
                                 Start New Review Cycle
                               </button>
                             )}
                             {!isPublished && (
                               <span className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                                 Publish the artifact before submitting for review.
                               </span>
                             )}
                           </div>
                         )}

                         {!currentCycle && (
                           <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div>
                               <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Due Date</label>
                               <input
                                 type="date"
                                 value={reviewDueAt}
                                 onChange={(e) => setReviewDueAt(e.target.value)}
                                 className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                               />
                             </div>
                             <div>
                               <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Notes</label>
                               <input
                                 value={reviewNotes}
                                 onChange={(e) => setReviewNotes(e.target.value)}
                                 className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                                 placeholder="Optional notes"
                               />
                             </div>
                             <div className="md:col-span-2">
                               <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assigned Reviewers (CMO)</label>
                               {reviewerAssignments.length === 0 ? (
                                 <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-amber-600">
                                   No assigned reviewers yet.
                                 </div>
                               ) : (
                                 <>
                                   <input
                                     value={reviewerSearch}
                                     onChange={(e) => setReviewerSearch(e.target.value)}
                                     placeholder="Search reviewers"
                                     className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                                   />
                                   <div className="mt-3 flex flex-wrap gap-2">
                                     {filteredReviewerOptions.length === 0 ? (
                                       <span className="text-xs text-slate-400">No reviewers match.</span>
                                     ) : (
                                       filteredReviewerOptions.map((option) => {
                                         const checked = selectedReviewerIds.includes(option.id);
                                         return (
                                           <label key={option.id} className="flex items-center gap-2 px-2 py-1 rounded-full border border-slate-200 bg-white text-[9px] font-black uppercase tracking-widest text-slate-500">
                                             <input
                                               type="checkbox"
                                               checked={checked}
                                               onChange={(e) => {
                                                 if (e.target.checked) {
                                                   setSelectedReviewerIds((prev) => [...prev, option.id]);
                                                 } else {
                                                   setSelectedReviewerIds((prev) => prev.filter((id) => id !== option.id));
                                                 }
                                               }}
                                             />
                                             {option.label}
                                           </label>
                                         );
                                       })
                                     )}
                                   </div>
                                   <div className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                     If none selected, all assigned reviewers will be used.
                                   </div>
                                 </>
                               )}
                             </div>
                           </div>
                         )}

                         {/* attachments are shown inline under the cycle row; no separate card */}

                         {review?.cycles && (review.cycles.length > 1 || currentCycleClosed) && (
                           <div className="mt-6">
                             <button
                               onClick={() => setIsHistoryOpen((prev) => !prev)}
                               className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-700 flex items-center gap-2"
                             >
                               <span>{currentCycleClosed ? 'View cycle details' : `History (${review.cycles.length - 1})`}</span>
                               <i className={`fas ${isHistoryOpen ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                             </button>
                             {isHistoryOpen ? (
                               <div className="mt-4 border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                                 {review.cycles
                                   .filter((cycle) => (currentCycleClosed ? true : cycle.cycleId !== review.currentCycleId))
                                   .map((cycle) => {
                                     const cycleRequestedAt = new Date(cycle.requestedAt).toLocaleDateString();
                                     const feedbackDate = cycle.feedbackSentAt ? new Date(cycle.feedbackSentAt).toLocaleDateString() : '—';
                                     const cycleDue = cycle.dueAt ? new Date(cycle.dueAt).toLocaleDateString() : '—';
                                     return (
                                       <div key={cycle.cycleId} className="px-4 py-3">
                                         <div className="grid grid-cols-1 md:grid-cols-6 gap-2 text-xs text-slate-600">
                                           <div className="font-semibold text-slate-800">Cycle #{cycle.number}</div>
                                           <div className="uppercase tracking-widest text-[10px] font-black text-slate-500">
                                             {cycle.status.replace(/_/g, ' ')}
                                           </div>
                                           <div>Requested: {cycleRequestedAt}</div>
                                           <div>Feedback: {feedbackDate}</div>
                                           <div>Due: {cycleDue}</div>
                                           <div className="flex flex-wrap gap-2">
                                             {(cycle.reviewers || []).map((r) => (
                                               <span key={r.userId} className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-500">
                                                 {r.displayName || r.email || r.userId}
                                               </span>
                                             ))}
                                           </div>
                                         </div>
                                        {cycle.feedbackAttachments?.length ? (
                                          <div className="mt-3 flex flex-wrap gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                              Feedback attachments:
                                            </span>
                                            {cycle.feedbackAttachments.map((att) => (
                                               <button
                                                 key={att.assetId}
                                                 onClick={(e) => {
                                                   e.preventDefault();
                                                   const params = new URLSearchParams(searchParams.toString());
                                                   params.set('tab', 'wiki');
                                                   params.set('pageId', String(att.assetId));
                                                   router.push(`/?${params.toString()}`);
                                                 }}
                                                 className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full hover:bg-blue-100"
                                              >
                                                {att.filename}
                                              </button>
                                            ))}
                                          </div>
                                        ) : null}
                                        {cycle.notes && (
                                          <div className="mt-3">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Submitter Notes</div>
                                            <div className="mt-2 bg-white border border-slate-100 rounded-xl p-3 text-sm">
                                              <MarkdownRenderer content={cycle.notes} />
                                            </div>
                                          </div>
                                        )}
                                        {cycle.reviewerNote?.body && (
                                          <div className="mt-3">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reviewer Note</div>
                                            <div className="mt-2 bg-white border border-slate-100 rounded-xl p-3 text-sm">
                                              <MarkdownRenderer content={cycle.reviewerNote.body} />
                                            </div>
                                          </div>
                                        )}
                                        {cycle.vendorResponse?.body && (
                                          <div className="mt-3">
                                            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vendor Response</div>
                                            <div className="mt-2 bg-white border border-slate-100 rounded-xl p-3 text-sm">
                                              <MarkdownRenderer content={cycle.vendorResponse.body} />
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                             ) : null}
                           </div>
                         )}

                         {!showReadOnlyRow && currentCycle && (feedbackPackages.length > 0 || feedbackLoading) && (
                           <div className="mt-8 bg-slate-50 border border-slate-100 rounded-2xl p-4">
                             <div className="flex items-center justify-between">
                               <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Historical Feedback</div>
                               <button
                                 onClick={() => setIsReviewModalOpen(true)}
                                 className="px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl bg-white border border-slate-200 text-slate-600"
                               >
                                 Attach Historical Feedback
                               </button>
                             </div>
                             {feedbackLoading ? (
                               <div className="text-sm text-slate-400 mt-3">Loading feedback packages...</div>
                             ) : (
                               <div className="mt-4 space-y-3">
                                 {feedbackPackages.map((pkg) => (
                                   <div key={String(pkg._id)} className="bg-white border border-slate-200 rounded-xl p-3">
                                     <div className="flex items-center justify-between">
                                       <div className="text-xs font-semibold text-slate-700">
                                         Feedback provided
                                       </div>
                                       <div className="text-[10px] text-slate-400">
                                         {new Date(pkg.createdAt).toLocaleDateString()}
                                       </div>
                                     </div>
                                     {pkg.summary && <div className="text-xs text-slate-600 mt-2">{pkg.summary}</div>}
                                     <div className="mt-2 flex flex-wrap gap-2">
                                       {pkg.attachments?.map((att) => (
                                         <button
                                           key={att.assetId}
                                           onClick={(e) => {
                                             e.preventDefault();
                                             const params = new URLSearchParams(searchParams.toString());
                                             params.set('tab', 'wiki');
                                             params.set('pageId', String(att.assetId));
                                             router.push(`/?${params.toString()}`);
                                           }}
                                           className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full hover:bg-blue-100"
                                         >
                                           {att.filename}
                                         </button>
                                       ))}
                                     </div>
                                     <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-widest">
                                       <span className="text-amber-600 font-black">{pkg.status.replace(/_/g, ' ')}</span>
                                       {pkg.status !== 'closed' && canCloseReview && (
                                         <button
                                           onClick={async () => {
                                             await fetch(`/api/feedback-packages/${pkg._id}/close`, {
                                               method: 'POST',
                                               headers: { 'Content-Type': 'application/json' },
                                               body: JSON.stringify({
                                                 resourceType: 'file' in activeArtifact ? 'wiki.asset' : 'wiki.page',
                                                 resourceId: String(activeArtifact._id || activeArtifact.id),
                                                 resourceTitle: activeArtifact.title
                                               })
                                             });
                                             refreshFeedbackPackages(activeArtifact);
                                           }}
                                           className="text-[10px] font-black text-slate-500 hover:text-slate-700"
                                         >
                                           Close
                                         </button>
                                       )}
                                     </div>
                                   </div>
                                 ))}
                               </div>
                             )}
                           </div>
                         )}
                       </>
                     );
                   })()}
                 </div>
               )}
               </section>
             )}
             {('file' in activeArtifact) ? (
               <WikiAssetDisplay
                 asset={activeArtifact as WikiAsset}
                 bundles={bundles}
                 applications={applications}
                 sheetViewMode={sheetViewMode}
                 onSheetViewModeChange={setSheetViewMode}
                 showSheetDashboards={showSheetDashboards}
                 onSheetDashboardsChange={setShowSheetDashboards}
               />
             ) : (
               <WikiPageDisplay page={activeArtifact as WikiPage} bundles={bundles} applications={applications} />
             )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-20 text-center bg-slate-50/10">
            <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mb-8 border border-slate-100 shadow-xl shadow-slate-200/50"><i className="fas fa-book-open text-slate-100 text-4xl"></i></div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Unified Registry</h3>
            <p className="text-slate-400 font-medium max-w-xs mt-3 leading-relaxed">Select a delivery artifact, blueprint, or document from the navigator to begin review.</p>
          </div>
        )}
      </main>

      {isEditing && activeArtifact && ('slug' in activeArtifact) && (
        <WikiForm id={activeArtifact._id} initialTitle={activeArtifact.title} initialContent={activeArtifact.content} initialSlug={activeArtifact.slug} spaceId={activeArtifact.spaceId} initialBundleId={activeArtifact.bundleId} initialApplicationId={activeArtifact.applicationId} initialDocumentTypeId={activeArtifact.documentTypeId} initialThemeKey={activeArtifact.themeKey} onSaveSuccess={(id) => { setIsEditing(false); refreshRegistry(id); }} onCancel={() => setIsEditing(false)} currentUser={currentUser} bundles={bundles} applications={applications} />
      )}

      {isEditingAsset && activeArtifact && ('file' in activeArtifact) && canEditAssetMarkdown(activeArtifact as WikiAsset) && (
        <WikiAssetMarkdownEditor
          asset={activeArtifact as WikiAsset}
          onSaveSuccess={(id) => { setIsEditingAsset(false); refreshRegistry(id); }}
          onCancel={() => setIsEditingAsset(false)}
          currentUser={currentUser}
        />
      )}

      {isCreating && (
        <CreateWikiPageForm
          spaceId={contextualMetadata.spaceId || (spaces[0]?._id || 'default')}
          initialBundleId={contextualMetadata.bundleId}
          initialApplicationId={contextualMetadata.applicationId}
          initialMilestoneId={contextualMetadata.milestoneId}
          allPages={pages}
          currentUser={currentUser}
          onSaveSuccess={(id) => { setIsCreating(false); refreshRegistry(id); }}
          onCancel={() => setIsCreating(false)}
          bundles={bundles}
          applications={applications}
        />
      )}

      {activeArtifact && (
        <CommentsDrawer
          isOpen={isCommentsOpen}
          onClose={() => {
            setIsCommentsOpen(false);
            if (wasSidebarVisible) setIsSidebarVisible(true);
            setWasSidebarVisible(null);
          }}
          resource={{
            type: ('file' in activeArtifact) ? 'wiki.asset' : 'wiki.page',
            id: String(activeArtifact._id || activeArtifact.id),
            title: activeArtifact.title
          }}
          currentUser={currentUser as any}
          onUnreadCountChange={setCommentUnreadCount}
          initialFilter={commentInitialFilter}
          initialCycleId={commentInitialFilter === 'current' ? commentInitialCycleId : null}
          currentReviewCycleId={review?.currentCycleId || null}
          reviewId={review?._id || null}
          suppressNewThread={commentSuppressNewThread}
          initialThreadId={commentInitialThreadId}
        />
      )}

      {isReviewModalOpen && activeArtifact && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/40">
          <div className="bg-white rounded-[2rem] w-full max-w-xl p-8 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-800">Attach Historical Feedback</h3>
              <button onClick={() => setIsReviewModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-600">
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Summary</label>
                <textarea
                  value={feedbackSummary}
                  onChange={(e) => setFeedbackSummary(e.target.value)}
                  className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                  placeholder="Optional summary of historical feedback"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Effective Date (Optional)</label>
                <input
                  type="date"
                  value={feedbackEffectiveAt}
                  onChange={(e) => setFeedbackEffectiveAt(e.target.value)}
                  className="mt-2 w-full border border-slate-200 rounded-xl px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Attachments</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => setFeedbackFiles(Array.from(e.target.files || []))}
                  className="mt-2 w-full text-sm"
                />
                {feedbackFiles.length > 0 && (
                  <div className="mt-2 text-xs text-slate-500">
                    {feedbackFiles.length} file(s) selected.
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => setIsReviewModalOpen(false)}
                className="text-[10px] font-black uppercase tracking-widest text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleFeedbackImport}
                disabled={feedbackFiles.length === 0 || reviewActionLoading}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                {reviewActionLoading ? 'Uploading...' : 'Attach Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isReviewerFeedbackModalOpen && activeArtifact && review?.currentCycleId && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/40">
          <div className="bg-white rounded-[2rem] w-full max-w-xl p-8 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-800">Upload Feedback</h3>
              <button
                onClick={() => {
                  setIsReviewerFeedbackModalOpen(false);
                  setReviewUploadProgress([]);
                }}
                className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 text-slate-400 hover:text-slate-600"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Attachments</label>
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setReviewFeedbackFiles(files);
                    setReviewUploadProgress(files.map((file) => ({
                      name: file.name,
                      progress: 0,
                      status: 'pending'
                    })));
                  }}
                  className="mt-2 w-full text-sm"
                />
                {reviewFeedbackFiles.length > 0 && (
                  <div className="mt-2 text-xs text-slate-500">
                    {reviewFeedbackFiles.length} file(s) selected.
                  </div>
                )}
                {reviewUploadProgress.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      Uploading {reviewUploadProgress.filter((f) => f.status === 'done').length} of {reviewUploadProgress.length}
                    </div>
                    {reviewUploadProgress.map((file) => (
                      <div key={file.name} className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-600">
                          <span className="truncate">{file.name}</span>
                          <span className="ml-3 text-[9px] uppercase tracking-widest text-slate-400">
                            {file.status}
                          </span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full ${file.status === 'error' ? 'bg-red-400' : 'bg-blue-500'}`}
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button
                onClick={() => {
                  setIsReviewerFeedbackModalOpen(false);
                  setReviewUploadProgress([]);
                }}
                className="text-[10px] font-black uppercase tracking-widest text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReviewerUpload(review.currentCycleId)}
                disabled={reviewFeedbackFiles.length === 0 || reviewActionLoading}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                {reviewActionLoading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
      `}} />
    </div>
  );
};

const HierarchyToggle: React.FC<{ label: string; active: boolean; onToggle: (v: boolean) => void }> = ({ label, active, onToggle }) => (
  <button onClick={() => onToggle(!active)} className="flex items-center justify-between group py-1">
     <span className={`text-[11px] font-semibold tracking-tight transition-colors ${active ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
     <div className={`w-7 h-3.5 rounded-full relative transition-all ${active ? 'bg-blue-600' : 'bg-slate-200'}`}>
        <div className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full transition-all ${active ? 'left-4' : 'left-0.5'}`} />
     </div>
  </button>
);

export default Wiki;
