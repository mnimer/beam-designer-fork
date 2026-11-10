/**
 * Hook for VS Code webview IPC bridge
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Handles IPC messaging with the VS Code extension host:
 * - 'ready' handshake and initial state requests
 * - Handling loadPipeline, projectIdResolved, codeRegenerated, folderFilesRead, etc.
 * - Outbound IPC requests (refreshFolderFiles, runPipeline, regenerateCode, pickFolder, readFileContent)
 * - Ref-based stale closure protection for pipelineConfig, filename, and projectId
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import YAML from 'yaml';
import { computeUpdatedOutputFolder } from '../utils/outputFolder';
import { migrateLegacyNodes } from '../utils/legacyNodeMigration';
import { DEFAULT_SAMPLES, type SamplePipeline } from '../components/NodesCard';
import { serializePipeline } from './usePipelinePersistence';
import { type TokenUsage } from '../components/BottomPanel/SourceCodeTab';
import { getVsCodeApi } from '../bridge/vscodeApi';
import { pipelineConfigReducer, type PipelineConfig } from '../state/pipelineConfigReducer';
import { resolveLanguageOrDefault } from '../utils/language';

export type { PipelineConfig };

/** Initial project ID shown until the host resolves the gcloud default or the user picks one. */
export const PLACEHOLDER_PROJECT_ID = 'YOUR_PROJECT_ID';

/**
 * Whether a project ID is still the unset placeholder (or empty), i.e. safe to replace with
 * the host-resolved gcloud default without discarding a user choice.
 *
 * @param projectId Current project ID state.
 * @returns True when no real project has been chosen yet.
 */
export function isPlaceholderProjectId(projectId: string | undefined): boolean {
  return !projectId || projectId.trim() === '' || projectId === PLACEHOLDER_PROJECT_ID;
}

/**
 * Resolves the primary generated pipeline source file from a list of output directory files.
 *
 * @param files List of relative file paths in the generated output directory.
 * @param language Target programming language ('Python' | 'Java').
 * @param filename Optional current pipeline .beam filename used for name matching.
 * @returns The best matching main pipeline code file path, or null if empty.
 */
export const findMainPipelineFile = (files: string[], language: 'Python' | 'Java', filename?: string): string | null => {
  if (!files || files.length === 0) return null;

  const baseName = filename ? filename.replace(/\.beam$/, '').toLowerCase() : '';
  const pascalBaseName = baseName ? baseName.charAt(0).toUpperCase() + baseName.slice(1) : '';

  // Filter code files by language preference, but fall back to the other language if preferred language has no files
  let codeFiles = files.filter(f => {
    const lower = f.toLowerCase();
    if (language === 'Java') {
      return lower.endsWith('.java') && !lower.includes('test');
    } else {
      return lower.endsWith('.py') && !lower.includes('test') && !lower.endsWith('__init__.py');
    }
  });

  // If preferred language returned no code files, check if the other language has code files in the directory
  if (codeFiles.length === 0) {
    codeFiles = files.filter(f => {
      const lower = f.toLowerCase();
      return (lower.endsWith('.java') || lower.endsWith('.py')) && !lower.includes('test') && !lower.endsWith('__init__.py');
    });
  }

  if (codeFiles.length === 0) {
    // If still no code files found, try any .java or .py file
    codeFiles = files.filter(f => f.endsWith('.java') || f.endsWith('.py'));
  }

  if (codeFiles.length === 0) {
    // No code files exist in folder at all
    return files[0];
  }

  // Find best match among codeFiles matching baseName or pascalBaseName or pipeline
  const match = codeFiles.find(f => {
    const lower = f.toLowerCase();
    return (baseName && lower.includes(baseName)) || 
           (pascalBaseName && lower.includes(pascalBaseName.toLowerCase())) ||
           lower.includes('pipeline.java') ||
           lower.includes('pipeline.py');
  });

  return match || codeFiles[0];
};

/**
 * Options for configuring the VS Code host communication bridge in {@link useVsCodeBridge}.
 */
export interface UseVsCodeBridgeOptions {
  setNodes: (nodes: any[] | ((prev: any[]) => any[])) => void;
  setEdges: (edges: any[] | ((prev: any[]) => any[])) => void;
  setRuntimeVariables: React.Dispatch<React.SetStateAction<{ key: string; value: string }[]>>;
  setJobConfig: React.Dispatch<React.SetStateAction<any>>;
  pipelineConfig: PipelineConfig;
  setPipelineConfig: React.Dispatch<React.SetStateAction<PipelineConfig>>;
  filename: string;
  setFilename: React.Dispatch<React.SetStateAction<string>>;
  projectId: string;
  setProjectId: React.Dispatch<React.SetStateAction<string>>;
  fitView?: (options?: any) => void;
  vscode?: any;
}

/**
 * Custom React hook coordinating bidirectional IPC message exchanges between webview and extension host.
 *
 * @param options State updaters and options for processing extension messages.
 * @returns State and event dispatchers connected to the VS Code extension host.
 */
export function useVsCodeBridge({
  setNodes,
  setEdges,
  setRuntimeVariables,
  setJobConfig,
  pipelineConfig,
  setPipelineConfig,
  filename,
  setFilename,
  projectId,
  setProjectId,
  fitView,
  vscode,
}: UseVsCodeBridgeOptions) {
  /**
   * Resolved VS Code API handle: the explicitly injected one when provided, otherwise
   * the global the extension host installs on window.
   */
  const activeVsCode = vscode !== undefined ? vscode : (getVsCodeApi() ?? null);

  // NOTE: assigned during render rather than in an effect. The IPC senders below are
  // long-lived (useCallback with empty dependency arrays) and must observe the current
  // handle without being torn down and re-created on every render. This mirrors the
  // pipelineConfigRef / filenameRef / projectIdRef pattern used elsewhere in this file.
  // Do NOT convert this to a useEffect and do NOT add it to a dependency array.
  const vsCodeRef = useRef(activeVsCode);
  vsCodeRef.current = activeVsCode;

  const [isLoaded, setIsLoaded] = useState(false);
  const [loadRevision, setLoadRevision] = useState(0);
  const [samples, setSamples] = useState<SamplePipeline[]>(DEFAULT_SAMPLES);
  const [generatedCode, setGeneratedCode] = useState('');
  const [subnetworks, setSubnetworks] = useState<{ name: string; region: string; network: string; value: string }[]>([]);
  const [folderFiles, setFolderFiles] = useState<string[]>([]);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFileContent, setSelectedFileContent] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);

  // Keep config and active pipeline attributes in mutable refs updated on every render
  // to avoid stale closures in static event listeners and IPC message handlers.
  const pipelineConfigRef = useRef(pipelineConfig);
  pipelineConfigRef.current = pipelineConfig;

  const filenameRef = useRef(filename);
  filenameRef.current = filename;

  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  /**
   * Refreshes the file list in the selected output folder.
   * NOTE: Reads from pipelineConfigRef when folderPath is not supplied to prevent
   * stale closures in long-lived event listeners and effects.
   */
  const refreshFolderFiles = useCallback((folderPath?: string) => {
    const vs = vsCodeRef.current;
    if (vs) {
      const targetFolder = folderPath !== undefined ? folderPath : pipelineConfigRef.current.outputFolder;
      vs.postMessage({ command: 'readFolderFiles', folderPath: targetFolder });
    }
  }, []);

  const handleOpenSample = useCallback((sample: SamplePipeline) => {
    const vs = vsCodeRef.current;
    if (vs) {
      vs.postMessage({
        command: 'openSample',
        filename: sample.filename,
        content: sample.content,
      });
    }
  }, []);

  const handlePickFolder = useCallback(() => {
    const vs = vsCodeRef.current;
    if (vs) {
      vs.postMessage({ command: 'pickFolder' });
    }
  }, []);

  const handleSelectFile = useCallback((fileName: string) => {
    setSelectedFileName(fileName);
    const vs = vsCodeRef.current;
    if (vs) {
      vs.postMessage({
        command: 'readFileContent',
        filePath: fileName,
        folderPath: pipelineConfigRef.current.outputFolder,
      });
    }
  }, []);

  const handleRegenerate = useCallback((graphState: { nodes: any[]; edges: any[]; runtimeVariables: any[]; jobConfig: any }) => {
    const vs = vsCodeRef.current;
    if (vs) {
      setIsGenerating(true);
      const state = {
        ...graphState,
        pipelineConfig: { ...pipelineConfigRef.current, needsRebuild: false },
      };
      const yamlStr = serializePipeline(state);
      vs.postMessage({
        command: 'regenerateCode',
        data: yamlStr,
        filename: filenameRef.current,
        language: pipelineConfigRef.current.language,
        outputFolder: pipelineConfigRef.current.outputFolder,
      });
    }
  }, []);

  useEffect(() => {
    const vs = vsCodeRef.current;
    if (vs) {
      vs.postMessage({ command: 'ready' });
      vs.postMessage({ command: 'getSubnetworks' });
      vs.postMessage({ command: 'getSamples' });

      const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        if (!message) return;

        if (message.command === 'samplesLoaded') {
          if (message.samples && Array.isArray(message.samples) && message.samples.length > 0) {
            setSamples(message.samples);
          }
        } else if (message.command === 'projectIdResolved') {
          // P9: the host resolves the gcloud default project AFTER posting loadPipeline so the
          // canvas never waits on the gcloud CLI. By the time it arrives the user may already
          // have chosen a project, so only fill in the placeholder -- never overwrite.
          if (message.projectId && isPlaceholderProjectId(projectIdRef.current)) {
            setProjectId(message.projectId);
          }
        } else if (message.command === 'loadPipeline') {
          console.log('[useVsCodeBridge] Received loadPipeline for', message.filename);
          setFilename(message.filename || 'default_job');
          if (message.projectId) {
            setProjectId(message.projectId);
          }
          if (message.data) {
            try {
              const data = YAML.parse(message.data);
              // NOTE: Migration of legacy nodes to include beam_transform metadata
              const loadedNodes = migrateLegacyNodes(data.nodes || []);
              setNodes(loadedNodes);
              setEdges(data.edges || []);
              const variables = data.runtimeVariables || [];
              const hasJobId = variables.some((v: any) => v.key === 'JOB_ID');
              if (!hasJobId) {
                const defaultJobId = message.filename
                  ? message.filename.replace('.beam', '').replace(/ /g, '_')
                  : 'default_job';
                variables.unshift({ key: 'JOB_ID', value: defaultJobId });
              }
              setRuntimeVariables(variables);
              setJobConfig({
                machineType: 'n1-standard-1',
                minInstances: 1,
                maxInstances: 10,
                gcsStagingPath: '',
                network: '',
                subnetwork: '',
                ...(data.jobConfig || {}),
                runner: data.jobConfig?.runner || 'DirectRunner',
              });

              const rawConfig = data.pipelineConfig || {};
              const config: PipelineConfig = {
                ...rawConfig,
                language: resolveLanguageOrDefault(rawConfig.language),
                outputFolder: rawConfig.outputFolder || '',
                needsRebuild: rawConfig.needsRebuild ?? false,
              };
              const nameWithoutExt = message.filename ? message.filename.replace('.beam', '') : '';
              const relativeFolder = message.relativeFolder || '';
              const defaultOutputFolder =
                message.defaultOutputFolder ||
                (relativeFolder ? `${relativeFolder}/${nameWithoutExt}` : nameWithoutExt);

              const prevOutputFolder = config.outputFolder;
              const updatedOutputFolder = computeUpdatedOutputFolder(
                config.outputFolder,
                relativeFolder,
                nameWithoutExt,
                defaultOutputFolder
              );

              config.outputFolder = updatedOutputFolder;
              if (prevOutputFolder && prevOutputFolder !== updatedOutputFolder) {
                config.needsRebuild = true;
              }
              setPipelineConfig((prev) => pipelineConfigReducer(prev, { type: 'reset', config }));
            } catch (e) {
              console.error('Failed to parse YAML', e);
            }
          } else {
            console.log('No data received, setting empty pipeline');
            setNodes([]);
            setEdges([]);
            const defaultJobId = message.filename
              ? message.filename.replace('.beam', '').replace(/ /g, '_')
              : 'default_job';
            setRuntimeVariables([{ key: 'JOB_ID', value: defaultJobId }]);
            setJobConfig({
              runner: 'DirectRunner',
              machineType: 'n1-standard-1',
              minInstances: 1,
              maxInstances: 10,
              gcsStagingPath: '',
              network: '',
              subnetwork: '',
            });
            setPipelineConfig((prev) =>
              pipelineConfigReducer(prev, {
                type: 'reset',
                config: {
                  language: 'Python',
                  outputFolder: message.defaultOutputFolder || '',
                  needsRebuild: false,
                },
              })
            );
          }
          setIsLoaded(true);
          setLoadRevision((prev) => prev + 1);

          setTimeout(() => {
            if (fitView) {
              fitView({ duration: 0, padding: 1 });
            }
          }, 100);
        } else if (message.command === 'codeRegenerated') {
          setIsGenerating(false);
          if (message.success) {
            if (message.tokenUsage) {
              setTokenUsage(message.tokenUsage);
            }
            setPipelineConfig((prev) => pipelineConfigReducer(prev, { type: 'markBuilt' }));
            setGeneratedCode(message.code || '');
            setSelectedFileName(null);
            // NOTE: Clear the previously viewed file's contents alongside its name.
            // Without this the viewer keeps rendering the *old* generation's file body
            // under a blank filename after a regenerate.
            setSelectedFileContent(null);
            // NOTE: Read latest output folder from pipelineConfigRef to avoid stale closure
            refreshFolderFiles(pipelineConfigRef.current.outputFolder);
          } else if (typeof message.error === 'string') {
            console.warn('[useVsCodeBridge] Code generation failed:', message.error);
          }
        } else if (message.command === 'codeGenerationStopped') {
          setIsGenerating(false);
        } else if (message.command === 'subnetworksLoaded') {
          setSubnetworks(message.subnetworks);
        } else if (message.command === 'folderFilesRead') {
          if (message.tokenUsage) {
            setTokenUsage(message.tokenUsage);
          }
          const loadedFiles: string[] = message.files || [];
          setFolderFiles(loadedFiles);
          if (loadedFiles.length > 0) {
            const currentLang = pipelineConfigRef.current.language;
            const currentName = filenameRef.current;
            const currentFolder = pipelineConfigRef.current.outputFolder;
            const mainFile = findMainPipelineFile(loadedFiles, currentLang, currentName);
            if (mainFile) {
              setSelectedFileName(mainFile);
              if (vs) {
                vs.postMessage({
                  command: 'readFileContent',
                  filePath: mainFile,
                  folderPath: currentFolder,
                });
              }
            }
          }
        } else if (message.command === 'fileContentLoaded') {
          setSelectedFileContent(message.content);
        } else if (message.command === 'fileContentError') {
          setSelectedFileContent(`// Unable to display ${message.filePath ?? 'file'}: ${message.error || 'Failed to read file'}`);
        } else if (message.command === 'folderSelected') {
          setPipelineConfig((prev) =>
            pipelineConfigReducer(prev, {
              type: 'setOutputFolder',
              folder: message.path,
            })
          );
        } else if (message.command === 'updateOutputFolder') {
          setPipelineConfig((prev) =>
            pipelineConfigReducer(prev, {
              type: 'syncOutputFolderFromHost',
              folder: message.outputFolder,
            })
          );
        }
      };

      window.addEventListener('message', handleMessage);
      return () => window.removeEventListener('message', handleMessage);
    } else {
      // NOTE: When running outside of VS Code (e.g. standalone dev server), mark as loaded
      setIsLoaded(true);
    }
  }, [setNodes, setEdges, setRuntimeVariables, setJobConfig, setPipelineConfig, setFilename, setProjectId, fitView, refreshFolderFiles]);

  return {
    isLoaded,
    setIsLoaded,
    loadRevision,
    samples,
    setSamples,
    generatedCode,
    setGeneratedCode,
    subnetworks,
    setSubnetworks,
    folderFiles,
    setFolderFiles,
    selectedFileName,
    setSelectedFileName,
    selectedFileContent,
    setSelectedFileContent,
    isGenerating,
    setIsGenerating,
    tokenUsage,
    setTokenUsage,
    refreshFolderFiles,
    handleOpenSample,
    handlePickFolder,
    handleSelectFile,
    handleRegenerate,
    pipelineConfigRef,
    filenameRef,
    projectIdRef,
  };
}
