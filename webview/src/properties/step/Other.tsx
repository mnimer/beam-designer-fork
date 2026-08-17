import React from 'react';

/**
 * OtherProperties Component
 * 
 * This component displays property configuration and informative descriptions
 * for 'Other' transform steps, including Flatten and ReShuffle.
 * 
 * Architectural Decisions:
 * - Provides context-aware descriptions for Flatten and ReShuffle transforms.
 * - Handles both label and beam_transform variations (e.g., ReShuffle / Reshuffle).
 */
interface OtherNode {
  data: {
    label: string;
    beam_transform?: string;
    properties?: Record<string, any>;
  };
}

interface OtherPropertiesProps {
  node: OtherNode;
  onChange: (properties: any) => void;
}

const DESCRIPTIONS: Record<string, string> = {
  'Flatten': 'Merges multiple PCollection objects of the same type into a single logical PCollection.',
  'ReShuffle': 'Redistributes elements across workers by assigning temporary random keys to break fusion and balance load.',
  'Reshuffle': 'Redistributes elements across workers by assigning temporary random keys to break fusion and balance load.'
};

/**
 * Renders the properties pane for Other steps
 * 
 * @param props - Component props containing node data and onChange handler
 * @returns JSX element with transform descriptions
 */
export const OtherProperties: React.FC<OtherPropertiesProps> = ({ node }) => {
  // Extract label or fallback from node data
  const label = node.data.label;
  // Look up descriptive text for the transform
  const description = DESCRIPTIONS[label] || 'Transform properties are currently empty.';

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-slate-400">
        {label} properties are currently empty. {description}
      </div>
    </div>
  );
};
