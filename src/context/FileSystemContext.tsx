import React, { createContext, useContext, useState, ReactNode } from 'react';

/**
 * FileSystemContext - PLACEHOLDER
 *
 * Previously used webnative for Fission WNFS integration.
 * Now a stub - file system functionality is handled via local storage
 * or server-side APIs when needed.
 */

// Placeholder FileSystem interface matching previous API
interface FileSystem {
  exists: (path: any) => Promise<boolean>;
  mkdir: (path: any) => Promise<void>;
  write: (path: any, content: any) => Promise<void>;
  read: (path: any) => Promise<any>;
  ls: (path: any) => Promise<Record<string, any>>;
  publish: () => Promise<void>;
}

interface FileSystemContextType {
  fs: FileSystem | null;
  setFs: (fs: FileSystem | null) => void;
  isReady: boolean;
}

const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

/**
 * FileSystemProvider - Stub implementation
 */
export const FileSystemProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [fs, setFs] = useState<FileSystem | null>(null);

  // File system is never ready in stub mode
  const isReady = false;

  return (
    <FileSystemContext.Provider value={{ fs, setFs, isReady }}>
      {children}
    </FileSystemContext.Provider>
  );
};

/**
 * Hook to access the file system context
 */
export const useFileSystem = (): FileSystemContextType => {
  const context = useContext(FileSystemContext);
  if (context === undefined) {
    throw new Error('useFileSystem must be used within a FileSystemProvider');
  }
  return context;
};

/**
 * Directory paths used in the application
 */
export const DIRECTORIES = {
  PUBLIC: {
    ROOT: ['public'],
    GALLERY: ['public', 'gallery'],
    DOCUMENTS: ['public', 'documents']
  },
  PRIVATE: {
    ROOT: ['private'],
    GALLERY: ['private', 'gallery'],
    SETTINGS: ['private', 'settings'],
    DOCUMENTS: ['private', 'documents']
  }
};

/**
 * Stub filesystem utilities - returns no-op functions
 */
export const createFileSystemUtils = (_fs: FileSystem) => {
  console.warn('⚠️ FileSystemUtils is a stub - webnative has been removed');
  return {
    ensureDirectory: async (_path: string[]): Promise<void> => {},
    writeFile: async (_path: string[], _fileName: string, _content: Blob | string): Promise<void> => {},
    readFile: async (_path: string[], _fileName: string): Promise<any> => {
      throw new Error('FileSystem not available');
    },
    fileExists: async (_path: string[], _fileName: string): Promise<boolean> => false,
    listDirectory: async (_path: string[]): Promise<Record<string, any>> => ({})
  };
};

/**
 * Hook to use filesystem utilities - always returns null in stub mode
 */
export const useFileSystemUtils = () => {
  const { fs, isReady } = useFileSystem();

  if (!isReady || !fs) {
    return null;
  }

  return createFileSystemUtils(fs);
};
