import type { ChatListItem } from "@/lib/chat-history";

export function toolGroupElapsedSeconds(
  tools: ChatListItem[],
  now: number
): number | null {
  if (tools.length === 0) {
    return null;
  }
  let startedAt = Number.POSITIVE_INFINITY;
  let completedAt = Number.NEGATIVE_INFINITY;
  for (const tool of tools) {
    const start = tool.toolStartedAt;
    const end = tool.toolStatus === "running" ? now : tool.toolCompletedAt;
    if (
      start === undefined ||
      end === undefined ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      end < start
    ) {
      return null;
    }
    startedAt = Math.min(startedAt, start);
    completedAt = Math.max(completedAt, end);
  }
  return Math.max(1, Math.floor((completedAt - startedAt) / 1000));
}

export type AssistantTurnSegment =
  | {
      groupId?: string;
      kind: "work";
      thinking?: ChatListItem;
      tools: ChatListItem[];
    }
  | { kind: "text"; message: ChatListItem; thinking?: ChatListItem };

export function segmentAssistantTurn(
  messages: ChatListItem[]
): AssistantTurnSegment[] {
  const segments: AssistantTurnSegment[] = [];
  let legacyToolGroup = 0;
  let previousWasTool = false;

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index]!;

    if (message.role === "tool") {
      const thinking = findThinkingForToolRun(messages, index);
      if (!previousWasTool) {
        legacyToolGroup += 1;
      }

      const groupId = message.toolGroupId ?? `legacy:${legacyToolGroup}`;
      const existing = segments.find(
        (segment): segment is Extract<AssistantTurnSegment, { kind: "work" }> =>
          segment.kind === "work" && segment.groupId === groupId
      );

      if (existing) {
        existing.tools.push(message);
        existing.thinking ??= thinking;
      } else {
        segments.push({ groupId, kind: "work", thinking, tools: [message] });
      }

      previousWasTool = true;
      continue;
    }

    previousWasTool = false;

    if (message.role === "assistant") {
      const hasThinking = hasThinkingContent(message);
      const hasText = hasAssistantText(message);
      const nextIsTool = messages[index + 1]?.role === "tool";

      if (hasThinking && nextIsTool) {
        continue;
      }

      if (hasThinking && !hasText) {
        segments.push({ kind: "work", thinking: message, tools: [] });
        continue;
      }

      if (hasText) {
        segments.push({
          kind: "text",
          message,
          ...(hasThinking ? { thinking: message } : {}),
        });
      }
    }
  }

  return segments;
}

function findThinkingForToolRun(
  messages: ChatListItem[],
  toolIndex: number
): ChatListItem | undefined {
  for (let index = toolIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (!message || message.role === "tool") {
      continue;
    }

    if (message.role === "user") {
      break;
    }

    if (hasThinkingContent(message)) {
      return message;
    }

    if (hasAssistantText(message)) {
      break;
    }
  }
}

function hasThinkingContent(message: ChatListItem): boolean {
  return Boolean(message.thinking?.trim() || message.thinkingStreaming);
}

function hasAssistantText(message: ChatListItem): boolean {
  // Empty streaming bubbles are handled by the awaiting-model placeholder, not as text.
  // Failed markers always render even when the error string is the only content.
  return Boolean(message.content.trim() || message.failed);
}
