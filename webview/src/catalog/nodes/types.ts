/** @fileoverview Type definitions for pipeline palette nodes.
 *
 * Author: Mike Nimer <mikenimer@google.com>
 */

/**
 * Definition of a pipeline node displayed in the palette catalog.
 */
export interface NodeDefinition {
  label: string;
  type: 'SOURCE' | 'STEP' | 'SINK';
  iconName: string;
  beamTransform: string;
  badge: string;
  description: string;
  category: string;
  supportedLanguages?: ('Java' | 'Python' | 'Go' | 'TypeScript')[];
}
