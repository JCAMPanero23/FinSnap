import { GoogleGenAI, Type } from '@google/genai';
import { AppSettings } from '../types';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export interface ReceiptLineItem {
  description: string;
  amount: number;
  quantity?: string;
  suggestedCategory: string;
}

export interface ReceiptParseResult {
  lineItems: ReceiptLineItem[];
  totalAmount: number;
  merchant?: string;
  date?: string;
}

export async function parseReceiptLineItems(
  imageBase64: string,
  mimeType: string,
  settings: AppSettings
): Promise<ReceiptParseResult> {
  const categoryList = settings.categories.map(c => c.name).join(', ');

  const SYSTEM_INSTRUCTION = `Parse this receipt image and extract all line items.

Available categories: ${categoryList}

For each line item, provide:
- description: Item name/description
- amount: Price (number only, no currency symbols)
- quantity: Optional quantity/unit (e.g., "2 lbs", "3x")
- suggestedCategory: Best matching category from the list

Also extract:
- totalAmount: Total on receipt
- merchant: Store/merchant name
- date: Transaction date (YYYY-MM-DD format)

Group similar items intelligently. For example, "Milk 2.50" and "Eggs 3.00" can be separate items but both under "Groceries" category.`;

  const parts = [
    { inlineData: { data: imageBase64, mimeType: mimeType } }
  ];

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          lineItems: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                amount: { type: Type.NUMBER },
                quantity: { type: Type.STRING },
                suggestedCategory: { type: Type.STRING },
              },
              required: ['description', 'amount', 'suggestedCategory'],
            },
          },
          totalAmount: { type: Type.NUMBER },
          merchant: { type: Type.STRING },
          date: { type: Type.STRING },
        },
        required: ['lineItems', 'totalAmount'],
      },
    },
  });

  const jsonStr = response.text;
  if (!jsonStr) {
    throw new Error('No response from AI');
  }

  const parsed: ReceiptParseResult = JSON.parse(jsonStr);
  return parsed;
}
