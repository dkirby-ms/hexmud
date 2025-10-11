import { PublicClientApplication } from '@azure/msal-browser';

import { isMsalConfigured, msalConfig } from './msalConfig.js';

let instance: PublicClientApplication | null = null;

export const initMsal = (): PublicClientApplication | null => {
  if (!isMsalConfigured()) {
    return null;
  }

  instance ??= new PublicClientApplication(msalConfig);

  return instance;
};

export const resetMsalInstanceForTests = () => {
  instance = null;
};
