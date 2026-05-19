"use client";

import { useEffect, useState } from "react";
import Papa from "papaparse";

import type { LoadedPortfolioData, OptionalSeriesRow, PortfolioArtifact } from "@/types/optimization";

async function fetchJson<T>(path: string) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

function parseCsv(text: string): OptionalSeriesRow[] {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true
  });
  return parsed.data.map((row) =>
    Object.entries(row).reduce<OptionalSeriesRow>((record, [key, value]) => {
      const numeric = Number(value);
      record[key] = value !== "" && Number.isFinite(numeric) ? numeric : value;
      return record;
    }, {})
  );
}

async function fetchOptionalSeries(baseName: string) {
  const json = await fetchJson<OptionalSeriesRow[]>(`/data/${baseName}.json`);
  if (json) return json;

  const csvResponse = await fetch(`/data/${baseName}.csv`, { cache: "no-store" });
  if (csvResponse.ok) {
    return parseCsv(await csvResponse.text());
  }

  return null;
}

export function usePortfolioData(): LoadedPortfolioData & { loading: boolean } {
  const [state, setState] = useState<LoadedPortfolioData & { loading: boolean }>({
    artifact: null,
    cvResults: null,
    performanceMetrics: null,
    errors: [],
    loading: true
  });

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      const errors: string[] = [];
      const artifact = await fetchJson<PortfolioArtifact>("/data/portfolio_artifact.json");
      if (!artifact) errors.push("portfolio_artifact.json was not found in /public/data.");

      const [cvResults, performanceMetrics] = await Promise.all([
        fetchOptionalSeries("cv_results"),
        fetchOptionalSeries("performance_metrics")
      ]);

      if (!cancelled) {
        setState({
          artifact,
          cvResults,
          performanceMetrics,
          errors,
          loading: false
        });
      }
    }

    loadData().catch((error: unknown) => {
      if (!cancelled) {
        setState({
          artifact: null,
          cvResults: null,
          performanceMetrics: null,
          errors: [error instanceof Error ? error.message : "Unable to load portfolio data."],
          loading: false
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
