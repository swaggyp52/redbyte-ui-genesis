import { startAuthentication, startRegistration, browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
import type { ApiClient } from './api.js';

export async function passkeysAvailable(): Promise<boolean> {
  try {
    return browserSupportsWebAuthn() && (await platformAuthenticatorIsAvailable());
  } catch {
    return false;
  }
}

export async function registerPasskey(api: ApiClient, label: string): Promise<number> {
  const { challengeId, options } = await api.registerOptions();
  const response = await startRegistration({ optionsJSON: options as Parameters<typeof startRegistration>[0]['optionsJSON'] });
  const result = await api.registerVerify(challengeId, response, label);
  return result.passkeyCount;
}

export async function loginWithPasskey(api: ApiClient): Promise<void> {
  const { challengeId, options } = await api.loginOptions();
  const response = await startAuthentication({ optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'] });
  await api.loginVerify(challengeId, response);
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
}

export function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
