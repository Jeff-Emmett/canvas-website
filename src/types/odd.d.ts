declare module '@oddjs/odd' {
  export interface Program {
    session?: Session;
  }

  export interface Session {
    username: string;
    fs: FileSystem;
  }

  export interface FileSystem {
    mkdir(path: string): Promise<void>;
  }

  export const program: (options: { namespace: { creator: string; name: string }; username?: string }) => Promise<Program>;
  export const session: {
    destroy(): Promise<void>;
  };
  export const account: {
    isUsernameValid(username: string): Promise<boolean>;
    isUsernameAvailable(username: string): Promise<boolean>;
  };
  export const dataRoot: {
    lookup(username: string): Promise<any>;
  };
  export const path: {
    directory(...parts: string[]): string;
  };
}

declare module '@oddjs/odd/fs/index' {
  export interface FileSystem {
    mkdir(path: string): Promise<void>;
  }
  export default FileSystem;
} 