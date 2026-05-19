export type PortfolioMethod =
  | "Equal Weight"
  | "Tangency"
  | "GMV"
  | "TAN Robust"
  | "GMV Robust"
  | "Custom Blend";

export interface WeightRow {
  index?: number;
  rank: number;
  industry: string;
  weight: number;
  weight_percent: number;
}

export interface ConcentrationMetrics {
  hhi: number;
  effective_number_of_holdings: number;
  max_weight: number;
  min_weight: number;
  nonzero_holdings: number;
  total_industries: number;
  weight_sum: number;
}

export interface SelectedStrategy {
  strategy_name: string;
  method: string;
  objective: string;
  selected_lambda: number;
  blend_weights: {
    tan_robust: number;
    gmv_robust: number;
    equal_weight: number;
  };
  allow_short: boolean;
  max_industry_cap: number;
  selection_logic: string;
}

export interface PortfolioArtifact {
  project_metadata: {
    project_name: string;
    group_number: number;
    course: string;
    created_at: string;
    description: string;
    intended_use: string;
  };
  data_summary: {
    dataset_name: string;
    frequency: string;
    training_period: string;
    data_challenge_horizon: string;
    number_of_industries: number;
    source_path: string;
  };
  selected_strategy: SelectedStrategy;
  portfolio_weights: {
    asset_names: string[];
    weights: number[];
    weights_table: WeightRow[];
    source_variable: string;
    asset_name_source_variable: string;
  };
  concentration_metrics: ConcentrationMetrics;
  interactive_dashboard_guidance: {
    recommended_frontend_controls: string[];
    recommended_charts: string[];
    recommended_user_experience: string;
  };
  optional_artifacts: {
    mu_capm?: Record<string, number>;
    mu_train?: Record<string, number>;
    V_shrink?: number[][];
    V_hat?: number[][];
    w_tan?: number[];
    w_gmv?: number[];
    df_raw_shape?: number[];
    df_raw_columns?: string[];
    data_path?: string;
  };
}

export interface PortfolioControlsState {
  method: PortfolioMethod;
  lambda: number;
  maxCap: number;
  tanBlend: number;
  gmvBlend: number;
  equalBlend: number;
  riskPreference: number;
  allowShort: boolean;
  showOnlyNonzero: boolean;
  normalizeWeights: boolean;
}

export interface PortfolioMetricRow {
  name: string;
  expectedReturn: number;
  volatility: number;
  sharpe: number;
  beta?: number;
  effectiveN: number;
  maxWeight: number;
  source: "saved" | "derived" | "exploratory";
}

export interface OptionalSeriesRow {
  [key: string]: string | number | null | undefined;
}

export interface LoadedPortfolioData {
  artifact: PortfolioArtifact | null;
  cvResults: OptionalSeriesRow[] | null;
  performanceMetrics: OptionalSeriesRow[] | null;
  errors: string[];
}
