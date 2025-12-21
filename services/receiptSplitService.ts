import { GoogleGenerativeAI } from '@google/generative-ai';
import { AppSettings } from '../types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

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
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          lineItems: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                amount: { type: 'number' },
                quantity: { type: 'string' },
                suggestedCategory: { type: 'string' },
              },
              required: ['description', 'amount', 'suggestedCategory'],
            },
          },
          totalAmount: { type: 'number' },
          merchant: { type: 'string' },
          date: { type: 'string' },
        },
        required: ['lineItems', 'totalAmount'],
      },
    },
  });

  const categoryList = settings.categories.map(c => c.name).join(', ');

  const prompt = `Parse this receipt image and extract all line items.

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

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType,
      },
    },
  ]);

  const response = result.response;
  const text = response.text();
  const parsed: ReceiptParseResult = JSON.parse(text);

  return parsed;
}
