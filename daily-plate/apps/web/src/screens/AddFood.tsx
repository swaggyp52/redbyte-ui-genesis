import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Food, FoodCandidate, FoodVersion, MealSlot, Quantity, SavedMeal } from '@daily-plate/contracts';
import { defaultMealSlot, parsePhrase, rankLocalFoods, type ParsedPhrase } from '@daily-plate/domain';
import { useApp } from '../lib/store.js';
import { addDraftEntry, addFoodEntry, candidateToFoodInput, deleteEntry, updateEntry, upsertFood, withdrawIfUnsent, type UpsertFoodInput } from '../lib/actions.js';
import { buildDayView, recentFoods, suggestionsAroundNow } from '../lib/selectors.js';
import { basisLabel, dayTitle } from '../lib/format.js';
import { OfflineError } from '../lib/api.js';
import { quantityForPhrase } from '../lib/quantities.js';
import { PortionSheet } from '../components/PortionSheet.js';
import { CustomFoodForm } from '../components/CustomFoodForm.js';
import { BarcodeScanner } from '../components/BarcodeScanner.js';
import { MealLogSheet } from '../components/MealLogSheet.js';
import { Sheet } from '../components/Sheet.js';

type Panel =
  | { kind: 'none' }
  | { kind: 'portion'; version: FoodVersion; food?: Food | undefined; initialQuantity?: Quantity | undefined; hint?: string | undefined }
  /** A database result: identity + amount first; the label form is a secondary action. */
  | { kind: 'candidate'; candidate: FoodCandidate; loadingDetails: boolean }
  | { kind: 'candidate-label'; candidate: FoodCandidate }
  | { kind: 'custom'; initialName?: string | undefined; barcode?: string | undefined }
  | { kind: 'scan' }
  | { kind: 'choose-local'; foods: Food[]; reason: string }
  | { kind: 'meal'; meal: SavedMeal }
  | { kind: 'draft'; text: string };

interface OnlineState {
  status: 'idle' | 'loading' | 'loading-more' | 'ok' | 'unavailable' | 'throttled' | 'not-configured' | 'skipped';
  candidates: FoodCandidate[];
  query: string;
  page: number;
  hasMore: boolean;
}

const IDLE: OnlineState = { status: 'idle', candidates: [], query: '', page: 0, hasMore: false };

export function AddFood() {
  const app = useApp();
  const { db, api, engine, foods, foodMap, versions, entries, outbox, meals, dismissals, viewDate, today, timeZone, toast, navigate, addIntent, setAddIntent } = app;
  const [text, setText] = useState(addIntent?.query ?? '');
  const [panel, setPanel] = useState<Panel>({ kind: 'none' });
  const [online, setOnline] = useState<OnlineState>(IDLE);
  const [notice, setNotice] = useState<{ text: string; barcode?: string } | null>(null);
  const [addedThisVisit, setAddedThisVisit] = useState(0);
  const queryGen = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resolveEntryId = addIntent?.resolveEntryId;

  const day = app.dayFor(viewDate);
  const view = useMemo(() => buildDayView(viewDate, day, entries, outbox), [viewDate, day, entries, outbox]);
  const parsed: ParsedPhrase = useMemo(() => parsePhrase(text), [text]);
  const slotNow: MealSlot = defaultMealSlot(new Date().getHours());

  // A new query invalidates any online results still in flight.
  useEffect(() => {
    queryGen.current += 1;
    setOnline(IDLE);
  }, [parsed.query]);

  const recentIds = useMemo(() => recentFoods(entries, foodMap, 50).map((f) => f.id), [entries, foodMap]);
  const localResults = useMemo(() => {
    const ranked = rankLocalFoods(
      foods.map((f) => ({ id: f.id, name: f.name, aliases: f.aliases, pinned: Boolean(f.pin), hidden: f.hidden })),
      parsed.query,
      recentIds,
    );
    return ranked.slice(0, 12).map((r) => foodMap.get(r.foodId)).filter((f): f is Food => Boolean(f));
  }, [parsed.query, foods, foodMap, recentIds]);
  const mealResults = useMemo(() => {
    const q = parsed.query.trim().toLowerCase();
    if (!q) return [];
    return meals.filter((m) => !m.deleted && m.name.toLowerCase().includes(q)).slice(0, 3);
  }, [parsed.query, meals]);

  const recents = useMemo(() => recentFoods(entries, foodMap, 6), [entries, foodMap]);
  const aroundNow = useMemo(() => suggestionsAroundNow(entries, foodMap, new Date(), slotNow, dismissals, foods.filter((f) => f.pin).map((f) => f.pin && f.id).filter((x): x is string => Boolean(x))), [entries, foodMap, slotNow, dismissals, foods]);

  const quantityFromPhrase = (version: FoodVersion, food?: Food) => quantityForPhrase(parsed, version, food);

  const openLocal = (food: Food): void => {
    const version = versions.get(food.currentVersionId);
    if (!version) {
      toast("This food's details aren't on this phone yet. Connect once to load them.");
      return;
    }
    const { quantity, hint } = quantityFromPhrase(version, food);
    setPanel({ kind: 'portion', version, food, initialQuantity: quantity, hint });
  };

  const afterAdd = (ids: string[], label: string): void => {
    toast(`Added ${label}`, {
      label: 'Undo',
      run: async () => {
        for (const id of ids) {
          if (!(await withdrawIfUnsent(db, id))) {
            const current = await db.entries.get(id);
            if (current) await deleteEntry(db, current);
          }
        }
        await engine.notifyLocalChange();
      },
    });
    void engine.notifyLocalChange();
    setAddedThisVisit((n) => n + ids.length);
    setPanel({ kind: 'none' });
    setText('');
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
    afterAdd([entry.id], `${label} — ${entry.snapshot?.quantityLabel ?? ''}`);
  };

  const searchOnline = async (page = 1): Promise<void> => {
    const q = parsed.query.trim();
    if (q.length < 2) return;
    const gen = queryGen.current;
    setOnline((o) => ({ ...o, status: page === 1 ? 'loading' : 'loading-more', query: q }));
    try {
      const res = await api.search(q, 'online', page);
      if (gen !== queryGen.current) return; // stale: the query changed while this was in flight
      const fresh = res.results.filter((r) => r.kind === 'candidate').map((r) => (r as { candidate: FoodCandidate }).candidate);
      setOnline((o) => ({ status: res.providerStatus === 'ok' ? 'ok' : res.providerStatus, candidates: page === 1 ? fresh : [...o.candidates, ...fresh.filter((c) => !o.candidates.some((x) => x.providerId === c.providerId))], query: q, page: res.page, hasMore: res.hasMore }));
    } catch (err) {
      if (gen !== queryGen.current) return;
      setOnline((o) => ({ ...o, status: err instanceof OfflineError ? 'unavailable' : 'unavailable', query: q }));
    }
  };

  /** Database result: fetch household portions when the source has them, then go straight to the amount. */
  const openCandidate = async (candidate: FoodCandidate): Promise<void> => {
    setPanel({ kind: 'candidate', candidate, loadingDetails: candidate.hasDetails });
    if (!candidate.hasDetails || candidate.provider !== 'usda') return;
    try {
      const d = await api.details('usda', candidate.providerId);
      setPanel((p) => (p.kind === 'candidate' && p.candidate.providerId === candidate.providerId ? { kind: 'candidate', candidate: d.candidate ?? candidate, loadingDetails: false } : p));
    } catch {
      setPanel((p) => (p.kind === 'candidate' && p.candidate.providerId === candidate.providerId ? { ...p, loadingDetails: false } : p));
    }
  };

  const addCandidate = async (candidate: FoodCandidate, quantity: Quantity, mealSlot: MealSlot): Promise<void> => {
    // Adding a database item saves it as one of her foods (so it is offline next time) and logs it.
    const { food, version } = await upsertFood(db, candidateToFoodInput(candidate));
    await finishAdd(version, quantity, mealSlot, food.name);
  };

  const lookupBarcode = useCallback(
    async (raw: string): Promise<void> => {
      const code = raw.replace(/\D/g, '');
      if (code.length < 6) return;
      setPanel({ kind: 'none' });
      // 1. This phone's saved foods, even offline.
      const localVersions = await db.foodVersions.where('barcode').equals(code).toArray();
      const localFoods = [...new Set(localVersions.map((v) => v.foodId))].map((id) => foodMap.get(id)).filter((f): f is Food => Boolean(f && !f.hidden));
      if (localFoods.length === 1) return openLocal(localFoods[0]!);
      if (localFoods.length > 1) return setPanel({ kind: 'choose-local', foods: localFoods, reason: `More than one of your foods has barcode ${code}.` });
      // 2. The Pi's saved foods, then the product databases.
      setNotice({ text: 'Looking up…' });
      try {
        const res = await api.barcode(code);
        const piFoods = res.local.map((id) => foodMap.get(id)).filter((f): f is Food => Boolean(f));
        if (piFoods.length === 1) {
          setNotice(null);
          return openLocal(piFoods[0]!);
        }
        if (piFoods.length > 1) {
          setNotice(null);
          return setPanel({ kind: 'choose-local', foods: piFoods, reason: `More than one of your foods has barcode ${code}.` });
        }
        if (res.candidate) {
          setNotice(null);
          return void openCandidate(res.candidate);
        }
        setNotice({ text: res.providerStatus === 'not-found' ? `No product found for ${res.barcode}. Add it from its label once and it will be yours next time.` : 'Product lookup is unavailable right now. Your saved foods still work, or add it from its label.', barcode: res.barcode });
      } catch (err) {
        setNotice({ text: err instanceof OfflineError ? "You're offline. Your saved foods still work, or add this from its label." : 'Product lookup is unavailable right now.', barcode: code });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, db, foodMap, versions],
  );

  const saveCustom = async (input: UpsertFoodInput, defaultQuantity: Quantity): Promise<void> => {
    const { food, version } = await upsertFood(db, input);
    void engine.notifyLocalChange();
    const { quantity } = quantityFromPhrase(version, food);
    setPanel({ kind: 'portion', version, food, initialQuantity: parsed.quantity ? quantity : defaultQuantity });
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
  const candidateVersion = useMemo(() => {
    if (panel.kind !== 'candidate') return null;
    const input = candidateToFoodInput(panel.candidate);
    const v: FoodVersion = { ...input.version, foodId: input.food.id, version: 1, createdAt: new Date().toISOString() };
    return v;
  }, [panel]);

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
      {addedThisVisit > 0 && (
        <div className="banner banner-teal" role="status" style={{ marginBottom: 12 }}>
          <div className="grow">
            {addedThisVisit} added to {dayTitle(viewDate, today)}. Add another, or you're done.
          </div>
          <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => navigate('today')}>
            Done
          </button>
        </div>
      )}
      <div className="stack">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            void searchOnline(1);
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
            Add from label
          </button>
        </div>

        {notice && (
          <div className="banner banner-gold" role="status">
            <div className="grow">{notice.text}</div>
            {notice.barcode && notice.text !== 'Looking up…' && (
              <button type="button" className="btn btn-primary" style={{ minHeight: 44 }} onClick={() => { setPanel({ kind: 'custom', barcode: notice.barcode }); setNotice(null); }}>
                Add from label
              </button>
            )}
            {notice.text !== 'Looking up…' && (
              <button type="button" className="btn btn-quiet" style={{ minHeight: 40 }} onClick={() => setNotice(null)}>
                OK
              </button>
            )}
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
          <section aria-label="Results">
            {mealResults.length > 0 && (
              <>
                <h2 className="section-title">Your meals</h2>
                <div className="list" style={{ marginBottom: 14 }}>
                  {mealResults.map((m) => (
                    <button key={m.id} type="button" className="result" onClick={() => setPanel({ kind: 'meal', meal: m })}>
                      <span className="name wrap">{m.name}</span>
                      <span className="meta">{m.items.length} items · tap to add</span>
                      <span className="badge badge-teal">Meal</span>
                    </button>
                  ))}
                </div>
              </>
            )}
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

            <div aria-live="polite">
              {online.status === 'idle' && (
                <button type="button" className="btn btn-secondary btn-block" onClick={() => void searchOnline(1)}>
                  {localResults.length > 0 || mealResults.length > 0 ? 'Search more foods' : `Search for "${parsed.query}"`}
                </button>
              )}
              {online.status === 'loading' && <p className="muted">Searching…</p>}
              {online.status === 'ok' && online.candidates.length === 0 && <div className="empty">No match for "{online.query}". Try a simpler name, or add it from the label.</div>}
              {online.status === 'not-configured' && <div className="banner banner-gold">Online food search isn't set up on your Pi yet. Your saved foods still work; you can add this from its label.</div>}
              {(online.status === 'unavailable' || online.status === 'throttled') && online.candidates.length === 0 && <div className="banner banner-gold">Food search is unavailable right now. Your saved foods still work.</div>}
              {online.candidates.length > 0 && (
                <>
                  <h2 className="section-title" style={{ marginTop: 14 }}>
                    More foods
                  </h2>
                  <div className="list">
                    {online.candidates.map((c) => (
                      <button key={`${c.provider}:${c.providerId}`} type="button" className="result" onClick={() => void openCandidate(c)}>
                        <span className="name wrap">{c.name}</span>
                        <span className="meta wrap">
                          {c.brand ? `${c.brand} · ` : ''}
                          {c.preparation !== 'unspecified' ? `${c.preparation} · ` : ''}
                          {c.basis.kind === 'per100g' ? 'per 100 g' : c.basis.kind === 'per100ml' ? 'per 100 ml' : `per ${c.basis.servingText}`}
                          {c.portions[0] ? ` · ${c.portions[0].name}` : ''}
                        </span>
                        <span className="badge">{c.provider === 'usda' ? 'USDA' : 'Product'}</span>
                      </button>
                    ))}
                  </div>
                  {online.hasMore && online.status !== 'loading-more' && (
                    <button type="button" className="btn btn-secondary btn-block" style={{ marginTop: 10 }} onClick={() => void searchOnline(online.page + 1)}>
                      More results
                    </button>
                  )}
                  {online.status === 'loading-more' && <p className="muted">Loading more…</p>}
                  {(online.status === 'unavailable' || online.status === 'throttled') && <p className="muted small">Couldn't load more right now.</p>}
                </>
              )}
            </div>
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
          notes={panel.hint ? [panel.hint] : undefined}
          onConfirm={(quantity, mealSlot) => finishAdd(panel.version, quantity, mealSlot, panel.version.name)}
          onClose={() => setPanel({ kind: 'none' })}
        />
      )}

      {panel.kind === 'candidate' && candidateVersion && (
        <PortionSheet
          version={candidateVersion}
          dayView={view}
          initialQuantity={quantityFromPhrase(candidateVersion).quantity}
          initialMealSlot={slotNow}
          mode="add"
          notes={[
            panel.loadingDetails ? 'Loading serving sizes…' : `From ${panel.candidate.provider === 'usda' ? 'USDA FoodData Central' : 'the Open Food Facts product database'}.`,
            ...(panel.candidate.needsLabelConfirmation ? ['Carbohydrate may or may not include fiber in this source. Check the label if it matters.'] : []),
            ...panel.candidate.warnings.filter((w) => !w.includes('include fiber')),
          ]}
          secondary={{ label: 'Check or edit the label', run: () => setPanel({ kind: 'candidate-label', candidate: panel.candidate }) }}
          onConfirm={(quantity, mealSlot) => addCandidate(panel.candidate, quantity, mealSlot)}
          onClose={() => setPanel({ kind: 'none' })}
        />
      )}

      {panel.kind === 'candidate-label' && (
        <Sheet title="Check this food" onClose={() => setPanel({ kind: 'candidate', candidate: panel.candidate, loadingDetails: false })}>
          <p className="muted small" style={{ marginBottom: 12 }}>
            Numbers come from the source, not from a lab test of what's on your plate. Correct anything that doesn't match your label; the corrected version is what gets saved.
          </p>
          <CustomFoodForm candidate={panel.candidate} onSave={saveCustom} onCancel={() => setPanel({ kind: 'candidate', candidate: panel.candidate, loadingDetails: false })} />
        </Sheet>
      )}

      {panel.kind === 'custom' && (
        <Sheet title="Add from the label" onClose={() => setPanel({ kind: 'none' })}>
          <CustomFoodForm initialName={panel.initialName} barcode={panel.barcode} onSave={saveCustom} onCancel={() => setPanel({ kind: 'none' })} />
        </Sheet>
      )}

      {panel.kind === 'scan' && (
        <Sheet title="Scan barcode" onClose={() => setPanel({ kind: 'none' })}>
          <BarcodeScanner onDetected={(code) => void lookupBarcode(code)} onManual={(code) => void lookupBarcode(code)} onClose={() => setPanel({ kind: 'none' })} />
        </Sheet>
      )}

      {panel.kind === 'choose-local' && (
        <Sheet title="Which one?" onClose={() => setPanel({ kind: 'none' })}>
          <div className="stack">
            <p className="muted small">{panel.reason}</p>
            <div className="list">
              {panel.foods.map((f) => (
                <FoodRow key={f.id} food={f} version={versions.get(f.currentVersionId)} onOpen={() => openLocal(f)} />
              ))}
            </div>
          </div>
        </Sheet>
      )}

      {panel.kind === 'meal' && <MealLogSheet meal={panel.meal} slot={slotNow} localDate={viewDate} onClose={() => setPanel({ kind: 'none' })} onDone={(n, ids) => afterAdd(ids, `${panel.meal.name} (${n} items)`)} />}

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
