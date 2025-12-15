"use client";

import React, { useMemo, useState } from 'react';
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight, ChevronDown, Folder, File } from "lucide-react";

interface FileItem {
  filePath: string;
  reason?: string;
  decision?: string;
  [key: string]: any;
}

interface FolderStructure {
  [folderPath: string]: FileItem[];
}

interface FolderFileListProps {
  files: FileItem[];
  selectedFiles: Set<string>;
  onToggleFile: (filePath: string) => void;
  onFileClick?: (item: FileItem) => void;
  extractMatchInfo?: (filePath: string, tournaments: any[]) => any;
  tournaments?: any[];
  type: 'upload' | 'download' | 'deleteLocal' | 'deleteRemote' | 'conflict';
}

export function FolderFileList({
  files,
  selectedFiles,
  onToggleFile,
  onFileClick,
  extractMatchInfo,
  tournaments = [],
  type
}: FolderFileListProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Organize files by folder
  const folderStructure = useMemo(() => {
    const structure: FolderStructure = {};

    files.forEach(file => {
      const lastSlashIndex = file.filePath.lastIndexOf('/');
      const folder = lastSlashIndex > 0 ? file.filePath.substring(0, lastSlashIndex) : '/';

      if (!structure[folder]) {
        structure[folder] = [];
      }
      structure[folder].push(file);
    });

    return structure;
  }, [files]);

  // Get sorted folder paths
  const sortedFolders = useMemo(() => {
    return Object.keys(folderStructure).sort();
  }, [folderStructure]);

  // Check if all files in a folder are selected
  const isFolderFullySelected = (folder: string) => {
    const filesInFolder = folderStructure[folder];
    return filesInFolder.every(file => selectedFiles.has(file.filePath));
  };

  // Check if some (but not all) files in a folder are selected
  const isFolderPartiallySelected = (folder: string) => {
    const filesInFolder = folderStructure[folder];
    const selectedCount = filesInFolder.filter(file => selectedFiles.has(file.filePath)).length;
    return selectedCount > 0 && selectedCount < filesInFolder.length;
  };

  // Toggle all files in a folder
  const toggleFolder = (folder: string) => {
    const filesInFolder = folderStructure[folder];
    const shouldSelect = !isFolderFullySelected(folder);

    filesInFolder.forEach(file => {
      const isCurrentlySelected = selectedFiles.has(file.filePath);
      if (shouldSelect && !isCurrentlySelected) {
        onToggleFile(file.filePath);
      } else if (!shouldSelect && isCurrentlySelected) {
        onToggleFile(file.filePath);
      }
    });
  };

  // Toggle folder expansion
  const toggleExpanded = (folder: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folder)) {
      newExpanded.delete(folder);
    } else {
      newExpanded.add(folder);
    }
    setExpandedFolders(newExpanded);
  };

  const getColorClasses = () => {
    switch (type) {
      case 'upload':
        return {
          text: 'text-green-700 dark:text-green-300',
          hover: 'hover:bg-green-100 dark:hover:bg-green-900/30',
          folder: 'text-green-600 dark:text-green-400'
        };
      case 'download':
        return {
          text: 'text-blue-700 dark:text-blue-300',
          hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30',
          folder: 'text-blue-600 dark:text-blue-400'
        };
      case 'deleteLocal':
      case 'deleteRemote':
        return {
          text: 'text-red-700 dark:text-red-300',
          hover: 'hover:bg-red-100 dark:hover:bg-red-900/30',
          folder: 'text-red-600 dark:text-red-400'
        };
      case 'conflict':
        return {
          text: 'text-yellow-700 dark:text-yellow-300',
          hover: 'hover:bg-yellow-100 dark:hover:bg-yellow-900/30',
          folder: 'text-yellow-600 dark:text-yellow-400'
        };
    }
  };

  const colors = getColorClasses();

  return (
    <div className="space-y-1">
      {sortedFolders.map(folder => {
        const filesInFolder = folderStructure[folder];
        const isExpanded = expandedFolders.has(folder);
        const isFullySelected = isFolderFullySelected(folder);
        const isPartiallySelected = isFolderPartiallySelected(folder);
        const selectedCount = filesInFolder.filter(f => selectedFiles.has(f.filePath)).length;

        return (
          <div key={folder} className="border-b border-border/40 last:border-0">
            {/* Folder Header */}
            <div className={`flex items-center gap-2 py-1.5 px-2 ${colors.hover} rounded`}>
              <Checkbox
                id={`folder-${folder}`}
                checked={isFullySelected}
                ref={(el) => {
                  if (el && isPartiallySelected) {
                    el.indeterminate = true;
                  }
                }}
                onCheckedChange={() => toggleFolder(folder)}
                className="mt-0.5"
              />
              <button
                onClick={() => toggleExpanded(folder)}
                className="flex items-center gap-1 flex-1 text-left"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                <Folder className={`h-4 w-4 shrink-0 ${colors.folder}`} />
                <span className={`font-semibold text-sm ${colors.text}`}>
                  {folder}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  ({selectedCount}/{filesInFolder.length})
                </span>
              </button>
            </div>

            {/* Files in Folder */}
            {isExpanded && (
              <div className="ml-8 space-y-1 mt-1">
                {filesInFolder.map(item => {
                  const isChecked = selectedFiles.has(item.filePath);
                  const matchInfo = extractMatchInfo ? extractMatchInfo(item.filePath, tournaments) : null;
                  const fileName = item.filePath.substring(item.filePath.lastIndexOf('/') + 1);

                  return (
                    <div key={item.filePath} className={`flex items-start gap-2 py-1 px-2 rounded ${colors.hover}`}>
                      <Checkbox
                        id={`file-${item.filePath}`}
                        checked={isChecked}
                        onCheckedChange={() => onToggleFile(item.filePath)}
                        className="mt-0.5"
                      />
                      <div
                        className={`flex-1 cursor-pointer ${onFileClick ? 'hover:underline' : ''}`}
                        onClick={() => onFileClick?.(item)}
                      >
                        <div className="flex items-center gap-1">
                          <File className="h-3 w-3 shrink-0 opacity-50" />
                          <span className={`font-mono text-xs ${colors.text}`}>{fileName}</span>
                        </div>
                        {matchInfo && (
                          <span className={`text-xs ml-4 font-semibold ${
                            matchInfo.isOutsideFixture
                              ? 'text-purple-600 dark:text-purple-400'
                              : 'text-orange-600 dark:text-orange-400'
                          }`}>
                            ({matchInfo.homeTeam} vs {matchInfo.awayTeam}, {matchInfo.category}, {matchInfo.date})
                            {matchInfo.isOutsideFixture && <span className="ml-1">🔵 FUERA DE FIXTURE</span>}
                          </span>
                        )}
                        {item.reason && type !== 'conflict' && (
                          <span className={`text-xs ml-2 ${colors.text} opacity-70`}>
                            ({item.reason})
                          </span>
                        )}
                        {type === 'conflict' && (
                          <span className="text-xs ml-2">
                            {item.decision === 'local-wins' ? '💻 Local gana' :
                             item.decision === 'remote-wins' ? '☁️ Remoto gana' :
                             item.decision === 'skip' ? '🚫 Omitir' :
                             '❓ Sin resolver'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
