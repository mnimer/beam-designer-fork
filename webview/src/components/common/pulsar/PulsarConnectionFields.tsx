/**
 * PulsarConnectionFields Component
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Purpose:
 * Shared broker and admin connection configuration block for Apache Beam PulsarIO
 * streaming source and sink property panels.
 * 
 * Architectural Decisions:
 * - Extracted to eliminate duplication across PulsarIO source and sink property panels.
 * - Pure presentational component conforming to "props in, events up": receives current values
 *   and dispatches change events upward. Owns no form state.
 * - Self-contained protocol helpers (pulsar://, pulsar+ssl:// for client; http://, https:// for admin)
 *   to reduce boilerplate in consuming property forms.
 * - Adheres strictly to the 8pt grid system and verbatim Tailwind classes matching PropertyField.
 */

import React from 'react';
import { Server } from 'lucide-react';
import { PropertyField } from '../PropertyField';

/**
 * Props for the {@link PulsarConnectionFields} component.
 */
export interface PulsarConnectionFieldsProps {
  /** Prefix for generating unique element ids (e.g. 'pulsar' or 'pulsar-sink'). */
  idPrefix?: string;
  /** Current Pulsar client service URL (e.g. pulsar://broker:6650). */
  clientUrl?: string;
  /** Current Pulsar web admin service URL (e.g. http://broker:8080). */
  adminUrl?: string;
  /** Whether to render the Web Admin URL field. Defaults to true. */
  showAdminUrl?: boolean;
  /** Direction context for documentation tooltips ('source' or 'sink'). Defaults to 'source'. */
  direction?: 'source' | 'sink';
  /** Standard change handler dispatched on input change. */
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  /** Optional custom callback to apply protocol scheme to client URL. */
  onApplyClientProtocol?: (protocol: string) => void;
  /** Optional custom callback to apply protocol scheme to admin URL. */
  onApplyAdminProtocol?: (protocol: string) => void;
  /** Optional property change callback for object patch emissions. */
  onPropertyChange?: (name: string, value: any) => void;
}

/**
 * PulsarConnectionFields renders the client and admin connection controls for Pulsar brokers.
 * 
 * @param props Connection properties and upward event callbacks.
 * @returns React component.
 */
export const PulsarConnectionFields: React.FC<PulsarConnectionFieldsProps> = ({
  idPrefix = 'pulsar',
  clientUrl = '',
  adminUrl = '',
  showAdminUrl = true,
  direction = 'source',
  onChange,
  onApplyClientProtocol,
  onApplyAdminProtocol,
  onPropertyChange
}) => {
  const isClientUrlMissing = !clientUrl.trim();
  const clientUrlId = `${idPrefix}-client-url`;
  const adminUrlId = `${idPrefix}-admin-url`;

  const clientTooltip = direction === 'source'
    ? 'Pulsar broker binary protocol service URL (e.g. pulsar://broker:6650 or pulsar+ssl://broker:6651). Configured via PulsarIO.read().withClientUrl().'
    : 'Pulsar broker binary protocol service URL (e.g. pulsar://broker:6650 or pulsar+ssl://broker:6651). Configured via PulsarIO.write().withClientUrl().';

  const adminTooltip = direction === 'source'
    ? 'Pulsar HTTP/HTTPS admin service URL for topic metadata discovery and partition lookup (e.g. http://broker:8080 or https://broker:8443). Configured via PulsarIO.read().withAdminUrl().'
    : 'Pulsar HTTP/HTTPS admin service URL for topic validation and schema registration lookup. Passed to client configuration.';

  const handleClientProtocol = (proto: string) => {
    if (onApplyClientProtocol) {
      onApplyClientProtocol(proto);
      return;
    }
    let clean = clientUrl.replace(/^[a-zA-Z+]+:\/\//, '');
    if (!clean) clean = proto === 'pulsar+ssl://' ? 'localhost:6651' : 'localhost:6650';
    const nextVal = `${proto}${clean}`;
    if (onPropertyChange) {
      onPropertyChange('clientUrl', nextVal);
    } else {
      onChange({ target: { name: 'clientUrl', value: nextVal } } as any);
    }
  };

  const handleAdminProtocol = (proto: string) => {
    if (onApplyAdminProtocol) {
      onApplyAdminProtocol(proto);
      return;
    }
    let clean = adminUrl.replace(/^[a-zA-Z+]+:\/\//, '');
    if (!clean) clean = proto === 'https://' ? 'localhost:8443' : 'localhost:8080';
    const nextVal = `${proto}${clean}`;
    if (onPropertyChange) {
      onPropertyChange('adminUrl', nextVal);
    } else {
      onChange({ target: { name: 'adminUrl', value: nextVal } } as any);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3 bg-[#252836]/60 rounded border border-slate-700">
      <div className="flex items-center justify-between">
        <span className="flex items-center text-xs font-bold uppercase text-slate-400 gap-1.5">
          <Server size={12} className="text-blue-400" />
          <span>Pulsar Broker Service URLs</span>
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleClientProtocol('pulsar://')}
            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
            title="Set pulsar:// scheme"
          >
            pulsar://
          </button>
          <button
            type="button"
            onClick={() => handleClientProtocol('pulsar+ssl://')}
            className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
            title="Set pulsar+ssl:// scheme"
          >
            pulsar+ssl://
          </button>
        </div>
      </div>

      {/* Client URL */}
      <PropertyField
        id={clientUrlId}
        name="clientUrl"
        label="Pulsar Client Service URL"
        required="Pulsar Client Service URL is required."
        tooltip={clientTooltip}
        aria-required="true"
        aria-invalid={isClientUrlMissing}
        value={clientUrl}
        onChange={onChange}
        placeholder="pulsar://localhost:6650"
        error={isClientUrlMissing ? 'Pulsar Client Service URL is required.' : null}
        invalid={isClientUrlMissing}
        mono={true}
      />

      {/* Admin URL */}
      {showAdminUrl && (
        <div className="flex flex-col gap-1 pt-1 border-t border-slate-700/40">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Web Admin URL (Optional)</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleAdminProtocol('http://')}
                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                title="Set http:// scheme"
              >
                http://
              </button>
              <button
                type="button"
                onClick={() => handleAdminProtocol('https://')}
                className="px-1.5 py-0.5 rounded text-[10px] bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors"
                title="Set https:// scheme"
              >
                https://
              </button>
            </div>
          </div>
          <PropertyField
            id={adminUrlId}
            name="adminUrl"
            tooltip={adminTooltip}
            value={adminUrl}
            onChange={onChange}
            placeholder="http://localhost:8080"
            mono={true}
          />
        </div>
      )}
    </div>
  );
};
