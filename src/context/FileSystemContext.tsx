import React, { createContext, useContext, useState, ReactNode } from 'react';
import type * as webnative from 'webnative';
import type FileSystem from 'webnative/fs/index';

/**
 * File system context interface
 */
interface FileSystemContextType {
  fs: FileSystem | null;
  setFs: (fs: FileSystem | null) => void;
  isReady: boolean;
}

// Create context with a default undefined value
const FileSystemContext = createContext<FileSystemContextType | undefined>(undefined);

/**
 * FileSystemProvider component
 * 
 * Provides access to the webnative filesystem throughout the application.
 */
export const FileSystemProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [fs, setFs] = useState<FileSystem | null>(null);

  // File system is ready when it's not null
  const isReady = fs !== null;

  return (
    <FileSystemContext.Provider value={{ fs, setFs, isReady }}>
      {children}
    </FileSystemContext.Provider>
  );
};

/**
 * Hook to access the file system context
 * 
 * @returns The file system context
 * @throws Error if used outside of FileSystemProvider
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
 * Common filesystem operations
 * 
 * @param fs The filesystem instance
 * @returns An object with filesystem utility functions
 */
export const createFileSystemUtils = (fs: FileSystem) => {
  return {
    /**
     * Creates a directory if it doesn't exist
     * 
     * @param path Array of path segments
     */
    ensureDirectory: async (path: string[]): Promise<void> => {
      const dirPath = webnative.path.directory(...path);
      const exists = await fs.exists(dirPath);
      if (!exists) {
        await fs.mkdir(dirPath);
      }
    },
    
    /**
     * Writes a file to the filesystem
     * 
     * @param path Array of path segments
     * @param fileName The name of the file
     * @param content The content to write
     */
    writeFile: async (path: string[], fileName: string, content: Blob | string): Promise<void> => {
      const filePath = webnative.path.file(...path, fileName);
      await fs.write(filePath, content);
      await fs.publish();
    },
    
    /**
     * Reads a file from the filesystem
     * 
     * @param path Array of path segments
     * @param fileName The name of the file
     * @returns The file content
     */
    readFile: async (path: string[], fileName: string): Promise<any> => {
      const filePath = webnative.path.file(...path, fileName);
      const exists = await fs.exists(filePath);
      if (!exists) {
        throw new Error(`File doesn't exist: ${filePath}`);
      }
      return await fs.read(filePath);
    },
    
    /**
     * Checks if a file exists
     * 
     * @param path Array of path segments
     * @param fileName The name of the file
     * @returns Boolean indicating if the file exists
     */
    fileExists: async (path: string[], fileName: string): Promise<boolean> => {
      const filePath = webnative.path.file(...path, fileName);
      return await fs.exists(filePath);
    },
    
    /**
     * Lists files in a directory
     * 
     * @param path Array of path segments
     * @returns Object with file names as keys
     */
    listDirectory: async (path: string[]): Promise<Record<string, any>> => {
      const dirPath = webnative.path.directory(...path);
      const exists = await fs.exists(dirPath);
      if (!exists) {
        return {};
      }
      return await fs.ls(dirPath);
    }
  };
};

/**
 * Hook to use filesystem utilities
 * 
 * @returns Filesystem utilities or null if filesystem is not ready
 */
export const useFileSystemUtils = () => {
  const { fs, isReady } = useFileSystem();
  
  if (!isReady || !fs) {
    return null;
  }
  
  return createFileSystemUtils(fs);
};