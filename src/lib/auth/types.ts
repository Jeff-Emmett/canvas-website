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
    case 'Insecure Context':
      return `This application requires a secure context (HTTPS)`;

    case 'Unsupported Browser':
      return `Your browser does not support the required features`;
  }
};
  