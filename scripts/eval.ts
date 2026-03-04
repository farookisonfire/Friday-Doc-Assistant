import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../src/lib/env";
import { runRag, type RunRagResult } from "../src/lib/runRag";
import {
  scoreRetrievalRecall,
  scoreGrounding,
  scoreCitationPrecision,
  scoreRefusalCorrectness,
} from "../src/lib/evalScorer";
import { evaluate } from "langsmith/evaluation";
import type { Example } from "langsmith/schemas";

interface EvalCase {
  id: string;
  question: string;
  expectedUrls: string[];
  shouldRefuse: boolean;
}

const DEFAULT_TOP_K = 5;
const CREATED_AT = new Date().toISOString();

function toRagResult(outputs: Record<string, unknown>): RunRagResult {
  return outputs as unknown as RunRagResult;
}

async function main() {
  env.LANGSMITH_API_KEY();

  const casesPath = path.join(process.cwd(), "data", "eval-cases.json");
  const cases: EvalCase[] = JSON.parse(await fs.readFile(casesPath, "utf-8"));

  const data: Example[] = cases.map((c) => ({
    id: randomUUID(),
    created_at: CREATED_AT,
    inputs: { question: c.question, topK: DEFAULT_TOP_K, caseId: c.id },
    outputs: { expectedUrls: c.expectedUrls, shouldRefuse: c.shouldRefuse },
    runs: [],
    dataset_id: "",
  }));

  const experimentResults = await evaluate(
    async (inputs: { question: string; topK: number }): Promise<RunRagResult> => {
      return runRag(inputs.question, inputs.topK);
    },
    {
      data,
      experimentPrefix: "friday-docs-rag",
      maxConcurrency: 2,
      evaluators: [
        ({ outputs, referenceOutputs }: { outputs: Record<string, unknown>; referenceOutputs?: Record<string, unknown> }) => ({
          key: "retrieval_recall",
          score: scoreRetrievalRecall(
            toRagResult(outputs).chunks ?? [],
            referenceOutputs?.expectedUrls as string[] | undefined
          ),
        }),
        ({ outputs }: { outputs: Record<string, unknown> }) => ({
          key: "grounding",
          score: scoreGrounding(toRagResult(outputs).analysis?.hallucinated ?? []),
        }),
        ({ outputs }: { outputs: Record<string, unknown> }) => {
          const r = toRagResult(outputs);
          return {
            key: "citation_precision",
            score: scoreCitationPrecision(
              r.analysis?.cited?.length ?? 0,
              r.analysis?.hallucinated?.length ?? 0
            ),
          };
        },
        ({ outputs, referenceOutputs }: { outputs: Record<string, unknown>; referenceOutputs?: Record<string, unknown> }) => ({
          key: "refusal_correctness",
          score: scoreRefusalCorrectness(
            toRagResult(outputs).isRefusal ?? false,
            referenceOutputs?.shouldRefuse as boolean | undefined
          ),
        }),
      ],
    }
  );

  const rows: Record<string, string | number>[] = [];
  let totalRecall = 0;
  let totalGrounding = 0;
  let totalPrecision = 0;
  let totalRefusal = 0;
  let countRecall = 0;
  let countGrounding = 0;
  let countPrecision = 0;
  let countRefusal = 0;

  for await (const row of experimentResults) {
    const scores: Record<string, number> = {};
    for (const r of row.evaluationResults.results) {
      if (r.score != null) scores[r.key] = r.score as number;
    }

    const recall = scores["retrieval_recall"] ?? NaN;
    const grounding = scores["grounding"] ?? NaN;
    const precision = scores["citation_precision"] ?? NaN;
    const refusal = scores["refusal_correctness"] ?? NaN;

    rows.push({
      case: String(row.example.inputs.caseId ?? row.example.inputs.question).slice(0, 40),
      retrieval_recall: isNaN(recall) ? "N/A" : recall.toFixed(2),
      grounding: isNaN(grounding) ? "N/A" : grounding.toFixed(2),
      citation_precision: isNaN(precision) ? "N/A" : precision.toFixed(2),
      refusal_correctness: isNaN(refusal) ? "N/A" : refusal.toFixed(2),
    });

    if (!isNaN(recall)) {
      totalRecall += recall;
      countRecall++;
    }
    if (!isNaN(grounding)) {
      totalGrounding += grounding;
      countGrounding++;
    }
    if (!isNaN(precision)) {
      totalPrecision += precision;
      countPrecision++;
    }
    if (!isNaN(refusal)) {
      totalRefusal += refusal;
      countRefusal++;
    }
  }

  console.table(rows);

  console.log("\n── Aggregate Scores ──────────────────────────────────");
  console.log(`  retrieval_recall:    ${countRecall ? (totalRecall / countRecall).toFixed(3) : "N/A"} (n=${countRecall})`);
  console.log(`  grounding:           ${countGrounding ? (totalGrounding / countGrounding).toFixed(3) : "N/A"} (n=${countGrounding})`);
  console.log(`  citation_precision:  ${countPrecision ? (totalPrecision / countPrecision).toFixed(3) : "N/A"} (n=${countPrecision})`);
  console.log(`  refusal_correctness: ${countRefusal ? (totalRefusal / countRefusal).toFixed(3) : "N/A"} (n=${countRefusal})`);
  console.log(`\n  Experiment: ${experimentResults.experimentName}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
