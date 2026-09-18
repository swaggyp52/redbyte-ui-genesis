import { useMemo, useRef, useState } from 'react';
import type { DiaryEntry, MealSlot, Quantity, SavedMeal } from '@daily-plate/contracts';
import { DAY_TYPE_LABELS, defaultMealSlot, previousDay, type DayType } from '@daily-plate/domain';
import { useApp } from '../lib/store.js';
import { buildDayView, ideasFromMyFoods, mealOffers, shortcuts, type EntryView, type IdeaView, type Shortcut } from '../lib/selectors.js';
import { addFoodEntry, deleteEntry, dismiss, logMeal, saveMeal, setDayType, updateEntry, withdrawIfUnsent } from '../lib/actions.js';
import { dayTitle, longDate, macroLine, quantityLabel } from '../lib/format.js';
import { MacroRows, SecondaryTotals } from '../components/MacroRows.js';
import { PortionSheet } from '../components/PortionSheet.js';
import { DayPicker } from '../components/DayPicker.js';
import { IdeasSheet } from '../components/IdeasSheet.js';
import { Sheet } from '../components/Sheet.js';
import { PlateMark } from '../components/PlateMark.js';
import { SyncLine } from '../components/SyncLine.js';
import { MealLogSheet, type MealLike } from '../components/MealLogSheet.js';

type SheetState =
  | { kind: 'none' }
  | { kind: 'entry'; entry: DiaryEntry }
  | { kind: 'move'; entry: DiaryEntry }
  | { kind: 'draft'; entry: DiaryEntry }
  | { kind: 'shortcut'; shortcut: Shortcut }
  | { kind: 'meal'; meal: SavedMeal }
  | { kind: 'copy'; meal: MealLike; slot: MealSlot }
  | { kind: 'day' }
  | { kind: 'ideas' }
  | { kind: 'idea'; idea: IdeaView };

export function Today() {
  const app = useApp();
  const { db, engine, entries, outbox, foods, foodMap, versions, meals, dismissals, today, viewDate, setViewDate, timeZone, toast, navigate, setAddIntent } = app;
  const [sheet, setSheet] = useState<SheetState>({ kind: 'none' });
  const busy = useRef(new Set<string>());

  const day = app.dayFor(viewDate);
  const view = useMemo(() => buildDayView(viewDate, day, entries, outbox), [viewDate, day, entries, outbox]);
  const pinned = useMemo(() => shortcuts(foods, versions, meals, 3), [foods, versions, meals]);
  const offers = useMemo(() => mealOffers(entries, foodMap, meals, dismissals), [entries, foodMap, meals, dismissals]);
  const datesWithEntries = useMemo(() => new Set(entries.filter((e) => !e.deleted).map((e) => e.localDate)), [entries]);
  const slotNow: MealSlot = defaultMealSlot(new Date().getHours());

  const afterAdd = (entry: DiaryEntry, label: string): void => {
    toast(`Added ${label}`, {
      label: 'Undo',
      run: async () => {
        const withdrawn = await withdrawIfUnsent(db, entry.id);
        if (!withdrawn) {
          const current = await db.entries.get(entry.id);
          if (current) await deleteEntry(db, current);
        }
        await engine.notifyLocalChange();
      },
    });
    void engine.notifyLocalChange();
  };

  const afterGroupAdd = (ids: string[], label: string): void => {
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
  };

  const quickAdd = async (s: Shortcut): Promise<void> => {
    if (busy.current.has(s.id)) return; // accidental double-tap while committing
    busy.current.add(s.id);
    try {
      if (s.kind === 'food' && s.version && s.food?.pin) {
        const { entry } = await addFoodEntry(db, { version: s.version, quantity: s.food.pin.quantity, mealSlot: slotNow, localDate: viewDate, timeZone });
        afterAdd(entry, `${s.name} — ${s.detail}`);
      } else if (s.kind === 'meal' && s.meal) {
        const added = await logMeal(db, { meal: s.meal, mealSlot: slotNow, localDate: viewDate, timeZone });
        toast(`Added ${s.name} (${added.length} items)`, {
          label: 'Undo',
          run: async () => {
            for (const e of added) {
              if (!(await withdrawIfUnsent(db, e.id))) {
                const current = await db.entries.get(e.id);
                if (current) await deleteEntry(db, current);
              }
            }
            await engine.notifyLocalChange();
          },
        });
        void engine.notifyLocalChange();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not add that.');
    } finally {
      // Hold through the acknowledgement so a rapid double-tap adds once; a later deliberate tap is a new serving.
      setTimeout(() => busy.current.delete(s.id), 700);
    }
  };

  const changeDayType = async (type: DayType): Promise<void> => {
    if (type === day.dayType) return;
    await setDayType(db, viewDate, type);
    void engine.notifyLocalChange();
  };

  const removeEntry = async (entry: DiaryEntry): Promise<void> => {
    const { undo } = await deleteEntry(db, entry);
    setSheet({ kind: 'none' });
    toast(`Removed ${entry.snapshot?.name ?? entry.draft?.text ?? 'entry'}`, {
      label: 'Undo',
      run: async () => {
        await undo();
        await engine.notifyLocalChange();
      },
    });
    void engine.notifyLocalChange();
  };

  const moveEntry = async (entry: DiaryEntry, localDate: string): Promise<void> => {
    await updateEntry(db, entry, { localDate });
    setSheet({ kind: 'none' });
    toast(`Moved to ${dayTitle(localDate, today)}`);
    void engine.notifyLocalChange();
  };

  const ideas = sheet.kind === 'ideas' ? ideasFromMyFoods(view, foods, versions, meals, dismissals) : null;

  return (
    <main className="screen" aria-labelledby="today-title">
      <header className="screen-head">
        <div className="hero">
          <PlateMark size={48} />
          <div>
            <h1 id="today-title">{dayTitle(viewDate, today)}</h1>
            <button type="button" className="btn btn-quiet" style={{ minHeight: 40, padding: '0 4px', marginLeft: -4 }} onClick={() => setSheet({ kind: 'day' })} aria-label={`Showing ${longDate(viewDate)}. Change day`}>
              {longDate(viewDate)} ▾
            </button>
          </div>
        </div>
      </header>

      <div className="stack">
        <div className="row-between">
          <div className="segmented" role="group" aria-label="Day type">
            {(['rest', 'training'] as DayType[]).map((t) => (
              <button key={t} type="button" aria-pressed={day.dayType === t} onClick={() => void changeDayType(t)}>
                {DAY_TYPE_LABELS[t].replace(' day', '')}
              </button>
            ))}
          </div>
          <SyncLine />
        </div>

        <section className="card" aria-label="Targets">
          <MacroRows view={view} />
          <div style={{ height: 14 }} />
          <SecondaryTotals view={view} />
          {view.provisional && <p className="small muted" style={{ marginTop: 10 }}>Remaining numbers are provisional until every item has its nutrients.</p>}
        </section>

        {pinned.length > 0 && (
          <section aria-label="Pinned shortcuts">
            <h2 className="section-title">Quick add</h2>
            <div className="stack-sm">
              {pinned.map((s) => (
                <div className="shortcut" key={`${s.kind}:${s.id}`}>
                  <div className="grow">
                    <div className="name wrap">{s.name}</div>
                    <div className="detail">{s.detail}</div>
                  </div>
                  <div className="shortcut-actions">
                    <button type="button" className="btn btn-secondary" aria-label={`Change amount for ${s.name}`} onClick={() => setSheet(s.kind === 'meal' && s.meal ? { kind: 'meal', meal: s.meal } : { kind: 'shortcut', shortcut: s })}>
                      Amount
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => void quickAdd(s)} aria-label={`Add ${s.name}, ${s.detail}`}>
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {offers[0] && (
          <div className="banner banner-teal" role="status">
            <div className="grow">
              You've had {offers[0].names.join(' + ')} together on {offers[0].days} days. Save it as a meal?
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ minHeight: 44 }}
              onClick={() => {
                const o = offers[0]!;
                const items = o.foodIds
                  .map((id) => foodMap.get(id))
                  .filter((f): f is NonNullable<typeof f> => Boolean(f))
                  .map((f) => ({ foodId: f.id, foodVersionId: f.currentVersionId, quantity: f.lastQuantity ?? f.pin?.quantity ?? versions.get(f.currentVersionId)?.defaultQuantity ?? { amount: '1', unit: { kind: 'serving' as const } } }));
                void saveMeal(db, { id: crypto.randomUUID(), name: `Usual ${o.mealSlot === 'unassigned' ? 'meal' : o.mealSlot}`, items, pin: null, suggestEligible: true }).then(() => {
                  toast('Saved. Rename it under My Foods.');
                  void engine.notifyLocalChange();
                });
              }}
            >
              Save
            </button>
            <button type="button" className="btn btn-quiet" style={{ minHeight: 44 }} onClick={() => void dismiss(db, offers[0]!.key, 'meal-combo').then(() => engine.notifyLocalChange())}>
              No
            </button>
          </div>
        )}

        <section aria-label="Entries">
          <div className="row-between">
            <h2 className="section-title">{view.entryCount === 0 ? 'Nothing logged yet' : 'Logged'}</h2>
            {view.entryCount > 0 && (
              <button type="button" className="btn btn-quiet" onClick={() => setSheet({ kind: 'ideas' })}>
                Ideas from my foods
              </button>
            )}
          </div>
          {view.entryCount === 0 && (
            <div className="empty stack-sm">
              <p>{viewDate === today ? 'Log what you had, when you have it.' : 'Nothing was recorded for this day.'}</p>
              <button type="button" className="btn btn-primary" onClick={() => navigate('add')}>
                Add food
              </button>
            </div>
          )}
          <div className="stack">
            {view.groups.map((g) => (
              <div key={g.slot}>
                <div className="row-between" style={{ margin: '6px 0 6px 4px' }}>
                  <h3 className="small muted">{g.label}</h3>
                  {viewDate !== today && g.entries.some((ev) => ev.entry.kind === 'food') && (
                    <button
                      type="button"
                      className="btn btn-quiet"
                      style={{ minHeight: 40 }}
                      onClick={() =>
                        setSheet({
                          kind: 'copy',
                          slot: g.slot,
                          meal: {
                            name: `${g.label.toLowerCase()} from ${dayTitle(viewDate, today).toLowerCase()}`,
                            items: g.entries.filter((ev) => ev.entry.kind === 'food' && ev.entry.foodId && ev.entry.foodVersionId && ev.entry.quantity).map((ev) => ({ foodId: ev.entry.foodId!, foodVersionId: ev.entry.foodVersionId!, quantity: ev.entry.quantity! })),
                          },
                        })
                      }
                    >
                      Add this to today
                    </button>
                  )}
                </div>
                <div className="stack-sm">
                  {g.entries.map((ev) => (
                    <EntryRow key={ev.entry.id} ev={ev} onOpen={() => setSheet(ev.entry.kind === 'draft' ? { kind: 'draft', entry: ev.entry } : { kind: 'entry', entry: ev.entry })} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {sheet.kind === 'day' && (
        <DayPicker
          selected={viewDate}
          today={today}
          datesWithEntries={datesWithEntries}
          onSelect={(d) => {
            setViewDate(d);
            if (d === today || d === previousDay(today)) setSheet({ kind: 'none' });
          }}
          onClose={() => setSheet({ kind: 'none' })}
        />
      )}

      {sheet.kind === 'entry' && sheet.entry.foodVersionId && versions.get(sheet.entry.foodVersionId) && (
        <PortionSheet
          version={versions.get(sheet.entry.foodVersionId)!}
          food={sheet.entry.foodId ? foodMap.get(sheet.entry.foodId) : undefined}
          dayView={view}
          initialQuantity={sheet.entry.quantity}
          initialMealSlot={sheet.entry.mealSlot}
          mode="edit"
          entry={sheet.entry}
          onConfirm={async (quantity: Quantity, mealSlot: MealSlot) => {
            await updateEntry(db, sheet.entry, { quantity, mealSlot });
            setSheet({ kind: 'none' });
            toast('Changed');
            void engine.notifyLocalChange();
          }}
          onDelete={() => void removeEntry(sheet.entry)}
          onMove={() => setSheet({ kind: 'move', entry: sheet.entry })}
          onClose={() => setSheet({ kind: 'none' })}
        />
      )}

      {sheet.kind === 'entry' && sheet.entry.foodVersionId && !versions.get(sheet.entry.foodVersionId) && (
        <Sheet title="Entry" onClose={() => setSheet({ kind: 'none' })}>
          <div className="stack">
            <p>This food's details are not on this phone yet. Connect once to load them.</p>
            <button type="button" className="btn btn-danger" onClick={() => void removeEntry(sheet.entry)}>
              Remove entry
            </button>
          </div>
        </Sheet>
      )}

      {sheet.kind === 'move' && (
        <Sheet title="Move to another day" onClose={() => setSheet({ kind: 'none' })}>
          <div className="stack">
            <button type="button" className="btn btn-primary btn-lg" onClick={() => void moveEntry(sheet.entry, previousDay(viewDate))}>
              {previousDay(viewDate) === previousDay(today) ? 'Yesterday' : longDate(previousDay(viewDate))}
            </button>
            {viewDate !== today && (
              <button type="button" className="btn btn-secondary btn-lg" onClick={() => void moveEntry(sheet.entry, today)}>
                Today
              </button>
            )}
          </div>
        </Sheet>
      )}

      {sheet.kind === 'draft' && (
        <Sheet title="Not finished yet" onClose={() => setSheet({ kind: 'none' })}>
          <div className="stack">
            <p>
              <b className="wrap">{sheet.entry.draft?.text}</b>
            </p>
            <p className="muted small">This item is saved without nutrients. It does not count as zero. Find the food to finish it.</p>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => {
                setAddIntent({ resolveEntryId: sheet.entry.id, query: sheet.entry.draft?.text ?? '' });
                setSheet({ kind: 'none' });
                navigate('add');
              }}
            >
              Find this food
            </button>
            <button type="button" className="btn btn-danger" onClick={() => void removeEntry(sheet.entry)}>
              Remove
            </button>
          </div>
        </Sheet>
      )}

      {sheet.kind === 'shortcut' && sheet.shortcut.version && (
        <PortionSheet
          version={sheet.shortcut.version}
          food={sheet.shortcut.food}
          dayView={view}
          initialQuantity={sheet.shortcut.food?.pin?.quantity}
          initialMealSlot={slotNow}
          mode="add"
          onConfirm={async (quantity, mealSlot) => {
            const { entry } = await addFoodEntry(db, { version: sheet.shortcut.version!, quantity, mealSlot, localDate: viewDate, timeZone });
            setSheet({ kind: 'none' });
            afterAdd(entry, `${sheet.shortcut.name} — ${entry.snapshot?.quantityLabel ?? ''}`);
          }}
          onClose={() => setSheet({ kind: 'none' })}
        />
      )}

      {sheet.kind === 'meal' && <MealLogSheet meal={sheet.meal} localDate={viewDate} onClose={() => setSheet({ kind: 'none' })} onDone={(n, ids) => { setSheet({ kind: 'none' }); afterGroupAdd(ids, `${sheet.meal.name} (${n} items)`); }} slot={slotNow} />}
      {sheet.kind === 'copy' && (
        <MealLogSheet
          meal={sheet.meal}
          title={`Add ${sheet.meal.name} to today`}
          localDate={today}
          slot={sheet.slot}
          onClose={() => setSheet({ kind: 'none' })}
          onDone={(n, ids) => {
            setSheet({ kind: 'none' });
            setViewDate(today);
            afterGroupAdd(ids, `${n} item${n === 1 ? '' : 's'} to today`);
          }}
        />
      )}

      {sheet.kind === 'ideas' && ideas && (
        <IdeasSheet
          ideas={ideas.ideas}
          provisional={ideas.provisional}
          onPick={(idea) => setSheet({ kind: 'idea', idea })}
          onHide={(idea) => void dismiss(db, idea.candidateId, 'suggestion').then(() => engine.notifyLocalChange())}
          onClose={() => setSheet({ kind: 'none' })}
        />
      )}

      {sheet.kind === 'idea' && sheet.idea.kind === 'food' && sheet.idea.version && (
        <PortionSheet
          version={sheet.idea.version}
          food={sheet.idea.food}
          dayView={view}
          initialQuantity={sheet.idea.food?.pin?.quantity ?? sheet.idea.food?.lastQuantity ?? sheet.idea.version.defaultQuantity}
          initialMealSlot={slotNow}
          mode="add"
          onConfirm={async (quantity, mealSlot) => {
            const { entry } = await addFoodEntry(db, { version: sheet.idea.version!, quantity, mealSlot, localDate: viewDate, timeZone });
            setSheet({ kind: 'none' });
            afterAdd(entry, `${sheet.idea.name} — ${entry.snapshot?.quantityLabel ?? ''}`);
          }}
          onClose={() => setSheet({ kind: 'none' })}
        />
      )}
      {sheet.kind === 'idea' && sheet.idea.kind === 'meal' && sheet.idea.meal && (
        <MealLogSheet meal={sheet.idea.meal} localDate={viewDate} onClose={() => setSheet({ kind: 'none' })} onDone={(n, ids) => { setSheet({ kind: 'none' }); afterGroupAdd(ids, `${sheet.idea.name} (${n} items)`); }} slot={slotNow} />
      )}
    </main>
  );
}

function EntryRow({ ev, onOpen }: { ev: EntryView; onOpen: () => void }) {
  const { entry } = ev;
  const cls = ['entry', ev.saveState === 'pending' ? 'pending' : '', ev.saveState === 'attention' ? 'attention' : '', entry.kind === 'draft' ? 'draft' : ''].filter(Boolean).join(' ');
  const state = ev.saveState === 'pending' ? 'On this phone — waiting to save' : ev.saveState === 'attention' ? `Needs attention: ${ev.attentionMessage ?? 'something changed elsewhere'}` : null;
  return (
    <button type="button" className={cls} onClick={onOpen} aria-label={`${entry.snapshot?.name ?? entry.draft?.text ?? 'Entry'}${entry.snapshot ? `, ${entry.snapshot.quantityLabel}` : ', not finished'}${state ? `. ${state}` : ''}`}>
      <span className="name wrap">{entry.snapshot?.name ?? entry.draft?.text}</span>
      <span className="qty">{entry.snapshot ? entry.snapshot.quantityLabel : 'Not finished — tap to find this food'}</span>
      {entry.snapshot && (
        <span className="macros">
          <b className="num">{macroLine(entry.snapshot.nutrients)}</b>
        </span>
      )}
      {state && <span className={`state-line${ev.saveState === 'attention' ? ' attention' : ''}`}>{state}</span>}
    </button>
  );
}
