export type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type OllamaChatResponse = {
  message?: { role: string; content: string };
  response?: string;
};

export function getOllamaBaseUrl(): string {
  return process.env.OLLAMA_BASE_URL ?? "http://ollama:11434";
}

export function getOllamaModel(): string {
  // Default to a smaller LLaMA 3.x model for local dev (8B часто не влезает по памяти)
  return process.env.OLLAMA_MODEL ?? "llama3.2:3b";
}

export async function ollamaChat(messages: OllamaMessage[]) {
  const baseUrl = getOllamaBaseUrl();
  const model = getOllamaModel();

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      messages,
      // Reduce context to lower memory pressure (can be overridden later if needed)
      options: { num_ctx: 2048 },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as OllamaChatResponse;
  const content = data.message?.content ?? data.response ?? "";
  return { content };
}


