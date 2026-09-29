/**
 * Hook for VS Code webview IPC bridge
 * 
 * Author: Mike Nimer <mikenimer@google.com>
 * 
 * Handles IPC messaging with the VS Code extension host:
 * - 'ready' handshake and initial state requests
 * - Handling loadPipeline, codeRegenerated, folderFilesRead, etc.
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

export interface PipelineConfig {
  language: 'Python' | 'Java';
  outputFolder: string;
  needsRebuild: boolean;
}

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
  const activeVsCode = vscode !== undefined ? vscode : (typeof window !== 'undefined' ? (window as any).vscode : null);

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

  const handleRunNow = useCallback((jobConfig: any, runtimeVariables: any[]) => {
    console.log('[@useVsCodeBridge] handleRunNow called');
    const vs = vsCodeRef.current;
    if (vs) {
      vs.postMessage({
        command: 'runPipeline',
        jobConfig,
        runtimeVariables,
        pipelineConfig: pipelineConfigRef.current,
      });
    } else {
      alert('VS Code API is not available. This feature only works when running inside the VS Code extension.');
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
        } else if (message.command === 'loadPipeline') {
          console.log('Received loadPipeline message:', message);
          setFilename(message.filename || 'default_job');
          if (message.projectId) {
            setProjectId(message.projectId);
          }
          if (message.data) {
            try {
              const data = YAML.parse(message.data);
              console.log('Parsed YAML data:', data);
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
              setJobConfig(
                data.jobConfig || {
                  runner: 'DirectRunner',
                  machineType: 'n1-standard-1',
                  minInstances: 1,
                  maxInstances: 10,
                  gcsStagingPath: '',
                  network: '',
                  subnetwork: '',
                }
              );

              const config = data.pipelineConfig || { language: 'Python', outputFolder: '', needsRebuild: false };
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
              if (config.needsRebuild === undefined) {
                config.needsRebuild = false;
              }
              setPipelineConfig(config);
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
            setPipelineConfig({
              language: 'Python',
              outputFolder: message.defaultOutputFolder || '',
              needsRebuild: false,
            });
          }
          setIsLoaded(true);
          setLoadRevision((prev) => prev + 1);

          setTimeout(() => {
            if (fitView) {
              fitView({ duration: 0, padding: 1 });
            }
          }, 100);
        } else if (message.command === 'updateSource') {
          setGeneratedCode(message.data);
        } else if (message.command === 'codeRegenerated') {
          setIsGenerating(false);
          if (message.success) {
            if (message.tokenUsage) {
              setTokenUsage(message.tokenUsage);
            }
            setPipelineConfig((prev) => ({ ...prev, needsRebuild: false }));
            setGeneratedCode(message.code || '');
            setSelectedFileName(null);
            // NOTE: Clear the previously viewed file's contents alongside its name.
            // Without this the viewer keeps rendering the *old* generation's file body
            // under a blank filename after a regenerate.
            setSelectedFileContent(null);
            // NOTE: Read latest output folder from pipelineConfigRef to avoid stale closure
            refreshFolderFiles(pipelineConfigRef.current.outputFolder);
          }
        } else if (message.command === 'subnetworksLoaded') {
          setSubnetworks(message.subnetworks);
        } else if (message.command === 'folderFilesRead' || message.command === 'folderFilesLoaded') {
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
        } else if (message.command === 'folderSelected') {
          setPipelineConfig((prev) => ({
            ...prev,
            outputFolder: message.path,
            needsRebuild: true,
          }));
        } else if (message.command === 'updateOutputFolder') {
          setPipelineConfig((prev) => {
            const prevFolder = prev.outputFolder;
            const newFolder = message.outputFolder;
            if (prevFolder !== newFolder) {
              const needsRebuild = prevFolder !== '' && prevFolder !== newFolder ? true : prev.needsRebuild;
              return {
                ...prev,
                outputFolder: newFolder,
                needsRebuild,
              };
            }
            return prev;
          });
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
    handleRunNow,
    handleRegenerate,
    pipelineConfigRef,
    filenameRef,
    projectIdRef,
  };
}
