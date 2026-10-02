/**
 * @fileoverview Pure predicates for runtime node and palette item kind detection.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

/**
 * Minimal structural shape of node data used for kind detection.
 */
export interface NodeDataLike {
  type?: string;
  beam_transform?: string;
  label?: string;
}

/**
 * Structural container for nodes containing optional node data.
 */
export interface NodeLike {
  data?: NodeDataLike;
}

/**
 * Minimal structural shape of a palette item used for kind matching.
 */
export interface PaletteItemLike {
  type: string;
  label: string;
  beamTransform?: string;
}

/**
 * Normalizes input to access node data properties regardless of whether
 * a full node (`{ data: ... }`) or raw data object is passed.
 *
 * @param target - A node object or node data object.
 * @returns The inner NodeDataLike object, or undefined if target is null/undefined.
 */
function getData(target?: NodeLike | NodeDataLike | null): NodeDataLike | undefined {
  if (!target || typeof target !== 'object') {
    return undefined;
  }
  if ('data' in target && target.data && typeof target.data === 'object') {
    return target.data as NodeDataLike;
  }
  return target as NodeDataLike;
}

/**
 * Safely extracts the display label from a node, data object, or raw string.
 *
 * @param target - A node object, node data object, or raw string label.
 * @returns The extracted string label, or undefined if absent.
 */
export function extractLabel(target?: NodeLike | NodeDataLike | string | null): string | undefined {
  if (typeof target === 'string') {
    return target;
  }
  const data = getData(target);
  return typeof data?.label === 'string' ? data.label : undefined;
}

/**
 * Checks whether a palette item represents a FileIO source transform.
 * Palette items do not have a data wrapper; checks `type === 'SOURCE'` and FileIO label or transform.
 *
 * @param item - The palette item to test.
 * @returns True if the item is a SOURCE and specifies FileIO by label or beamTransform.
 */
export function isFileIoSourceItem(item?: PaletteItemLike | null): boolean {
  if (!item || typeof item !== 'object') {
    return false;
  }
  return item.type === 'SOURCE' && (item.label === 'FileIO' || item.beamTransform === 'FileIO');
}

/**
 * Checks whether a palette item represents a Parse Message step.
 *
 * @param item - The palette item to test.
 * @returns True if the item has label 'Parse Message'.
 */
export function isParseMessageItem(item?: { label?: string } | null): boolean {
  if (!item || typeof item !== 'object') {
    return false;
  }
  return item.label === 'Parse Message';
}

/**
 * Checks whether a node represents a PubSub transform.
 * Checks the stable discriminator `data.beam_transform === 'PubSubIO'` first,
 * falling back to `data.label.includes('PubSub')`.
 *
 * @param target - A node object or node data object to evaluate.
 * @returns True if target matches PubSubIO beam_transform or label.
 */
export function isPubSubNode(target?: NodeLike | NodeDataLike | null): boolean {
  const data = getData(target);
  if (!data) {
    return false;
  }
  return data.beam_transform === 'PubSubIO' || Boolean(data.label && data.label.includes('PubSub'));
}

/**
 * Checks whether a node represents a PubSub SOURCE node.
 * Verifies `data.type === 'SOURCE'` and delegates to `isPubSubNode`.
 * This adds the `beam_transform` check to lookup so renamed PubSub sources
 * (e.g. label 'My stream', beam_transform 'PubSubIO') still auto-wire to Parse Message steps.
 *
 * @param target - A node object or node data object to evaluate.
 * @returns True if the node is a SOURCE and represents a PubSub transform.
 */
export function isPubSubSourceNode(target?: NodeLike | NodeDataLike | null): boolean {
  const data = getData(target);
  if (!data) {
    return false;
  }
  return data.type === 'SOURCE' && isPubSubNode(data);
}

/**
 * Checks whether a node represents a FhirIO transform.
 * Checks the stable discriminator `data.beam_transform === 'FhirIO'` first,
 * falling back to `data.label.includes('FhirIO')`.
 *
 * @param target - A node object or node data object to evaluate.
 * @returns True if target matches FhirIO beam_transform or label.
 */
export function isFhirIoNode(target?: NodeLike | NodeDataLike | null): boolean {
  const data = getData(target);
  if (!data) {
    return false;
  }
  return data.beam_transform === 'FhirIO' || Boolean(data.label && data.label.includes('FhirIO'));
}

/**
 * Checks whether a node represents a DicomIO transform.
 * Checks the stable discriminator `data.beam_transform === 'DicomIO'` first,
 * falling back to `data.label.includes('DicomIO')`.
 *
 * @param target - A node object or node data object to evaluate.
 * @returns True if target matches DicomIO beam_transform or label.
 */
export function isDicomIoNode(target?: NodeLike | NodeDataLike | null): boolean {
  const data = getData(target);
  if (!data) {
    return false;
  }
  return data.beam_transform === 'DicomIO' || Boolean(data.label && data.label.includes('DicomIO'));
}
