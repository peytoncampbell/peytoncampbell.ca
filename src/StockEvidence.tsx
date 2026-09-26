import { normalizeDate, normalizeNews } from './stockInsights';
import './StockEvidence.css';

interface PublishedCondition {
  label: string;
  observed: number | null;
  operator: '<' | '<=' | '>=';
  threshold: number | null;
  status: 'met' | 'not_met' | 'unknown' | 'reported';
}
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const nonempty = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim());
const finiteOrNull = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value));
const isCondition = (value: unknown): value is PublishedCondition => {
  const row = object(value);
  return nonempty(row.label) && finiteOrNull(row.observed) && finiteOrNull(row.threshold)
    && ['<', '<=', '>='].includes(row.operator as string) && ['met', 'not_met', 'unknown', 'reported'].includes(row.status as string);
};

export function PublishedCallEvaluation({ evaluation, expectedAsOf, expectedCall }: { evaluation: unknown; expectedAsOf: string; expectedCall: string }) {
  const row = object(evaluation);
  if (!normalizeDate(row.as_of) || row.as_of !== expectedAsOf || !nonempty(row.call) || row.call !== expectedCall
    || !nonempty(row.rule_version) || !nonempty(row.note) || row.streak_verified !== false
    || !Array.isArray(row.conditions) || !row.conditions.length || !row.conditions.every(isCondition)) {
    return <section className="se-evidence" aria-label="Published call evaluation"><p>Detailed conditions not published for this call.</p></section>;
  }
  return <section className="se-evidence" aria-label="Published call evaluation">
    <h3>Published call conditions</h3>
    <p>Published qualifying readings are reported, not verified consecutive weeks. They are not a countdown.</p>
    <ul className="se-conditions">{row.conditions.map((condition, index) => <li key={index}>
      <strong>{condition.label}</strong>
      <p>Observed: {condition.observed ?? 'unavailable'}; condition: {condition.operator} {condition.threshold ?? 'unavailable'}</p>
      <p>Status: {condition.status}</p>
    </li>)}</ul>
    <details className="se-method"><summary>Published rule and disclaimer</summary>
      <p className="se-meta">Rule: {row.rule_version}; source snapshot: <time dateTime={expectedAsOf}>{expectedAsOf}</time>; call: {row.call}</p>
      <p>{row.note}</p>
    </details>
  </section>;
}


export interface NewsRow {
  as_of: string;
  generated_at: string;
  summary: string | null;
  tickers: readonly { ticker: string; read: string; sentiment?: string }[];
  stories: readonly { ticker: string; title: string; url: string; source: string; published: string | null; image: string | null }[];
}

export function StockNewsEvidence({ ticker, rows }: { ticker: string; rows: readonly NewsRow[] }) {
  const summary = [...rows].filter(row => normalizeDate(row.as_of)).sort((a, b) => b.as_of.localeCompare(a.as_of))
    .flatMap(row => row.tickers.filter(item => item.ticker === ticker && typeof item.read === 'string' && item.read.trim()).map(item => ({ read: item.read, date: row.as_of })))[0];
  const articles = normalizeNews(rows.flatMap(row => row.stories.filter(story => story.ticker === ticker)));
  return <section className="se-evidence" aria-label={`${ticker} news and evidence`}>
    <h3>Generated desk summary</h3>
    {summary ? <><p>{summary.read}</p><p className="se-meta">Source snapshot: <time dateTime={summary.date}>{summary.date}</time></p></> : <p>No generated desk summary published for {ticker}.</p>}
    <h3>Cited headlines</h3>
    {!articles.length && <p>No cited articles published for {ticker}.</p>}
    {[true, false].map(dated => {
      const group = articles.filter(article => Boolean(article.published || article.date) === dated);
      return group.length ? <div key={String(dated)}>
        {!dated && <h4>Publication date unavailable</h4>}
        <ul className="se-articles">{group.map((article, index) => <li key={index}>
          {article.url ? <a href={article.url} target="_blank" rel="noopener noreferrer">{article.title}</a> : <span>{article.title}</span>}
          <div className="se-meta">{article.source || 'Source unavailable'}{(article.published || article.date) && <> — <time dateTime={article.published || article.date!}>{article.published || article.date}</time></>}</div>
        </li>)}</ul>
      </div> : null;
    })}
  </section>;
}
