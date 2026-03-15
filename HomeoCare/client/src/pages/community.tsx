
import React from 'react';
import { CommunityChat } from '../components/community-chat';

export default function Community() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-4">Community Chat</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Connect with fellow homeopathy enthusiasts, share experiences, and learn from each other's journey to wellness.
        </p>
      </div>
      
      <CommunityChat />
      
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>
          Please be respectful and remember that discussions here are for informational purposes only.
          Always consult with healthcare professionals for medical advice.
        </p>
      </div>
    </div>
  );
}
