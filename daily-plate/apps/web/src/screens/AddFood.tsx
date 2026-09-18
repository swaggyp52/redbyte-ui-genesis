import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DiaryEntry, Food, FoodCandidate, FoodVersion, MealSlot, Quantity, SearchResponse } from '@daily-plate/contracts';
import { defaultMealSlot, parsePhrase, type ParsedPhrase } from '@daily-plate/domain';
import { useApp } from '../lib/store.js';
import { addDraftEntry, addFoodEntry, deleteEntry, updateEntry, upsertFood, withdrawIfUnsent, type UpsertFoodInput } from '../lib/actions.js';
import { buildDayView, recentFoods, suggestionsAroundNow } from '../lib/selectors.js';
import { basisLabel, dayTitle } from '../lib/format.js';
import { OfflineError } from '../lib/api.js';
import { PortionSheet } from '../components/PortionSheet.js';
import { CustomFoodForm } from '../components/CustomFoodForm.js';
import { BarcodeScanner } from '../components/BarcodeScanner.js';
import { Sheet } from '../components/Sheet.js';

type Panel =
  | { kind: 'none' }
  | { kind: 'portion'; version: FoodVersion; food?: Food | undefined; initialQuantity?: Quantity | undefined }
  | { kind: 'candidate'; candidate: FoodCandidate }
  | { kind: 'custom'; initialName?: string }
  | { kind: 'scan' }
  | { kind: 'draft'; text: string };

interface OnlineState {
  status: 'idle' | 'loading' | SearchResponse['providerStatus'];
  candidates: FoodCandidate[];
  query: string;
}

export function AddFood() {
  const app = useApp();
  const { db, api, engine, foods, foodMap, versions, entries, outbox, meals, dismissals, viewDate, today, timeZone, toast, navigate, addIntent, setAddIntent } = app;
  const [text, setText] = useState(addIntent?.query ?? '');
  const [panel, setPanel] = useState<Panel>({ kind: 'none' });
  const [online, setOnline] = useState<OnlineState>({ status: 'idle', candidates: [], query: '' });
  const [barcodeMsg, setBarcodeMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resolveEntryId = addIntent?.resolveEntryId;

  const day = app.dayFor(viewDate);
  const view = useMemo(() => buildDayView(viewDate, day, entries, outbox), [viewDate, day, entries, outbox]);
  const parsed: ParsedPhrase = useMemo(() => parsePhrase(text), [text]);
  const slotNow: MealSlot = defaultMealSlot(new Date().getHours());

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setOnline({ status: 'idle', candidates: [], query: '' });
  }, [parsed.query]);

  const localResults = useMemo(() => {
    const q = parsed.query.trim().toLowerCase();
    if (q.length === 0) return [];
    const tokens = q.split(/\s+/).filter(Boolean);
    const recent = recentFoods(entries, foodMap, 50).map((f) => f.id);
    const scored: Array<{ food: Food; score: number }> = [];
    for (const food of foods) {
      if (food.hidden) continue;
      const name = food.name.toLowerCase();
      let score = 0;
      if (name === q) score = 100;
      else if (food.aliases.some((a) => a.toLowerCase() === q)) score = 95;
      else if (name.startsWith(q)) score = 80;
      else if (tokens.every((t) => name.includes(t))) score = 60;
      else if (food.aliases.some((a) => tokens.every((t) => a.toLowerCase().includes(t)))) score = 55;
      else if (tokens.some((t) => t.length >= 3 && name.includes(t))) score = 30;
      if (score === 0) continue;
      if (food.pin) score += 20;
      const r = recent.indexOf(food.id);
      if (r >= 0) score += Math.max(0, 15 - r);
      scored.push({ food, score });
    }
    return scored.sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name)).slice(0, 12).map((s) => s.food);
  }, [parsed.query, foods, entries, foodMap]);

  const recents = useMemo(() => recentFoods(entries, foodMap, 6), [entries, foodMap]);
  const aroundNow = useMemo(() => suggestionsAroundNow(entries, foodMap, new Date(), slotNow, dismissals, foods.filter((f) => f.pin).map((f) => f.id)), [entries, foodMap, slotNow, dismissals, foods]);

  const quantityFromPhrase = (version: FoodVersion, food?: Food): Quantity | undefined => {
    const q = parsed.quantity;
    const base = food?.pin?.quantity ?? food?.lastQuantity ?? version.defaultQuantity;
    if (!q) return base;
    switch (q.unit) {
      case 'count':
        return base ? { amount: q.amount, unit: base.unit } : { amount: q.amount, unit: { kind: 'serving' } };
      case 'serving':
        return { amount: q.amount, unit: { kind: 'serving' } };
      case 'g':
      case 'oz':
        return { amount: q.amount, unit: { kind: 'mass', unit: q.unit } };
      case 'ml':
      case 'floz':
        return { amount: q.amount, unit: { kind: 'volume', unit: q.unit } };
    }
  };

  const openLocal = (food: Food): void => {
    const version = versions.get(food.currentVersionId);
    if (!version) {
      toast("This food's details aren't on this phone yet.");
      return;
    }
    setPanel({ kind: 'portion', version, food, initialQuantity: quantityFromPhrase(version, food) });
  };

  const finishAdd = async (version: FoodVersion, quantity: Quantity, mealSlot: MealSlot, label: string): Promise<void> => {
    if (resolveEntryId) {
      const draft = await db.entries.get(resolveEntryId);
      if (draft) {
        await updateEntry(db, draft, { version, quantity, mealSlot });
        setAddIntent(null);
        toast(`Finished: ${label}`);
        void engine.notifyLocalChange();
        navigate('today');
        return;
      }
    }
    const { entry } = await addFoodEntry(db, { version, quantity, mealSlot, localDate: viewDate, timeZone });
    toast(`Added ${label}`, {
      label: 'Undo',
      run: async () => {
        if (!(await withdrawIfUnsent(db, entry.id))) {
          const current = await db.entries.get(entry.id);
          if (current) await deleteEntry(db, current);
        }
        await engine.notifyLocalChange();
      },
    });
    void engine.notifyLocalChange();
    setPanel({ kind: 'none' });
    setText('');
    navigate('today');
  };

  const searchOnline = async (): Promise<void> => {
    const q = parsed.query.trim();
    if (q.length < 2) return;
    setOnline({ status: 'loading', candidates: [], query: q });
    try {
      const res = await api.search(q, 'online');
      setOnline({ status: res.providerStatus, candidates: res.results.filter((r) => r.kind === 'candidate').map((r) => (r as { candidate: FoodCandidate }).candidate), query: q });
    } catch (err) {
      setOnline({ status: err instanceof OfflineError ? 'unavailable' : 'unavailable', candidates: [], query: q });
    }
  };

  const lookupBarcode = useCallback(
    async (code: string): Promise<void> => {
      setBarcodeMsg('Looking up…');
      try {
        const res = await api.barcode(code);
        const localId = res.local[0];
        if (localId && foodMap.get(localId)) {
          setPanel({ kind: 'none' });
          setBarcodeMsg(null);
          openLocal(foodMap.get(localId)!);
          return;
        }
        if (res.candidate) {
          setBarcodeMsg(null);
          setPanel({ kind: 'candidate', candidate: res.candidate });
          return;
        }
        setBarcodeMsg(res.providerStatus === 'not-found' ? `No product found for ${res.barcode}. You can add it from its label.` : 'Product lookup is unavailable right now. Your saved foods still work, or add it from its label.');
      } catch (err) {
        setBarcodeMsg(err instanceof OfflineError ? "You're offline. Your saved foods still work, or add this from its label." : 'Product lookup is unavailable right now.');
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, foodMap, versions],
  );

  const saveCustom = async (input: UpsertFoodInput, defaultQuantity: Quantity): Promise<void> => {
    const { food, version } = await upsertFood(db, input);
    void engine.notifyLocalChange();
    setPanel({ kind: 'portion', version, food, initialQuantity: parsed.quantity ? quantityFromPhrase(version, food) : defaultQuantity });
  };

  const saveDraft = async (draftText: string): Promise<void> => {
    await addDraftEntry(db, { text: draftText, mealSlot: slotNow, localDate: viewDate, timeZone });
    void engine.notifyLocalChange();
    setPanel({ kind: 'none' });
    setText('');
    toast('Saved to finish later');
    navigate('today');
  };

  const showStart = parsed.query.trim().length === 0;

  return (
    <main className="screen" aria-labelledby="add-title">
      <header className="screen-head">
        <h1 id="add-title">Add Food</h1>
        {viewDate !== today && <span className="badge badge-gold">Adding to {dayTitle(viewDate, today)}</span>}
      </header>
      {resolveEntryId && (
        <div className="banner banner-teal" style={{ marginBottom: 12 }}>
          <div className="grow">Finishing an unfinished entry. Pick the food and amount.</div>
          <button type="button" className="btn btn-quiet" style={{ minHeight: 40 }} onClick={() => setAddIntent(null)}>
            Stop
          </button>
        </div>
      )}
      <div className="stack">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            if (localResults[0] && parsed.query.trim()) openLocal(localResults[0]);
            else void searchOnline();
          }}
        >
          <label htmlFor="food-search" className="visually-hidden">
            What did you have?
          </label>
          <input
            id="food-search"
            ref={inputRef}
            className="input input-lg"
            placeholder="What did you have? e.g. 2 eggs"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            enterKeyHint="search"
          />
          {parsed.quantity && (
            <p className="help" style={{ marginTop: 6 }}>
              Amount {parsed.quantity.amount} {parsed.quantity.unit === 'count' ? '' : parsed.quantity.unit === 'floz' ? 'fl oz' : parsed.quantity.unit} · searching "{parsed.query}"
            </p>
          )}
        </form>

        <div className="row">
          <button type="button" className="btn btn-secondary grow" onClick={() => setPanel({ kind: 'scan' })}>
            Scan barcode
          </button>
          <button type="button" className="btn btn-secondary grow" onClick={() => setPanel({ kind: 'custom', ...(parsed.query ? { initialName: parsed.query } : {}) })}>
            Custom food
          </button>
        </div>

        {barcodeMsg && (
          <div className="banner banner-gold" role="status">
            <div className="grow">{barcodeMsg}</div>
            <button type="button" className="btn btn-quiet" style={{ minHeight: 40 }} onClick={() => setBarcodeMsg(null)}>
              OK
            </button>
          </div>
        )}

        {showStart && (
          <>
            {aroundNow.length > 0 && (
              <section aria-label="Often around now">
                <h2 className="section-title">Often around now</h2>
                <div className="list">
                  {aroundNow.map((f) => (
                    <FoodRow key={f.id} food={f} version={versions.get(f.currentVersionId)} onOpen={() => openLocal(f)} />
                  ))}
                </div>
              </section>
            )}
            {recents.length > 0 && (
              <section aria-label="Recent foods">
                <h2 className="section-title">Recent</h2>
                <div className="list">
                  {recents.map((f) => (
                    <FoodRow key={f.id} food={f} version={versions.get(f.currentVersionId)} onOpen={() => openLocal(f)} />
                  ))}
                </div>
              </section>
            )}
            {recents.length === 0 && foods.length === 0 && <div className="empty">Type a food above, scan a barcode, or add one from its label. Everything you add becomes a one-tap food next time.</div>}
          </>
        )}

        {!showStart && (
          <section aria-label="Results" aria-live="polite">
            {localResults.length > 0 && (
              <>
                <h2 className="section-title">Your foods</h2>
                <div className="list" style={{ marginBottom: 14 }}>
                  {localResults.map((f) => (
                    <FoodRow key={f.id} food={f} version={versions.get(f.currentVersionId)} onOpen={() => openLocal(f)} />
                  ))}
                </div>
              </>
            )}
            {meals
              .filter((m) => !m.deleted && m.name.toLowerCase().includes(parsed.query.trim().toLowerCase()))
              .slice(0, 3)
              .map((m) => (
                <div key={m.id} className="banner" style={{ marginBottom: 8 }}>
                  <div className="grow">
                    <b>{m.name}</b> is a saved meal. Add it from Today's Quick add or My Foods.
                  </div>
                </div>
              ))}

            {online.status === 'idle' && (
              <button type="button" className="btn btn-secondary btn-block" onClick={() => void searchOnline()}>
                {localResults.length > 0 ? 'Search more foods online' : `Search online for "${parsed.query}"`}
              </button>
            )}
            {online.status === 'loading' && <p className="muted">Searching…</p>}
            {online.status === 'ok' && online.candidates.length === 0 && <div className="empty">No online match for "{online.query}". Try a simpler name, or add it from the label.</div>}
            {online.status === 'not-configured' && <div className="banner banner-gold">Online food search isn't set up on your Pi yet. Your saved foods still work; you can add this from its label.</div>}
            {(online.status === 'unavailable' || online.status === 'throttled') && <div className="banner banner-gold">Food search is unavailable right now. Your saved foods still work.</div>}
            {online.candidates.length > 0 && (
              <>
                <h2 className="section-title" style={{ marginTop: 14 }}>
                  From USDA
                </h2>
                <div className="list">
                  {online.candidates.map((c) => (
                    <button key={c.providerId} type="button" className="result" onClick={() => setPanel({ kind: 'candidate', candidate: c })}>
                      <span className="name wrap">{c.name}</span>
                      <span className="meta wrap">
                        {c.brand ? `${c.brand} · ` : ''}
                        {c.preparation !== 'unspecified' ? `${c.preparation} · ` : ''}
                        {c.basis.kind === 'per100g' ? 'per 100 g' : c.basis.kind === 'per100ml' ? 'per 100 ml' : `per ${c.basis.servingText}`}
                        {c.portions[0] ? ` · ${c.portions[0].name}` : ''}
                      </span>
                      <span className="badge">USDA</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {online.status !== 'idle' && online.status !== 'loading' && (
              <div className="row" style={{ marginTop: 14 }}>
                <button type="button" className="btn btn-secondary grow" onClick={() => setPanel({ kind: 'custom', initialName: parsed.query })}>
                  Add from label
                </button>
                <button type="button" className="btn btn-quiet grow" onClick={() => setPanel({ kind: 'draft', text })}>
                  Save to finish later
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {panel.kind === 'portion' && (
        <PortionSheet
          version={panel.version}
          food={panel.food}
          dayView={view}
          initialQuantity={panel.initialQuantity}
          initialMealSlot={slotNow}
          mode="add"
          onConfirm={(quantity, mealSlot) => finishAdd(panel.version, quantity, mealSlot, `${panel.version.name}`)}
          onClose={() => setPanel({ kind: 'none' })}
        />
      )}

      {panel.kind === 'candidate' && (
        <Sheet title="Check this food" onClose={() => setPanel({ kind: 'none' })}>
          <p className="muted small" style={{ marginBottom: 12 }}>
            From {panel.candidate.provider === 'usda' ? 'USDA FoodData Central' : 'the Open Food Facts product database'}. Numbers come from the source, not from a lab test of what's on your plate. Correct anything that doesn't match your label.
          </p>
          <CustomFoodForm candidate={panel.candidate} onSave={saveCustom} onCancel={() => setPanel({ kind: 'none' })} />
        </Sheet>
      )}

      {panel.kind === 'custom' && (
        <Sheet title="Add from the label" onClose={() => setPanel({ kind: 'none' })}>
          <CustomFoodForm initialName={panel.initialName} onSave={saveCustom} onCancel={() => setPanel({ kind: 'none' })} />
        </Sheet>
      )}

      {panel.kind === 'scan' && (
        <Sheet title="Scan barcode" onClose={() => setPanel({ kind: 'none' })}>
          <BarcodeScanner onDetected={(code) => void lookupBarcode(code)} onManual={(code) => void lookupBarcode(code)} onClose={() => setPanel({ kind: 'none' })} />
        </Sheet>
      )}

      {panel.kind === 'draft' && (
        <Sheet title="Save to finish later" onClose={() => setPanel({ kind: 'none' })}>
          <div className="stack">
            <p>
              <b className="wrap">{panel.text}</b>
            </p>
            <p className="muted small">It will show on Today as "not finished". It won't count as zero, and you can find the food any time.</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => void saveDraft(panel.text)}>
              Save for later
            </button>
          </div>
        </Sheet>
      )}
    </main>
  );
}

function FoodRow({ food, version, onOpen }: { food: Food; version: FoodVersion | undefined; onOpen: () => void }) {
  const badge = version?.provenance.provider === 'usda' ? 'USDA' : version?.provenance.provider === 'off' ? 'Product' : version?.provenance.provider === 'recipe' ? 'Recipe' : 'Label';
  return (
    <button type="button" className="result" onClick={onOpen}>
      <span className="name wrap">{food.name}</span>
      <span className="meta wrap">
        {version?.brand ? `${version.brand} · ` : ''}
        {version ? basisLabel(version) : ''}
        {food.pin ? ' · pinned' : ''}
      </span>
      <span className="badge">{badge}</span>
    </button>
  );
}

export type { DiaryEntry };
