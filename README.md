<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# FinSnap - AI-Powered Expense Tracker

FinSnap is a modern, mobile-first expense tracking application powered by Google Gemini AI. It intelligently parses bank SMS messages, emails, and receipt images to automatically categorize and track your financial transactions.

## Features

- 🤖 **AI-Powered Parsing** - Uses Google Gemini to extract transaction details from SMS, emails, and images
- 📱 **Mobile-First Design** - Responsive React app optimized for mobile devices
- ☁️ **Cloud Sync** - All data backed up securely on Supabase
- 🔐 **Multi-Device Support** - Sign in on multiple phones, data syncs automatically
- 💳 **Multi-Account Management** - Track bank accounts, credit cards, wallets, and more
- 📊 **Analytics & Charts** - Visual breakdown of expenses by category
- 🏷️ **Smart Categorization** - AI-powered auto-categorization with customizable categories
- 💱 **Multi-Currency Support** - Automatic exchange rate handling
- 🔄 **Recurring Rules** - Smart merchant patterns for faster categorization
- 📅 **Calendar View** - Visualize transactions by date

## Tech Stack

### Frontend
- **React 19** - Modern UI framework
- **TypeScript** - Type-safe code
- **Tailwind CSS** - Utility-first styling
- **Vite** - Fast build tooling
- **Capacitor** - Native Android app wrapper
- **Lucide Icons** - Beautiful icon library
- **Recharts** - Data visualization

### Backend
- **Supabase** - PostgreSQL database + Auth + Edge Functions
- **Google Gemini 2.5 Flash** - AI-powered transaction parsing
- **Row Level Security** - Secure multi-tenant data isolation

## Architecture

### Data Flow

1. **User Input** → SMS text, email, or receipt image
2. **Frontend** → React app on mobile or web
3. **Supabase Auth** → Secure user authentication
4. **Edge Function** → Server-side Gemini API call (API key secure)
5. **Post-Processing** → Balance refinement, currency conversion
6. **Database** → PostgreSQL with automatic sync
7. **Real-time Sync** → Changes reflected across devices

### Security

- ✅ API keys stored server-side only (never exposed to client)
- ✅ PostgreSQL encryption at rest
- ✅ Row-level security policies (users can only access own data)
- ✅ HTTPS/TLS encryption in transit
- ✅ Automatic user data isolation

## Getting Started

### Prerequisites

- Node.js 16+
- Supabase account (free tier at https://supabase.com)
- Google Gemini API key (free tier at https://ai.google.dev)
- Android Studio (for building APK)

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/JCAMPanero23/FinSnap.git
   cd FinSnap
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Supabase**
   - Create a project at https://supabase.com
   - Run the SQL schema from `docs/database-schema.sql`
   - Deploy the Edge Function from `docs/edge-function.ts`
   - Copy your Project URL and anon key to `lib/supabase.ts`

4. **Set up Gemini API**
   - Get your API key from https://ai.google.dev
   - Add it as a secret in Supabase Edge Functions

5. **Start development server**
   ```bash
   npm run dev
   ```
   - Open http://localhost:3000
   - Sign up with email/password
   - Try parsing a transaction!

### Building for Android

1. **Build the web app**
   ```bash
   npm run build
   ```

2. **Sync with Capacitor**
   ```bash
   npx cap sync android
   ```

3. **Open in Android Studio**
   ```bash
   npx cap open android
   ```

4. **Build APK**
   - Click **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
   - APK location: `android/app/build/outputs/apk/debug/app-debug.apk`

5. **Install on phone**
   - Enable "Install from Unknown Sources" in phone settings
   - Transfer APK via USB or email
   - Open and install

## Project Structure

```
FinSnap/
├── src/
│   ├── components/          # React components
│   │   ├── Dashboard.tsx    # Summary and charts
│   │   ├── AddTransaction.tsx
│   │   ├── TransactionList.tsx
│   │   ├── EditTransactionModal.tsx
│   │   ├── SettingsView.tsx
│   │   ├── AccountsView.tsx
│   │   ├── CalendarView.tsx
│   │   └── Auth.tsx         # Login/Signup
│   ├── services/
│   │   └── supabaseService.ts  # API calls to Edge Function
│   ├── lib/
│   │   └── supabase.ts      # Supabase client config
│   ├── types.ts             # TypeScript interfaces
│   ├── App.tsx              # Main app state management
│   └── index.tsx            # React entry point
├── android/                 # Capacitor Android project
├── docs/
│   ├── database-schema.sql  # PostgreSQL schema
│   └── edge-function.ts     # Gemini API proxy
├── vite.config.ts
├── tsconfig.json
├── capacitor.config.ts
└── package.json
```

## Configuration

### Supabase Setup (Required)

1. Create tables using `docs/database-schema.sql`
2. Deploy Edge Function `parse-transactions`
3. Add `GEMINI_API_KEY` secret to Edge Function
4. Update `lib/supabase.ts` with your credentials

### Environment Variables

Create `.env.local` (for local development only):
```
GEMINI_API_KEY=your-api-key-here
```

Note: In production (APK), the Edge Function handles Gemini calls securely server-side.

## Development Commands

```bash
# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview

# Build APK (requires Android setup)
npm run build && npx cap sync android
```

## Database Schema

The app uses Supabase with PostgreSQL:

- **user_settings** - User preferences (currency, etc.)
- **categories** - Expense categories
- **accounts** - Bank accounts, credit cards, wallets
- **transactions** - Transaction records
- **recurring_rules** - Merchant patterns for auto-categorization

All tables have Row Level Security enabled - users can only access their own data.

## How AI Parsing Works

The Gemini AI parser:
1. Analyzes SMS text or receipt images
2. Extracts transaction amount, merchant, date, time
3. Auto-categorizes based on user's categories
4. Matches accounts by last 4 digits
5. Applies recurring rules for merchants
6. Handles multi-currency with exchange rates
7. Ignores failed transactions
8. Detects transfers and ATM withdrawals

**Example:**
```
Input: "Your card ending 1234 was charged $50.00 at Starbucks. Available balance: $450.00"

Output:
{
  merchant: "Starbucks",
  amount: 50.00,
  category: "Food & Dining",
  type: "EXPENSE",
  accountId: "card-1234",
  parsedMeta: {
    availableBalance: 450.00
  }
}
```

## Security Considerations

### What's Secure
- ✅ API keys never exposed to client
- ✅ User authentication via Supabase
- ✅ Data encrypted in database
- ✅ Row-level security prevents data leaks

### What to Remember
- ⚠️ APK can be extracted/reversed (app APKs are generally extractable)
- ⚠️ For production SaaS, consider additional measures:
  - Backend API proxy for all requests
  - Device-specific tokens
  - Rate limiting per user
  - Data encryption end-to-end

## Deployment

### Web Version
Deploy to Vercel, Netlify, or any static host:
```bash
npm run build
# Upload dist/ folder
```

### Android App
1. Build signed release APK in Android Studio
2. Upload to Google Play Store
3. Update version in `android/app/build.gradle`

## Troubleshooting

### Database Error on Signup
If you see "Database error saving new user":
- Check that the SQL schema was run completely
- Verify the `initialize_user_defaults()` function has `SECURITY DEFINER`
- Rebuild the trigger

### Gemini API Errors
- Verify API key is set in Supabase Edge Function secrets
- Check that Edge Function has internet access
- Ensure you haven't exceeded free tier limits (1,500 requests/day)

### APK Installation Fails
- Enable "Install from Unknown Sources" on phone
- Ensure Android 8.0+ (API 26)
- Check USB debugging is enabled

## Future Enhancements

- [ ] Offline mode with local sync
- [ ] Budget alerts and spending goals
- [ ] Receipt image OCR improvements
- [ ] PDF statement imports
- [ ] Multi-user accounts (family)
- [ ] Bill reminders
- [ ] Export to CSV/Excel
- [ ] Dark mode
- [ ] Push notifications

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues or questions:
1. Check existing GitHub issues
2. Create a new issue with details
3. Include error messages and steps to reproduce

## Credits

- Built with [React](https://react.dev)
- Styled with [Tailwind CSS](https://tailwindcss.com)
- AI powered by [Google Gemini](https://ai.google.dev)
- Backend by [Supabase](https://supabase.com)
- Mobile with [Capacitor](https://capacitorjs.com)

---

**Made with ❤️ for expense tracking**
