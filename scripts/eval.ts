import { env } from "../src/lib/env";

async function main() {
  env.LANGSMITH_API_KEY();
  console.log("[eval] Phase 6: will run evaluation cases -> score retrieval recall, grounding, citation accuracy -> log to LangSmith");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
