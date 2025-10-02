# Resident RVU Dashboard

A Streamlit application for analyzing radiology resident productivity using Work RVUs (wRVUs) with actionable insights for performance benchmarking and efficiency optimization.

## Features

- **Performance Overview**: Key metrics including daily RVUs, RVUs per hour, cases per day, and RVUs per case
- **Daily Performance Trend**: Interactive charts showing daily RVU performance with 7-day moving average
- **Hourly Efficiency Analysis**: Bar chart showing RVU efficiency by hour of day
- **Case Mix Analysis**: Top 5 modality-body part combinations with pie chart breakdown
- **Schedule Optimization**: Heatmap showing optimal work schedule patterns

## Data Requirements

The app expects CSV files with the following columns:
- `DICTATION DTTM`: Study interpretation date/time
- `EXAM DESC`: Radiology exam description
- `WRVU ESTIMATE`: Work RVU value

⚠️ **Security Notice**: Do not include PHI or patient identifiers in your data.

## Local Development

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd ara
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the app locally**:
   ```bash
   streamlit run app.py
   ```

4. **Open your browser** to `http://localhost:8501`

## Deployment Options

### Streamlit Community Cloud (Recommended)

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Deploy on Streamlit Cloud**:
   - Go to [share.streamlit.io](https://share.streamlit.io)
   - Sign in with your GitHub account
   - Click "New app"
   - Select your repository and branch
   - Set the main file path to `app.py`
   - Click "Deploy"

### Other Deployment Platforms

#### Heroku
1. Create a `Procfile`:
   ```
   web: streamlit run app.py --server.port=$PORT --server.address=0.0.0.0
   ```

2. Deploy using Heroku CLI or GitHub integration

#### Docker
1. Create a `Dockerfile`:
   ```dockerfile
   FROM python:3.9-slim
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install -r requirements.txt
   COPY . .
   EXPOSE 8501
   CMD ["streamlit", "run", "app.py", "--server.address", "0.0.0.0"]
   ```

2. Build and run:
   ```bash
   docker build -t rvu-dashboard .
   docker run -p 8501:8501 rvu-dashboard
   ```

## Configuration

The app uses `.streamlit/config.toml` for configuration:
- Theme colors match the medical/analytics aesthetic
- Headless mode enabled for deployment
- CORS and XSRF protection configured for web deployment

## Usage

1. **Upload Data**: Use the sidebar to upload a CSV file or paste data
2. **Set Goals**: Configure your daily RVU target (default: 15 for residents)
3. **Analyze**: View performance metrics and insights
4. **Explore**: Use interactive charts to understand patterns

## Methods

- **Data Processing**: Modality and body part extraction from exam descriptions
- **Derivations**: Daily/weekly aggregates and trend calculations
- **KPIs**: RVUs/day, RVUs/case, 7-day moving average, trend slope
- **Assumption**: 8-hour workday for RVUs/hour calculations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

This project is open source and available under the MIT License.

## Support

For issues or questions, please open an issue on GitHub.
