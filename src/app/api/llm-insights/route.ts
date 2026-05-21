import { NextResponse } from "next/server";
import OpenAI from "openai";

type Allocation = {
  industry: string;
  weight: number;
  weight_percent: number;
};

type PortfolioPayload = {
  weights?: unknown;
  industryNames?: unknown;
  blendWeights?: unknown;
  controls?: unknown;
  metrics?: Record<string, unknown>;
  topAllocations?: Allocation[];
  bottomAllocations?: Allocation[];
  projectContext?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toFiniteWeights(value: unknown) {
  if (!Array.isArray(value)) return null;
  const weights = value.map((item) => Number(item));
  return weights.every(Number.isFinite) ? weights : null;
}

function toIndustryNames(value: unknown, length: number) {
  if (!Array.isArray(value)) return null;
  const names = value.map((item) => String(item));
  return names.length === length ? names : null;
}

function calculateWeightMetrics(weights: number[]) {
  const hhi = weights.reduce((sum, weight) => sum + weight * weight, 0);
  const nonzeroHoldings = weights.filter((weight) => Math.abs(weight) > 1e-6).length;

  return {
    weightSum: weights.reduce((sum, weight) => sum + weight, 0),
    hhi,
    effectiveNumberOfHoldings: hhi > 0 ? 1 / hhi : 0,
    maxWeight: Math.max(...weights),
    minWeight: Math.min(...weights),
    nonzeroHoldings
  };
}

function buildAllocations(weights: number[], industryNames: string[] | null) {
  return weights
    .map<Allocation>((weight, index) => ({
      industry: industryNames?.[index] ?? `Asset ${index + 1}`,
      weight,
      weight_percent: weight * 100
    }))
    .sort((a, b) => b.weight - a.weight);
}

function cleanAllocation(value: unknown) {
  if (!Array.isArray(value)) return undefined;

  return value
    .map((item) => {
      if (!isRecord(item)) return null;
      const weight = Number(item.weight);
      if (!Number.isFinite(weight)) return null;

      return {
        industry: String(item.industry ?? item.name ?? "Unknown"),
        weight,
        weight_percent: Number.isFinite(Number(item.weight_percent)) ? Number(item.weight_percent) : weight * 100
      };
    })
    .filter((item): item is Allocation => Boolean(item));
}

function buildPrompt(summary: Record<string, unknown>) {
  return `You are interpreting the output of a quantitative portfolio optimization model.

Write exactly 5 sentences.

Project context:
This is a Quantitative Risk Management portfolio construction project using 43 US industry portfolios from 1986 to 2015. The objective is to recommend or explore a static allocation evaluated mainly by out-of-sample Sharpe ratio on withheld 2016 to 2020 data. The optimizer uses concepts such as equal weight, tangency portfolio, global minimum variance, robust TAN, regularized robust GMV, beta shrinkage, CAPM-based expected returns, covariance shrinkage, concentration control, and blend weights. The LLM should only interpret the current model output and should not change the weights.

Current portfolio output:
${JSON.stringify(summary, null, 2)}

Requirements:
1. Use a clear, grounded university report style.
2. Explain what the current portfolio implies.
3. Mention Sharpe ratio objective, robustness, diversification, and concentration if relevant.
4. Do not claim guaranteed future outperformance.
5. Do not recommend changing the weights.
6. Do not invent numbers not provided in the model output.
7. Keep the output to exactly 5 sentences.`;
}

export async function POST(request: Request) {
  let body: PortfolioPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid portfolio payload." }, { status: 400 });
  }

  if (!isRecord(body) || Object.keys(body).length === 0) {
    return NextResponse.json({ error: "Invalid portfolio payload." }, { status: 400 });
  }

  const weights = body.weights === undefined ? null : toFiniteWeights(body.weights);

  if (body.weights !== undefined && !weights) {
    return NextResponse.json({ error: "Invalid portfolio payload." }, { status: 400 });
  }

  const industryNames = weights ? toIndustryNames(body.industryNames, weights.length) : null;
  const allocationRows = weights ? buildAllocations(weights, industryNames) : [];
  const calculatedMetrics = weights ? calculateWeightMetrics(weights) : {};
  const frontendMetrics = isRecord(body.metrics) ? body.metrics : {};
  const topAllocations = cleanAllocation(body.topAllocations) ?? allocationRows.slice(0, 10);
  const bottomAllocations = cleanAllocation(body.bottomAllocations) ?? [...allocationRows].sort((a, b) => a.weight - b.weight).slice(0, 5);

  const summary = {
    projectContext:
      typeof body.projectContext === "string"
        ? body.projectContext
        : "Interactive Quantitative Risk Management portfolio construction lab.",
    weights,
    industryNames,
    blendWeights: isRecord(body.blendWeights) ? body.blendWeights : undefined,
    controls: isRecord(body.controls) ? body.controls : undefined,
    metrics: {
      ...frontendMetrics,
      ...calculatedMetrics
    },
    topAllocations,
    bottomAllocations
  };

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
  }

  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    const response = await client.responses.create({
      model: "gpt-5.4-mini",
      input: buildPrompt(summary),
      temperature: 0.2,
      max_output_tokens: 220
    });

    return NextResponse.json({
      insight: response.output_text
    });
  } catch {
    return NextResponse.json({ error: "Failed to generate LLM insights." }, { status: 500 });
  }
}
