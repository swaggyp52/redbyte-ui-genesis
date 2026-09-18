import { MACRO_KEYS, NUTRIENT_LABELS, formatDisplay } from '@daily-plate/domain';
import { Sheet } from './Sheet.js';
import type { IdeaView } from '../lib/selectors.js';

interface IdeasSheetProps {
  ideas: IdeaView[];
  provisional: boolean;
  onPick: (idea: IdeaView) => void;
  onHide: (idea: IdeaView) => void;
  onClose: () => void;
}

/** Transparent arithmetic from foods she saved. Never advice. */
export function IdeasSheet({ ideas, provisional, onPick, onHide, onClose }: IdeasSheetProps) {
  return (
    <Sheet title="Ideas from my foods" onClose={onClose}>
      <div className="stack">
        {provisional && <div className="banner banner-gold">Some of today's items are missing numbers, so these are rough matches.</div>}
        {ideas.length === 0 && <div className="empty">No saved food fits what's left today. Save foods with full protein, carbs and fat to see ideas here.</div>}
        {ideas.map((idea) => (
          <div className="card stack-sm" key={idea.candidateId}>
            <div className="row-between">
              <div className="grow">
                <div>
                  <b className="wrap">{idea.name}</b>
                </div>
                <div className="small muted">
                  {idea.kind === 'meal' ? 'Saved meal' : `${idea.multiple} × your usual amount`}
                </div>
              </div>
            </div>
            <p className="small">
              Adds about{' '}
              {MACRO_KEYS.map((k, i) => (
                <span key={k}>
                  {i > 0 ? ', ' : ''}
                  {formatDisplay(idea.adds[k], 0)} g {NUTRIENT_LABELS[k].toLowerCase()}
                </span>
              ))}
              .
            </p>
            <p className="small muted">
              Would leave{' '}
              {MACRO_KEYS.map((k, i) => {
                const r = idea.remainingAfter[k];
                const over = Number(r) < 0;
                return (
                  <span key={k}>
                    {i > 0 ? ', ' : ''}
                    {over ? `${formatDisplay(r.replace('-', ''), 0)} g over` : `${formatDisplay(r, 0)} g`} {NUTRIENT_LABELS[k].toLowerCase()}
                  </span>
                );
              })}
              .
            </p>
            <div className="row">
              <button type="button" className="btn btn-primary grow" onClick={() => onPick(idea)}>
                Choose amount
              </button>
              <button type="button" className="btn btn-quiet" onClick={() => onHide(idea)}>
                Don't suggest
              </button>
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
