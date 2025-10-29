import { Agent } from "@xmtp/agent-sdk";
import { logDetails } from "@xmtp/agent-sdk/debug";
import { ContentTypeMarkdown, MarkdownCodec } from "@xmtp/content-type-markdown";
import { ClaudeHandler, SessionManager } from "../utils/claude-handler.js";
import { WalletSendCallsCodec } from "@xmtp/content-type-wallet-send-calls";
import { ReplyCodec } from "@xmtp/content-type-reply";
import { AttachmentCodec, RemoteAttachmentCodec } from "@xmtp/content-type-remote-attachment";
import { ReactionCodec } from "@xmtp/content-type-reaction";

// Load .env file only in local development
if (process.env.NODE_ENV !== "production") process.loadEnvFile(".env");

const agent = await Agent.createFromEnv({
  dbPath: (inboxId) =>
    `${process.env.RAILWAY_VOLUME_MOUNT_PATH ?? "./xmtp"}/${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`,
  codecs: [
    new MarkdownCodec(),
    new ReactionCodec(),
    new ReplyCodec(),
    new RemoteAttachmentCodec(),
    new AttachmentCodec(),
    new WalletSendCallsCodec(),
  ],          
});

// Initialize Claude handler and session manager
const claudeHandler = new ClaudeHandler();
const sessionManager = new SessionManager();

// Handle text messages with Claude CLI
agent.on("text", async (ctx) => {
  const messageContent = ctx.message.content;
  const senderAddress = (await ctx.getSenderAddress()) || "unknown";
  const conversationId = ctx.conversation.id || "unknown";

  console.log(`📨 Received message from ${senderAddress}: ${messageContent}`);

  // Get or create session for this conversation
  const session = sessionManager.getOrCreateSession(
    senderAddress,
    conversationId,
  );

  // Check if there's an active controller for this session
  const sessionKey = sessionManager.getSessionKey(
    senderAddress,
    conversationId,
  );
  const existingController = sessionManager.activeControllers.get(sessionKey);
  if (existingController) {
    existingController.abort();
  }

  const abortController = new AbortController();
  sessionManager.activeControllers.set(sessionKey, abortController);

  try {
    // Add user message to session
    session.messages.push({
      role: "user",
      content: messageContent,
    });

    // Stream response from Claude
    let fullResponse = "";

    for await (const chunk of claudeHandler.streamFromClaude(
      session.messages,
      abortController,
    )) {
      if (abortController.signal.aborted) break;
      fullResponse += chunk;
    }

    // Send the full response back via XMTP as markdown
    if (fullResponse.trim()) {
      await ctx.conversation.send(fullResponse, ContentTypeMarkdown);

      // Add assistant response to session
      session.messages.push({
        role: "assistant",
        content: fullResponse,
      });

      console.log(`✅ Sent markdown response to ${senderAddress}`);
    }
  } catch (error: any) {
    if (error.name !== "AbortError") {
      console.error("❌ Error processing message:", error);
      await ctx.sendText(
        "Sorry, I encountered an error while processing your message.",
      );
    }
  } finally {
    sessionManager.activeControllers.delete(sessionKey);
  }
});

agent.on("group", async (ctx) => {
  console.log(`👥 New group conversation: ${ctx.conversation.id}`);
});

agent.on("dm", async (ctx) => {
  console.log(`💬 New DM conversation: ${ctx.conversation.id}`);
});

// Log when we're ready
agent.on("start", (): void => {
  console.log("🤖 XMTP Copilot with Claude CLI is running!");
  logDetails(agent.client);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);

  try {
    sessionManager.cleanupAllSessions();
    await agent.stop();
    console.log("✅ XMTP Copilot stopped successfully");
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
  } finally {
    setTimeout(() => {
      console.log("🔴 Force exiting...");
      process.exit(0);
    }, 2000);
  }
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGQUIT", () => shutdown("SIGQUIT"));

await agent.start();
