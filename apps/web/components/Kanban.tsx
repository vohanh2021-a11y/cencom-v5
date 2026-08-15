import * as React from 'react';
import VehicleCard from './VehicleCard';

/**
 * Kanban — 5 cột trạng thái, mỗi cột chứa các VehicleCard.
 */
export default function Kanban({
  cols,
  onCardClick,
}: {
  cols: any[];
  onCardClick: (bks: string) => void;
}) {
  return (
    <div className="kb-cols">
      {(cols || []).map((col) => (
        <div className="kb-col" key={col.key}>
          <h4>
            {col.label}
            <span className="cnt">{col.cards.length}</span>
          </h4>
          {col.cards.map((c: any) => (
            <VehicleCard key={c.bks} card={c} onClick={onCardClick} />
          ))}
          {col.cards.length === 0 ? <div className="kb-empty">Không có</div> : null}
        </div>
      ))}
    </div>
  );
}
