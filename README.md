# RVU Dashboard

A modern, full-stack web application for radiology residents to track their productivity using Work RVUs (wRVUs) with actionable insights, beautiful analytics, and PDF export capabilities.

![RVU Dashboard](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-3-blue) ![Supabase](https://img.shields.io/badge/Supabase-Auth%20%26%20DB-green)

## ✨ Features

- **🔐 User Authentication**: Secure login/signup with Supabase Auth
- **📊 Performance Analytics**: Daily RVUs, trends, efficiency metrics, and goal tracking
- **📈 Interactive Charts**: Beautiful visualizations with Recharts
  - Daily performance trend with 7-day moving average
  - Hourly efficiency analysis
  - Case mix breakdown by modality and body part
  - Schedule optimization heatmap
- **📁 Data Management**: Upload CSV/Excel files or paste data directly
- **📄 PDF Export**: Generate professional reports with insights
- **🎨 Modern UI**: Dark theme with glass morphism, smooth animations

## 🛠️ Tech Stack

- **Frontend**: React 18, TypeScript, Tailwind CSS
- **State Management**: Zustand
- **Charts**: Recharts
- **Backend/Auth**: Supabase (PostgreSQL + Row Level Security)
- **PDF Generation**: jsPDF + jspdf-autotable
- **File Parsing**: PapaParse, xlsx
- **Deployment**: Netlify

## 📋 Data Requirements

Upload files with these columns (column names are flexible):
- `DICTATION DTTM` - Date/time of study interpretation
- `EXAM DESC` - Radiology exam description
- `WRVU ESTIMATE` - Work RVU value

⚠️ **Security Notice**: Do NOT include PHI or patient identifiers.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account (free tier works)

### 1. Clone & Install

   ```bash
   git clone <repository-url>
   cd ara
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the following schema:

```sql
-- Create profiles table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  goal_rvu_per_day NUMERIC DEFAULT 15,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create RVU records table
CREATE TABLE rvu_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  dictation_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  exam_description TEXT NOT NULL,
  wrvu_estimate NUMERIC NOT NULL,
  modality TEXT,
  exam_type TEXT,
  body_part TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rvu_records ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Policies for rvu_records
CREATE POLICY "Users can view own records" ON rvu_records
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own records" ON rvu_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own records" ON rvu_records
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own records" ON rvu_records
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

3. Get your Supabase URL and anon key from Settings > API

### 3. Configure Environment

Create a `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run Development Server

   ```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## 🌐 Deploy to Netlify

### Option 1: Netlify CLI

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify deploy --prod
```

### Option 2: Git Integration

1. Push to GitHub
2. Connect repository in Netlify
3. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Add environment variables in Netlify dashboard
5. Deploy!

## 📊 Dashboard Features

### Performance Overview
- Daily RVUs vs target
- RVUs per hour efficiency
- Cases per day volume
- RVUs per case complexity
- Target hit rate percentage
- 7-day moving average
- Trend analysis

### Charts & Visualizations
- **Daily Trend**: Line chart with target line and moving average
- **Hourly Efficiency**: Bar chart showing productivity by hour
- **Case Mix**: Top 5 modality-body part combinations
- **Modality Distribution**: Pie chart of RVUs by modality
- **Schedule Heatmap**: Day/hour productivity patterns

### PDF Report
Exports a comprehensive report including:
- Performance metrics and status
- Summary statistics
- Case mix breakdown
- Modality distribution
- Schedule optimization recommendations
- Recent daily performance

## 🔧 Project Structure

```
ara/
├── public/
│   └── vite.svg
├── src/
│   ├── components/
│   │   ├── charts/
│   │   │   ├── CaseMixChart.tsx
│   │   │   ├── DailyTrendChart.tsx
│   │   │   ├── HeatmapChart.tsx
│   │   │   ├── HourlyEfficiencyChart.tsx
│   │   │   └── ModalityPieChart.tsx
│   │   ├── EmptyState.tsx
│   │   ├── FileUpload.tsx
│   │   ├── LoadingScreen.tsx
│   │   ├── MetricsOverview.tsx
│   │   └── Sidebar.tsx
│   ├── lib/
│   │   ├── dataProcessing.ts
│   │   ├── pdfExport.ts
│   │   └── supabase.ts
│   ├── pages/
│   │   ├── AuthPage.tsx
│   │   └── Dashboard.tsx
│   ├── stores/
│   │   ├── authStore.ts
│   │   └── dataStore.ts
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   └── vite-env.d.ts
├── .gitignore
├── index.html
├── netlify.toml
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

## 📝 Methods

- **Data Processing**: Automatic modality and body part extraction from exam descriptions
- **Derivations**: Daily/weekly aggregates, trend calculations, moving averages
- **KPIs**: RVUs/day, RVUs/case, target hit rate, efficiency metrics
- **Assumption**: 8-hour workday for RVUs/hour calculations

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

## 🙋 Support

For issues or questions, please open an issue on GitHub.

---

Built with ❤️ for radiology residents
