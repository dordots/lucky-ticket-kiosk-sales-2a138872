import { createClient } from '@base44/sdk';
// import { getAccessToken } from '@base44/sdk/utils/auth-utils';

// Create a client with authentication required
// Note: requiresAuth: false allows manual auth handling to prevent auto-redirect
export const base44 = createClient({
  appId: "692c1590f3e6a1aa2a138872", 
  serverUrl: 'https://base44.app', // Explicitly set server URL
  env: 'prod', // Set environment
  requiresAuth: false, // Set to false to handle auth manually and prevent auto-redirect
  autoInitAuth: true, // Auto-detect tokens from URL or localStorage
});
