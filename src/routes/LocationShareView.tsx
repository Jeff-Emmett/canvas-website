import React from 'react';
import { useParams } from 'react-router-dom';
import { LocationViewer } from '@/components/location/LocationViewer';

export const LocationShareView: React.FC = () => {
  const { token } = useParams<{ token: string }>();

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Invalid Share Link</h2>
          <p className="text-sm text-muted-foreground">No share token provided in the URL</p>
        </div>
      </div>
    );
  }

  return <LocationViewer shareToken={token} />;
};




























