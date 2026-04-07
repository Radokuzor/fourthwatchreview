import OpenAI from "openai";
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4";
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

const normalizeContentPart = (
  part: MessageContent
): TextContent | ImageContent | FileContent => {
  if (typeof part === "string") {
    return { type: "text", text: part };
  }

  if (part.type === "text") {
    return part;
  }

  if (part.type === "image_url") {
    return part;
  }

  if (part.type === "file_url") {
    return part;
  }

  throw new Error("Unsupported message content part");
};

function messageToPlainText(message: Message): string {
  const { role, name, tool_call_id } = message;

  if (role === "tool" || role === "function") {
    const content = ensureArray(message.content)
      .map((part) => (typeof part === "string" ? part : JSON.stringify(part)))
      .join("\n");
    return `${name ?? role}${tool_call_id ? ` (${tool_call_id})` : ""}: ${content}`;
  }

  const contentParts = ensureArray(message.content).map(normalizeContentPart);

  if (contentParts.length === 1 && contentParts[0].type === "text") {
    return contentParts[0].text;
  }

  return contentParts
    .map((p) => {
      if (p.type === "text") return p.text;
      return JSON.stringify(p);
    })
    .join("\n");
}

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

function assertOpenAIKey() {
  if (!ENV.openaiApiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
}

function getClient() {
  assertOpenAIKey();
  return new OpenAI({ apiKey: ENV.openaiApiKey });
}

function wrapOpenAIResult(completion: OpenAI.Chat.ChatCompletion): InvokeResult {
  const choice = completion.choices[0];
  const raw: unknown = choice?.message?.content;
  let text = "";
  if (typeof raw === "string") {
    text = raw;
  } else if (Array.isArray(raw)) {
    for (const p of raw as OpenAI.Chat.ChatCompletionContentPart[]) {
      if (p.type === "text") text += p.text;
      else text += JSON.stringify(p);
    }
  }

  return {
    id: completion.id,
    created: completion.created,
    model: completion.model,
    choices: [
      {
        index: choice?.index ?? 0,
        message: { role: "assistant", content: text },
        finish_reason: choice?.finish_reason ?? "stop",
      },
    ],
    usage: completion.usage
      ? {
          prompt_tokens: completion.usage.prompt_tokens,
          completion_tokens: completion.usage.completion_tokens,
          total_tokens: completion.usage.total_tokens,
        }
      : undefined,
  };
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const client = getClient();

  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format,
  } = params;

  if (tools && tools.length > 0) {
    throw new Error("invokeLLM: tool calls are not supported in this build");
  }
  if (toolChoice || tool_choice) {
    throw new Error("invokeLLM: tool_choice is not supported in this build");
  }

  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema,
  });

  const systemParts = messages.filter((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");
  const systemInstruction =
    systemParts.length > 0
      ? systemParts.map((m) => messageToPlainText(m)).join("\n\n")
      : undefined;

  const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  if (systemInstruction) {
    openaiMessages.push({ role: "system", content: systemInstruction });
  }
  for (const m of nonSystem) {
    const text = messageToPlainText(m);
    if (m.role === "user") {
      openaiMessages.push({ role: "user", content: text });
    } else if (m.role === "assistant") {
      openaiMessages.push({ role: "assistant", content: text });
    } else {
      openaiMessages.push({ role: "user", content: `[${m.role}] ${text}` });
    }
  }

  const maxOut = params.maxTokens ?? params.max_tokens ?? 8192;
  const model = ENV.openaiModel;

  let responseFormatParam:
    | OpenAI.Chat.ChatCompletionCreateParams["response_format"]
    | undefined;

  if (normalizedResponseFormat?.type === "json_schema") {
    const js = normalizedResponseFormat.json_schema;
    responseFormatParam = {
      type: "json_schema",
      json_schema: {
        name: js.name,
        schema: js.schema,
        strict: js.strict ?? false,
      },
    };
  } else if (normalizedResponseFormat?.type === "json_object") {
    responseFormatParam = { type: "json_object" };
  }

  const completion = await client.chat.completions.create({
    model,
    messages:
      openaiMessages.length > 0
        ? openaiMessages
        : [{ role: "user", content: "" }],
    max_tokens: maxOut,
    ...(responseFormatParam ? { response_format: responseFormatParam } : {}),
  });

  return wrapOpenAIResult(completion);
}
