import { normalizeFactor } from './stockInsights';

/** Display weights for the published five-pillar model, never inputs to a browser recomputation. */
export const PILLAR_META = [
  { key: 'growth', label: 'Growth', weight: 27.2 },
  { key: 'revisions', label: 'Revisions', weight: 21.7 },
  { key: 'momentum', label: 'Momentum', weight: 21.7 },
  { key: 'valuation', label: 'Valuation', weight: 16.3 },
  { key: 'quality', label: 'Quality', weight: 13.0 },
];

type FactorProps = {
  pillars: Record<string, unknown> | null | undefined;
  scope: 'book' | 'universe' | null | undefined;
  modelVersion: string | null | undefined;
  isEtf?: boolean;
  coverage?: { inputs_present?: unknown; thin_inputs?: unknown } | null;
};

export function FactorBars({ pillars, scope, modelVersion, isEtf, coverage }: FactorProps) {
  if (isEtf) return <p className="sd-analysis-note">ETF — not scored by the equity model.</p>;
  if (!pillars) return <p className="sd-analysis-note">Factor breakdown not published.</p>;
  const label = scope === 'book' ? 'Book' : scope === 'universe' ? 'Universe' : 'Unspecified scope';
  const knownWeights = modelVersion === '2026-09-25-five-pillar';
  const inputs = typeof coverage?.inputs_present === 'number' && Number.isInteger(coverage.inputs_present) && coverage.inputs_present >= 0 ? coverage.inputs_present : null;
  return <section className="sd-factors" data-factor-scope={scope ?? 'unknown'}>
    <h3>{label} factors</h3>
    <p className="sd-analysis-note">Relative model scores · 0–100</p>
    {!scope && <p className="sd-analysis-note">Score scope unavailable.</p>}
    <ul aria-label={`${label} factor scores`}>
      {PILLAR_META.map(factor => {
        const score = normalizeFactor(pillars?.[factor.key]);
        return <li key={factor.key} data-factor-key={factor.key} data-factor-value={score ?? 'unavailable'}>
          <div className="sd-factor-label"><span>{factor.label}</span><strong>{score === null ? 'Unavailable' : score.toLocaleString('en-CA', { maximumFractionDigits: 1 })}</strong></div>
          <div className="sd-factor-track" aria-hidden="true">{score !== null && <span style={{ width: `${score}%` }} />}</div>
          {knownWeights && <small>Weight {factor.weight.toFixed(1)}%</small>}
        </li>;
      })}
    </ul>
    {!knownWeights && <p className="sd-analysis-note">Weights unavailable for this model.</p>}
    <p className="sd-analysis-note">{inputs === null ? 'Input coverage not published' : `${inputs} inputs present`}{coverage?.thin_inputs === true ? ' · Thin inputs reported' : ''}. Missing inputs can receive neutral scores.</p>
    <details className="sd-factor-method"><summary>How to read these scores</summary><p>Relative factor scores, not expected returns or probabilities. The composite also applies analyst-coverage shrinkage; adding these bars does not reproduce it.</p></details>
  </section>;
}
