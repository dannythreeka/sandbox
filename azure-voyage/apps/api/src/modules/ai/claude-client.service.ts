import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";

export interface ClaudeToolResult {
  input: unknown;
  inputTokens: number;
  outputTokens: number;
}

interface JsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
}

export interface ClaudeChatResult {
  text: string;
  toolCalls: { name: string; input: unknown }[];
  inputTokens: number;
  outputTokens: number;
}

/**
 * @anthropic-ai/sdk 封裝（docs/06 §1）：單一入口，強制模型透過一顆 tool
 * 回傳結構化 JSON。`AI_ENABLED=false` 或缺少 API key 時 client 為 null，
 * 呼叫一律回傳 null——呼叫端據此走 fallback，遊戲永遠不因 AI 停擺
 * （docs/06 §2 鐵律 2）。
 */
@Injectable()
export class ClaudeClientService {
  private readonly logger = new Logger(ClaudeClientService.name);
  private readonly client: Anthropic | null;

  constructor(config: ConfigService) {
    const enabled = config.get<string>("AI_ENABLED") === "true";
    const apiKey = config.get<string>("ANTHROPIC_API_KEY");
    this.client = enabled && apiKey ? new Anthropic({ apiKey }) : null;
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  async callStructured(opts: {
    model: string;
    system: string;
    user: string;
    toolName: string;
    inputSchema: JsonSchema;
  }): Promise<ClaudeToolResult | null> {
    if (!this.client) return null;
    try {
      const response = await this.client.messages.create(
        {
          model: opts.model,
          max_tokens: 1024,
          system: opts.system,
          messages: [{ role: "user", content: opts.user }],
          tools: [
            {
              name: opts.toolName,
              description: `Return the ${opts.toolName} payload as tool input.`,
              input_schema: opts.inputSchema as unknown as Anthropic.Tool.InputSchema,
            },
          ],
          tool_choice: { type: "tool", name: opts.toolName },
        },
        { timeout: 15_000 },
      );
      const toolUse = response.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      if (!toolUse) return null;
      return {
        input: toolUse.input,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    } catch (err) {
      this.logger.warn(`Claude 呼叫失敗，改走 fallback: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  /**
   * 自由文字對話（docs/06 §5 DIALOGUE）：不強制工具，模型可自行決定要不要
   * 呼叫 `tools` 裡的任一顆（`tool_choice: "auto"`），文字與工具呼叫可以並存。
   */
  async chat(opts: {
    model: string;
    system: string;
    messages: { role: "user" | "assistant"; content: string }[];
    maxTokens?: number;
    tools?: { name: string; description: string; inputSchema: JsonSchema }[];
  }): Promise<ClaudeChatResult | null> {
    if (!this.client) return null;
    try {
      const response = await this.client.messages.create(
        {
          model: opts.model,
          max_tokens: opts.maxTokens ?? 300,
          system: opts.system,
          messages: opts.messages,
          ...(opts.tools && opts.tools.length > 0
            ? {
                tools: opts.tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  input_schema: t.inputSchema as unknown as Anthropic.Tool.InputSchema,
                })),
                tool_choice: { type: "auto" as const },
              }
            : {}),
        },
        { timeout: 15_000 },
      );
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      const toolCalls = response.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
        .map((b) => ({ name: b.name, input: b.input }));
      return {
        text,
        toolCalls,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      };
    } catch (err) {
      this.logger.warn(`Claude 對話呼叫失敗，改走 fallback: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
