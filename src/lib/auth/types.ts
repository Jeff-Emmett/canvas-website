export interface Session {
  username: string;
  authed: boolean;
  loading: boolean;
  backupCreated: boolean | null;
  error?: string;
}

export enum SessionError {
  PROGRAM_FAILURE = 'PROGRAM_FAILURE',
  FILESYSTEM_INIT_FAILURE = 'FILESYSTEM_INIT_FAILURE',
  DATAROOT_NOT_FOUND = 'DATAROOT_NOT_FOUND',
  UNKNOWN = 'UNKNOWN'
}

export const errorToMessage = (error: SessionError): string | undefined => {
  switch (error) {
    case SessionError.PROGRAM_FAILURE:
      return `Program failure occurred`;

    case SessionError.FILESYSTEM_INIT_FAILURE:
      return `Failed to initialize filesystem`;

    case SessionError.DATAROOT_NOT_FOUND:
      return `Data root not found`;

    case SessionError.UNKNOWN:
      return `An unknown error occurred`;

    default:
      return undefined;
  }
};
  