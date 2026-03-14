import React from 'react';
import { EntityReference, EvidenceItem, RelatedEntitiesMeta } from '../../types/ai';
import StrategicAnswerCard from './StrategicAnswerCard';
import ScenarioPlannerPanel from './ScenarioPlannerPanel';

type StrategicResult = {
  answer: string;
  explanation: string;
  evidence: EvidenceItem[];
  relatedEntities: EntityReference[];
  followUps: string[];
  success: boolean;
  errorMessage?: string;
  warning?: string;
};

type Props = {
  relatedEntitiesMeta?: RelatedEntitiesMeta;
};

const StrategicAdvisorPanel: React.FC<Props> = ({ relatedEntitiesMeta }) => {
  const [question, setQuestion] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [suggestions, setSuggestions] = React.useState<string[]>([]);
  const [result, setResult] = React.useState<StrategicResult | null>(null);

  const loadSuggestions = React.useCallback(async () => {
    try {
      const res = await fetch('/api/ai/strategic-suggestions');
      if (!res.ok) return;
      const data = await res.json();
      if (data?.status === 'success' && Array.isArray(data.suggestions)) {
        setSuggestions(data.suggestions.slice(0, 8));
      }
    } catch {
      // Ignore suggestion fetch failures.
    }
  }, []);

  React.useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions]);

  const askStrategicQuestion = async (seed?: string) => {
    const nextQuestion = String(seed ?? question).trim();
    if (!nextQuestion) return;
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/ai/strategic-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: nextQuestion, options: { useLLM: true } })
      });
      const data = await res.json();
      if (!res.ok || data?.success === false) {
        setError(data?.errorMessage || 'Unable to answer strategic question.');
        return;
      }

      setResult({
        answer: String(data?.answer || '').trim(),
        explanation: String(data?.explanation || '').trim(),
        evidence: Array.isArray(data?.evidence) ? data.evidence : [],
        relatedEntities: Array.isArray(data?.relatedEntities) ? data.relatedEntities : [],
        followUps: Array.isArray(data?.followUps) ? data.followUps : [],
        success: true,
        warning: typeof data?.warning === 'string' ? data.warning : undefined
      });

      if (!seed) setQuestion('');
    } catch {
      setError('Unable to answer strategic question.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <i className="fas fa-compass text-slate-400 text-xs"></i>
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Strategic AI Advisor</h3>
      </div>

      <div className="flex flex-col md:flex-row gap-2">
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask a high-level strategic question about delivery risks, trade-offs, or priorities..."
          className="flex-1 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <button
          onClick={() => askStrategicQuestion()}
          disabled={loading || !question.trim()}
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Analyzing...' : 'Ask'}
        </button>
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((item, idx) => (
            <button
              key={`strategic-suggestion-${idx}`}
              onClick={() => askStrategicQuestion(item)}
              disabled={loading}
              className="px-3 py-1.5 rounded-full border border-slate-300 bg-slate-50 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>
      )}

      {result && (
        <StrategicAnswerCard
          answer={result.answer}
          explanation={result.explanation}
          evidence={result.evidence}
          relatedEntities={result.relatedEntities}
          relatedEntitiesMeta={relatedEntitiesMeta}
          followUps={result.followUps}
          warning={result.warning}
          busy={loading}
          onFollowUp={(nextQuestion) => {
            setQuestion(nextQuestion);
            void askStrategicQuestion(nextQuestion);
          }}
        />
      )}

      <ScenarioPlannerPanel />
    </section>
  );
};

export default StrategicAdvisorPanel;
