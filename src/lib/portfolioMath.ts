import type {
  ConcentrationMetrics,
  PortfolioArtifact,
  PortfolioControlsState,
  PortfolioMetricRow,
  PortfolioMethod,
  WeightRow
} from "@/types/optimization";

export const palette = {
  bordeaux: "#4F000B",
  darkAmaranth: "#720026",
  amaranth: "#CE4257",
  coral: "#FF7F51",
  sandy: "#FF9B54",
  ink: "#24131A",
  muted: "#6B5D63",
  line: "#E8DDE1",
  surface: "#FFF8F5"
};

export const portfolioMethods: PortfolioMethod[] = [
  "Equal Weight",
  "Tangency",
  "GMV",
  "TAN Robust",
  "GMV Robust",
  "Custom Blend"
];

export function formatPercent(value: number, digits = 1) {
  if (!Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(digits);
}

export function normalizeWeights(weights: number[]) {
  const total = weights.reduce((sum, value) => sum + value, 0);
  if (Math.abs(total) < 1e-12) {
    return equalWeights(weights.length);
  }
  return weights.map((value) => value / total);
}

export function equalWeights(length: number) {
  return Array.from({ length }, () => 1 / length);
}

export function clampLongOnly(weights: number[]) {
  return weights.map((value) => Math.max(0, value));
}

export function capWeights(weights: number[], cap: number) {
  const capped = weights.map((value) => Math.min(Math.max(value, 0), cap));
  let free = capped.map((value, index) => (value < cap - 1e-10 ? index : -1)).filter((index) => index >= 0);
  let remainder = 1 - capped.reduce((sum, value) => sum + value, 0);

  for (let guard = 0; guard < 20 && Math.abs(remainder) > 1e-8 && free.length > 0; guard += 1) {
    const addition = remainder / free.length;
    for (const index of free) {
      capped[index] = Math.min(cap, Math.max(0, capped[index] + addition));
    }
    free = capped.map((value, index) => (value < cap - 1e-10 ? index : -1)).filter((index) => index >= 0);
    remainder = 1 - capped.reduce((sum, value) => sum + value, 0);
  }

  return normalizeWeights(capped);
}

export function blendWeights(weightSets: Array<{ weights: number[]; share: number }>) {
  const length = weightSets[0]?.weights.length ?? 0;
  const totalShare = weightSets.reduce((sum, item) => sum + Math.max(0, item.share), 0) || 1;
  return Array.from({ length }, (_, index) =>
    weightSets.reduce((sum, item) => sum + item.weights[index] * Math.max(0, item.share), 0) / totalShare
  );
}

export function matrixVariance(weights: number[], covariance?: number[][]) {
  if (!covariance?.length) return Number.NaN;
  let variance = 0;
  for (let i = 0; i < weights.length; i += 1) {
    for (let j = 0; j < weights.length; j += 1) {
      variance += weights[i] * weights[j] * (covariance[i]?.[j] ?? 0);
    }
  }
  return Math.max(variance, 0);
}

export function expectedMonthlyReturn(weights: number[], mu?: Record<string, number>, names?: string[]) {
  if (!mu || !names?.length) return Number.NaN;
  return weights.reduce((sum, weight, index) => sum + weight * (mu[names[index]] ?? 0), 0);
}

export function concentrationMetrics(weights: number[]): ConcentrationMetrics {
  const hhi = weights.reduce((sum, weight) => sum + weight * weight, 0);
  const positives = weights.filter((weight) => Math.abs(weight) > 1e-6);
  return {
    hhi,
    effective_number_of_holdings: hhi > 0 ? 1 / hhi : 0,
    max_weight: Math.max(...weights),
    min_weight: Math.min(...weights),
    nonzero_holdings: positives.length,
    total_industries: weights.length,
    weight_sum: weights.reduce((sum, weight) => sum + weight, 0)
  };
}

export function weightsToRows(names: string[], weights: number[]) {
  return names
    .map<WeightRow>((industry, index) => ({
      industry,
      index,
      rank: index + 1,
      weight: weights[index] ?? 0,
      weight_percent: (weights[index] ?? 0) * 100
    }))
    .sort((a, b) => b.weight - a.weight)
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function robustTangencyProxy(artifact: PortfolioArtifact) {
  const names = artifact.portfolio_weights.asset_names;
  const mu = artifact.optional_artifacts.mu_capm;
  const cov = artifact.optional_artifacts.V_shrink;
  if (!mu || !cov) return artifact.optional_artifacts.w_tan ?? artifact.portfolio_weights.weights;

  const scores = names.map((name, index) => {
    const variance = Math.max(cov[index]?.[index] ?? 1, 1e-9);
    return Math.max(0, (mu[name] ?? 0) / Math.sqrt(variance));
  });
  return normalizeWeights(scores);
}

export function baseWeightsByMethod(artifact: PortfolioArtifact): Record<PortfolioMethod, number[]> {
  const n = artifact.portfolio_weights.asset_names.length;
  const equal = equalWeights(n);
  const final = artifact.portfolio_weights.weights;
  const tan = artifact.optional_artifacts.w_tan ?? final;
  const gmv = artifact.optional_artifacts.w_gmv ?? final;
  const tanRobust = robustTangencyProxy(artifact);

  return {
    "Equal Weight": equal,
    Tangency: normalizeWeights(tan),
    GMV: normalizeWeights(gmv),
    "TAN Robust": normalizeWeights(tanRobust),
    "GMV Robust": normalizeWeights(final),
    "Custom Blend": normalizeWeights(final)
  };
}

export function applyControls(artifact: PortfolioArtifact, controls: PortfolioControlsState) {
  const bases = baseWeightsByMethod(artifact);
  const equal = bases["Equal Weight"];
  const tan = bases["TAN Robust"];
  const gmv = bases["GMV Robust"];
  const selected = bases[controls.method];
  const lambdaPressure = Math.min(1, Math.log10(controls.lambda * 10000 + 1) / 2.25);
  const riskPressure = controls.riskPreference / 100;

  let weights =
    controls.method === "Custom Blend"
      ? blendWeights([
          { weights: tan, share: controls.tanBlend },
          { weights: gmv, share: controls.gmvBlend },
          { weights: equal, share: controls.equalBlend }
        ])
      : selected;

  weights = blendWeights([
    { weights, share: 1 },
    { weights: equal, share: lambdaPressure * 0.45 },
    { weights: tan, share: Math.max(0, riskPressure - 0.5) * 0.4 },
    { weights: gmv, share: Math.max(0, 0.5 - riskPressure) * 0.4 }
  ]);

  if (!controls.allowShort) weights = clampLongOnly(weights);
  if (controls.maxCap < 0.999) weights = capWeights(weights, controls.maxCap);
  if (controls.normalizeWeights) weights = normalizeWeights(weights);

  return weights;
}

export function portfolioMetrics(
  name: string,
  weights: number[],
  artifact: PortfolioArtifact,
  source: PortfolioMetricRow["source"] = "derived"
): PortfolioMetricRow {
  const names = artifact.portfolio_weights.asset_names;
  const mu = artifact.optional_artifacts.mu_capm ?? artifact.optional_artifacts.mu_train;
  const cov = artifact.optional_artifacts.V_shrink ?? artifact.optional_artifacts.V_hat;
  const monthlyReturn = expectedMonthlyReturn(weights, mu, names);
  const monthlyVariance = matrixVariance(weights, cov);
  const expectedReturn = monthlyReturn * 12 * 0.01;
  const volatility = Math.sqrt(monthlyVariance) * Math.sqrt(12) * 0.01;
  const metrics = concentrationMetrics(weights);

  return {
    name,
    expectedReturn,
    volatility,
    sharpe: volatility > 0 ? expectedReturn / volatility : Number.NaN,
    effectiveN: metrics.effective_number_of_holdings,
    maxWeight: metrics.max_weight,
    source
  };
}

export function buildPerformanceComparison(artifact: PortfolioArtifact, selectedWeights: number[]) {
  const bases = baseWeightsByMethod(artifact);
  return [
    portfolioMetrics("Equal Weight", bases["Equal Weight"], artifact, "derived"),
    portfolioMetrics("Tangency", bases.Tangency, artifact, "saved"),
    portfolioMetrics("GMV", bases.GMV, artifact, "saved"),
    portfolioMetrics("TAN Robust", bases["TAN Robust"], artifact, "derived"),
    portfolioMetrics("GMV Robust", bases["GMV Robust"], artifact, "saved"),
    portfolioMetrics("Selected View", selectedWeights, artifact, "exploratory")
  ];
}

export function buildFrontier(artifact: PortfolioArtifact) {
  const bases = baseWeightsByMethod(artifact);
  const points: PortfolioMetricRow[] = [];
  for (let i = 0; i <= 20; i += 1) {
    const share = i / 20;
    const weights = blendWeights([
      { weights: bases.GMV, share: 1 - share },
      { weights: bases["TAN Robust"], share }
    ]);
    points.push(portfolioMetrics(`Blend ${i}`, weights, artifact, "derived"));
  }
  points.push(portfolioMetrics("Equal Weight", bases["Equal Weight"], artifact, "derived"));
  points.push(portfolioMetrics("Final", bases["GMV Robust"], artifact, "saved"));
  return points;
}

export function methodExplanation(method: PortfolioMethod) {
  const copy: Record<PortfolioMethod, string> = {
    "Equal Weight":
      "This is the simplest benchmark. It does not try to forecast returns or estimate an optimal covariance structure. Its strength is that it avoids overfitting.",
    Tangency:
      "This portfolio is return-seeking because it maximizes Sharpe ratio. It can look strong in-sample, but it is sensitive to expected-return estimates.",
    GMV:
      "This portfolio is risk-control focused. It minimizes variance and does not depend on expected-return forecasts.",
    "TAN Robust":
      "This portfolio still seeks high risk-adjusted return, but it uses more structured inputs through CAPM expected returns and shrinkage.",
    "GMV Robust":
      "This portfolio focuses on variance reduction using a more stable shrinkage covariance matrix. It is less dependent on noisy expected-return estimates.",
    "Custom Blend":
      "This is an exploratory blend of robust tangency, robust GMV, and equal weight. It is useful for seeing how the allocation changes as the portfolio moves between return-seeking and risk-control views."
  };
  return copy[method];
}

export function explainPortfolio(
  method: PortfolioMethod,
  rows: WeightRow[],
  metrics: ConcentrationMetrics,
  lambda: number
) {
  const top = rows.slice(0, 6).map((row) => row.industry).join(", ");
  const concentration =
    metrics.effective_number_of_holdings < 10
      ? "concentrated"
      : metrics.effective_number_of_holdings < 22
        ? "moderately diversified"
        : "more diversified";
  const regularization =
    lambda > 0.0005
      ? "Regularization is active. This discourages large weights and helps reduce concentration risk."
      : "Regularization is light, so the selected base portfolio remains more visible.";
  const concentrationText =
    metrics.effective_number_of_holdings < 10
      ? "This portfolio has meaningful concentration. Review the largest industry weights carefully because the portfolio depends heavily on those exposures."
      : metrics.effective_number_of_holdings > 22
        ? "This portfolio is more diversified. That may reduce idiosyncratic industry risk, but it can also move the allocation closer to equal weighting."
        : "This portfolio sits between a concentrated optimizer output and a broad equal-weight benchmark.";

  return `This view is ${concentration}, with the largest weights in ${top}. ${regularization} ${concentrationText} The point is not to chase the highest historical return; it is to see how the selected method handles noisy inputs, concentration, and out-of-sample reliability.`;
}
