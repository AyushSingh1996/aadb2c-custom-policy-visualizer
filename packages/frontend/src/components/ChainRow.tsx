import type { PolicyChain, PolicyFile } from '@policy-analyzer/shared';
import { ArrowRight } from 'lucide-react';
import { getChainFiles, getChainRelyingPartyCount } from '../lib/analysis-view.js';
import { NodeCard } from './NodeCard.js';

export interface ChainRowProps {
  chain: PolicyChain;
  files: PolicyFile[];
  onSelect: () => void;
}

export function ChainRow({ chain, files, onSelect }: ChainRowProps): JSX.Element {
  const chainFiles = getChainFiles(chain, files);
  const rpCount = getChainRelyingPartyCount(chainFiles);

  return (
    <div className="chain-row">
      <button type="button" className="chain-row__label" onClick={onSelect}>
        <div className="chain-row__name">{chain.name}</div>
        <div className="chain-row__caption">
          {rpCount} RP{rpCount === 1 ? '' : 's'}
        </div>
      </button>

      <div className="chain-row__graph">
        {chainFiles.map((file, index) => (
          <div className="chain-row__graph-item" key={file.id}>
            <NodeCard file={file} onClick={onSelect} />
            {index < chainFiles.length - 1 ? (
              <div className="chain-row__connector" aria-hidden="true">
                <div className="chain-row__connector-line" />
                <ArrowRight size={14} />
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
