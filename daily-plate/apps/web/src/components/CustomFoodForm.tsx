import { useState } from 'react';
import type { FoodCandidate, NutrientSetDto, Portion, Quantity } from '@daily-plate/contracts';
import { NUTRIENT_KEYS, NUTRIENT_LABELS, NUTRIENT_UNITS, isDecimal, type NutrientKey, type NutrientValue, type Preparation } from '@daily-plate/domain';
import type { UpsertFoodInput } from '../lib/actions.js';

export interface CustomFoodFormProps {
  /** Start from a provider candidate (review/correct) or blank. */
  candidate?: FoodCandidate | undefined;
  initialName?: string | undefined;
  existingFoodId?: string | undefined;
  existingAliases?: string[] | undefined;
  onSave: (input: UpsertFoodInput, defaultQuantity: Quantity) => Promise<void> | void;
  onCancel: () => void;
}

type Basis = 'serving' | 'per100g' | 'per100ml';

interface NutrientField {
  mode: 'value' | 'unknown' | 'less-than' | 'estimate';
  text: string;
}

function fieldFrom(v: NutrientValue): NutrientField {
  switch (v.status) {
    case 'reported':
      return { mode: 'value', text: v.amount };
    case 'estimated':
      return { mode: 'estimate', text: v.amount };
    case 'less-than':
      return { mode: 'less-than', text: v.amount };
    case 'unknown':
      return { mode: 'unknown', text: '' };
  }
}

function valueFrom(f: NutrientField): NutrientValue | 'invalid' {
  if (f.mode === 'unknown') return { status: 'unknown' };
  const text = f.text.trim().replace(',', '.');
  if (!isDecimal(text) || Number(text) < 0) return 'invalid';
  if (f.mode === 'less-than') return Number(text) > 0 ? { status: 'less-than', amount: text } : 'invalid';
  if (f.mode === 'estimate') return { status: 'estimated', amount: text };
  return { status: 'reported', amount: text };
}

/**
 * Label entry. Every nutrient is either a number, "less than", an estimate,
 * or "not on the label" — a blank never becomes zero.
 */
export function CustomFoodForm({ candidate, initialName, existingFoodId, existingAliases, onSave, onCancel }: CustomFoodFormProps) {
  const [name, setName] = useState(candidate?.name ?? initialName ?? '');
  const [brand, setBrand] = useState(candidate?.brand ?? '');
  const [basis, setBasis] = useState<Basis>(candidate?.basis.kind ?? 'serving');
  const [servingText, setServingText] = useState(candidate?.basis.kind === 'serving' ? candidate.basis.servingText : '1 serving');
  const [servingGrams, setServingGrams] = useState(candidate?.basis.kind === 'serving' ? candidate.basis.servingGrams ?? '' : '');
  const [servingMl, setServingMl] = useState(candidate?.basis.kind === 'serving' ? candidate.basis.servingMl ?? '' : '');
  const [preparation, setPreparation] = useState<Preparation>(candidate?.preparation ?? 'unspecified');
  const [portionName, setPortionName] = useState(candidate?.portions[0]?.name ?? (candidate ? '' : 'serving'));
  const [portionSize, setPortionSize] = useState(candidate?.portions[0]?.grams ?? candidate?.portions[0]?.ml ?? '');
  const [fields, setFields] = useState<Record<NutrientKey, NutrientField>>(() => {
    const out = {} as Record<NutrientKey, NutrientField>;
    // A blank label starts as "exact, empty": an empty field is refused at save, never treated as zero.
    for (const k of NUTRIENT_KEYS) out[k] = candidate ? fieldFrom(candidate.nutrients[k]) : { mode: 'value', text: '' };
    return out;
  });
  const [tagAlcohol, setTagAlcohol] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const setField = (k: NutrientKey, patch: Partial<NutrientField>): void => setFields((f) => ({ ...f, [k]: { ...f[k], ...patch } }));

  const submit = async (): Promise<void> => {
    setError(null);
    if (name.trim().length === 0) return setError('Give this food a name.');
    const nutrients = {} as NutrientSetDto;
    for (const k of NUTRIENT_KEYS) {
      const v = valueFrom(fields[k]);
      if (v === 'invalid') return setError(`${NUTRIENT_LABELS[k]}: enter a number, or mark it not on the label.`);
      nutrients[k] = v;
    }
    let basisObj: UpsertFoodInput['version']['basis'];
    const portions: Portion[] = [];
    let defaultQuantity: Quantity;
    if (basis === 'serving') {
      if (servingText.trim().length === 0) return setError('Describe one serving (for example "1 bottle" or "2 scoops").');
      basisObj = { kind: 'serving', servingText: servingText.trim() };
      if (servingGrams.trim()) {
        if (!isDecimal(servingGrams.trim()) || Number(servingGrams) <= 0) return setError('Serving grams must be a number.');
        basisObj.servingGrams = servingGrams.trim();
      }
      if (servingMl.trim()) {
        if (!isDecimal(servingMl.trim()) || Number(servingMl) <= 0) return setError('Serving millilitres must be a number.');
        basisObj.servingMl = servingMl.trim();
      }
      const pName = portionName.trim() || 'serving';
      portions.push({ id: 'serving', name: pName, servings: '1' });
      defaultQuantity = { amount: '1', unit: { kind: 'portion', portionId: 'serving' } };
    } else {
      basisObj = { kind: basis };
      if (portionName.trim() && portionSize.trim()) {
        if (!isDecimal(portionSize.trim()) || Number(portionSize) <= 0) return setError('Portion size must be a number.');
        portions.push(basis === 'per100g' ? { id: 'portion', name: portionName.trim(), grams: portionSize.trim() } : { id: 'portion', name: portionName.trim(), ml: portionSize.trim() });
        defaultQuantity = { amount: '1', unit: { kind: 'portion', portionId: 'portion' } };
      } else {
        defaultQuantity = { amount: '100', unit: basis === 'per100g' ? { kind: 'mass', unit: 'g' } : { kind: 'volume', unit: 'ml' } };
      }
    }
    if (candidate) {
      for (const p of candidate.portions) if (!portions.some((x) => x.id === p.id)) portions.push(p);
    }
    const foodId = existingFoodId ?? crypto.randomUUID();
    const corrected = candidate ? NUTRIENT_KEYS.filter((k) => JSON.stringify(nutrients[k]) !== JSON.stringify(candidate.nutrients[k])) : [];
    const input: UpsertFoodInput = {
      food: { id: foodId, name: name.trim(), aliases: existingAliases ?? [], pin: null, suggestEligible: !tagAlcohol, tags: tagAlcohol ? ['alcohol'] : [], hidden: false },
      version: {
        id: crypto.randomUUID(),
        name: name.trim(),
        ...(brand.trim() ? { brand: brand.trim() } : {}),
        ...(candidate?.barcode ? { barcode: candidate.barcode } : {}),
        preparation,
        basis: basisObj,
        nutrients,
        portions,
        defaultQuantity,
        provenance: candidate
          ? {
              provider: candidate.provider,
              providerId: candidate.providerId,
              fetchedAt: new Date().toISOString(),
              ...(candidate.sourceServingText ? { sourceServingText: candidate.sourceServingText } : {}),
              normalizationVersion: candidate.normalizationVersion,
              attribution: candidate.attribution,
              ...(corrected.length > 0 ? { userCorrected: corrected } : {}),
            }
          : { provider: 'user', fetchedAt: new Date().toISOString(), normalizationVersion: 'user-1' },
      },
    };
    setBusy(true);
    try {
      await onSave(input, defaultQuantity);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
      setBusy(false);
    }
  };

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {candidate?.needsLabelConfirmation && <div className="banner banner-gold">Check total carbohydrate on the label: this source doesn't say whether fiber is included.</div>}
      {candidate?.warnings.filter((w) => !w.includes('include fiber')).map((w) => (
        <div className="banner" key={w}>
          {w}
        </div>
      ))}
      <div className="field">
        <label htmlFor="cf-name">Name</label>
        <input id="cf-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
      </div>
      <div className="field">
        <label htmlFor="cf-brand">Brand (optional)</label>
        <input id="cf-brand" className="input" value={brand} onChange={(e) => setBrand(e.target.value)} autoComplete="off" />
      </div>

      <div className="field">
        <span className="label">The label's numbers are…</span>
        <div className="chips" role="group" aria-label="Nutrition basis">
          {(['serving', 'per100g', 'per100ml'] as Basis[]).map((b) => (
            <button key={b} type="button" className="chip" aria-pressed={basis === b} onClick={() => setBasis(b)}>
              {b === 'serving' ? 'per serving' : b === 'per100g' ? 'per 100 g' : 'per 100 ml'}
            </button>
          ))}
        </div>
      </div>

      {basis === 'serving' ? (
        <>
          <div className="field">
            <label htmlFor="cf-serving">One serving is</label>
            <input id="cf-serving" className="input" value={servingText} onChange={(e) => setServingText(e.target.value)} placeholder="1 bottle, 2 scoops, 1 slice…" />
          </div>
          <div className="row">
            <div className="field grow">
              <label htmlFor="cf-sg">Grams per serving (if known)</label>
              <input id="cf-sg" className="input" inputMode="decimal" value={servingGrams} onChange={(e) => setServingGrams(e.target.value)} />
            </div>
            <div className="field grow">
              <label htmlFor="cf-sm">ml per serving (if known)</label>
              <input id="cf-sm" className="input" inputMode="decimal" value={servingMl} onChange={(e) => setServingMl(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="cf-pn">What do you call one serving?</label>
            <input id="cf-pn" className="input" value={portionName} onChange={(e) => setPortionName(e.target.value)} placeholder="bottle, scoop, slice…" />
          </div>
        </>
      ) : (
        <div className="row">
          <div className="field grow">
            <label htmlFor="cf-pn2">A usual portion (optional)</label>
            <input id="cf-pn2" className="input" value={portionName} onChange={(e) => setPortionName(e.target.value)} placeholder="breast, bowl, can…" />
          </div>
          <div className="field grow">
            <label htmlFor="cf-ps">…is this many {basis === 'per100g' ? 'g' : 'ml'}</label>
            <input id="cf-ps" className="input" inputMode="decimal" value={portionSize} onChange={(e) => setPortionSize(e.target.value)} />
          </div>
        </div>
      )}

      <div className="field">
        <label htmlFor="cf-prep">Preparation</label>
        <select id="cf-prep" className="select" value={preparation} onChange={(e) => setPreparation(e.target.value as Preparation)}>
          <option value="unspecified">Not specified</option>
          <option value="as-sold">As sold / packaged</option>
          <option value="raw">Raw</option>
          <option value="cooked">Cooked</option>
          <option value="dry">Dry</option>
          <option value="prepared">Prepared</option>
          <option value="drained">Drained</option>
          <option value="undrained">Undrained</option>
        </select>
      </div>

      <fieldset style={{ border: 0, padding: 0, margin: 0 }} className="stack-sm">
        <legend className="label" style={{ marginBottom: 6 }}>
          Nutrition per {basis === 'serving' ? 'serving' : basis === 'per100g' ? '100 g' : '100 ml'}
        </legend>
        {NUTRIENT_KEYS.map((k) => (
          <div className="row" key={k}>
            <label htmlFor={`cf-n-${k}`} style={{ width: 92, fontWeight: 650 }}>
              {NUTRIENT_LABELS[k]}
            </label>
            <input
              id={`cf-n-${k}`}
              className="input grow"
              inputMode="decimal"
              disabled={fields[k].mode === 'unknown'}
              value={fields[k].text}
              placeholder={fields[k].mode === 'unknown' ? 'not on the label' : NUTRIENT_UNITS[k]}
              onChange={(e) => setField(k, { text: e.target.value })}
              aria-label={`${NUTRIENT_LABELS[k]} in ${NUTRIENT_UNITS[k]}`}
            />
            <select className="select" style={{ width: 128, paddingRight: 34 }} value={fields[k].mode} onChange={(e) => setField(k, { mode: e.target.value as NutrientField['mode'] })} aria-label={`${NUTRIENT_LABELS[k]} kind`}>
              <option value="value">exact</option>
              <option value="less-than">less than</option>
              <option value="estimate">about</option>
              <option value="unknown">not on label</option>
            </select>
          </div>
        ))}
      </fieldset>

      <label className="row" style={{ cursor: 'pointer' }}>
        <input type="checkbox" checked={tagAlcohol} onChange={(e) => setTagAlcohol(e.target.checked)} style={{ width: 26, height: 26 }} />
        <span className="small">This is an alcoholic drink (never suggested by Ideas)</span>
      </label>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <div className="sheet-actions stack-sm">
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          Save food
        </button>
        <button type="button" className="btn btn-quiet btn-block" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
