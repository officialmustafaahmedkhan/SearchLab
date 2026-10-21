import React from 'react';
import { StateSnapshot } from '../../types/execution';

interface HashTableViewProps {
  snapshot: StateSnapshot | null;
  keys: string[];
}

export const HashTableView: React.FC<HashTableViewProps> = ({ snapshot, keys: _keys }) => {
  const table: string[][] =
    snapshot?.variables?.finalHashTable ||
    Array.from({ length: 7 }, () => []);

  const currentKey = snapshot?.variables?.currentKey;
  const computedBucket = snapshot?.variables?.computedBucket;

  return (
    <div className="hash-table-container">
      <div className="hash-status-bar">
        <span>
          Current Key: <strong className="text-cyan">{currentKey ?? 'None'}</strong>
        </span>
        <span>
          Bucket Index:{' '}
          <strong className="text-amber">
            {computedBucket !== undefined ? `#${computedBucket}` : '-'}
          </strong>
        </span>
      </div>

      <div className="hash-buckets-list">
        {Array.from({ length: 7 }).map((_, bucketIdx) => {
          const items = table[bucketIdx] || [];
          const isTargetBucket = computedBucket === bucketIdx;

          return (
            <div
              key={bucketIdx}
              className={`hash-bucket-row ${isTargetBucket ? 'bucket-highlight' : ''}`}
            >
              <div className="bucket-header">
                <span className="bucket-index">Bucket #{bucketIdx}</span>
              </div>
              <div className="bucket-chain">
                {items.length === 0 ? (
                  <span className="chain-empty">empty</span>
                ) : (
                  items.map((item, itemIdx) => (
                    <React.Fragment key={itemIdx}>
                      <div className="chain-node">
                        <span className="chain-key">{item}</span>
                      </div>
                      {itemIdx < items.length - 1 && <span className="chain-arrow">→</span>}
                    </React.Fragment>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
