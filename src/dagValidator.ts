/**
 * DAG Topology Validator using Kahn's Algorithm (Extension Host)
 *
 * Author: Mike Nimer <mikenimer@google.com>
 *
 * Purpose:
 * Headless topological validator for Apache Beam pipelines executed within the VS Code
 * Extension Host. Validates pipeline graphs before code generation or Dataflow execution,
 * catching cyclic dependencies and orphan steps without relying on external Python runtimes.
 *
 * Architectural Decisions:
 * - Direct TypeScript port of Kahn's algorithm matching the webview validator.
 * - Used as a pre-flight security and correctness gate in `handleRegenerateCode` before invoking
 *   the Gemini API, preventing wasted LLM quotas and broken generated pipelines.
 * - Categorizes findings into fatal errors (cycles, orphan/disconnected steps) which block
 *   code generation, and non-fatal warnings (missing sink) which advise the user.
 */

export interface DagNode {
    id: string;
    type?: string;
    data?: {
        label?: string;
        type?: string;
        beam_transform?: string;
        [key: string]: any;
    };
    [key: string]: any;
}

export interface DagEdge {
    id?: string;
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    [key: string]: any;
}

export interface DagValidationResult {
    /** True if the pipeline DAG has no fatal errors (such as cycles) */
    isValid: boolean;
    /** True if one or more cyclic dependencies were detected */
    hasCycles: boolean;
    /** Array of node IDs participating in cycles */
    cycleNodeIds: string[];
    /** Array of edge IDs forming the cycle loop(s) */
    cycleEdgeIds: string[];
    /** Array of cycle path loops */
    cyclePaths: string[][];
    /** Formatted human-readable string representation of the cycle path(s) */
    cyclePathString: string;
    /** Topologically sorted node IDs from root to terminal (empty if cyclic) */
    sortedNodeIds: string[];
    /** Disconnected nodes with zero incoming and zero outgoing edges (when graph size > 1) */
    orphanNodeIds: string[];
    /** Nodes requiring an upstream source (e.g. FhirIO with readResources()) that have no incoming edge */
    missingUpstreamNodeIds: string[];
    /** Source nodes that do not accept upstream input (e.g. FhirIO in searchResources mode) but have an incoming edge */
    invalidUpstreamNodeIds: string[];
    /** Fatal error messages that block pipeline code generation */
    errors: string[];
    /** Non-fatal warning messages for user feedback */
    warnings: string[];
}

/**
 * Validates the topology of a pipeline DAG using Kahn's algorithm.
 *
 * @param nodes List of pipeline nodes
 * @param edges List of pipeline edges
 * @returns Comprehensive validation result containing cycle details, sorted nodes, and warnings
 */
export function validateDagTopology(
    nodes: DagNode[],
    edges: DagEdge[]
): DagValidationResult {
    // Extract and sanitize valid string node IDs
    const validNodes = (nodes || []).filter((n) => n && n.id !== undefined && n.id !== null);
    const nodeIds = validNodes.map((n) => String(n.id));
    const nodeMap = new Map<string, DagNode>();
    validNodes.forEach((n) => nodeMap.set(String(n.id), n));

    // Base case: empty pipeline graph
    if (nodeIds.length === 0) {
        return {
            isValid: true,
            hasCycles: false,
            cycleNodeIds: [],
            cycleEdgeIds: [],
            cyclePaths: [],
            cyclePathString: '',
            sortedNodeIds: [],
            orphanNodeIds: [],
            missingUpstreamNodeIds: [],
            invalidUpstreamNodeIds: [],
            errors: [],
            warnings: [],
        };
    }

    // 1. Build adjacency structures and compute in-degrees
    const inDegree = new Map<string, number>();
    const initialInDegree = new Map<string, number>();
    const outgoingNeighbors = new Map<string, string[]>();
    const edgesByPair = new Map<string, string[]>();

    nodeIds.forEach((id) => {
        inDegree.set(id, 0);
        initialInDegree.set(id, 0);
        outgoingNeighbors.set(id, []);
    });

    (edges || []).forEach((edge) => {
        if (!edge || edge.source === undefined || edge.target === undefined) {
            return;
        }
        const src = String(edge.source);
        const tgt = String(edge.target);

        if (inDegree.has(src) && inDegree.has(tgt)) {
            outgoingNeighbors.get(src)!.push(tgt);
            inDegree.set(tgt, inDegree.get(tgt)! + 1);
            initialInDegree.set(tgt, initialInDegree.get(tgt)! + 1);

            const pairKey = `${src}->${tgt}`;
            if (!edgesByPair.has(pairKey)) {
                edgesByPair.set(pairKey, []);
            }
            if (edge.id) {
                edgesByPair.get(pairKey)!.push(String(edge.id));
            }
        }
    });

    // 2. Initialize Kahn's queue with all zero-in-degree nodes
    const queue: string[] = [];
    nodeIds.forEach((id) => {
        if (inDegree.get(id) === 0) {
            queue.push(id);
        }
    });

    // 3. Process the queue to compute topological sort
    const sortedNodeIds: string[] = [];
    while (queue.length > 0) {
        const curr = queue.shift()!;
        sortedNodeIds.push(curr);

        const neighbors = outgoingNeighbors.get(curr) || [];
        for (const nxt of neighbors) {
            const remainingDegree = inDegree.get(nxt)! - 1;
            inDegree.set(nxt, remainingDegree);
            if (remainingDegree === 0) {
                queue.push(nxt);
            }
        }
    }

    // 4. Check for orphan / disconnected nodes and missing/invalid upstream nodes
    const orphanNodeIds: string[] = [];
    const missingUpstreamNodeIds: string[] = [];
    const invalidUpstreamNodeIds: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    if (nodeIds.length > 1) {
        nodeIds.forEach((id) => {
            const degIn = initialInDegree.get(id) || 0;
            const degOut = (outgoingNeighbors.get(id) || []).length;
            if (degIn === 0 && degOut === 0) {
                orphanNodeIds.push(id);
            }
        });

        if (orphanNodeIds.length > 0) {
            const orphanLabels = orphanNodeIds.map((id) => {
                const node = nodeMap.get(id);
                return node?.data?.label ? `"${node.data.label}" (${id})` : id;
            });
            errors.push(`Orphan node(s) detected: ${orphanLabels.join(', ')}. All steps must be connected into the pipeline.`);
        }
    }

    // 4b. Check FhirIO and DicomIO nodes for required or disallowed upstream connections based on readMode
    validNodes.forEach((node) => {
        const id = String(node.id);
        const isFhirSource =
            node.data?.type === 'SOURCE' &&
            (node.data?.beam_transform === 'FhirIO' || node.data?.label?.includes('FhirIO'));
        const isDicomSource =
            node.data?.type === 'SOURCE' &&
            (node.data?.beam_transform === 'DicomIO' || node.data?.label?.includes('DicomIO'));

        if (!isFhirSource && !isDicomSource) {
            return;
        }

        const transformName = isDicomSource ? 'DicomIO' : 'FhirIO';
        const upstreamRequiredMode = isDicomSource ? 'readStudyMetadata' : 'readResources';
        const readMode = node.data?.properties?.readMode || upstreamRequiredMode;
        const degIn = initialInDegree.get(id) || 0;
        const label = node.data?.label ? `"${node.data.label}" (${id})` : id;

        if (readMode === upstreamRequiredMode && degIn === 0) {
            missingUpstreamNodeIds.push(id);
            errors.push(
                `${transformName}.${upstreamRequiredMode}() on node ${label} requires an upstream PubSubIO node connected in front of it.`
            );
        } else if (readMode !== upstreamRequiredMode && degIn > 0) {
            invalidUpstreamNodeIds.push(id);
            errors.push(
                `${transformName}.${readMode}() on node ${label} does not accept an upstream connection. Remove the connected upstream node or switch back to ${transformName}.${upstreamRequiredMode}().`
            );
        }
    });

    // 5. Check for missing Apache Beam core components
    const hasSource = validNodes.some((n) => n.data?.type === 'SOURCE');
    const hasSink = validNodes.some((n) => n.data?.type === 'SINK');

    if (!hasSource) {
        warnings.push('Pipeline has no SOURCE node. At least one SOURCE is required for execution.');
    }
    if (!hasSink) {
        warnings.push('Pipeline has no SINK node. At least one SINK is recommended for output delivery.');
    }

    // 6. Handle cycles if Kahn's sort did not resolve all nodes
    const cycleNodeIds: string[] = [];
    const cycleEdgeIds: string[] = [];
    const cyclePaths: string[][] = [];
    let cyclePathString = '';

    if (sortedNodeIds.length < nodeIds.length) {
        const remainingNodeIds = new Set<string>();
        nodeIds.forEach((id) => {
            if ((inDegree.get(id) || 0) > 0) {
                remainingNodeIds.add(id);
            }
        });

        const visited = new Set<string>();
        const recStack = new Map<string, number>();
        const currentPath: string[] = [];

        const dfs = (nodeId: string) => {
            visited.add(nodeId);
            currentPath.push(nodeId);
            recStack.set(nodeId, currentPath.length - 1);

            const neighbors = outgoingNeighbors.get(nodeId) || [];
            for (const nxt of neighbors) {
                if (!remainingNodeIds.has(nxt)) {
                    continue;
                }

                if (recStack.has(nxt)) {
                    const cycleStartIndex = recStack.get(nxt)!;
                    const cycleLoop = currentPath.slice(cycleStartIndex).concat(nxt);
                    cyclePaths.push(cycleLoop);

                    for (let i = 0; i < cycleLoop.length - 1; i++) {
                        const from = cycleLoop[i];
                        const to = cycleLoop[i + 1];
                        const matchingEdges = edgesByPair.get(`${from}->${to}`) || [];
                        matchingEdges.forEach((eid) => {
                            if (!cycleEdgeIds.includes(eid)) {
                                cycleEdgeIds.push(eid);
                            }
                        });
                    }
                } else if (!visited.has(nxt)) {
                    dfs(nxt);
                }
            }

            currentPath.pop();
            recStack.delete(nodeId);
        };

        remainingNodeIds.forEach((id) => {
            if (!visited.has(id)) {
                dfs(id);
            }
        });

        if (cyclePaths.length > 0) {
            const uniqueCycleNodes = new Set<string>();
            cyclePaths.forEach((path) => {
                path.forEach((nid) => uniqueCycleNodes.add(nid));
            });
            uniqueCycleNodes.forEach((nid) => cycleNodeIds.push(nid));

            const firstPath = cyclePaths[0];
            cyclePathString = firstPath
                .map((nid) => {
                    const node = nodeMap.get(nid);
                    return node?.data?.label ? `${node.data.label} (${nid})` : nid;
                })
                .join(' -> ');
        } else {
            remainingNodeIds.forEach((nid) => cycleNodeIds.push(nid));
            cyclePathString = cycleNodeIds.join(' -> ');
        }

        errors.push(`Cyclic dependency detected in pipeline graph: ${cyclePathString}`);
    }

    // 7. Compute final validity
    const hasCycles = cycleNodeIds.length > 0;
    const isValid = errors.length === 0;

    return {
        isValid,
        hasCycles,
        cycleNodeIds,
        cycleEdgeIds,
        cyclePaths,
        cyclePathString,
        sortedNodeIds: hasCycles ? [] : sortedNodeIds,
        orphanNodeIds,
        missingUpstreamNodeIds,
        invalidUpstreamNodeIds,
        errors,
        warnings,
    };
}
