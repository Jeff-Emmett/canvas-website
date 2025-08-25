import React, { createContext, useContext, useState, ReactNode } from 'react';
import * as webnative from 'webnative';
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
      try {
        const dirPath = webnative.path.directory(...path);
        const exists = await fs.exists(dirPath as any);
        if (!exists) {
          await fs.mkdir(dirPath as any);
        }
      } catch (error) {
        console.error('Error ensuring directory:', error);
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
      try {
        const filePath = webnative.path.file(...path, fileName);
        // Convert content to appropriate format for webnative
        const contentToWrite = typeof content === 'string' ? new TextEncoder().encode(content) : content;
        await fs.write(filePath as any, contentToWrite as any);
        await fs.publish();
      } catch (error) {
        console.error('Error writing file:', error);
      }
    },
    
    /**
     * Reads a file from the filesystem
     * 
     * @param path Array of path segments
     * @param fileName The name of the file
     * @returns The file content
     */
    readFile: async (path: string[], fileName: string): Promise<any> => {
      try {
        const filePath = webnative.path.file(...path, fileName);
        const exists = await fs.exists(filePath as any);
        if (!exists) {
          throw new Error(`File doesn't exist: ${fileName}`);
        }
        return await fs.read(filePath as any);
      } catch (error) {
        console.error('Error reading file:', error);
        throw error;
      }
    },
    
    /**
     * Checks if a file exists
     * 
     * @param path Array of path segments
     * @param fileName The name of the file
     * @returns Boolean indicating if the file exists
     */
    fileExists: async (path: string[], fileName: string): Promise<boolean> => {
      try {
        const filePath = webnative.path.file(...path, fileName);
        return await fs.exists(filePath as any);
      } catch (error) {
        console.error('Error checking file existence:', error);
        return false;
      }
    },
    
    /**
     * Lists files in a directory
     * 
     * @param path Array of path segments
     * @returns Object with file names as keys
     */
    listDirectory: async (path: string[]): Promise<Record<string, any>> => {
      try {
        const dirPath = webnative.path.directory(...path);
        const exists = await fs.exists(dirPath as any);
        if (!exists) {
          return {};
        }
        return await fs.ls(dirPath as any);
      } catch (error) {
        console.error('Error listing directory:', error);
        return {};
      }
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