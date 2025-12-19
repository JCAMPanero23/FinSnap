import { NativeBiometric } from 'capacitor-native-biometric';
import { getSetting, saveSetting } from './indexedDBService';

const BIOMETRIC_ENABLED_KEY = 'biometricEnabled';

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch (error) {
    console.log('Biometric not available:', error);
    return false;
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  const enabled = await getSetting(BIOMETRIC_ENABLED_KEY);
  return enabled === true;
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  await saveSetting(BIOMETRIC_ENABLED_KEY, enabled);
}

export async function authenticate(): Promise<{ success: boolean; error?: string }> {
  try {
    await NativeBiometric.verifyIdentity({
      reason: 'Unlock FinSnap',
      title: 'Biometric Authentication',
      subtitle: 'Unlock to access your data',
      description: 'Use your fingerprint or face to unlock',
      useFallback: true,
      negativeButtonText: 'Cancel',
    });
    return { success: true };
  } catch (error: any) {
    console.error('Biometric authentication failed:', error);
    return { success: false, error: error.message || 'Authentication failed' };
  }
}
