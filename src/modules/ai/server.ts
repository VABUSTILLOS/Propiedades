import "server-only";

/**
 * DeepSeek client for property description + scoring assistance.
 * All calls are server-side (API key never reaches the client).
 */

type DeepSeekConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

function getConfig(): DeepSeekConfig | null {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    baseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  };
}

export async function callDeepSeek(prompt: string): Promise<string | null> {
  const config = getConfig();
  if (!config) return null;

  const res = await fetch(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        {
          role: "system",
          content:
            "You are a real-estate copywriter for the Mexican market. Respond in Spanish unless asked otherwise. Keep responses concise and factual.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 400,
    }),
  });

  if (!res.ok) return null;

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() ?? null;
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
  return callDeepSeek(
    `Write a compelling ${input.type === "rent" ? "rental" : "sales"} listing description for:\n` +
      `Title: ${input.title}\nLocation: ${input.colonia}, ${input.city}\n` +
      `Land: ${input.terrainM2} m² · Built: ${input.constructionM2} m² · Price: $${input.price.toLocaleString()} MXN\n` +
      `Max 120 words. Highlight lifestyle and investment value. No emoji, no bullet lists.`,
  );
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
  const text = await callDeepSeek(
    `Rate this property's investment attractiveness 0–100.\n` +
      `Title: ${input.title}\nLocation: ${input.colonia}, ${input.city}\n` +
      `Price: $${input.price.toLocaleString()} MXN · ${input.terrainM2} m² land · ${input.constructionM2} m² built\n` +
      `Est. rent: ${input.estimatedMonthlyRent ? `$${input.estimatedMonthlyRent} / mo` : "unknown"}\n` +
      `Respond ONLY as JSON: {"score": number, "reasoning": "one sentence"}`,
  );
  if (!text) return null;

  try {
    const parsed = JSON.parse(text) as { score?: number; reasoning?: string };
    if (typeof parsed.score !== "number") return null;
    return {
      score: Math.max(0, Math.min(100, Math.round(parsed.score))),
      reasoning: parsed.reasoning ?? "",
    };
  } catch {
    return null;
  }
}
