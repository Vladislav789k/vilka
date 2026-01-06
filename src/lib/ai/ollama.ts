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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout (model can be slow)

  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        messages,
        // Increase context to handle longer prompts (but keep reasonable for 3B model)
        options: { num_ctx: 4096 },
      }),
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Ollama error ${res.status}: ${text}`);
    }

    const data = (await res.json()) as OllamaChatResponse;
    const content = data.message?.content ?? data.response ?? "";
    return { content };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("Request timeout: модель не ответила за 30 секунд");
    }
    throw error;
  }
}


