# Interactive Portfolio Optimization Lab

An interactive DBA5109 Quantitative Risk Management showcase for comparing naive diversification, classical mean variance optimization, and robust regularized portfolio construction across 43 US industry portfolios.

The app is designed as a polished investment lab rather than a notebook export. It loads the saved project artifacts, explains the portfolio construction logic, and lets users explore how method choice, regularization, caps, blends, and risk preference affect the displayed allocation.

## Stack

- Next.js App Router
- React and TypeScript
- Tailwind CSS
- Recharts
- Framer Motion
- Local JSON/CSV files from `public/data`

## Data Folder

Place the exported project artifacts here:

```text
public/
  data/
    portfolio_artifact.json
    final_portfolio_weights.csv
    final_portfolio_weights.json
    portfolio_concentration_metrics.json
    gp_data_1986_to_2015.csv
    cv_results.json or cv_results.csv                  optional
    performance_metrics.json or performance_metrics.csv optional
```

The current app has already copied the provided required files into `public/data`.

## Data Behavior

The browser reads JSON and CSV only. It does not load `portfolio_engine.joblib` directly, because joblib requires Python.

The provided `portfolio_artifact.json` includes saved final weights, Tangency and GMV weights, CAPM expected returns, sample means, shrinkage covariance, and sample covariance. The app uses these real exports to compute:

- allocation charts
- concentration metrics
- expected return, volatility, and Sharpe estimates
- derived performance comparison views
- an estimated efficient frontier from exported inputs

Slider changes are labeled as exploratory browser transforms unless a Python backend is added to rerun the original optimizer.

## Local Development

Install dependencies:

```bash
npm install
```

Run the app:

```bash
npm run dev
```

Open:

[http://localhost:3000](http://localhost:3000)

Build for production:

```bash
npm run build
```

## Optional Python Backend

If exact recomputation from `portfolio_engine.joblib` is needed later, add a Python API instead of loading joblib in the browser. A suitable backend shape would be:

```text
GET  /api/portfolio
GET  /api/weights
GET  /api/metrics
GET  /api/cv-results
POST /api/simulate
```

The frontend can then call JSON endpoints while the backend handles joblib, covariance arrays, constraints, and optimization routines.

## Main Message

I built an interactive portfolio construction lab that allows users to compare naive diversification, classical mean variance optimization, and robust regularized optimization under realistic constraints. The goal is not just to show final weights, but to make the portfolio construction thought process understandable and interactive.
