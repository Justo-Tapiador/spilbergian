/**
 * src/llm/OpenAIAdapter.js — LLM adapter for Spilbergian v3.0.
 *
 * Uses z-ai-web-dev-sdk when available (preferred), falling back to a
 * direct OpenAI-compatible HTTP call (so it works with Ollama, LM Studio,
 * z-ai's own API, etc.) when the SDK is not installed.
 */
import axios from 'axios';

export class OpenAIAdapter {
  constructor(opts = {}) {
    this.model       = opts.model || 'glm-4.6';
    this.temperature = opts.temperature ?? 0.85;
    this.maxTokens   = opts.maxTokens ?? 8192;
    this.apiKey      = opts.apiKey || process.env.OPENAI_API_KEY || process.env.ZAI_API_KEY;
    this.baseURL     = opts.baseURL || process.env.OPENAI_BASE_URL || 'https://api.z.ai/api/paas/v4';
    this._sdkClient  = null;
  }

  async _ensureSdk() {
    if (this._sdkClient) return this._sdkClient;
    if (!this.apiKey) return false;
    try {
      const mod = await import('z-ai-web-dev-sdk');
      const ZAI = mod.default || mod.ZAI || mod;
      this._sdkClient =  await Promise.race([
        createP,
        new Promise((resolve) => setTimeout(() => resolve(false), 3000)),
      ]);
    } catch {
      this._sdkClient = false; // mark unavailable
    }
    return this._sdkClient;
  }

  /**
   * Send a chat completion request.
   * @param {string} userMessage
   * @param {string} [systemMessage]
   * @returns {Promise<string>} assistant text
   */
  async chat(userMessage, systemMessage = '') {
    // Try SDK first
    const sdk = await this._ensureSdk();
    if (sdk && typeof sdk.chat?.completions?.create === 'function') {
      try {
        const res = await sdk.chat.completions.create({
          model: this.model,
          messages: [
            ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
            { role: 'user', content: userMessage },
          ],
          temperature: this.temperature,
          max_tokens: this.maxTokens,
        });
        return res.choices?.[0]?.message?.content || '';
      } catch (err) {
        console.warn('[OpenAIAdapter] SDK call failed, falling back to HTTP:', err.message);
      }
    }

    // Fallback: direct HTTP call (OpenAI-compatible)
    if (!this.apiKey) {
      throw new Error('OpenAIAdapter: no API key set (OPENAI_API_KEY / ZAI_API_KEY) and z-ai-web-dev-sdk not available.');
    }
    const res = await axios.post(
      `${this.baseURL}/chat/completions`,
      {
        model: this.model,
        messages: [
          ...(systemMessage ? [{ role: 'system', content: systemMessage }] : []),
          { role: 'user', content: userMessage },
        ],
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60_000,
      },
    );
    return res.data?.choices?.[0]?.message?.content || '';
  }

  /** Classify a text into one of the provided labels. */
  async classify(text, labels) {
    const sys = `You are a strict classifier. Respond with ONLY one of these labels: ${labels.join(', ')}. No other text.`;
    const out = await this.chat(`Classify: "${text}"`, sys);
    const cleaned = out.trim().toLowerCase();
    return labels.find(l => cleaned.includes(l.toLowerCase())) || labels[0];
  }

  /** JSON-mode chat (best effort). Returns parsed object or null. */
  async chatJSON(userMessage, systemMessage = '') {
    const text = await this.chat(userMessage, systemMessage + '\n\nRespond ONLY with valid JSON, no markdown fences.');
    try {
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
      return JSON.parse(cleaned);
    } catch {
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { return JSON.parse(match[0]); } catch { return null; }
      }
      return null;
    }
  }
}

export default OpenAIAdapter;
