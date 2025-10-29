import { spawn } from "child_process";

// Types
export interface Session {
  userId: string;
  channelId: string;
  threadTs?: string;
  isActive: boolean;
  lastActivity: Date;
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

// Session Manager
export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  public activeControllers: Map<string, AbortController> = new Map();

  getSessionKey(userId: string, channelId: string, threadTs?: string): string {
    return `${userId}-${channelId}-${threadTs || "direct"}`;
  }

  getSession(
    userId: string,
    channelId: string,
    threadTs?: string,
  ): Session | undefined {
    return this.sessions.get(this.getSessionKey(userId, channelId, threadTs));
  }

  createSession(userId: string, channelId: string, threadTs?: string): Session {
    const session: Session = {
      userId,
      channelId,
      threadTs,
      isActive: true,
      lastActivity: new Date(),
      messages: [],
    };
    this.sessions.set(this.getSessionKey(userId, channelId, threadTs), session);
    return session;
  }

  getOrCreateSession(
    userId: string,
    channelId: string,
    threadTs?: string,
  ): Session {
    return (
      this.getSession(userId, channelId, threadTs) ||
      this.createSession(userId, channelId, threadTs)
    );
  }

  cleanupSession(sessionKey: string): void {
    const controller = this.activeControllers.get(sessionKey);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(sessionKey);
    }
    this.sessions.delete(sessionKey);
  }

  cleanupAllSessions(): void {
    console.log(
      `🧹 Cleaning up ${this.activeControllers.size} active sessions...`,
    );
    for (const [sessionKey, controller] of this.activeControllers) {
      console.log(`Cancelling session: ${sessionKey}`);
      controller.abort();
    }
    this.activeControllers.clear();
    this.sessions.clear();
  }
}

// Claude Handler using CLI
export class ClaudeHandler {
  constructor() {
    // No initialization needed for CLI
  }

  async *streamFromClaude(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    abortController: AbortController,
  ): AsyncGenerator<string> {
    try {
      console.log(
        "🤖 Starting Claude CLI call with messages:",
        messages.length,
      );

      // Log all messages for debugging
      messages.forEach((msg, index) => {
        console.log(
          `📝 Message ${index + 1} (${msg.role}):`,
          msg.content.substring(0, 100) +
            (msg.content.length > 100 ? "..." : ""),
        );
      });

      // Convert messages to a single prompt for CLI
      const prompt = this.convertMessagesToPrompt(messages);
      console.log(
        "📤 Sending prompt to Claude CLI:",
        prompt.substring(0, 200) + (prompt.length > 200 ? "..." : ""),
      );
      console.log("📤 Full prompt length:", prompt.length);
      console.log("📤 Full prompt content:", JSON.stringify(prompt));

      // Use the same approach as the reference implementation
      const fullResponse = await this.executeClaudeCommand(
        prompt,
        abortController,
      );
      console.log(
        "📥 Received response from Claude CLI:",
        fullResponse.substring(0, 200) +
          (fullResponse.length > 200 ? "..." : ""),
      );

      // Simulate streaming by yielding chunks of the response
      const chunkSize = 50; // Characters per chunk
      for (let i = 0; i < fullResponse.length; i += chunkSize) {
        if (abortController.signal.aborted) break;

        const chunk = fullResponse.slice(i, i + chunkSize);
        yield chunk;

        // Add a small delay to simulate streaming
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      console.log("✅ Claude CLI stream completed");
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("❌ Claude CLI error:", error);
        yield `Error: ${error.message}`;
      }
    }
  }

  private convertMessagesToPrompt(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
  ): string {
    // Convert conversation history to a single prompt
    // Take only the last user message for simplicity
    const lastUserMessage = messages.filter((m) => m.role === "user").pop();
    return lastUserMessage ? lastUserMessage.content : "Hello";
  }

  private async executeClaudeCommand(
    prompt: string,
    abortController: AbortController,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log("🚀 Spawning Claude CLI process...");
      console.log("🚀 Command: claude --print", JSON.stringify(prompt));
      console.log("🚀 Full command: claude --print \"" + prompt + "\"");

      // Add timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.log("⏰ Claude CLI request timed out after 30 seconds");
        reject(new Error("Claude CLI request timed out after 30 seconds"));
      }, 30000);

      // Use spawn with proper error handling
      // Use shell: true to resolve 'claude' from PATH
      // Properly quote the prompt to handle spaces and special characters
      const claudeProcess = spawn("claude", ["--print", `"${prompt}"`], {
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
        shell: true,
        env: { ...process.env },
      });

      console.log("📡 Claude CLI process spawned with PID:", claudeProcess.pid);

      let stdout = "";
      let stderr = "";

      claudeProcess.stdout.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        console.log(
          "📨 Received stdout chunk:",
          chunk.substring(0, 100) + (chunk.length > 100 ? "..." : ""),
        );
      });

      claudeProcess.stderr.on("data", (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        console.log(
          "⚠️  Received stderr chunk:",
          chunk.substring(0, 100) + (chunk.length > 100 ? "..." : ""),
        );
      });

      claudeProcess.on("close", (code: number) => {
        clearTimeout(timeout);
        console.log("🔚 Claude CLI process closed with code:", code);
        if (code === 0) {
          console.log("✅ Claude CLI completed successfully");
          resolve(stdout.trim());
        } else {
          console.error("❌ Claude CLI failed with stderr:", stderr);
          reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
        }
      });

      claudeProcess.on("error", (error: Error) => {
        clearTimeout(timeout);
        console.error("💥 Claude CLI process error:", error);
        reject(error);
      });

      // Handle abort signal
      abortController.signal.addEventListener("abort", () => {
        console.log("🛑 Claude CLI request aborted");
        clearTimeout(timeout);
        claudeProcess.kill("SIGTERM");
        reject(new Error("Request aborted"));
      });
    });
  }
}
