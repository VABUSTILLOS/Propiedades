import "server-only";

/**
 * Multi-provider AI client for property description + scoring assistance.
 * DeepSeek is the primary provider; kie.ai (OpenAI-compatible Gemini gateway)
 * is used as a fallback when DeepSeek is unset or unreachable.
 * All calls are server-side (API keys never reach the client).
 */

type ChatProvider = {
  name: "deepseek" | "kieai";
  apiKey: string;
  /** Full chat completions URL including provider-specific path prefix. */
  url: string;
  model: string;
};

/**
 * Resolve the active chat provider. DeepSeek wins when configured, otherwise
 * kie.ai (Gemini 2.5 Flash/Pro). Returns null when neither key is present.
 */
function getProvider(): ChatProvider | null {
  const deepseekKey = process.env.DEEPSEEK_API_KEY;
  if (deepseekKey) {
    const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
    const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
    return { name: "deepseek", apiKey: deepseekKey, url: `${baseUrl}/chat/completions`, model };
  }

  const kieaiKey = process.env.KIEAI_API_KEY;
  if (kieaiKey) {
    const model = process.env.KIEAI_MODEL ?? "gemini-2.5-flash";
    return {
      name: "kieai",
      apiKey: kieaiKey,
      url: `https://api.kie.ai/${model}/v1/chat/completions`,
      model,
    };
  }

  return null;
}

type ChatCompletionResult = {
  content: string | null;
  provider: "deepseek" | "kieai";
};

/**
 * OpenAI-compatible chat completion across providers. Returns null on failure
 * so callers can degrade gracefully.
 */
export async function chatCompletion(opts: {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}): Promise<ChatCompletionResult | null> {
  const provider = getProvider();
  if (!provider) return null;

  try {
    const res = await fetch(provider.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        ...(opts.jsonMode ? { response_format: { type: "json_object" } } : {}),
        temperature: opts.temperature ?? 0.7,
        max_tokens: opts.maxTokens ?? 400,
      }),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content?.trim() ?? null;
    return { content, provider: provider.name };
  } catch {
    return null;
  }
}

/** Strip ```json fences that some providers (Gemini via kie.ai) wrap JSON in. */
function extractJson(text: string): string | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced && fenced[1]) ?? text;
  try {
    const parsed = JSON.parse(candidate) as unknown;
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

/**
 * Generate a property listing description from structured details.
 */
export async function generateDescription(input: {
  title: string;
  type: string;
  city: string;
  colonia: string;
  terrainM2: number;
  constructionM2: number;
  price: number;
}): Promise<string | null> {
  const result = await chatCompletion({
    system:
      "You are a real-estate copywriter for the Mexican market. Respond in Spanish unless asked otherwise. Keep responses concise and factual.",
    user:
      `Write a compelling ${input.type === "rent" ? "rental" : "sales"} listing description for:\n` +
      `Title: ${input.title}\nLocation: ${input.colonia}, ${input.city}\n` +
      `Land: ${input.terrainM2} m² · Built: ${input.constructionM2} m² · Price: $${input.price.toLocaleString()} MXN\n` +
      `Max 120 words. Highlight lifestyle and investment value. No emoji, no bullet lists.`,
  });
  return result?.content ?? null;
}

/**
 * Score a property 0–100 for investment attractiveness.
 */
export async function scoreProperty(input: {
  title: string;
  city: string;
  colonia: string;
  price: number;
  terrainM2: number;
  constructionM2: number;
  estimatedMonthlyRent?: number | null;
}): Promise<{ score: number; reasoning: string } | null> {
  const result = await chatCompletion({
    jsonMode: true,
    system:
      "You are a real-estate copywriter for the Mexican market. Respond in Spanish unless asked otherwise. Keep responses concise and factual.",
    user:
      `Rate this property's investment attractiveness 0–100.\n` +
      `Title: ${input.title}\nLocation: ${input.colonia}, ${input.city}\n` +
      `Price: $${input.price.toLocaleString()} MXN · ${input.terrainM2} m² land · ${input.constructionM2} m² built\n` +
      `Est. rent: ${input.estimatedMonthlyRent ? `$${input.estimatedMonthlyRent} / mo` : "unknown"}\n` +
      `Respond ONLY as JSON: {"score": number, "reasoning": "one sentence"}`,
  });
  const text = result?.content ?? null;
  if (!text) return null;

  const json = extractJson(text);
  if (!json) return null;

  try {
    const parsed = JSON.parse(json) as { score?: number; reasoning?: string };
    if (typeof parsed.score !== "number") return null;
    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      reasoning: parsed.reasoning ?? "",
    };
  } catch {
    return null;
  }
}
