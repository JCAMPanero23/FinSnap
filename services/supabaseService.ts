import { supabase } from '../lib/supabase';
import { Transaction, AppSettings } from '../types';

export const parseTransactions = async (
  text: string,
  settings: AppSettings,
  imageBase64?: string,
  imageMimeType?: string
): Promise<Omit<Transaction, 'id'>[]> => {
  try {
    // Call the Edge Function
    const { data, error } = await supabase.functions.invoke('parse-transactions', {
      body: {
        text,
        imageBase64,
        imageMimeType,
        settings
      }
    });

    if (error) throw error;

    return data.transactions || [];
  } catch (error) {
    console.error("Error parsing transactions:", error);
    throw new Error("Failed to process the input. Please try again.");
  }
};
