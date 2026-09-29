/**
 * CollapsibleSection Unit Tests
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Validates the shared accordion primitive: controlled open/closed rendering, toggle event
 * propagation, optional icon rendering, and the aria-expanded disclosure state.
 * 
 * Architectural Decisions:
 * - Uses Vitest and @testing-library/react, matching the existing common component suites.
 * - Asserts that collapsed sections do not mount their children, because panels rely on that
 *   behaviour to avoid running effects inside closed sections.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CollapsibleSection } from './CollapsibleSection';

describe('CollapsibleSection', () => {
  it('renders the title but not the children when collapsed', () => {
    render(
      <CollapsibleSection title="Advanced Tuning" isOpen={false} onToggle={vi.fn()}>
        <div>Advanced body content</div>
      </CollapsibleSection>
    );

    expect(screen.getByText('Advanced Tuning')).toBeInTheDocument();
    expect(screen.queryByText('Advanced body content')).not.toBeInTheDocument();
  });

  it('renders the children when expanded', () => {
    render(
      <CollapsibleSection title="Advanced Tuning" isOpen={true} onToggle={vi.fn()}>
        <div>Advanced body content</div>
      </CollapsibleSection>
    );

    expect(screen.getByText('Advanced body content')).toBeInTheDocument();
  });

  it('fires onToggle when the header button is clicked', () => {
    const handleToggle = vi.fn();

    render(
      <CollapsibleSection title="Read Tuning & Options" isOpen={false} onToggle={handleToggle}>
        <div>Body</div>
      </CollapsibleSection>
    );

    fireEvent.click(screen.getByRole('button'));

    expect(handleToggle).toHaveBeenCalledTimes(1);
  });

  it('renders the optional icon element when provided', () => {
    render(
      <CollapsibleSection
        title="Schema Specification"
        icon={<span data-testid="section-icon">icon</span>}
        isOpen={false}
        onToggle={vi.fn()}
      >
        <div>Body</div>
      </CollapsibleSection>
    );

    expect(screen.getByTestId('section-icon')).toBeInTheDocument();
  });

  it('omits the icon slot content when no icon is provided', () => {
    render(
      <CollapsibleSection title="Schema Specification" isOpen={false} onToggle={vi.fn()}>
        <div>Body</div>
      </CollapsibleSection>
    );

    expect(screen.queryByTestId('section-icon')).not.toBeInTheDocument();
  });

  it('publishes aria-expanded="false" when collapsed and "true" when expanded', () => {
    const { rerender } = render(
      <CollapsibleSection title="Advanced Tuning" isOpen={false} onToggle={vi.fn()}>
        <div>Body</div>
      </CollapsibleSection>
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');

    rerender(
      <CollapsibleSection title="Advanced Tuning" isOpen={true} onToggle={vi.fn()}>
        <div>Body</div>
      </CollapsibleSection>
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true');
  });

  it('applies the optional id to the section wrapper', () => {
    const { container } = render(
      <CollapsibleSection id="thrift-advanced" title="Advanced" isOpen={false} onToggle={vi.fn()}>
        <div>Body</div>
      </CollapsibleSection>
    );

    expect(container.querySelector('#thrift-advanced')).toBeInTheDocument();
  });
});
