import type { PolicyMapBaseSection, PolicyMapExtensionGroup } from '../lib/analysis-view.js';
import { useLayoutEffect, useRef, useState } from 'react';
import { getFileDisplayPath } from '../lib/format.js';
import { NodeCard } from './NodeCard.js';

interface PolicyMapGraphProps {
  sections: PolicyMapBaseSection[];
  zoom: number;
  expandedBaseIds: Set<string>;
  expandedExtensionIds: Set<string>;
  onToggleBase: (baseId: string) => void;
  onToggleExtension: (extensionId: string) => void;
  onSelectChain: (chainId: string) => void;
}

interface GraphPath {
  id: string;
  d: string;
}

export function PolicyMapGraph({
  sections,
  zoom,
  expandedBaseIds,
  expandedExtensionIds,
  onToggleBase,
  onToggleExtension,
  onSelectChain,
}: PolicyMapGraphProps): JSX.Element {
  return (
    <div className="policy-graph">
      <div className="policy-graph__viewport">
        <div className="policy-graph__content" style={{ transform: `scale(${zoom})` }}>
          {sections.map((section) => (
            <PolicyMapSection
              key={section.baseFile.id}
              section={section}
              isBaseExpanded={expandedBaseIds.has(section.baseFile.id)}
              expandedExtensionIds={expandedExtensionIds}
              onToggleBase={onToggleBase}
              onToggleExtension={onToggleExtension}
              onSelectChain={onSelectChain}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PolicyMapSectionProps {
  section: PolicyMapBaseSection;
  isBaseExpanded: boolean;
  expandedExtensionIds: Set<string>;
  onToggleBase: (baseId: string) => void;
  onToggleExtension: (extensionId: string) => void;
  onSelectChain: (chainId: string) => void;
}

function PolicyMapSection({
  section,
  isBaseExpanded,
  expandedExtensionIds,
  onToggleBase,
  onToggleExtension,
  onSelectChain,
}: PolicyMapSectionProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [paths, setPaths] = useState<GraphPath[]>([]);
  const nodeRefs = useRef<Record<string, HTMLElement | null>>({});
  const baseIsExpandable = !section.isPlaceholder && section.extensions.length > 0;

  const visibleExtensions = isBaseExpanded && baseIsExpandable ? section.extensions : [];

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const updatePaths = (): void => {
      const nextPaths = buildPaths(
        container,
        section,
        isBaseExpanded,
        expandedExtensionIds,
        nodeRefs.current,
      );
      setPaths(nextPaths);
    };

    updatePaths();

    const observer = new ResizeObserver(() => {
      updatePaths();
    });

    observer.observe(container);
    for (const element of Object.values(nodeRefs.current)) {
      if (element) {
        observer.observe(element);
      }
    }

    window.addEventListener('resize', updatePaths);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePaths);
    };
  }, [section, isBaseExpanded, expandedExtensionIds]);

  function setNodeRef(nodeId: string): (element: HTMLElement | null) => void {
    return (element) => {
      nodeRefs.current[nodeId] = element;
    };
  }

  return (
    <section
      className={`policy-graph-section${isBaseExpanded ? ' policy-graph-section--expanded' : ' policy-graph-section--collapsed'}`}
    >
      <div className="policy-graph-section__canvas" ref={containerRef}>
        <svg className="policy-graph-section__connectors" aria-hidden="true">
          <defs>
            <marker
              id={`policy-graph-arrow-${section.baseFile.id}`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(100, 116, 139, 0.72)" />
            </marker>
          </defs>
          {paths.map((path) => (
            <path
              key={path.id}
              d={path.d}
              className="policy-graph-section__path"
              markerEnd={`url(#policy-graph-arrow-${section.baseFile.id})`}
            />
          ))}
        </svg>

        <div className="policy-graph-section__layout">
          <div className="policy-graph-section__base-column">
            <div ref={setNodeRef(`base:${section.baseFile.id}`)}>
              <NodeCard
                file={section.baseFile}
                showSize={false}
                metaLabel={
                  section.isPlaceholder
                    ? 'Unresolved reference'
                    : `${section.extensions.length} Extension${section.extensions.length === 1 ? '' : 's'}`
                }
                title={
                  section.isPlaceholder
                    ? section.baseFile.parseError ?? section.baseFile.fileName
                    : isBaseExpanded
                      ? `${getFileDisplayPath(section.baseFile)} — Click to collapse extensions`
                      : `${getFileDisplayPath(section.baseFile)} — Click to expand extensions`
                }
                {...(baseIsExpandable ? { expanded: isBaseExpanded } : {})}
                {...(baseIsExpandable ? { onClick: () => onToggleBase(section.baseFile.id) } : {})}
              />
            </div>
          </div>

          <div className="policy-graph-section__extensions">
            {visibleExtensions.map((extension) => (
              <ExtensionBranch
                key={extension.extensionFile.id}
                extension={extension}
                isExpanded={expandedExtensionIds.has(extension.extensionFile.id)}
                onToggleExtension={onToggleExtension}
                onSelectChain={onSelectChain}
                setNodeRef={setNodeRef}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

interface ExtensionBranchProps {
  extension: PolicyMapExtensionGroup;
  isExpanded: boolean;
  onToggleExtension: (extensionId: string) => void;
  onSelectChain: (chainId: string) => void;
  setNodeRef: (nodeId: string) => (element: HTMLElement | null) => void;
}

function ExtensionBranch({
  extension,
  isExpanded,
  onToggleExtension,
  onSelectChain,
  setNodeRef,
}: ExtensionBranchProps): JSX.Element {
  const visibleRelyingParties = isExpanded ? extension.relyingParties : [];

  return (
    <div className="policy-graph-extension">
      <div className="policy-graph-extension__node" ref={setNodeRef(`ext:${extension.extensionFile.id}`)}>
        <NodeCard
          file={extension.extensionFile}
          showSize={false}
          metaLabel={`${extension.relyingParties.length} Relying ${extension.relyingParties.length === 1 ? 'Party' : 'Parties'}`}
          title={
            isExpanded
              ? `${getFileDisplayPath(extension.extensionFile)} — Click to collapse relying party files`
              : `${getFileDisplayPath(extension.extensionFile)} — Click to expand relying party files`
          }
          expanded={isExpanded}
          onClick={() => onToggleExtension(extension.extensionFile.id)}
        />
      </div>

      <div className="policy-graph-extension__rps">
        {visibleRelyingParties.map((entry) => (
          <div className="policy-graph-rp-row" key={entry.chainId}>
            <div className="policy-graph-rp-row__node" ref={setNodeRef(`rp:${entry.chainId}`)}>
              <NodeCard
                file={entry.rpFile}
                showSize={false}
                detailLabel="View Details →"
                title={`${getFileDisplayPath(entry.rpFile)} — Open policy detail`}
                onClick={() => onSelectChain(entry.chainId)}
              />
            </div>
            <div className="policy-graph-rp-row__flow" ref={setNodeRef(`flow:${entry.chainId}`)}>
              <span>{entry.flowName}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildPaths(
  container: HTMLDivElement,
  section: PolicyMapBaseSection,
  isBaseExpanded: boolean,
  expandedExtensionIds: Set<string>,
  refs: Record<string, HTMLElement | null>,
): GraphPath[] {
  const containerRect = container.getBoundingClientRect();
  const baseRect = refs[`base:${section.baseFile.id}`]?.getBoundingClientRect();
  if (!baseRect || !isBaseExpanded || section.isPlaceholder) {
    return [];
  }

  const baseAnchor = getRightAnchor(baseRect, containerRect);
  const paths: GraphPath[] = [];

  for (const extension of section.extensions) {
    const extensionRect = refs[`ext:${extension.extensionFile.id}`]?.getBoundingClientRect();
    if (!extensionRect) {
      continue;
    }

    const extensionAnchor = getLeftAnchor(extensionRect, containerRect);
    paths.push({
      id: `base-${section.baseFile.id}-ext-${extension.extensionFile.id}`,
      d: createConnectorPath(baseAnchor.x, baseAnchor.y, extensionAnchor.x, extensionAnchor.y),
    });

    if (!expandedExtensionIds.has(extension.extensionFile.id)) {
      continue;
    }

    const extensionRightAnchor = getRightAnchor(extensionRect, containerRect);

    for (const entry of extension.relyingParties) {
      const rpRect = refs[`rp:${entry.chainId}`]?.getBoundingClientRect();
      const flowRect = refs[`flow:${entry.chainId}`]?.getBoundingClientRect();
      if (!rpRect || !flowRect) {
        continue;
      }

      const rpAnchor = getLeftAnchor(rpRect, containerRect);
      const rpRightAnchor = getRightAnchor(rpRect, containerRect);
      const flowAnchor = getLeftAnchor(flowRect, containerRect);

      paths.push({
        id: `ext-${extension.extensionFile.id}-rp-${entry.chainId}`,
        d: createConnectorPath(extensionRightAnchor.x, extensionRightAnchor.y, rpAnchor.x, rpAnchor.y),
      });
      paths.push({
        id: `rp-${entry.chainId}-flow`,
        d: createConnectorPath(rpRightAnchor.x, rpRightAnchor.y, flowAnchor.x, flowAnchor.y, 18),
      });
    }
  }

  return paths;
}

function getLeftAnchor(rect: DOMRect, containerRect: DOMRect): { x: number; y: number } {
  return {
    x: rect.left - containerRect.left,
    y: rect.top - containerRect.top + rect.height / 2,
  };
}

function getRightAnchor(rect: DOMRect, containerRect: DOMRect): { x: number; y: number } {
  return {
    x: rect.right - containerRect.left,
    y: rect.top - containerRect.top + rect.height / 2,
  };
}

function createConnectorPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  curveStrength = 28,
): string {
  const midX = startX + Math.max((endX - startX) / 2, curveStrength);
  const controlOffset = Math.min(Math.abs(endY - startY) * 0.35, 32);

  return [
    `M ${startX} ${startY}`,
    `C ${midX} ${startY}, ${midX - controlOffset} ${endY}, ${endX} ${endY}`,
  ].join(' ');
}
