import { describe, it, expect } from 'vitest';
import {
  NODE_LANGUAGE_SUPPORT_REGISTRY,
  getSupportedLanguages,
  isNodeSupportedInLanguage,
  isJavaOnlyTransform,
  isPythonOnlyTransform,
  getJavaOnlyTransforms,
  getPythonOnlyTransforms,
  validateDiagramLanguageSupport,
} from './nodeLanguageSupport';
import { SOURCE_NODES, STEP_NODES, SINK_NODES } from '../components/NodesCard';

describe('nodeLanguageSupport registry & diagram validation', () => {
  it('explicitly registers every node in SOURCE_NODES, STEP_NODES, and SINK_NODES', () => {
    const allPaletteNodes = [...SOURCE_NODES, ...STEP_NODES, ...SINK_NODES];
    for (const node of allPaletteNodes) {
      expect(
        NODE_LANGUAGE_SUPPORT_REGISTRY[node.beamTransform],
        `Missing NODE_LANGUAGE_SUPPORT_REGISTRY entry for ${node.label} (${node.beamTransform})`
      ).toBeDefined();
    }
  });

  it('identifies the exact 4 Java-only file connectors and 1 Python-only connector (FlinkStreamingImpulseSource)', () => {
    expect(getJavaOnlyTransforms()).toEqual([
      'ContextualTextIO',
      'ThriftIO',
      'TikaIO',
      'XmlIO',
    ]);
    expect(getPythonOnlyTransforms()).toEqual(['FlinkStreamingImpulseSource']);

    expect(isJavaOnlyTransform('TikaIO')).toBe(true);
    expect(isJavaOnlyTransform('ContextualTextIO')).toBe(true);
    expect(isJavaOnlyTransform('ThriftIO')).toBe(true);
    expect(isJavaOnlyTransform('XmlIO')).toBe(true);
    expect(isJavaOnlyTransform('IcebergIO')).toBe(false);
    expect(isJavaOnlyTransform('ParquetIO')).toBe(false);
    expect(isPythonOnlyTransform('TikaIO')).toBe(false);
    expect(isPythonOnlyTransform('FlinkStreamingImpulseSource')).toBe(true);
  });

  it('validates a diagram with Java-only nodes as invalid when Python is selected', () => {
    const nodes = [
      { id: 'n1', data: { label: 'Read PDFs', beamTransform: 'TikaIO' } },
      { id: 'n2', data: { label: 'Extract Text', beamTransform: 'ParDo' } },
      { id: 'n3', data: { label: 'Log Output', beamTransform: 'LogMessage' } },
    ];

    const pythonResult = validateDiagramLanguageSupport(nodes, 'Python');
    expect(pythonResult.isValid).toBe(false);
    expect(pythonResult.unsupportedNodes).toHaveLength(1);
    expect(pythonResult.unsupportedNodes[0].beamTransform).toBe('TikaIO');
    expect(pythonResult.errors[0]).toContain(
      'Node "Read PDFs" (TikaIO) is only supported in Java and cannot generate Python code.'
    );

    const javaResult = validateDiagramLanguageSupport(nodes, 'Java');
    expect(javaResult.isValid).toBe(true);
    expect(javaResult.unsupportedNodes).toHaveLength(0);
    expect(javaResult.errors).toEqual([]);
  });

  it('validates a diagram with Java-only nodes using real snake_case beam_transform property', () => {
    const nodes = [
      { id: 'n1', data: { label: 'TikaIO Parse', beam_transform: 'TikaIO', type: 'SOURCE', iconName: 'FileText' } },
      { id: 'n2', data: { label: 'ParDo', beam_transform: 'ParDo', type: 'STEP', iconName: 'Code' } },
      { id: 'n3', data: { label: 'Log Message', beam_transform: 'LogMessage', type: 'SINK', iconName: 'Terminal' } },
    ];

    const pythonResult = validateDiagramLanguageSupport(nodes, 'Python');
    expect(pythonResult.isValid).toBe(false);
    expect(pythonResult.unsupportedNodes).toHaveLength(1);
    expect(pythonResult.unsupportedNodes[0].beamTransform).toBe('TikaIO');
    expect(pythonResult.errors[0]).toBe(
      'Node "TikaIO Parse" (TikaIO) is only supported in Java and cannot generate Python code.'
    );

    // Case-insensitive language parameter test
    const lowerPythonResult = validateDiagramLanguageSupport(nodes, 'python' as any);
    expect(lowerPythonResult.isValid).toBe(false);

    const javaResult = validateDiagramLanguageSupport(nodes, 'Java');
    expect(javaResult.isValid).toBe(true);
    expect(javaResult.unsupportedNodes).toHaveLength(0);
  });

  it('correctly resolves and flags all 4 Java-only nodes even if beam_transform is missing (inferred from label)', () => {
    const nodes = [
      { id: 'tika-node', data: { label: 'TikaIO', type: 'SOURCE', iconName: 'FileText' } },
      { id: 'contextual-node', data: { label: 'ContextualTextIO', type: 'SOURCE', iconName: 'FileText' } },
      { id: 'thrift-node', data: { label: 'ThriftIO', type: 'SOURCE', iconName: 'FileCode' } },
      { id: 'xml-node', data: { label: 'XmlIO', type: 'SOURCE', iconName: 'FileCode' } },
    ];

    const result = validateDiagramLanguageSupport(nodes, 'Python');
    expect(result.isValid).toBe(false);
    expect(result.unsupportedNodes).toHaveLength(4);
    const transformNames = result.unsupportedNodes.map((n) => n.beamTransform).sort();
    expect(transformNames).toEqual(['ContextualTextIO', 'ThriftIO', 'TikaIO', 'XmlIO']);
  });

  it('scales to Go and TypeScript target languages', () => {
    const nodes = [
      { id: 'n1', data: { label: 'Iceberg Reader', beamTransform: 'IcebergIO' } },
    ];

    expect(isNodeSupportedInLanguage('IcebergIO', 'Java')).toBe(true);
    expect(isNodeSupportedInLanguage('IcebergIO', 'Python')).toBe(true);
    expect(isNodeSupportedInLanguage('IcebergIO', 'Go')).toBe(false);
    expect(isNodeSupportedInLanguage('IcebergIO', 'TypeScript')).toBe(false);

    const goResult = validateDiagramLanguageSupport(nodes, 'Go');
    expect(goResult.isValid).toBe(false);
    expect(goResult.errors[0]).toContain(
      'Node "Iceberg Reader" (IcebergIO) is only supported in Java, Python and cannot generate Go code.'
    );
  });

  it('defaults unknown or custom transforms to Java and Python support', () => {
    expect(getSupportedLanguages('CustomTransform')).toEqual(['Java', 'Python']);
    expect(getSupportedLanguages(undefined)).toEqual(['Java', 'Python']);
  });
});
