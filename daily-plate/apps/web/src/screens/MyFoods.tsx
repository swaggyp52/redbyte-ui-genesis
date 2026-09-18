import { useMemo, useState } from 'react';
import type { Food, FoodVersion, Quantity, Recipe, SavedMeal, SavedMealItem } from '@daily-plate/contracts';
import { NUTRIENT_KEYS, NUTRIENT_LABELS, isDecimal, valueCopy } from '@daily-plate/domain';
import { useApp } from '../lib/store.js';
import { deleteMeal, deleteRecipe, saveMeal, updateFood, upsertFood, upsertRecipe, type UpsertFoodInput } from '../lib/actions.js';
import { basisLabel, quantityLabel } from '../lib/format.js';
import { Sheet } from '../components/Sheet.js';
import { CustomFoodForm } from '../components/CustomFoodForm.js';

type Tab = 'foods' | 'meals' | 'recipes';
type Panel = { kind: 'none' } | { kind: 'food'; food: Food } | { kind: 'edit-label'; food: Food } | { kind: 'meal'; meal?: SavedMeal } | { kind: 'recipe'; recipe?: Recipe };

export function MyFoods() {
  const { foods, versions, meals, recipes, recipeVersions } = useApp();
  const [tab, setTab] = useState<Tab>('foods');
  const [panel, setPanel] = useState<Panel>({ kind: 'none' });
  const [filter, setFilter] = useState('');

  const visibleFoods = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return foods
      .filter((f) => !f.hidden && versions.get(f.currentVersionId)?.provenance.provider !== 'recipe')
      .filter((f) => q.length === 0 || f.name.toLowerCase().includes(q) || f.aliases.some((a) => a.toLowerCase().includes(q)))
      .sort((a, b) => Number(Boolean(b.pin)) - Number(Boolean(a.pin)) || (a.pin && b.pin ? a.pin.order - b.pin.order : 0) || b.updatedAt.localeCompare(a.updatedAt));
  }, [foods, versions, filter]);

  return (
    <main className="screen" aria-labelledby="foods-title">
      <header className="screen-head">
        <h1 id="foods-title">My Foods</h1>
      </header>
      <div className="stack">
        <div className="segmented" role="group" aria-label="Kind">
          {(['foods', 'meals', 'recipes'] as Tab[]).map((t) => (
            <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>
              {t === 'foods' ? 'Foods' : t === 'meals' ? 'Meals' : 'Recipes'}
            </button>
          ))}
        </div>

        {tab === 'foods' && (
          <>
            <input className="input" placeholder="Find in my foods" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Find in my foods" />
            {visibleFoods.length === 0 && <div className="empty">Foods you add or save from search will live here. Pin your usual ones to put them on Today.</div>}
            <div className="list">
              {visibleFoods.map((f) => {
                const v = versions.get(f.currentVersionId);
                return (
                  <button key={f.id} type="button" className="list-row" onClick={() => setPanel({ kind: 'food', food: f })}>
                    <span>
                      <span className="name wrap">{f.name}</span>
                      <br />
                      <span className="sub">
                        {v?.brand ? `${v.brand} · ` : ''}
                        {v ? basisLabel(v) : ''}
                        {f.aliases.length > 0 ? ` · also "${f.aliases[0]}"` : ''}
                      </span>
                    </span>
                    {f.pin ? <span className="badge badge-teal">Pinned</span> : <span className="badge">{v?.provenance.provider === 'usda' ? 'USDA' : v?.provenance.provider === 'off' ? 'Product' : 'Label'}</span>}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {tab === 'meals' && (
          <>
            <button type="button" className="btn btn-primary" onClick={() => setPanel({ kind: 'meal' })}>
              New meal
            </button>
            {meals.filter((m) => !m.deleted).length === 0 && <div className="empty">A meal is a group of foods you often have together, like "Usual breakfast". Log it in one tap and still untick a part.</div>}
            <div className="list">
              {meals
                .filter((m) => !m.deleted)
                .map((m) => (
                  <button key={m.id} type="button" className="list-row" onClick={() => setPanel({ kind: 'meal', meal: m })}>
                    <span>
                      <span className="name wrap">{m.name}</span>
                      <br />
                      <span className="sub">{m.items.length} items</span>
                    </span>
                    {m.pin && <span className="badge badge-teal">Pinned</span>}
                  </button>
                ))}
            </div>
          </>
        )}

        {tab === 'recipes' && (
          <>
            <button type="button" className="btn btn-primary" onClick={() => setPanel({ kind: 'recipe' })}>
              New recipe
            </button>
            {recipes.filter((r) => !r.deleted).length === 0 && <div className="empty">A recipe is a batch you make and divide, like soup into six bowls. Log a bowl like any other food.</div>}
            <div className="list">
              {recipes
                .filter((r) => !r.deleted)
                .map((r) => {
                  const rv = recipeVersions.find((v) => v.id === r.currentVersionId);
                  return (
                    <button key={r.id} type="button" className="list-row" onClick={() => setPanel({ kind: 'recipe', recipe: r })}>
                      <span>
                        <span className="name wrap">{r.name}</span>
                        <br />
                        <span className="sub">{rv ? `${rv.yieldServings} ${rv.servingName}s · ${rv.ingredients.length} ingredients` : ''}</span>
                      </span>
                      <span className="badge">Recipe</span>
                    </button>
                  );
                })}
            </div>
          </>
        )}
      </div>

      {panel.kind === 'food' && <FoodDetail food={panel.food} onEditLabel={() => setPanel({ kind: 'edit-label', food: panel.food })} onClose={() => setPanel({ kind: 'none' })} />}
      {panel.kind === 'edit-label' && <EditLabel food={panel.food} onClose={() => setPanel({ kind: 'none' })} />}
      {panel.kind === 'meal' && <MealEditor meal={panel.meal} onClose={() => setPanel({ kind: 'none' })} />}
      {panel.kind === 'recipe' && <RecipeEditor recipe={panel.recipe} onClose={() => setPanel({ kind: 'none' })} />}
    </main>
  );
}

function FoodDetail({ food, onEditLabel, onClose }: { food: Food; onEditLabel: () => void; onClose: () => void }) {
  const { db, engine, versions, foods, foodMap, toast } = useApp();
  const live = foodMap.get(food.id) ?? food;
  const version = versions.get(live.currentVersionId);
  const [alias, setAlias] = useState('');
  const [pinAmount, setPinAmount] = useState(live.pin?.quantity.amount ?? live.lastQuantity?.amount ?? version?.defaultQuantity?.amount ?? '1');
  const [pinUnit, setPinUnit] = useState<Quantity['unit']>(live.pin?.quantity.unit ?? live.lastQuantity?.unit ?? version?.defaultQuantity?.unit ?? { kind: 'serving' });
  if (!version) return null;

  const units: Array<{ key: string; label: string; unit: Quantity['unit'] }> = [
    ...version.portions.map((p) => ({ key: `p:${p.id}`, label: p.name, unit: { kind: 'portion' as const, portionId: p.id } })),
    ...(version.basis.kind === 'serving' ? [{ key: 'serving', label: 'serving', unit: { kind: 'serving' as const } }] : []),
    ...(version.basis.kind === 'per100g' || (version.basis.kind === 'serving' && version.basis.servingGrams) ? [{ key: 'g', label: 'g', unit: { kind: 'mass' as const, unit: 'g' as const } }] : []),
    ...(version.basis.kind === 'per100ml' || (version.basis.kind === 'serving' && version.basis.servingMl) ? [{ key: 'ml', label: 'ml', unit: { kind: 'volume' as const, unit: 'ml' as const } }] : []),
  ];
  const unitKey = (u: Quantity['unit']): string => (u.kind === 'portion' ? `p:${u.portionId}` : u.kind === 'serving' ? 'serving' : u.kind === 'mass' ? 'g' : 'ml');

  const save = async (changes: Parameters<typeof updateFood>[2], msg: string): Promise<void> => {
    try {
      await updateFood(db, live, changes);
      toast(msg);
      void engine.notifyLocalChange();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save.');
    }
  };

  const pin = (): void => {
    if (!isDecimal(pinAmount) || Number(pinAmount) <= 0) return toast('Enter an amount greater than zero.');
    const order = live.pin?.order ?? Math.max(-1, ...foods.filter((f) => f.pin).map((f) => f.pin!.order)) + 1;
    void save({ pin: { order, quantity: { amount: pinAmount, unit: pinUnit } } }, 'Pinned to Today');
  };

  return (
    <Sheet title={live.name} onClose={onClose}>
      <div className="stack">
        <p className="muted small wrap">
          {version.brand ? `${version.brand} · ` : ''}
          {basisLabel(version)} · from {version.provenance.provider === 'user' ? 'your label' : version.provenance.provider === 'usda' ? 'USDA' : version.provenance.provider === 'off' ? 'the product database' : 'your recipe'}
          {version.version > 1 ? ` · label version ${version.version}` : ''}
        </p>
        <dl className="nutrients">
          {NUTRIENT_KEYS.map((k) => (
            <div key={k} style={{ display: 'contents' }}>
              <dt>{NUTRIENT_LABELS[k]}</dt>
              <dd>{valueCopy(k, version.nutrients[k])}</dd>
            </div>
          ))}
        </dl>

        <div className="card card-tint stack-sm">
          <h3>{live.pin ? 'Pinned on Today' : 'Pin to Today'}</h3>
          <p className="small muted">A pinned shortcut always adds exactly this amount. It never changes on its own.</p>
          <div className="row">
            <input className="input" style={{ width: 96 }} inputMode="decimal" value={pinAmount} onChange={(e) => setPinAmount(e.target.value)} aria-label="Pinned amount" />
            <select className="select grow" value={unitKey(pinUnit)} onChange={(e) => setPinUnit(units.find((u) => u.key === e.target.value)?.unit ?? pinUnit)} aria-label="Pinned unit">
              {units.map((u) => (
                <option key={u.key} value={u.key}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
          <div className="row">
            <button type="button" className="btn btn-primary grow" onClick={pin}>
              {live.pin ? 'Update pin' : 'Pin'}
            </button>
            {live.pin && (
              <button type="button" className="btn btn-secondary" onClick={() => void save({ pin: null }, 'Unpinned')}>
                Unpin
              </button>
            )}
          </div>
        </div>

        <div className="card card-tint stack-sm">
          <h3>Other names</h3>
          <p className="small muted">Type "my shake" and get this food straight away.</p>
          {live.aliases.length > 0 && (
            <div className="chips">
              {live.aliases.map((a) => (
                <button key={a} type="button" className="chip" onClick={() => void save({ aliases: live.aliases.filter((x) => x !== a) }, 'Removed name')} aria-label={`Remove name ${a}`}>
                  {a} ×
                </button>
              ))}
            </div>
          )}
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              const a = alias.trim();
              if (!a) return;
              void save({ aliases: [...live.aliases.filter((x) => x.toLowerCase() !== a.toLowerCase()), a].slice(0, 10) }, 'Name added');
              setAlias('');
            }}
          >
            <input className="input grow" value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="my shake" aria-label="New name" />
            <button type="submit" className="btn btn-secondary">
              Add
            </button>
          </form>
        </div>

        <label className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={live.suggestEligible && !live.tags.includes('alcohol')} disabled={live.tags.includes('alcohol')} onChange={(e) => void save({ suggestEligible: e.target.checked }, e.target.checked ? 'Can be suggested' : "Won't be suggested")} style={{ width: 26, height: 26 }} />
          <span className="small">Allow in "Ideas from my foods"{live.tags.includes('alcohol') ? ' (never for alcohol)' : ''}</span>
        </label>

        <div className="row">
          <button type="button" className="btn btn-secondary grow" onClick={onEditLabel}>
            Correct the label
          </button>
          <button type="button" className="btn btn-danger" onClick={() => void save({ hidden: true, pin: null }, 'Hidden from your foods').then(onClose)}>
            Hide
          </button>
        </div>
        {version.provenance.attribution && <p className="small muted wrap">{version.provenance.attribution}</p>}
      </div>
    </Sheet>
  );
}

function EditLabel({ food, onClose }: { food: Food; onClose: () => void }) {
  const { db, engine, versions, toast } = useApp();
  const version = versions.get(food.currentVersionId);
  if (!version) return null;
  const candidate = {
    provider: version.provenance.provider === 'usda' || version.provenance.provider === 'off' ? version.provenance.provider : ('usda' as const),
    providerId: version.provenance.providerId ?? '',
    name: version.name,
    ...(version.brand ? { brand: version.brand } : {}),
    ...(version.barcode ? { barcode: version.barcode } : {}),
    preparation: version.preparation,
    basis: version.basis,
    nutrients: version.nutrients,
    portions: version.portions,
    ...(version.provenance.sourceServingText ? { sourceServingText: version.provenance.sourceServingText } : {}),
    attribution: version.provenance.attribution ?? '',
    normalizationVersion: version.provenance.normalizationVersion,
    needsLabelConfirmation: false,
    warnings: [],
    kind: 'branded' as const,
    hasDetails: false,
  };
  const onSave = async (input: UpsertFoodInput): Promise<void> => {
    const fixed: UpsertFoodInput = {
      food: { ...input.food, id: food.id, aliases: food.aliases, pin: food.pin, suggestEligible: food.suggestEligible, tags: input.food.tags.length > 0 ? input.food.tags : food.tags, hidden: false },
      version: version.provenance.provider === 'user' || version.provenance.provider === 'recipe' ? { ...input.version, provenance: { provider: 'user', fetchedAt: new Date().toISOString(), normalizationVersion: 'user-1' } } : input.version,
    };
    await upsertFood(db, fixed);
    toast('Label updated for future use. Past entries keep what you logged.');
    void engine.notifyLocalChange();
    onClose();
  };
  return (
    <Sheet title="Correct the label" onClose={onClose}>
      <p className="muted small" style={{ marginBottom: 12 }}>
        This creates a new label version used from now on. Entries you already logged stay exactly as they were.
      </p>
      <CustomFoodForm candidate={candidate} existingFoodId={food.id} existingAliases={food.aliases} onSave={onSave} onCancel={onClose} />
    </Sheet>
  );
}

function MealEditor({ meal, onClose }: { meal?: SavedMeal | undefined; onClose: () => void }) {
  const { db, engine, foods, versions, meals, toast } = useApp();
  const [name, setName] = useState(meal?.name ?? '');
  const [items, setItems] = useState<SavedMealItem[]>(meal?.items ?? []);
  const [pinned, setPinned] = useState(Boolean(meal?.pin));
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const candidates = foods.filter((f) => !f.hidden && query.trim() && f.name.toLowerCase().includes(query.trim().toLowerCase()) && !items.some((i) => i.foodId === f.id)).slice(0, 6);

  const addItem = (f: Food): void => {
    const v = versions.get(f.currentVersionId);
    if (!v) return;
    const q = f.pin?.quantity ?? f.lastQuantity ?? v.defaultQuantity ?? { amount: '1', unit: { kind: 'serving' as const } };
    setItems([...items, { foodId: f.id, foodVersionId: v.id, quantity: q }]);
    setQuery('');
  };

  const save = async (): Promise<void> => {
    setError(null);
    if (!name.trim()) return setError('Name this meal.');
    if (items.length === 0) return setError('Add at least one food.');
    for (const i of items) if (!isDecimal(i.quantity.amount) || Number(i.quantity.amount) <= 0) return setError('Every amount must be a number above zero.');
    const order = meal?.pin?.order ?? Math.max(-1, ...meals.filter((m) => m.pin).map((m) => m.pin!.order), ...foods.filter((f) => f.pin).map((f) => f.pin!.order)) + 1;
    await saveMeal(db, { id: meal?.id ?? crypto.randomUUID(), name: name.trim(), items, pin: pinned ? { order } : null, suggestEligible: meal?.suggestEligible ?? true });
    toast('Meal saved');
    void engine.notifyLocalChange();
    onClose();
  };

  return (
    <Sheet title={meal ? 'Edit meal' : 'New meal'} onClose={onClose}>
      <div className="stack">
        <div className="field">
          <label htmlFor="meal-name">Name</label>
          <input id="meal-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Usual breakfast" />
        </div>
        <div className="list">
          {items.map((item, idx) => {
            const f = foods.find((x) => x.id === item.foodId);
            const v = versions.get(item.foodVersionId);
            return (
              <div key={item.foodId} className="list-row">
                <span>
                  <span className="name wrap">{f?.name ?? 'Food'}</span>
                  <br />
                  <span className="sub">{v ? quantityLabel(item.quantity, v) : ''}</span>
                </span>
                <span className="row">
                  <input className="input" style={{ width: 80 }} inputMode="decimal" value={item.quantity.amount} aria-label={`Amount of ${f?.name ?? 'food'}`} onChange={(e) => setItems(items.map((it, i) => (i === idx ? { ...it, quantity: { ...it.quantity, amount: e.target.value } } : it)))} />
                  <button type="button" className="btn btn-quiet" onClick={() => setItems(items.filter((_, i) => i !== idx))} aria-label={`Remove ${f?.name ?? 'food'}`}>
                    ×
                  </button>
                </span>
              </div>
            );
          })}
        </div>
        <div className="field">
          <label htmlFor="meal-add">Add a food</label>
          <input id="meal-add" className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type to find in my foods" />
          {candidates.length > 0 && (
            <div className="list">
              {candidates.map((f) => (
                <button key={f.id} type="button" className="list-row" onClick={() => addItem(f)}>
                  <span className="name wrap">{f.name}</span>
                  <span className="badge">Add</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <label className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} style={{ width: 26, height: 26 }} />
          <span>Pin to Today</span>
        </label>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="sheet-actions stack-sm">
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => void save()}>
            Save meal
          </button>
          {meal && (
            <button type="button" className="btn btn-danger btn-block" onClick={() => void deleteMeal(db, meal).then(() => { toast('Meal removed'); void engine.notifyLocalChange(); onClose(); })}>
              Remove meal
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

function RecipeEditor({ recipe, onClose }: { recipe?: Recipe | undefined; onClose: () => void }) {
  const { db, engine, foods, versions, recipeVersions, toast } = useApp();
  const current = recipe ? recipeVersions.find((v) => v.id === recipe.currentVersionId) : undefined;
  const [name, setName] = useState(recipe?.name ?? '');
  const [servingName, setServingName] = useState(current?.servingName ?? 'bowl');
  const [yieldServings, setYieldServings] = useState(current?.yieldServings ?? '6');
  const [ingredients, setIngredients] = useState<Array<{ foodId: string; foodVersionId: string; quantity: Quantity }>>(current?.ingredients.map(({ foodId, foodVersionId, quantity }) => ({ foodId, foodVersionId, quantity })) ?? []);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const candidates = foods.filter((f) => !f.hidden && query.trim() && f.name.toLowerCase().includes(query.trim().toLowerCase()) && versions.get(f.currentVersionId)?.provenance.provider !== 'recipe').slice(0, 6);

  const addIngredient = (f: Food): void => {
    const v = versions.get(f.currentVersionId);
    if (!v) return;
    const q: Quantity = v.basis.kind === 'per100g' ? { amount: '100', unit: { kind: 'mass', unit: 'g' } } : v.basis.kind === 'per100ml' ? { amount: '100', unit: { kind: 'volume', unit: 'ml' } } : (v.defaultQuantity ?? { amount: '1', unit: { kind: 'serving' } });
    setIngredients([...ingredients, { foodId: f.id, foodVersionId: v.id, quantity: q }]);
    setQuery('');
  };

  const save = async (): Promise<void> => {
    setError(null);
    if (!name.trim()) return setError('Name this recipe.');
    if (!isDecimal(yieldServings) || Number(yieldServings) <= 0) return setError('How many servings does the batch make?');
    if (ingredients.length === 0) return setError('Add at least one ingredient.');
    try {
      const r = await upsertRecipe(db, { ...(recipe ? { recipeId: recipe.id } : {}), name: name.trim(), servingName: servingName.trim() || 'serving', yieldServings, ingredients });
      toast(r.version.incomplete.length > 0 ? `Saved. Missing per serving: ${r.version.incomplete.map((k) => NUTRIENT_LABELS[k].toLowerCase()).join(', ')}` : 'Recipe saved');
      void engine.notifyLocalChange();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  };

  return (
    <Sheet title={recipe ? 'Edit recipe' : 'New recipe'} onClose={onClose}>
      <div className="stack">
        {recipe && <div className="banner">Saving creates a new version. Bowls you already logged keep the old numbers.</div>}
        <div className="field">
          <label htmlFor="recipe-name">Name</label>
          <input id="recipe-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Lentil soup" />
        </div>
        <div className="row">
          <div className="field grow">
            <label htmlFor="recipe-yield">Batch makes</label>
            <input id="recipe-yield" className="input" inputMode="decimal" value={yieldServings} onChange={(e) => setYieldServings(e.target.value)} />
          </div>
          <div className="field grow">
            <label htmlFor="recipe-serving">called</label>
            <input id="recipe-serving" className="input" value={servingName} onChange={(e) => setServingName(e.target.value)} placeholder="bowl" />
          </div>
        </div>
        <div className="list">
          {ingredients.map((ing, idx) => {
            const f = foods.find((x) => x.id === ing.foodId);
            const v = versions.get(ing.foodVersionId);
            return (
              <div key={`${ing.foodId}-${idx}`} className="list-row">
                <span>
                  <span className="name wrap">{f?.name ?? 'Food'}</span>
                  <br />
                  <span className="sub">{v ? quantityLabel(ing.quantity, v) : ''}</span>
                </span>
                <span className="row">
                  <input className="input" style={{ width: 80 }} inputMode="decimal" value={ing.quantity.amount} aria-label={`Amount of ${f?.name ?? 'food'}`} onChange={(e) => setIngredients(ingredients.map((it, i) => (i === idx ? { ...it, quantity: { ...it.quantity, amount: e.target.value } } : it)))} />
                  <button type="button" className="btn btn-quiet" onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))} aria-label={`Remove ${f?.name ?? 'food'}`}>
                    ×
                  </button>
                </span>
              </div>
            );
          })}
        </div>
        <div className="field">
          <label htmlFor="recipe-add">Add an ingredient</label>
          <input id="recipe-add" className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type to find in my foods" />
          {candidates.length > 0 && (
            <div className="list">
              {candidates.map((f) => (
                <button key={f.id} type="button" className="list-row" onClick={() => addIngredient(f)}>
                  <span className="name wrap">{f.name}</span>
                  <span className="badge">Add</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="sheet-actions stack-sm">
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => void save()}>
            Save recipe
          </button>
          {recipe && (
            <button type="button" className="btn btn-danger btn-block" onClick={() => void deleteRecipe(db, recipe).then(() => { toast('Recipe removed'); void engine.notifyLocalChange(); onClose(); })}>
              Remove recipe
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}

export type { FoodVersion };
