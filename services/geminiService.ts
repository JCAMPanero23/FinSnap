import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, TransactionType, AppSettings } from "../types";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export const parseTransactions = async (
  text: string, 
  settings: AppSettings,
  imageBase64?: string, 
  imageMimeType?: string
): Promise<Omit<Transaction, 'id'>[]> => {
  try {
    const parts: any[] = [];
    
    // Add image part if available
    if (imageBase64 && imageMimeType) {
      parts.push({
        inlineData: {
          data: imageBase64,
          mimeType: imageMimeType
        }
      });
      parts.push({ text: "Extract transaction details from this image. If there is text provided as well, use it to help context." });
    }

    // Add text part if available
    if (text) {
      parts.push({ text: `Parse the following text into transactions: "${text}"` });
    }

    if (parts.length === 0) {
      throw new Error("No input provided");
    }

    const categoryList = settings.categories.map(c => c.name).join(", ");
    const accountList = settings.accounts.map(a => 
      `{id: "${a.id}", name: "${a.name}", last4: "${a.last4Digits || ''}", type: "${a.type}"}`
    ).join(", ");
    
    const recurringRulesList = (settings.recurringRules || []).map(r => 
      `{keyword: "${r.merchantKeyword}", category: "${r.category || ''}", type: "${r.type || 'EXPENSE'}"}`
    ).join(", ");

    const cashAccount = settings.accounts.find(a => a.type === 'Cash' || a.type === 'Wallet');
    const cashAccountInfo = cashAccount ? `Use account "${cashAccount.name}" (ID: ${cashAccount.id})` : "a generic 'Cash' account";

    const SYSTEM_INSTRUCTION = `
      You are a specialized financial assistant API. Your goal is to parse raw text messages (like bank SMS, email notifications, or pasted text) OR images of such messages into structured financial transaction data.

      The user's Base Currency is: ${settings.baseCurrency}.
      The user's Custom Categories are: ${categoryList}.
      The user's Known Accounts are: [${accountList}].

      Parsing Helpers: [${recurringRulesList}].
      Use these helpers:
      - If a merchant name roughly matches a keyword and type is 'EXPENSE' or 'INCOME', use the provided category.
      - If a merchant/keyword matches a rule with type='TRANSFER', strictly treat it as a TRANSFER.

      CRITICAL RULES:
      1. **FAILED TRANSACTIONS**: If a message says "could not be completed", "declined", "failed", "unsuccessful", or "reversed", **IGNORE IT COMPLETELY**. Do NOT output a transaction for it.

      2. **BANK STATEMENT PARSING**:
         - If parsing an image/text that looks like a bank statement (has header with "Account Number", "Account Statement", table structure), recognize the account in the HEADER.
         - The account number shown at the TOP of the statement is the SOURCE account for ALL transactions in the table below.
         - DO NOT treat the header account as a separate transaction or different account.
         - Match the header account number with Known Accounts using last 4 digits or full number.
         - Apply that accountId to ALL parsed transactions from the table.

      3. **CHEQUE DETECTION**:
         - Look for cheque/check numbers in transactions (e.g., "Ref/Cheque No: 241626", "CHQ 123456", "Cheque Number: XXX").
         - If a transaction mentions a cheque number, set 'isCheque' to true and populate 'chequeNumber' with the number.
         - Cheque transactions should have status 'PENDING' by default (they need to be cleared/matched later).
         - Common cheque indicators: "CHQ", "CHEQUE", "CHECK", "Ref/Cheque No", or standalone 6-digit numbers in a cheque column.

      4. **WITHDRAWALS**: If the text indicates a "Cash Withdrawal" or "ATM Withdrawal":
         - Treat it as a TRANSFER.
         - Source: The bank/card mentioned.
         - Destination: ${cashAccountInfo}.
         - Generate TWO transactions: Expense from Source, Income to Destination.

      5. Identify if a transaction is an EXPENSE, INCOME, or TRANSFER.

      6. Extract the Merchant Name (clean up formatting).

      7. Categorize the transaction into ONE of the user's provided categories.

      8. Extract the date (YYYY-MM-DD) and time (HH:mm). Assume current year if missing.

      9. ACCOUNT MATCHING:
         - Look for card/account digits (e.g. "ending 1234", "no. XXX920001", "Cr.Card XXX1337"). Match with Known Accounts.
         - For bank statements, use the account from the header for all transactions.
         - Set 'accountId' if matched.

      10. BALANCE & CURRENCY:
         - If the transaction is in a foreign currency (not ${settings.baseCurrency}), populate 'originalAmount' and 'originalCurrency'.
         - Extract 'amount' in ${settings.baseCurrency}. If not explicitly stated, estimate it or leave it equal to originalAmount (it will be refined by balance logic if available).
         - Extract the numeric value of balance even if attached to currency code (e.g. "AED8637.52" -> 8637.52).
         - Look for "Available Balance", "Avl Bal", "Balance is", or "Balance" column in statements. Extract into 'parsedMeta.availableBalance'.
         - Look for "Available Credit Limit", "Avl. Cr.limit". Extract into 'parsedMeta.availableCredit'.

      11. TRANSFERS:
         - If text describes a transfer between TWO known accounts, generate TWO transaction objects (Expense from Source, Income to Dest).
         - Set 'isTransfer': true for both.

      Return an array of transactions.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              amount: { type: Type.NUMBER },
              currency: { type: Type.STRING },
              originalAmount: { type: Type.NUMBER },
              originalCurrency: { type: Type.STRING },
              merchant: { type: Type.STRING },
              date: { type: Type.STRING },
              time: { type: Type.STRING },
              category: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["EXPENSE", "INCOME"] },
              account: { type: Type.STRING },
              accountId: { type: Type.STRING },
              rawText: { type: Type.STRING },
              isTransfer: { type: Type.BOOLEAN },
              isCheque: { type: Type.BOOLEAN, description: "True if this transaction is a cheque payment" },
              chequeNumber: { type: Type.STRING, description: "The cheque/check number if detected" },
              chequeStatus: { type: Type.STRING, enum: ["PENDING", "CLEARED"], description: "Cheque status - PENDING for new cheques" },
              tags: { type: Type.ARRAY, items: { type: Type.STRING } },
              parsedMeta: {
                type: Type.OBJECT,
                properties: {
                  availableBalance: { type: Type.NUMBER, description: "The actual account balance if found" },
                  availableCredit: { type: Type.NUMBER, description: "The available credit limit if found" }
                }
              }
            },
            required: ["amount", "merchant", "date", "category", "type"],
          },
        },
      },
    });

    const jsonStr = response.text;
    if (!jsonStr) return [];
    
    let parsedData: any[] = JSON.parse(jsonStr);

    // --- Post-Processing for Precise Balance-Based Conversion ---
    
    // 1. Sort Chronologically (Oldest first) to ensure running balance logic works for bulk entries
    parsedData.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time || '00:00'}`).getTime();
      const dateB = new Date(`${b.date}T${b.time || '00:00'}`).getTime();
      return dateA - dateB;
    });

    // 2. Initialize running states from current App Settings
    const accountStates: Record<string, { balance: number, limit?: number }> = {};
    settings.accounts.forEach(a => {
      accountStates[a.id] = { balance: a.balance, limit: a.totalCreditLimit };
    });

    // 3. Refine Amounts
    parsedData = parsedData.map(tx => {
      const state = tx.accountId ? accountStates[tx.accountId] : null;
      const isForeign = tx.originalCurrency && tx.originalCurrency !== settings.baseCurrency;
      
      // Calculate 'Real Cost' if foreign currency and balance info is available
      if (state && isForeign) {
        let prevBalance = state.balance;
        let newBalance = prevBalance; // Default if no meta found
        let foundMeta = false;

        // Case A: Available Balance (Debit / Bank)
        if (tx.parsedMeta?.availableBalance !== undefined) {
          newBalance = tx.parsedMeta.availableBalance;
          foundMeta = true;
        } 
        // Case B: Available Credit (Credit Card)
        // Balance = -(Limit - AvlCredit)
        else if (tx.parsedMeta?.availableCredit !== undefined && state.limit) {
          newBalance = -(state.limit - tx.parsedMeta.availableCredit);
          foundMeta = true;
        }

        if (foundMeta) {
          // The difference is the actual amount charged in Base Currency
          const diff = Math.abs(prevBalance - newBalance);
          
          // Sanity check: If diff is reasonable (e.g. not 0 unless amount is 0)
          if (diff > 0.01) {
            tx.amount = Number(diff.toFixed(2));
            tx.currency = settings.baseCurrency; // Ensure base currency
          }
        }
      }

      // Update Running State for next iteration (Bulk Entry support)
      if (state) {
        if (tx.parsedMeta?.availableBalance !== undefined) {
           state.balance = tx.parsedMeta.availableBalance;
        } else if (tx.parsedMeta?.availableCredit !== undefined && state.limit) {
           state.balance = -(state.limit - tx.parsedMeta.availableCredit);
        } else {
           // If no balance info, manually adjust tracking
           if (tx.type === "EXPENSE") state.balance -= tx.amount;
           else state.balance += tx.amount;
        }
      }

      // Finalize Exchange Rate
      tx.exchangeRate = (tx.originalAmount && tx.amount && tx.originalAmount !== tx.amount)
        ? tx.amount / tx.originalAmount
        : 1;

      tx.type = tx.type === "INCOME" ? TransactionType.INCOME : TransactionType.EXPENSE;

      // Set default cheque status if cheque detected
      if (tx.isCheque && !tx.chequeStatus) {
        tx.chequeStatus = 'PENDING';
      }

      return tx;
    });

    // 4. Reverse back to Newest First for UI
    return parsedData.reverse();

  } catch (error) {
    console.error("Error parsing transactions with Gemini:", error);
    throw new Error("Failed to process the input. Please try again.");
  }
};