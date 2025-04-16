export type Session = {
  username: string;
  authed: boolean;
  loading: boolean;
  backupCreated: boolean | null;
  error?: SessionError;
};

export type SessionError = 'Insecure Context' | 'Unsupported Browser';

export const errorToMessage = (error: SessionError): string => {
  switch (error) {
    case 'Insecure Context':
      return `This application requires a secure context (HTTPS)`;

    case 'Unsupported Browser':
      return `Your browser does not support the required features`;
  }
};