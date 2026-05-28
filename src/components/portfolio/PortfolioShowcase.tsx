"use client";

import { motion } from "framer-motion";
import {
  Activity,
  BarChart3,
  ChevronDown,
  FlaskConical,
  Gauge,
  Lightbulb,
  LineChart,
  Sparkles,
  SlidersHorizontal
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { usePortfolioData } from "@/lib/usePortfolioData";
import {
  applyControls,
  buildFrontier,
  buildPerformanceComparison,
  blendWeights,
  concentrationMetrics,
  explainPortfolio,
  formatNumber,
  formatPercent,
  methodExplanation,
  palette,
  portfolioMetrics,
  portfolioMethods,
  baseWeightsByMethod,
  weightsToRows
} from "@/lib/portfolioMath";
import type {
  ConcentrationMetrics,
  OptionalSeriesRow,
  PortfolioArtifact,
  PortfolioControlsState,
  PortfolioMetricRow,
  PortfolioMethod,
  WeightRow
} from "@/types/optimization";

const defaultControls: PortfolioControlsState = {
  method: "GMV Robust",
  lambda: 0.001,
  maxCap: 0.3,
  tanBlend: 0.5,
  gmvBlend: 0.4,
  equalBlend: 0.1,
  riskPreference: 35,
  allowShort: false,
  showOnlyNonzero: true,
  normalizeWeights: true
};

const chartColors = [palette.bordeaux, palette.darkAmaranth, palette.amaranth, palette.coral, palette.sandy, "#8B5E63"];

function SectionShell({
  id,
  eyebrow,
  title,
  children
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="scroll-mt-28 px-4 py-16 sm:px-6 lg:px-8" id={id}>
      <div className="mx-auto max-w-content">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#CE4257]">{eyebrow}</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-[#4F000B] sm:text-4xl">
          {title}
        </h2>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

export function HeroSection({ artifact }: { artifact: PortfolioArtifact | null }) {
  const summary = artifact?.data_summary;
  return (
    <section className="relative overflow-hidden bg-white px-4 pb-16 pt-28 sm:px-6 lg:px-8">
      <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-[#4F000B] via-[#CE4257] to-[#FF9B54]" />
      <div className="mx-auto grid max-w-content gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#CE4257]">
            DBA5109 Quantitative Risk Management
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-semibold tracking-tight text-[#4F000B] sm:text-6xl lg:text-7xl">
            Interactive Portfolio Optimization Lab
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-[#594A51]">
            A risk-focused portfolio construction project using 43 US industry portfolios from 1986 to 2015.
          </p>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#6B5D63]">
            This portfolio is a regularized GMV robust allocation built from monthly industry returns. It was designed
            around stability, risk control, and out-of-sample reliability rather than chasing noisy historical return
            estimates.
          </p>
          <p className="mt-4 max-w-3xl text-base leading-7 text-[#6B5D63]">
            The final allocation leans toward defensive and lower-volatility industries such as Utilities, Food,
            Household, Drugs, Telecom, and Beer, with Oil included as a cyclical/value exposure. The strategy uses
            shrinkage covariance, CAPM-style expected returns, beta shrinkage, and L2 regularization to reduce
            estimation noise, control concentration, and avoid the kind of overfitting that can make optimized
            portfolios look better in-sample than they really are.
          </p>
        </motion.div>

        <SummaryCards
          cards={[
            ["Portfolio universe", `${summary?.number_of_industries ?? 43} industries`],
            ["Training data", summary?.training_period ?? "1986 to 2015"],
            ["Final strategy", artifact?.selected_strategy.strategy_name ?? "GMV robust with L2 regularization"]
          ]}
        />
      </div>
    </section>
  );
}

export function SummaryCards({ cards }: { cards: Array<[string, string]> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
      {cards.map(([label, value], index) => (
        <motion.div
          className="rounded-lg border border-[#E8DDE1] bg-white p-5 shadow-soft"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 * index, duration: 0.5 }}
          key={label}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#A14A58]">{label}</p>
          <p className="mt-3 text-2xl font-semibold text-[#24131A]">{value}</p>
        </motion.div>
      ))}
    </div>
  );
}

function ModelBriefingSection() {
  const portfolios = [
    ["MKT", "Market benchmark", "0.4916", "0.9998", "Passive CRSP value-weighted benchmark"],
    ["EWP", "Equal Weighted Portfolio", "0.5027", "0.6943", "Naive 1/43 diversification baseline"],
    ["TAN", "Tangency Portfolio", "1.2769", "1.0089", "Sharpe-maximizing MVO; strong in-sample but fragile"],
    ["TAN-robust", "CAPM + shrinkage tangency", "-", "1.4692", "Best Section 1 OOS Sharpe after robust estimation"],
    ["GMV", "Global Minimum Variance", "0.6951", "1.0071", "Variance-only optimizer; less dependent on noisy means"],
    ["GMV-robust", "Shrinkage covariance GMV", "-", "1.3910", "Robust risk-controlled variant"]
  ];

  const validationRows: Array<[string, string]> = [
    ["Training data", "January 1986 to December 2015, 43 US industry portfolios"],
    ["Data challenge horizon", "Static allocation evaluated on withheld 2016 to 2020 data"],
    ["CV design", "3 rolling windows, each with 15-year training and 5-year validation periods"],
    ["Search space", "66 blend combinations x 6 lambda values = 396 combinations"],
    ["Selection criterion", "Highest mean out-of-sample Sharpe ratio across validation windows"]
  ];

  const limitations = [
    "Only 3 CV windows, so mean out-of-sample Sharpe estimates have high variance.",
    "Static 5-year weights can drift as industries perform differently, causing unintended concentration.",
    "The 2016 to 2020 horizon mixes a long bull market with the COVID-19 crash, so regime sensitivity remains.",
    "Long-only and 30% cap constraints improve realism but may leave alpha unavailable to unconstrained methods.",
    "Market-cap weights were unavailable, so beta-implied proxies are only approximations."
  ];

  const recommendations = [
    "Use more rolling windows or blocked cross-validation to increase confidence in hyperparameter selection.",
    "Add transaction costs, turnover constraints, and rebalancing rules to make implementation performance more realistic.",
    "Test regime-aware or stress-tested allocations across crisis, inflation, and bull-market environments.",
    "Compare against Black-Litterman, risk parity, hierarchical risk parity, and constrained factor models.",
    "Monitor drift and refresh covariance, beta, and concentration controls through a scheduled portfolio review process."
  ];

  return (
    <SectionShell eyebrow="Model selection brief" id="model-briefing" title="Why the final recommendation is GMV Robust L2">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="grid gap-5">
          <div className="rounded-lg border border-[#E8DDE1] bg-white p-6 shadow-soft">
            <p className="text-sm leading-6 text-[#65565D]">
              The project tested classical mean-variance portfolios, robust shrinkage variants, and regularized
              portfolio construction. Although Tangency looked strongest in-sample, it depended heavily on noisy
              expected-return estimates. The final data-challenge recommendation is a regularized GMV-robust portfolio
              because rolling-window validation favored covariance-driven risk control over return chasing.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                ["Chosen strategy", "GMV Robust L2"],
                ["Selected lambda", "0.001"],
                ["Mean CV OOS Sharpe", "0.6977"]
              ].map(([label, value]) => (
                <div className="rounded-lg border border-[#E8DDE1] bg-[#FFF8F5] p-4" key={label}>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#A14A58]">{label}</p>
                  <p className="mt-2 text-xl font-semibold text-[#4F000B]">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-lg border border-[#F3C7C0] bg-[#FFF8F5] p-4">
              <p className="text-sm font-semibold text-[#720026]">Sharpe ratio in plain language</p>
              <p className="mt-2 text-sm leading-6 text-[#65565D]">
                Sharpe ratio measures return earned per unit of volatility. In this project, it is the main comparison
                metric because the goal is not simply higher return, but more efficient risk-adjusted performance.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <BriefList icon={<Gauge className="h-5 w-5 text-[#CE4257]" />} items={validationRows} title="Validation design" />
            <BriefList icon={<Lightbulb className="h-5 w-5 text-[#CE4257]" />} items={recommendations} title="Recommendations" />
          </div>
        </div>

        <div className="grid gap-5">
          <div className="overflow-hidden rounded-lg border border-[#E8DDE1] bg-white shadow-soft">
            <div className="flex items-center gap-3 border-b border-[#E8DDE1] bg-[#4F000B] px-5 py-4 text-white">
              <BarChart3 className="h-5 w-5" />
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-white/65">Model evaluation</p>
                <h3 className="text-lg font-semibold">Portfolios trained and tested</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="bg-[#FFF8F5] text-xs uppercase tracking-[0.16em] text-[#A14A58]">
                  <tr>
                    <th className="px-4 py-3">Code</th>
                    <th className="px-4 py-3">Model</th>
                    <th className="px-4 py-3 text-right">In-sample Sharpe</th>
                    <th className="px-4 py-3 text-right">OOS Sharpe</th>
                    <th className="px-4 py-3">Interpretation</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolios.map(([code, model, inSample, oos, note]) => (
                    <tr className={code === "GMV-robust" ? "bg-[#FFF8F5]" : "border-t border-[#E8DDE1]"} key={code}>
                      <td className="px-4 py-3 font-semibold text-[#4F000B]">{code}</td>
                      <td className="px-4 py-3 text-[#42333A]">{model}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#24131A]">{inSample}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#24131A]">{oos}</td>
                      <td className="px-4 py-3 text-[#65565D]">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <BriefList icon={<FlaskConical className="h-5 w-5 text-[#CE4257]" />} items={limitations} title="Study limitations" />
        </div>
      </div>
    </SectionShell>
  );
}

function BriefList({ icon, items, title }: { icon: React.ReactNode; items: Array<string | [string, string]>; title: string }) {
  return (
    <article className="rounded-lg border border-[#E8DDE1] bg-white p-5 shadow-soft">
      <div className="flex items-center gap-3">
        {icon}
        <h3 className="text-lg font-semibold text-[#4F000B]">{title}</h3>
      </div>
      <ul className="mt-4 grid gap-3 text-sm leading-6 text-[#65565D]">
        {items.map((item) => {
          const key = Array.isArray(item) ? item.join(":") : item;
          return (
            <li className="flex gap-2" key={key}>
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#CE4257]" />
              <span>
                {Array.isArray(item) ? (
                  <>
                    <span className="font-semibold text-[#42333A]">{item[0]}:</span> {item[1]}
                  </>
                ) : (
                  item
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function StoryMode() {
  const steps = [
    [
      "The benchmark matters",
      "Equal weight is a serious baseline because it avoids estimation error. Any optimized portfolio has to justify the extra complexity."
    ],
    [
      "Tangency can overfit",
      "Tangency maximizes Sharpe ratio, so it depends heavily on expected-return estimates. It can look strong in-sample but become fragile later."
    ],
    [
      "GMV is more stable",
      "GMV focuses on variance and does not require expected-return forecasts. That made it a better base when return estimates were unreliable."
    ],
    [
      "Shrinkage disciplines the inputs",
      "CAPM expected returns, beta shrinkage, and covariance shrinkage helped make the inputs more structured and less sensitive to noise."
    ],
    [
      "Regularization controls overconfidence",
      "L2 regularization tells the optimizer not to put too much confidence into only a few industries."
    ],
    [
      "Final recommendation",
      "The selected strategy was a regularized GMV robust portfolio because it focused on risk control, shrinkage, and concentration management."
    ]
  ];

  return (
    <SectionShell eyebrow="Overview" id="overview" title="The real problem was portfolio fragility">
      <div className="mb-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-[#E8DDE1] bg-white p-6 shadow-soft">
          <p className="text-sm leading-6 text-[#65565D]">
            This project compares naive diversification, classical mean-variance optimization, robust estimation, and
            regularized portfolio construction across 43 US industry portfolios. The objective was not only to find a
            portfolio that performed well historically, but to understand which methods were more reliable when tested
            out-of-sample.
          </p>
          <p className="mt-4 text-sm leading-6 text-[#65565D]">
            The final strategy is a regularized GMV robust portfolio. It focuses on risk structure, shrinkage, and
            concentration control instead of relying too heavily on noisy expected-return estimates.
          </p>
        </div>
        <div className="rounded-lg border border-[#E8DDE1] bg-[#FFF8F5] p-6 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#CE4257]">Key takeaway</p>
          <p className="mt-3 text-xl font-semibold leading-8 text-[#4F000B]">
            The strongest portfolio on paper is not always the most reliable one. The real value of this project is
            showing why robustness matters.
          </p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {steps.map(([title, text], index) => (
          <div className="rounded-lg border border-[#E8DDE1] bg-white p-6 shadow-soft transition hover:-translate-y-1" key={title}>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-[#FFF0EA] text-sm font-semibold text-[#CE4257]">
              {index + 1}
            </div>
            <h3 className="mt-5 text-xl font-semibold text-[#4F000B]">{title}</h3>
            <p className="mt-3 text-sm leading-6 text-[#65565D]">{text}</p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function LessonsLearned() {
  const lessons = [
    [
      "In-sample performance is not enough",
      "A portfolio can look excellent on historical data but fail when tested later. This is why we looked at out-of-sample performance and rolling-window validation."
    ],
    [
      "Tangency is powerful but fragile",
      "The Tangency Portfolio maximizes Sharpe ratio, but that also means it depends heavily on expected returns. Since expected returns are noisy, the portfolio can become unstable."
    ],
    [
      "GMV is more stable",
      "GMV focuses only on variance. It ignores expected returns, which can actually be an advantage when return estimates are unreliable."
    ],
    [
      "Shrinkage improves the inputs",
      "Instead of trusting raw sample estimates, shrinkage pulls extreme estimates toward a more stable structure. This helps reduce estimation noise."
    ],
    [
      "Regularization controls concentration",
      "L2 regularization reduces the optimizer's tendency to place too much weight in a few industries. This makes the portfolio more realistic and less fragile."
    ],
    [
      "The final portfolio reflects a risk-control mindset",
      "The selected allocation was not the flashiest portfolio. It was chosen because it was more disciplined, more stable, and better aligned with out-of-sample reliability."
    ]
  ];

  return (
    <SectionShell eyebrow="Lessons learned" id="lessons" title="What the project taught us">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {lessons.map(([title, text]) => (
          <div className="rounded-lg border border-[#E8DDE1] bg-white p-6 shadow-soft" key={title}>
            <h3 className="text-xl font-semibold text-[#4F000B]">{title}</h3>
            <p className="mt-3 text-sm leading-6 text-[#65565D]">{text}</p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display: string;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between gap-4 text-sm font-medium text-[#42333A]">
        {label}
        <span className="rounded-full bg-[#FFF0EA] px-2.5 py-1 text-xs font-semibold text-[#720026]">{display}</span>
      </span>
      <input
        className="mt-3 h-2 w-full cursor-pointer accent-[#FF7F51]"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

function Toggle({
  checked,
  label,
  onChange
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-lg border border-[#E8DDE1] bg-white px-4 py-3 text-sm text-[#42333A]">
      <span>{label}</span>
      <input
        checked={checked}
        className="h-4 w-4 accent-[#CE4257]"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

export function PortfolioControls({
  controls,
  setControls,
  artifact
}: {
  controls: PortfolioControlsState;
  setControls: (controls: PortfolioControlsState) => void;
  artifact: PortfolioArtifact;
}) {
  const patch = (partial: Partial<PortfolioControlsState>) => setControls({ ...controls, ...partial });

  return (
    <div className="rounded-lg border border-[#E8DDE1] bg-white p-5 shadow-soft">
      <div className="flex items-center gap-3">
        <SlidersHorizontal className="h-5 w-5 text-[#CE4257]" />
        <h3 className="text-lg font-semibold text-[#4F000B]">Portfolio controls</h3>
      </div>

      <label className="mt-5 block text-sm font-medium text-[#42333A]">
        Portfolio method
        <select
          className="mt-2 w-full rounded-lg border border-[#E8DDE1] bg-white px-3 py-2 text-sm text-[#24131A] outline-none transition focus:border-[#CE4257]"
          onChange={(event) => patch({ method: event.target.value as PortfolioMethod })}
          value={controls.method}
        >
          {portfolioMethods.map((method) => (
            <option key={method}>{method}</option>
          ))}
        </select>
      </label>

      <div className="mt-6 grid gap-5">
        <RangeControl
          display={controls.lambda.toFixed(4)}
          label="Lambda regularization strength"
          max={0.01}
          min={0}
          onChange={(lambda) => patch({ lambda })}
          step={0.0005}
          value={controls.lambda}
        />
        <RangeControl
          display={formatPercent(controls.maxCap, 0)}
          label="Maximum industry weight cap"
          max={0.6}
          min={0.05}
          onChange={(maxCap) => patch({ maxCap })}
          step={0.01}
          value={controls.maxCap}
        />
        <RangeControl
          display={formatNumber(controls.tanBlend, 2)}
          label="Tangency blend weight"
          max={1}
          min={0}
          onChange={(tanBlend) => patch({ tanBlend })}
          step={0.05}
          value={controls.tanBlend}
        />
        <RangeControl
          display={formatNumber(controls.gmvBlend, 2)}
          label="GMV blend weight"
          max={1}
          min={0}
          onChange={(gmvBlend) => patch({ gmvBlend })}
          step={0.05}
          value={controls.gmvBlend}
        />
        <RangeControl
          display={formatNumber(controls.equalBlend, 2)}
          label="Equal weight blend weight"
          max={1}
          min={0}
          onChange={(equalBlend) => patch({ equalBlend })}
          step={0.05}
          value={controls.equalBlend}
        />
        <RangeControl
          display={controls.riskPreference < 40 ? "Defensive" : controls.riskPreference > 65 ? "Aggressive" : "Balanced"}
          label="Risk preference"
          max={100}
          min={0}
          onChange={(riskPreference) => patch({ riskPreference })}
          step={5}
          value={controls.riskPreference}
        />
      </div>

      <div className="mt-6 grid gap-3">
        <Toggle checked={controls.allowShort} label="Allow short selling" onChange={(allowShort) => patch({ allowShort })} />
        <Toggle
          checked={controls.showOnlyNonzero}
          label="Show only nonzero holdings"
          onChange={(showOnlyNonzero) => patch({ showOnlyNonzero })}
        />
        <Toggle
          checked={controls.normalizeWeights}
          label="Normalize weights"
          onChange={(normalizeWeights) => patch({ normalizeWeights })}
        />
      </div>

      <div className="mt-6 rounded-lg bg-[#FFF8F5] p-4 text-sm leading-6 text-[#65565D]">
        <p className="font-semibold text-[#720026]">Training and validation</p>
        <p>Training period: {artifact.data_summary.training_period}</p>
        <p>Validation horizon: {artifact.data_summary.data_challenge_horizon}</p>
        <p className="mt-2">
          These selectors are explanatory in the static Vercel app. Re-running the saved joblib optimizer would require a Python API.
        </p>
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E8DDE1] bg-white p-4 shadow-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#A14A58]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#24131A]">{value}</p>
    </div>
  );
}

export function MetricsCards({ metrics, selected }: { metrics: ConcentrationMetrics; selected: PortfolioMetricRow }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <MetricTile label="Expected return" value={formatPercent(selected.expectedReturn, 1)} />
      <MetricTile label="Volatility" value={formatPercent(selected.volatility, 1)} />
      <MetricTile label="Sharpe ratio" value={formatNumber(selected.sharpe, 2)} />
      <MetricTile label="Effective N" value={formatNumber(metrics.effective_number_of_holdings, 1)} />
      <MetricTile label="Max weight" value={formatPercent(metrics.max_weight, 1)} />
      <MetricTile label="Weight sum" value={formatNumber(metrics.weight_sum, 3)} />
    </div>
  );
}

export function WeightBarChart({
  rows,
  totalIndustries,
  maxCap
}: {
  rows: WeightRow[];
  totalIndustries: number;
  maxCap: number;
}) {
  const data = rows.map((row) => ({ ...row, weightPct: row.weight * 100 }));
  const equalLine = (1 / totalIndustries) * 100;
  return (
    <ChartCard icon={<BarChart3 className="h-5 w-5" />} title="Final portfolio weights">
      <div className="h-[520px]">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 12, right: 28, top: 8, bottom: 8 }}>
            <CartesianGrid horizontal={false} stroke="#F0E5E8" />
            <XAxis tickFormatter={(value) => `${value}%`} type="number" />
            <YAxis dataKey="industry" interval={0} tick={{ fontSize: 12 }} type="category" width={58} />
            <Tooltip formatter={(value) => [`${Number(value).toFixed(2)}%`, "Weight"]} />
            <ReferenceLine stroke="#BCA4AB" strokeDasharray="4 4" x={equalLine} />
            <ReferenceLine stroke={palette.coral} strokeDasharray="5 5" x={maxCap * 100} />
            <Bar dataKey="weightPct" radius={[0, 6, 6, 0]}>
              {data.map((row, index) => (
                <Cell fill={index < 5 ? chartColors[index % chartColors.length] : "#D9C8CE"} key={row.industry} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function AllocationDonutChart({ rows }: { rows: WeightRow[] }) {
  const top = rows.slice(0, 10);
  const other = rows.slice(10).reduce((sum, row) => sum + row.weight, 0);
  const data = [...top, { industry: "Other", weight: Math.max(0, other), weight_percent: other * 100, rank: 99 }];

  return (
    <ChartCard icon={<Activity className="h-5 w-5" />} title="Composition">
      <div className="h-[330px]">
        <ResponsiveContainer height="100%" width="100%">
          <PieChart>
            <Pie data={data} dataKey="weight" innerRadius={70} nameKey="industry" outerRadius={112} paddingAngle={2}>
              {data.map((row, index) => (
                <Cell fill={chartColors[index % chartColors.length]} key={row.industry} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => [formatPercent(Number(value), 1), "Weight"]} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-[#E8DDE1] bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-3 text-[#CE4257]">
        {icon}
        <h3 className="text-lg font-semibold text-[#4F000B]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function PerformanceComparison({
  rows,
  externalMetrics
}: {
  rows: PortfolioMetricRow[];
  externalMetrics: OptionalSeriesRow[] | null;
}) {
  const data = rows.map((row) => ({
    name: row.name,
    returnPct: row.expectedReturn * 100,
    volatilityPct: row.volatility * 100,
    sharpe: row.sharpe
  }));

  return (
    <ChartCard icon={<LineChart className="h-5 w-5" />} title="Performance comparison">
      {!externalMetrics ? (
        <p className="mb-4 rounded-lg bg-[#FFF8F5] p-3 text-sm text-[#65565D]">
          performance_metrics file not found. This chart is estimated from exported expected returns and covariance
          matrices in the artifact.
        </p>
      ) : null}
      <div className="h-[340px]">
        <ResponsiveContainer height="100%" width="100%">
          <ComposedChart data={data}>
            <CartesianGrid stroke="#F0E5E8" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tickFormatter={(value) => `${value}%`} />
            <YAxis orientation="right" yAxisId="right" />
            <Tooltip />
            <Legend />
            <Bar dataKey="returnPct" fill={palette.amaranth} name="Expected return" radius={[6, 6, 0, 0]} yAxisId="left" />
            <Bar dataKey="volatilityPct" fill={palette.sandy} name="Volatility" radius={[6, 6, 0, 0]} yAxisId="left" />
            <Line dataKey="sharpe" name="Sharpe" stroke={palette.bordeaux} strokeWidth={3} yAxisId="right" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function lambdaSensitivityRows(artifact: PortfolioArtifact) {
  const bases = baseWeightsByMethod(artifact);
  const final = bases["GMV Robust"];
  const equal = bases["Equal Weight"];

  return Array.from({ length: 13 }, (_, index) => {
    const lambda = index / 1200;
    const pressure = Math.min(1, Math.log10(lambda * 10000 + 1) / 2.25);
    const weights = blendWeights([
      { weights: final, share: 1 },
      { weights: equal, share: pressure * 0.65 }
    ]);
    const metric = portfolioMetrics(`lambda ${lambda.toFixed(4)}`, weights, artifact, "exploratory");
    return {
      lambda,
      sharpe: metric.sharpe,
      effectiveN: metric.effectiveN,
      maxWeight: metric.maxWeight * 100
    };
  });
}

export function LambdaAnalysis({
  artifact,
  cvResults
}: {
  artifact: PortfolioArtifact;
  cvResults: OptionalSeriesRow[] | null;
}) {
  const isCv = Boolean(cvResults?.length);
  const data = isCv
    ? cvResults!.map((row) => ({
        lambda: Number(row.lambda ?? row.Lambda ?? 0),
        sharpe: Number(row.mean_oos_sharpe ?? row.sharpe ?? row.Sharpe ?? 0),
        effectiveN: Number(row.effective_number_of_holdings ?? row.effectiveN ?? 0),
        maxWeight: Number(row.max_weight ?? row.maxWeight ?? 0) * 100
      }))
    : lambdaSensitivityRows(artifact);

  if (!cvResults?.length) {
    return (
      <ChartCard icon={<Gauge className="h-5 w-5" />} title="Lambda sensitivity">
        <p className="mb-4 rounded-lg bg-[#FFF8F5] p-3 text-sm leading-6 text-[#65565D]">
          Artifact-derived view using the exported final portfolio, equal-weight benchmark, CAPM expected returns, and
          shrinkage covariance. It shows how stronger regularization changes estimated Sharpe, effective holdings, and
          maximum industry weight.
        </p>
        <LambdaChart data={data} sharpeName="Estimated Sharpe" />
      </ChartCard>
    );
  }

  return (
    <ChartCard icon={<Gauge className="h-5 w-5" />} title="Lambda analysis">
      <LambdaChart data={data} sharpeName="Mean OOS Sharpe" />
    </ChartCard>
  );
}

function LambdaChart({ data, sharpeName }: { data: Array<{ lambda: number; sharpe: number; effectiveN: number; maxWeight: number }>; sharpeName: string }) {
  return (
    <div className="h-[320px]">
      <ResponsiveContainer height="100%" width="100%">
        <ComposedChart data={data}>
          <CartesianGrid stroke="#F0E5E8" />
          <XAxis dataKey="lambda" tickFormatter={(value) => Number(value).toFixed(3)} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line dataKey="sharpe" name={sharpeName} stroke={palette.bordeaux} strokeWidth={3} />
          <Line dataKey="effectiveN" name="Effective N" stroke={palette.coral} strokeWidth={3} />
          <Line dataKey="maxWeight" name="Max weight %" stroke={palette.sandy} strokeWidth={3} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EfficientFrontier({ points }: { points: PortfolioMetricRow[] }) {
  const data = points.map((point) => ({
    name: point.name,
    risk: point.volatility * 100,
    ret: point.expectedReturn * 100,
    sharpe: point.sharpe
  }));

  return (
    <ChartCard icon={<FlaskConical className="h-5 w-5" />} title="Efficient frontier view">
      <p className="mb-4 text-sm leading-6 text-[#65565D]">
        This frontier is computed from exported CAPM expected returns and shrinkage covariance, using blends of the
        saved GMV and robust tangency views. It is a transparent approximation for the browser app, not a hidden rerun
        of the Python optimizer.
      </p>
      <div className="h-[320px]">
        <ResponsiveContainer height="100%" width="100%">
          <ScatterChart>
            <CartesianGrid stroke="#F0E5E8" />
            <XAxis dataKey="risk" name="Volatility" tickFormatter={(value) => `${Number(value).toFixed(0)}%`} />
            <YAxis dataKey="ret" name="Expected return" tickFormatter={(value) => `${Number(value).toFixed(0)}%`} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }} />
            <Scatter data={data} fill={palette.amaranth} name="Estimated portfolios" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function artifactHeatmapRows(artifact: PortfolioArtifact) {
  const bases = baseWeightsByMethod(artifact);
  const lambdas = [0, 0.0005, 0.001, 0.0025, 0.005, 0.0075, 0.01];
  const tanShares = [0, 0.2, 0.4, 0.6, 0.8, 1];
  return lambdas.flatMap((lambda) =>
    tanShares.map((tanShare) => {
      const pressure = Math.min(1, Math.log10(lambda * 10000 + 1) / 2.25);
      const weights = blendWeights([
        { weights: bases["TAN Robust"], share: tanShare },
        { weights: bases["GMV Robust"], share: 1 - tanShare },
        { weights: bases["Equal Weight"], share: pressure * 0.5 }
      ]);
      const metric = portfolioMetrics(`lambda ${lambda}`, weights, artifact, "exploratory");
      return {
        lambda,
        blend: tanShare,
        sharpe: metric.sharpe,
        effectiveN: metric.effectiveN,
        maxWeight: metric.maxWeight
      };
    })
  );
}

export function CVHeatmap({
  artifact,
  cvResults
}: {
  artifact: PortfolioArtifact;
  cvResults: OptionalSeriesRow[] | null;
}) {
  const isCv = Boolean(cvResults?.length);
  const cells = isCv
    ? cvResults!.slice(0, 64).map((row, index) => ({
        label: `lambda ${row.lambda ?? "n/a"} blend ${row.blend ?? row.tan_blend ?? index}`,
        lambda: row.lambda ?? "n/a",
        blend: row.blend ?? row.tan_blend ?? "n/a",
        sharpe: Number(row.mean_oos_sharpe ?? row.sharpe ?? 0)
      }))
    : artifactHeatmapRows(artifact).map((row) => ({
        label: `lambda ${row.lambda.toFixed(4)} TAN ${Math.round(row.blend * 100)}%`,
        lambda: row.lambda.toFixed(4),
        blend: `${Math.round(row.blend * 100)}% TAN`,
        sharpe: row.sharpe
      }));

  if (!cvResults?.length) {
    const maxSharpe = Math.max(...cells.map((row) => row.sharpe));
    const minSharpe = Math.min(...cells.map((row) => row.sharpe));
    return (
      <ChartCard icon={<BarChart3 className="h-5 w-5" />} title="Blend and lambda heatmap">
        <p className="mb-4 rounded-lg bg-[#FFF8F5] p-3 text-sm leading-6 text-[#65565D]">
          Artifact-derived grid comparing lambda levels and TAN Robust versus GMV Robust blend weights by estimated
          Sharpe. Add an exported cv_results file to replace this with the original rolling-window CV results.
        </p>
        <HeatmapGrid cells={cells} maxSharpe={maxSharpe} minSharpe={minSharpe} />
      </ChartCard>
    );
  }

  const maxSharpe = Math.max(...cells.map((row) => row.sharpe));
  const minSharpe = Math.min(...cells.map((row) => row.sharpe));

  return (
    <ChartCard icon={<BarChart3 className="h-5 w-5" />} title="CV results heatmap">
      <HeatmapGrid cells={cells} maxSharpe={maxSharpe} minSharpe={minSharpe} />
    </ChartCard>
  );
}

function HeatmapGrid({
  cells,
  maxSharpe,
  minSharpe
}: {
  cells: Array<{ label: string; lambda: string | number; blend: string | number; sharpe: number }>;
  maxSharpe: number;
  minSharpe: number;
}) {
  const spread = maxSharpe - minSharpe || 1;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-7">
      {cells.map((row, index) => {
        const intensity = Math.max(0.18, Math.min(1, (row.sharpe - minSharpe) / spread));
        return (
          <div
            className="rounded-md p-3 text-xs font-semibold text-white shadow-sm"
            key={`${row.lambda}-${row.blend}-${index}`}
            style={{ backgroundColor: `rgba(206, 66, 87, ${0.28 + intensity * 0.72})` }}
            title={`${row.label}, Sharpe ${formatNumber(row.sharpe, 2)}`}
          >
            <span className="block text-[10px] font-medium opacity-90">{row.blend}</span>
            <span className="mt-1 block text-base">{formatNumber(row.sharpe, 2)}</span>
            <span className="block text-[10px] font-medium opacity-90">λ {row.lambda}</span>
          </div>
        );
      })}
    </div>
  );
}

export function ExplainPortfolioPanel({
  method,
  rows,
  metrics,
  lambda
}: {
  method: PortfolioMethod;
  rows: WeightRow[];
  metrics: ConcentrationMetrics;
  lambda: number;
}) {
  return (
    <div className="rounded-lg border border-[#E8DDE1] bg-[#FFF8F5] p-5">
      <h3 className="text-lg font-semibold text-[#4F000B]">Explain my portfolio</h3>
      <p className="mt-3 text-sm leading-6 text-[#594A51]">{explainPortfolio(method, rows, metrics, lambda)}</p>
      <p className="mt-4 text-sm leading-6 text-[#594A51]">{methodExplanation(method)}</p>
    </div>
  );
}

export function TechnicalAppendix() {
  const items = [
    [
      "Mean variance optimization",
      "Chooses portfolio weights by trading off expected return and variance. It is elegant, but highly dependent on input quality."
    ],
    ["Tangency objective", "Maximizes Sharpe ratio. This makes it sensitive to expected-return estimates."],
    ["GMV objective", "Minimizes portfolio variance. It is often more stable because it does not need expected returns."],
    [
      "CAPM expected return",
      "Uses market beta to create structured return estimates instead of relying only on raw historical averages."
    ],
    ["Beta shrinkage", "Pulls unstable beta estimates toward a common average to reduce noise."],
    [
      "Covariance shrinkage",
      "Blends the sample covariance matrix with a more stable target matrix so risk estimates are less extreme."
    ],
    ["L2 regularization", "Penalizes large weights and discourages concentrated solutions."],
    [
      "Rolling-window cross-validation",
      "Tests choices across multiple train and validation windows to reduce look-ahead bias and avoid choosing parameters based on one lucky period."
    ],
    [
      "Limitations",
      "The results are based on historical data and may not generalize to future regimes. The 2016 to 2020 horizon includes both a bull market and the COVID shock, so no static allocation is perfect. The browser app reads exported JSON and CSV. Exact joblib recomputation should be done through a Python API if needed."
    ]
  ];

  return (
    <SectionShell eyebrow="Technical appendix" id="appendix" title="Methods without the notebook noise">
      <div className="divide-y divide-[#E8DDE1] rounded-lg border border-[#E8DDE1] bg-white shadow-soft">
        {items.map(([title, text]) => (
          <details className="group p-5" key={title}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold text-[#4F000B]">
              {title}
              <ChevronDown className="h-5 w-5 transition group-open:rotate-180" />
            </summary>
            <p className="mt-3 text-sm leading-6 text-[#65565D]">{text}</p>
          </details>
        ))}
      </div>
    </SectionShell>
  );
}

function StickyNav() {
  const items = [
    ["Overview", "#overview"],
    ["Investment Lab", "#lab"],
    ["Results", "#results"],
    ["Methodology", "#methodology"],
    ["Technical Appendix", "#appendix"]
  ];
  return (
    <div className="fixed inset-x-0 top-4 z-50 px-4">
      <nav className="mx-auto flex max-w-content items-center justify-between rounded-full border border-[#E8DDE1] bg-white/90 px-4 py-3 shadow-soft backdrop-blur">
        <a className="flex items-center gap-2 text-sm font-semibold text-[#4F000B]" href="#">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#4F000B] text-xs text-white">PL</span>
          Portfolio Lab
        </a>
        <div className="hidden items-center gap-1 lg:flex">
          {items.map(([label, href]) => (
            <a className="rounded-full px-3 py-2 text-sm text-[#65565D] transition hover:bg-[#FFF0EA] hover:text-[#720026]" href={href} key={href}>
              {label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  );
}

function DataNotice({ artifact }: { artifact: PortfolioArtifact }) {
  const hasEngineInputs = Boolean(
    artifact.optional_artifacts.mu_capm &&
      artifact.optional_artifacts.V_shrink &&
      artifact.optional_artifacts.w_tan &&
      artifact.optional_artifacts.w_gmv
  );

  return (
    <div className="rounded-lg border border-[#E8DDE1] bg-white p-5 text-sm leading-6 text-[#65565D] shadow-soft">
      <p className="font-semibold text-[#720026]">Data loading status</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          ["Loaded", "portfolio_artifact.json"],
          ["Loaded", "final_portfolio_weights.json/csv"],
          ["Loaded", "portfolio_concentration_metrics.json"],
          [hasEngineInputs ? "Loaded" : "Partial", "CAPM means, covariance, Tangency/GMV weights"],
          ["Optional", "cv_results.csv/json not present"],
          ["Optional", "performance_metrics.csv/json not present"]
        ].map(([status, label]) => (
          <div className="rounded-lg bg-[#FFF8F5] px-3 py-2" key={label}>
            <span className="font-semibold text-[#720026]">{status}</span>
            <span className="ml-2">{label}</span>
          </div>
        ))}
      </div>
      <p className="mt-4">
        Data is read from <span className="font-semibold">/public/data</span>. Because the browser cannot load
        <span className="font-semibold"> portfolio_engine.joblib</span>, exact optimizer reruns still require a Python
        API; the visible fallback charts are artifact-derived sensitivity views.
      </p>
    </div>
  );
}

function FinalAllocationNarrative({ artifact, metrics }: { artifact: PortfolioArtifact; metrics: ConcentrationMetrics }) {
  const selectedLambda = artifact.selected_strategy.selected_lambda;

  return (
    <div className="rounded-lg border border-[#E8DDE1] bg-white p-5 text-sm leading-6 text-[#65565D] shadow-soft">
      <p className="font-semibold text-[#720026]">Final allocation</p>
      <p className="mt-3">
        The final allocation is concentrated in a selected set of industries rather than spread equally across all 43.
        This does not mean the portfolio is blindly concentrated. The optimizer selected industries that helped reduce
        portfolio variance under the selected constraints.
      </p>
      <p className="mt-3">
        The largest weights are in defensive and lower-volatility industries such as Utilities, Food, Household, Drugs,
        Telecom, and Beer, with Oil providing a cyclical/value component. This gives the portfolio a defensive tilt,
        which fits the objective of stability and risk control.
      </p>
      <p className="mt-3">
        Utilities received the largest allocation because it helped reduce portfolio variance. However, the project also
        recognized that too much concentration is risky, which is why L2 regularization and a maximum weight cap were
        used. The selected lambda is <span className="font-semibold text-[#720026]">{selectedLambda}</span>, the maximum
        weight is <span className="font-semibold text-[#720026]">{formatPercent(metrics.max_weight, 1)}</span>, and the
        effective number of holdings is{" "}
        <span className="font-semibold text-[#720026]">{formatNumber(metrics.effective_number_of_holdings, 1)}</span>.
      </p>
    </div>
  );
}

function LlmConfirmModal({
  loading,
  onCancel,
  onGenerate
}: {
  loading: boolean;
  onCancel: () => void;
  onGenerate: () => void;
}) {
  return (
    <div
      aria-labelledby="llm-confirm-title"
      aria-modal="true"
      className="fixed inset-0 z-[80] grid place-items-center bg-[#24131A]/35 px-4 backdrop-blur-sm"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-lg border border-[#E8DDE1] bg-white p-6 shadow-soft">
        <h3 className="text-xl font-semibold text-[#4F000B]" id="llm-confirm-title">
          Generate LLM Insights
        </h3>
        <p className="mt-3 text-sm leading-6 text-[#594A51]">
          This will call the OpenAI API and consume AI tokens. Continue?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-full border border-[#E8DDE1] px-4 py-2 text-sm font-semibold text-[#594A51] transition hover:border-[#CE4257] hover:text-[#720026]"
            disabled={loading}
            onClick={onCancel}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-full bg-[#720026] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4F000B] disabled:cursor-not-allowed disabled:bg-[#BCA4AB]"
            disabled={loading}
            onClick={onGenerate}
            type="button"
          >
            Generate Insights
          </button>
        </div>
      </div>
    </div>
  );
}

function LlmInsightsCard({
  error,
  insight,
  loading,
  stale,
  onGenerateClick
}: {
  error: string;
  insight: string;
  loading: boolean;
  stale: boolean;
  onGenerateClick: () => void;
}) {
  return (
    <div className="rounded-lg border border-[#E8DDE1] bg-white p-5 text-sm leading-6 text-[#65565D] shadow-soft">
      <div className="flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-[#CE4257]" />
        <h3 className="text-lg font-semibold text-[#4F000B]">LLM Insights</h3>
      </div>

      {stale ? (
        <p className="mt-4 rounded-lg bg-[#FFF8F5] px-3 py-2 text-sm font-semibold text-[#720026]">
          Portfolio settings changed. Regenerate insights to reflect the latest output.
        </p>
      ) : null}

      <div className="mt-4 min-h-[120px]">
        {loading ? (
          <p>Generating LLM insights...</p>
        ) : error ? (
          <div>
            <p className="font-semibold text-[#CE4257]">
              Unable to generate LLM insights. Please check the API key, quota, or server logs.
            </p>
            <p className="mt-2 text-[#8B5E63]">{error}</p>
          </div>
        ) : insight ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#A14A58]">LLM Insights</p>
            <p className="mt-3 whitespace-pre-line text-[#594A51]">{insight}</p>
          </div>
        ) : (
          <p>Generate a short AI-assisted interpretation of the current optimized portfolio.</p>
        )}
      </div>

      <button
        className="mt-5 rounded-full bg-[#720026] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#4F000B] disabled:cursor-not-allowed disabled:bg-[#BCA4AB]"
        disabled={loading}
        onClick={onGenerateClick}
        type="button"
      >
        Generate LLM Insights
      </button>
    </div>
  );
}

function ResultsInsights() {
  const bullets = [
    "Equal weight is a strong baseline because it avoids estimation error.",
    "Tangency can overfit because it depends on expected returns.",
    "GMV is more stable because it focuses on covariance.",
    "Shrinkage makes the inputs less extreme.",
    "L2 regularization reduces concentration.",
    "Rolling-window validation gives a better test than a single in-sample result."
  ];

  return (
    <div className="rounded-lg border border-[#E8DDE1] bg-white p-6 shadow-soft lg:col-span-2">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#CE4257]">Results and insights</p>
      <h3 className="mt-3 text-2xl font-semibold text-[#4F000B]">The pattern mattered more than one backtest number</h3>
      <p className="mt-4 text-sm leading-6 text-[#65565D]">
        The main result is not just the final Sharpe ratio. The more important result is the pattern across methods.
        Portfolios that relied too heavily on noisy expected returns were less reliable. Portfolios built around risk
        structure, shrinkage, and regularization were more stable.
      </p>
      <p className="mt-3 text-sm leading-6 text-[#65565D]">
        Tangency looked strong in-sample because it directly optimized Sharpe ratio. But robust methods performed better
        when tested out-of-sample. This supports the main lesson of the project: the optimizer is only as good as the
        inputs you give it.
      </p>
      <div className="mt-5 grid gap-2 md:grid-cols-2">
        {bullets.map((item) => (
          <div className="rounded-lg bg-[#FFF8F5] px-3 py-2 text-sm text-[#594A51]" key={item}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function MethodologySection() {
  const cards = [
    [
      "Equal Weighted Portfolio",
      "Every industry receives the same weight. It is simple, but that is also its strength. It avoids noisy estimation, which makes it a serious benchmark."
    ],
    [
      "Tangency Portfolio",
      "Maximizes the Sharpe ratio. It can look very strong in-sample, but it relies heavily on expected-return estimates. Small errors in expected returns can create large allocation swings."
    ],
    [
      "Global Minimum Variance",
      "Minimizes portfolio variance. It does not require expected-return estimates, which makes it more stable when return forecasts are unreliable."
    ],
    [
      "CAPM Expected Returns",
      "Uses market beta to create more structured expected-return estimates instead of relying only on raw historical averages."
    ],
    [
      "Beta Shrinkage",
      "Pulls unstable beta estimates toward the cross-sectional average. This reduces the influence of extreme beta estimates."
    ],
    [
      "Covariance Shrinkage",
      "Blends the noisy sample covariance matrix with a more stable constant-correlation structure. This keeps risk estimates more grounded."
    ],
    [
      "L2 Regularization",
      "Penalizes large portfolio weights. In simple terms, it tells the optimizer not to put too much confidence into only a few industries."
    ],
    [
      "Rolling-Window Cross-Validation",
      "Tests different parameter choices across multiple training and validation windows. This reduces look-ahead bias and avoids choosing a method based on one lucky period."
    ]
  ];

  return (
    <SectionShell eyebrow="Methodology" id="methodology" title="How the portfolio was built without blindly trusting the optimizer">
      <div className="mb-6 rounded-lg border border-[#E8DDE1] bg-white p-6 shadow-soft">
        <p className="text-sm leading-6 text-[#65565D]">
          The project started with the standard mean-variance framework, then added layers of robustness to deal with
          the real issue: noisy inputs. Historical average returns can be unstable, and if an optimizer trusts them too
          much, it may create extreme weights that look good in-sample but fail out-of-sample.
        </p>
        <p className="mt-4 text-sm leading-6 text-[#65565D]">
          To address this, we compared simple benchmarks, classical optimization, robust parameter estimation, and
          regularization.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(([title, text], index) => (
          <div className="rounded-lg border border-[#E8DDE1] bg-white p-6 shadow-soft" key={title}>
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#FFF0EA] text-sm font-semibold text-[#CE4257]">
              {index + 1}
            </div>
            <h3 className="mt-4 text-lg font-semibold text-[#4F000B]">{title}</h3>
            <p className="mt-3 text-sm leading-6 text-[#65565D]">{text}</p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function WhyWonSection() {
  const insights = [
    [
      "The benchmark matters",
      "Equal weight is hard to beat because it avoids noisy estimation. Any optimized portfolio has to justify the extra complexity."
    ],
    [
      "Expected returns are noisy",
      "Tangency portfolios maximize Sharpe ratio, but small mean-estimation errors can cause large allocation changes."
    ],
    [
      "Robustness is the product",
      "Covariance shrinkage and L2 regularization keep the portfolio grounded in risk control instead of overconfident forecasts."
    ],
    [
      "GMV is boring, but useful",
      "GMV does not chase return estimates. That is exactly why it can be more reliable when expected returns are unstable."
    ]
  ];

  return (
    <SectionShell eyebrow="Recommendation" id="why-gmv" title="Why GMV Robust L2 won">
      <div className="rounded-lg border border-[#E8DDE1] bg-white p-6 shadow-soft">
        <p className="text-sm leading-6 text-[#65565D]">
          The regularized GMV robust portfolio won because it solved the right problem. The issue was not just how to
          estimate higher returns. The issue was how to build a portfolio that would not become fragile when historical
          patterns changed.
        </p>
        <p className="mt-4 text-sm leading-6 text-[#65565D]">
          The Tangency Portfolio directly optimizes Sharpe ratio, which makes it attractive in-sample. But because it
          depends heavily on expected returns, it can overfit noisy historical averages. GMV is more stable because it
          focuses on variance instead of expected-return forecasts. The robust version improves this by using shrinkage
          covariance. L2 regularization then reduces concentration by penalizing large weights.
        </p>
        <p className="mt-4 text-sm leading-6 text-[#65565D]">
          This made the final portfolio more grounded. It leaned toward defensive industries and prioritized risk
          control rather than aggressive return chasing.
        </p>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {insights.map(([title, text]) => (
          <div className="rounded-lg border border-[#E8DDE1] bg-[#FFF8F5] p-5 shadow-soft" key={title}>
            <h3 className="text-lg font-semibold text-[#4F000B]">{title}</h3>
            <p className="mt-3 text-sm leading-6 text-[#65565D]">{text}</p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function LabSection({
  artifact,
  cvResults,
  performanceMetrics
}: {
  artifact: PortfolioArtifact;
  cvResults: OptionalSeriesRow[] | null;
  performanceMetrics: OptionalSeriesRow[] | null;
}) {
  const [controls, setControls] = useState<PortfolioControlsState>({
    ...defaultControls,
    lambda: artifact.selected_strategy.selected_lambda,
    maxCap: artifact.selected_strategy.max_industry_cap,
    allowShort: artifact.selected_strategy.allow_short
  });
  const [showLlmConfirm, setShowLlmConfirm] = useState(false);
  const [llmInsight, setLlmInsight] = useState("");
  const [llmLoading, setLlmLoading] = useState(false);
  const [llmError, setLlmError] = useState("");
  const [insightFingerprint, setInsightFingerprint] = useState("");

  const weights = useMemo(() => applyControls(artifact, controls), [artifact, controls]);
  const allRows = useMemo(() => weightsToRows(artifact.portfolio_weights.asset_names, weights), [artifact.portfolio_weights.asset_names, weights]);
  const rows = useMemo(() => {
    return controls.showOnlyNonzero ? allRows.filter((row) => Math.abs(row.weight) > 0.0001) : allRows;
  }, [allRows, controls.showOnlyNonzero]);
  const metrics = useMemo(() => concentrationMetrics(weights), [weights]);
  const selected = useMemo(() => portfolioMetrics(controls.method, weights, artifact, "exploratory"), [artifact, controls.method, weights]);
  const comparisonRows = useMemo(() => buildPerformanceComparison(artifact, weights), [artifact, weights]);
  const frontier = useMemo(() => buildFrontier(artifact), [artifact]);
  const currentPortfolioFingerprint = useMemo(
    () =>
      JSON.stringify({
        controls,
        weights
      }),
    [controls, weights]
  );
  const buildCurrentPortfolioInsightPayload = () => ({
    weights,
    industryNames: artifact.portfolio_weights.asset_names,
    blendWeights: {
      tan: controls.tanBlend,
      gmv: controls.gmvBlend,
      ewp: controls.equalBlend
    },
    controls: {
      selectedMethod: controls.method,
      cap: controls.maxCap,
      regularizationLambda: controls.lambda,
      riskPreference: controls.riskPreference,
      allowShort: controls.allowShort,
      normalizeWeights: controls.normalizeWeights
    },
    metrics: {
      expectedReturn: selected.expectedReturn,
      volatility: selected.volatility,
      sharpe: selected.sharpe,
      beta: selected.beta,
      hhi: metrics.hhi,
      effectiveNumberOfHoldings: metrics.effective_number_of_holdings,
      maxWeight: metrics.max_weight,
      minWeight: metrics.min_weight,
      nonzeroHoldings: metrics.nonzero_holdings,
      weightSum: metrics.weight_sum
    },
    topAllocations: allRows.slice(0, 10),
    bottomAllocations: [...allRows].sort((a, b) => a.weight - b.weight).slice(0, 5),
    projectContext:
      "Quantitative Risk Management portfolio construction project using 43 US industry portfolios from 1986 to 2015, evaluated with out-of-sample Sharpe ratio on withheld 2016 to 2020 data."
  });

  async function generateLlmInsight() {
    setLlmLoading(true);
    setLlmError("");

    try {
      const response = await fetch("/api/llm-insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildCurrentPortfolioInsightPayload())
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate LLM insight.");
      }

      setLlmInsight(data.insight);
      setInsightFingerprint(currentPortfolioFingerprint);
    } catch (error) {
      setLlmError(error instanceof Error ? error.message : "Failed to generate LLM insight.");
    } finally {
      setLlmLoading(false);
      setShowLlmConfirm(false);
    }
  }

  return (
    <SectionShell eyebrow="Investment lab" id="lab" title="Adjust assumptions and watch the allocation move">
      <div className="grid gap-6">
        <MetricsCards metrics={metrics} selected={selected} />
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.35fr]">
          <div className="grid content-start gap-5">
            <PortfolioControls artifact={artifact} controls={controls} setControls={setControls} />
            <ExplainPortfolioPanel lambda={controls.lambda} method={controls.method} metrics={metrics} rows={rows} />
            <div className="rounded-lg border border-[#E8DDE1] bg-white p-5 text-sm leading-6 text-[#65565D] shadow-soft">
              <p className="font-semibold text-[#720026]">Interpretation guardrail</p>
              <p className="mt-2">
                The saved artifact contains method weights and covariance inputs, so metrics are computed from real
                exports. Some interactions are exploratory unless connected to the Python optimization backend. Exact
                recomputation from the joblib artifact should be handled through a Python API.
              </p>
            </div>
          </div>
          <div className="grid gap-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <FinalAllocationNarrative artifact={artifact} metrics={metrics} />
              <LlmInsightsCard
                error={llmError}
                insight={llmInsight}
                loading={llmLoading}
                onGenerateClick={() => setShowLlmConfirm(true)}
                stale={Boolean(llmInsight && insightFingerprint !== currentPortfolioFingerprint)}
              />
            </div>
            <WeightBarChart maxCap={controls.maxCap} rows={rows} totalIndustries={artifact.data_summary.number_of_industries} />
            <div className="grid gap-5 lg:grid-cols-2">
              <AllocationDonutChart rows={rows} />
              <PerformanceComparison externalMetrics={performanceMetrics} rows={comparisonRows} />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-12 grid gap-5 lg:grid-cols-2" id="results">
        <ResultsInsights />
        <LambdaAnalysis artifact={artifact} cvResults={cvResults} />
        <EfficientFrontier points={frontier} />
        <CVHeatmap artifact={artifact} cvResults={cvResults} />
        <DataNotice artifact={artifact} />
      </div>
      {showLlmConfirm ? (
        <LlmConfirmModal loading={llmLoading} onCancel={() => setShowLlmConfirm(false)} onGenerate={generateLlmInsight} />
      ) : null}
    </SectionShell>
  );
}

export function PortfolioShowcase() {
  const { artifact, cvResults, errors, loading, performanceMetrics } = usePortfolioData();

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-white px-4 text-center">
        <div>
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#F3D6D0] border-t-[#CE4257]" />
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-[#720026]">Loading portfolio lab</p>
        </div>
      </main>
    );
  }

  if (!artifact) {
    return (
      <main className="grid min-h-screen place-items-center bg-white px-4">
        <div className="max-w-xl rounded-lg border border-[#E8DDE1] bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-semibold text-[#4F000B]">Portfolio artifact missing</h1>
          <p className="mt-3 text-sm leading-6 text-[#65565D]">
            Add portfolio_artifact.json to /public/data to load the dashboard.
          </p>
          {errors.map((error) => (
            <p className="mt-2 text-sm text-[#CE4257]" key={error}>
              {error}
            </p>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-[#24131A]" id="main-content">
      <StickyNav />
      <HeroSection artifact={artifact} />
      <ModelBriefingSection />
      <StoryMode />
      <LessonsLearned />
      <LabSection artifact={artifact} cvResults={cvResults} performanceMetrics={performanceMetrics} />
      <WhyWonSection />
      <MethodologySection />
      <TechnicalAppendix />
      <footer className="border-t border-[#E8DDE1] bg-[#FFF8F5] px-4 py-8 text-center text-sm text-[#65565D]">
        Interactive portfolio construction lab built from the DBA5109 project artifacts.
      </footer>
    </main>
  );
}
