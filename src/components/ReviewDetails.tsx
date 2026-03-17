import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from '../lib/navigation';
import MarkdownRenderer from './MarkdownRenderer';
import { Bundle, ReviewRecord, ReviewCycle } from '../types';

type CycleSummary = {
  cycleId: string;
  number: number;
  status: string;
  requestedAt?: string;
  inReviewAt?: string;
  feedbackSentAt?: string;
  closedAt?: string;
  dueAt?: string;
  reviewers: { userId: string; displayName: string; email?: string }[];
  feedbackAttachmentCount: number;
  hasReviewerNote: boolean;
  hasVendorResponse: boolean;
  reviewCommentThreadCount: number;
  reviewCommentMessageCount?: number;
};

interface ReviewDetailsProps {
  reviewId: string;
  bundles: Bundle[];
}

type NodeKind = 'requested' | 'in_review' | 'feedback_sent' | 'vendor_response' | 'closed';

const ReviewDetails: React.FC<ReviewDetailsProps> = ({ reviewId, bundles }) => {
  const router = useRouter();
  const [review, setReview] = useState<ReviewRecord | null>(null);
  const [cycleSummaries, setCycleSummaries] = useState<CycleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'swimlanes'>('timeline');
  const [expandedCycles, setExpandedCycles] = useState<Set<string>>(new Set());
  const [selectedNode, setSelectedNode] = useState<{ cycleId: string; kind: NodeKind } | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [expandedAttachments, setExpandedAttachments] = useState<Set<string>>(new Set());

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/${encodeURIComponent(reviewId)}/details`);
      const data = await res.json();
      setReview(data?.review || null);
      setCycleSummaries(Array.isArray(data?.cycleSummaries) ? data.cycleSummaries : []);
    } catch {
      setReview(null);
      setCycleSummaries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [reviewId]);

  useEffect(() => {
    if (!cycleSummaries.length) return;
    const latest = [...cycleSummaries].sort((a, b) => b.number - a.number)[0];
    if (latest) {
      setExpandedCycles(new Set([latest.cycleId]));
      setSelectedCycleId(latest.cycleId);
    }
  }, [cycleSummaries.length]);

  useEffect(() => {
    if (!selectedCycleId) return;
    setExpandedCycles(new Set([selectedCycleId]));
  }, [selectedCycleId]);

  const cyclesById = useMemo(() => {
    const map = new Map<string, ReviewCycle>();
    (review?.cycles || []).forEach((cycle) => map.set(cycle.cycleId, cycle));
    return map;
  }, [review?.cycles]);

  const sortedSummaries = useMemo(() => {
    return [...cycleSummaries].sort((a, b) => b.number - a.number);
  }, [cycleSummaries]);
  const latestSummary = sortedSummaries[0];
  const filteredSummaries = selectedCycleId
    ? sortedSummaries.filter((summary) => summary.cycleId === selectedCycleId)
    : sortedSummaries;
  const selectedSummary = filteredSummaries[0] || latestSummary;

  const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : '—');
  const bundleName = review?.resource?.bundleId
    ? bundles.find((b) => String(b._id || b.id) === String(review.resource.bundleId))?.name
    : null;

  const getStatusPill = (status?: string) => {
    const base = 'px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest';
    switch (status) {
      case 'requested':
        return `${base} bg-slate-100 text-slate-600`;
      case 'in_review':
        return `${base} bg-blue-100 text-blue-700`;
      case 'feedback_sent':
        return `${base} bg-purple-100 text-purple-700`;
      case 'vendor_addressing':
        return `${base} bg-orange-100 text-orange-700`;
      case 'closed':
        return `${base} bg-emerald-100 text-emerald-700`;
      default:
        return `${base} bg-slate-100 text-slate-500`;
    }
  };
  const getHealthBadge = (status?: string, dueAt?: string) => {
    if (!dueAt) return null;
    const dueTime = new Date(dueAt).getTime();
    const now = Date.now();
    if (Number.isNaN(dueTime)) return null;
    if (dueTime < now) {
      return { label: 'Overdue', className: 'bg-red-100 text-red-700' };
    }
    if (status === 'vendor_addressing') {
      return { label: 'Waiting on vendor', className: 'bg-slate-100 text-slate-600' };
    }
    if (dueTime - now <= 1000 * 60 * 60 * 48) {
      return { label: 'Due soon', className: 'bg-amber-100 text-amber-700' };
    }
    return { label: 'On track', className: 'bg-emerald-100 text-emerald-700' };
  };
  const getAvatarUrl = (name?: string) => {
    if (!name) return 'https://ui-avatars.com/api/?name=User&background=0D8ABC&color=fff';
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0D8ABC&color=fff`;
  };

  const handleOpenResource = () => {
    if (!review?.resource?.type || !review?.resource?.id) return;
    if (review.resource.type.startsWith('wiki.')) {
      router.push(`/?tab=wiki&pageId=${encodeURIComponent(review.resource.id)}`);
    }
  };

  const handleOpenComments = (cycleId: string) => {
    if (!review?.resource?.type || !review?.resource?.id) return;
    if (review.resource.type.startsWith('wiki.')) {
      router.push(`/?comments=1&tab=review&cycleId=${encodeURIComponent(cycleId)}&pageId=${encodeURIComponent(review.resource.id)}&returnToReview=${encodeURIComponent(reviewId)}`);
    }
  };

  const getNodeClass = (kind: NodeKind, isActive: boolean) => {
    if (isActive) return 'border-slate-900 bg-slate-900 text-white';
    switch (kind) {
      case 'requested':
        return 'border-slate-200 bg-slate-100 text-slate-700';
      case 'in_review':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'feedback_sent':
        return 'border-purple-200 bg-purple-50 text-purple-700';
      case 'vendor_response':
        return 'border-amber-200 bg-amber-50 text-amber-700';
      case 'closed':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      default:
        return 'border-slate-200 bg-white text-slate-700';
    }
  };

  const cycleIndex = selectedSummary
    ? sortedSummaries.findIndex((summary) => summary.cycleId === selectedSummary.cycleId)
    : -1;
  const canPrev = cycleIndex >= 0 && cycleIndex < sortedSummaries.length - 1;
  const canNext = cycleIndex > 0;
  const goPrev = () => {
    if (!canPrev) return;
    const next = sortedSummaries[cycleIndex + 1];
    setSelectedCycleId(next.cycleId);
  };
  const goNext = () => {
    if (!canNext) return;
    const next = sortedSummaries[cycleIndex - 1];
    setSelectedCycleId(next.cycleId);
  };
  const toggleAttachments = (cycleId: string) => {
    setExpandedAttachments((prev) => {
      const next = new Set(prev);
      if (next.has(cycleId)) next.delete(cycleId);
      else next.add(cycleId);
      return next;
    });
  };

  const renderDrawer = () => {
    if (!selectedNode) return null;
    const cycle = cyclesById.get(selectedNode.cycleId);
    if (!cycle) return null;
    return (
      <div className="w-full lg:w-[340px] bg-white border border-slate-200 rounded-2xl p-4">
        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Details</div>
        <div className="mt-2 text-sm font-semibold text-slate-800">Cycle #{cycle.number}</div>
        <div className="mt-1 text-xs text-slate-500">{selectedNode.kind.replace(/_/g, ' ')}</div>
        {selectedNode.kind === 'feedback_sent' && (
          <div className="mt-4 space-y-3">
            {cycle.feedbackAttachments?.length ? (
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Attachments <span className="ml-1 text-[9px] font-black text-blue-600">({cycle.feedbackAttachments.length})</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {cycle.feedbackAttachments.map((att) => (
                    <span key={att.assetId} className="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600">
                      {att.filename}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {cycle.reviewerNote?.body ? (
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reviewer Note</div>
                <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <MarkdownRenderer content={cycle.reviewerNote.body} />
                </div>
              </div>
            ) : null}
            <button
              onClick={() => handleOpenComments(cycle.cycleId)}
              className="px-3 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl"
            >
              Open Review Comments
            </button>
          </div>
        )}
        {selectedNode.kind === 'vendor_response' && cycle.vendorResponse?.body && (
          <div className="mt-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vendor Response</div>
            <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <MarkdownRenderer content={cycle.vendorResponse.body} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTimelineCycle = (summary: CycleSummary) => {
    const cycle = cyclesById.get(summary.cycleId);
    if (!cycle) return null;
    const isExpanded = expandedCycles.has(summary.cycleId);
    const toggle = () => {
      setExpandedCycles((prev) => {
        const next = new Set(prev);
        if (next.has(summary.cycleId)) next.delete(summary.cycleId);
        else next.add(summary.cycleId);
        return next;
      });
    };

    const showAllAttachments = expandedAttachments.has(summary.cycleId);
    const attachments = cycle.feedbackAttachments || [];
    const visibleAttachments = showAllAttachments ? attachments : attachments.slice(0, 2);
    const reviewerNames = (summary.reviewers || []).map((r) => r.displayName || r.email || r.userId);

    return (
      <div key={summary.cycleId} className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="w-full flex items-center justify-between">
          <button onClick={toggle} className="text-left">
            <div className="text-sm font-semibold text-slate-800">Cycle #{summary.number}</div>
            <div className={getStatusPill(summary.status)}>{summary.status.replace(/_/g, ' ')}</div>
          </button>
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
            {sortedSummaries.length > 1 && (
              <>
                <button onClick={goPrev} disabled={!canPrev} className={`px-2 py-1 rounded-lg border ${canPrev ? 'border-slate-200 text-slate-600 hover:text-slate-800' : 'border-slate-100 text-slate-300 cursor-not-allowed'}`}>
                  ←
                </button>
                <span>Cycle {summary.number} of {sortedSummaries.length}</span>
                <button onClick={goNext} disabled={!canNext} className={`px-2 py-1 rounded-lg border ${canNext ? 'border-slate-200 text-slate-600 hover:text-slate-800' : 'border-slate-100 text-slate-300 cursor-not-allowed'}`}>
                  →
                </button>
              </>
            )}
            <span>{isExpanded ? 'Collapse' : 'Expand'}</span>
          </div>
        </div>
        {isExpanded && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs text-slate-600">
              <div>Requested: {formatDate(summary.requestedAt)}</div>
              <div>Due: {formatDate(summary.dueAt)}</div>
              <div>Reviewers: {reviewerNames.join(', ') || '—'}</div>
              <div>Attachments: {summary.feedbackAttachmentCount}</div>
            </div>

            <div className="space-y-2">
              {summary.requestedAt && (
                <button onClick={() => setSelectedNode({ cycleId: summary.cycleId, kind: 'requested' })} className="w-full text-left border border-slate-100 rounded-xl p-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={getAvatarUrl(cycle.requestedBy?.displayName || cycle.requestedBy?.email)}
                      alt="Requested by"
                      className="w-6 h-6 rounded-full border border-slate-200"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-700">Requested</div>
                      <div className="text-[9px] text-slate-400">{formatDate(summary.requestedAt)}</div>
                    </div>
                  </div>
                </button>
              )}
              {summary.inReviewAt && (
                <button onClick={() => setSelectedNode({ cycleId: summary.cycleId, kind: 'in_review' })} className="w-full text-left border border-slate-100 rounded-xl p-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={getAvatarUrl(cycle.inReviewBy?.displayName || cycle.inReviewBy?.email)}
                      alt="In review by"
                      className="w-6 h-6 rounded-full border border-slate-200"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-700">In Review</div>
                      <div className="text-[9px] text-slate-400">{formatDate(summary.inReviewAt)}</div>
                    </div>
                  </div>
                </button>
              )}
              {summary.feedbackSentAt && (
                <div className="border border-slate-100 rounded-xl p-2">
                  <button onClick={() => setSelectedNode({ cycleId: summary.cycleId, kind: 'feedback_sent' })} className="w-full text-left">
                    <div className="flex items-center gap-2">
                      <img
                        src={getAvatarUrl(cycle.feedbackSentBy?.displayName || cycle.feedbackSentBy?.email)}
                        alt="Feedback by"
                        className="w-6 h-6 rounded-full border border-slate-200"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-700">Feedback Sent</div>
                        <div className="text-[9px] text-slate-400">{formatDate(summary.feedbackSentAt)}</div>
                      </div>
                    </div>
                  </button>
                  {cycle.reviewerNote?.body && (
                    <div className="mt-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reviewer Note</div>
                      <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <MarkdownRenderer content={cycle.reviewerNote.body} />
                      </div>
                    </div>
                  )}
                  {attachments.length ? (
                    <div className="mt-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Attachments <span className="ml-1 text-[9px] font-black text-blue-600">({attachments.length})</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {visibleAttachments.map((att) => (
                          <button
                            key={att.assetId}
                            onClick={() => router.push(`/?tab=wiki&pageId=${encodeURIComponent(att.assetId)}`)}
                            className="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 hover:bg-blue-100"
                          >
                            {att.filename}
                          </button>
                        ))}
                      </div>
                      {attachments.length > 2 && (
                        <button
                          onClick={() => toggleAttachments(summary.cycleId)}
                          className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                        >
                          {showAllAttachments ? 'Show less' : `Show all (${attachments.length})`}
                        </button>
                      )}
                    </div>
                  ) : null}
                  <div className="mt-3">
                    <button
                      onClick={() => handleOpenComments(summary.cycleId)}
                      className="px-3 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl"
                    >
                      Open Review Comments
                    </button>
                  </div>
                </div>
              )}
              {cycle.vendorResponse?.body && (
                <div className="border border-slate-100 rounded-xl p-2">
                  <button onClick={() => setSelectedNode({ cycleId: summary.cycleId, kind: 'vendor_response' })} className="w-full text-left">
                    <div className="flex items-center gap-2">
                      <img
                        src={getAvatarUrl(cycle.vendorResponse?.submittedBy?.displayName || cycle.vendorResponse?.submittedBy?.email)}
                        alt="Vendor response"
                        className="w-6 h-6 rounded-full border border-slate-200"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-700">Vendor Response</div>
                        <div className="text-[9px] text-slate-400">{formatDate(cycle.vendorResponse.submittedAt)}</div>
                      </div>
                    </div>
                  </button>
                  <div className="mt-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <MarkdownRenderer content={cycle.vendorResponse.body} />
                  </div>
                </div>
              )}
              {summary.closedAt && (
                <button onClick={() => setSelectedNode({ cycleId: summary.cycleId, kind: 'closed' })} className="w-full text-left border border-slate-100 rounded-xl p-2">
                  <div className="flex items-center gap-2">
                    <img
                      src={getAvatarUrl(cycle.closedBy?.displayName || cycle.closedBy?.email)}
                      alt="Closed by"
                      className="w-6 h-6 rounded-full border border-slate-200"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-700">Closed</div>
                      <div className="text-[9px] text-slate-400">{formatDate(summary.closedAt)}</div>
                    </div>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSwimlaneCycle = (summary: CycleSummary) => {
    const cycle = cyclesById.get(summary.cycleId);
    if (!cycle) return null;
    const attachments = cycle.feedbackAttachments || [];
    const showAllAttachments = expandedAttachments.has(summary.cycleId);
    const visibleAttachments = showAllAttachments ? attachments : attachments.slice(0, 2);
    const nodes: Array<{ kind: NodeKind; label: string; at?: string }> = [
      { kind: 'requested' as NodeKind, label: 'Requested', at: summary.requestedAt },
      { kind: 'in_review' as NodeKind, label: 'In Review', at: summary.inReviewAt },
      { kind: 'feedback_sent' as NodeKind, label: 'Feedback Sent', at: summary.feedbackSentAt },
      { kind: 'vendor_response' as NodeKind, label: 'Vendor Response', at: cycle.vendorResponse?.submittedAt },
      { kind: 'closed' as NodeKind, label: 'Closed', at: summary.closedAt }
    ];
    const visibleNodes = nodes.filter((node) => Boolean(node.at));
    return (
      <div key={summary.cycleId} className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-800">Cycle #{summary.number}</div>
            <div className={getStatusPill(summary.status)}>{summary.status.replace(/_/g, ' ')}</div>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
            {sortedSummaries.length > 1 && (
              <>
                <button onClick={goPrev} disabled={!canPrev} className={`px-2 py-1 rounded-lg border ${canPrev ? 'border-slate-200 text-slate-600 hover:text-slate-800' : 'border-slate-100 text-slate-300 cursor-not-allowed'}`}>
                  ←
                </button>
                <span>Cycle {summary.number} of {sortedSummaries.length}</span>
                <button onClick={goNext} disabled={!canNext} className={`px-2 py-1 rounded-lg border ${canNext ? 'border-slate-200 text-slate-600 hover:text-slate-800' : 'border-slate-100 text-slate-300 cursor-not-allowed'}`}>
                  →
                </button>
              </>
            )}
            <span>Requested {formatDate(summary.requestedAt)}</span>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center gap-2 overflow-x-auto">
            {visibleNodes.map((node, index) => (
              <React.Fragment key={node.kind}>
                <button
                  onClick={() => setSelectedNode({ cycleId: summary.cycleId, kind: node.kind })}
                  className={`min-w-[120px] border rounded-xl px-3 py-2 text-left ${getNodeClass(node.kind, selectedNode?.cycleId === summary.cycleId && selectedNode?.kind === node.kind)}`}
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={getAvatarUrl(
                        node.kind === 'requested' ? cycle.requestedBy?.displayName || cycle.requestedBy?.email :
                        node.kind === 'in_review' ? cycle.inReviewBy?.displayName || cycle.inReviewBy?.email :
                        node.kind === 'feedback_sent' ? cycle.feedbackSentBy?.displayName || cycle.feedbackSentBy?.email :
                        node.kind === 'vendor_response' ? cycle.vendorResponse?.submittedBy?.displayName || cycle.vendorResponse?.submittedBy?.email :
                        cycle.closedBy?.displayName || cycle.closedBy?.email
                      )}
                      alt="Actor"
                      className="w-5 h-5 rounded-full border border-slate-200"
                    />
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest">{node.label}</div>
                      <div className="text-[9px] text-slate-400">{formatDate(node.at)}</div>
                    </div>
                  </div>
                </button>
                {index < nodes.length - 1 && <div className="h-px w-6 bg-slate-200"></div>}
              </React.Fragment>
            ))}
          </div>
          {selectedNode?.cycleId === summary.cycleId && (
            <div className="mt-4 border border-slate-100 rounded-xl p-3">
              {selectedNode.kind === 'feedback_sent' && (
                <>
                  {cycle.reviewerNote?.body && (
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reviewer Note</div>
                      <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                        <MarkdownRenderer content={cycle.reviewerNote.body} />
                      </div>
                    </div>
                  )}
                  {attachments.length ? (
                    <div className="mt-3">
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Attachments <span className="ml-1 text-[9px] font-black text-blue-600">({attachments.length})</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {visibleAttachments.map((att) => (
                          <button
                            key={att.assetId}
                            onClick={() => router.push(`/?tab=wiki&pageId=${encodeURIComponent(att.assetId)}`)}
                            className="px-2 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 hover:bg-blue-100"
                          >
                            {att.filename}
                          </button>
                        ))}
                      </div>
                      {attachments.length > 2 && (
                        <button
                          onClick={() => toggleAttachments(summary.cycleId)}
                          className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                        >
                          {showAllAttachments ? 'Show less' : `Show all (${attachments.length})`}
                        </button>
                      )}
                    </div>
                  ) : null}
                  <div className="mt-3">
                    <button
                      onClick={() => handleOpenComments(summary.cycleId)}
                      className="px-3 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl"
                    >
                      Open Review Comments
                    </button>
                  </div>
                </>
              )}
              {selectedNode.kind === 'vendor_response' && cycle.vendorResponse?.body && (
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vendor Response</div>
                  <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                    <MarkdownRenderer content={cycle.vendorResponse.body} />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-12 max-w-6xl mx-auto animate-fadeIn">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Activities / Reviews</div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{review?.resource?.title || 'Review Details'}</h2>
          <div className="text-xs text-slate-500 mt-2">
            {bundleName ? `Bundle ${bundleName}` : review?.resource?.bundleId ? `Bundle ${review.resource.bundleId}` : 'No bundle'} · Review {review?.status || '—'} · {review?.cycles?.length || 0} cycles
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/activities/reviews')} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl">
            Back to Reviews
          </button>
          <button onClick={handleOpenResource} className="px-4 py-2 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl">
            Open Resource
          </button>
        </div>
      </header>

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
            activeTab === 'timeline' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'
          }`}
        >
          Timeline
        </button>
        <button
          onClick={() => setActiveTab('swimlanes')}
          className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
            activeTab === 'swimlanes' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'
          }`}
        >
          Swimlanes
        </button>
      </div>

      {selectedSummary && (
        <div className="mb-6 bg-white border border-slate-200 rounded-2xl px-4 py-3 flex flex-wrap gap-4 text-xs text-slate-600">
          <div className={getStatusPill(selectedSummary.status)}>{selectedSummary.status.replace(/_/g, ' ')}</div>
          <div>Cycle #{selectedSummary.number}</div>
          <div>Reviewers: {(selectedSummary.reviewers || []).map((r) => r.displayName || r.email || r.userId).join(', ') || '—'}</div>
          <div>Requested: {formatDate(selectedSummary.requestedAt)}</div>
          <div>Due: {formatDate(selectedSummary.dueAt)}</div>
          {(() => {
            const health = getHealthBadge(selectedSummary.status, selectedSummary.dueAt);
            if (!health) return null;
            return (
              <div className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${health.className}`}>
                {health.label}
              </div>
            );
          })()}
        </div>
      )}

      {loading && <div className="text-sm text-slate-400">Loading review details...</div>}
      {!loading && !review && <div className="text-sm text-slate-400">Review not found.</div>}
      {!loading && review && (
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-4">
            {activeTab === 'timeline' && filteredSummaries.map(renderTimelineCycle)}
            {activeTab === 'swimlanes' && filteredSummaries.map(renderSwimlaneCycle)}
          </div>
          {activeTab === 'timeline' && renderDrawer()}
        </div>
      )}
    </div>
  );
};

export default ReviewDetails;
