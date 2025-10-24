
import { App } from '@slack/bolt';
import { existsSync, mkdirSync } from 'fs';
import { config as dotenvConfig } from 'dotenv';
import { exec } from 'child_process';
import { ClaudeHandler, SessionManager, type Session } from '../utils/claude-handler.js';

// Load environment variables
dotenvConfig();

// Utility function to convert Markdown formatting to Slack formatting
function formatTextForSlack(text: string): string {
  // Use placeholders to avoid conflicts between bold and italic conversion
  const placeholders: string[] = [];
  
  // First, convert **bold** to placeholders
  let result = text.replace(/\*\*(.*?)\*\*/g, (match, content) => {
    const placeholder = `__BOLD_${placeholders.length}__`;
    placeholders.push(`*${content}*`); // Store as Slack bold format
    return placeholder;
  });
  
  // Then, convert *italic* to _italic_
  result = result.replace(/\*([^*]+?)\*/g, '_$1_');
  
  // Finally, restore bold placeholders
  placeholders.forEach((placeholder, index) => {
    result = result.replace(`__BOLD_${index}__`, placeholder);
  });
  
  return result;
}

interface SlackMessage {
  channel: string;
  ts: string;
  user: string;
  text: string;
  thread_ts?: string;
  subtype?: string;
  files?: any[];
}

// Environment configuration
const config = {
  slack: {
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    appToken: process.env.SLACK_APP_TOKEN,
  },
  xmtp: {
    env: process.env.XMTP_ENV || 'production',
    workingDir: process.env.XMTP_WORKING_DIR || '/tmp/xmtp-slack-sessions',
  },
  claude: {
    // Using CLI authentication instead of API key
  }
};


// Main Slack Bot
class XMTPSlackBot {
  private app: App;
  private sessionManager: SessionManager;
  private claudeHandler: ClaudeHandler;

  constructor() {
    this.app = new App({
      token: config.slack.token,
      signingSecret: config.slack.signingSecret,
      socketMode: true,
      appToken: config.slack.appToken,
    });

    this.sessionManager = new SessionManager();
    this.claudeHandler = new ClaudeHandler();

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Message handler
    this.app.message(async ({ message, say, client }) => {
      const slackMessage = message as SlackMessage;
      const { user, channel, thread_ts, ts, text, subtype } = slackMessage;

      
      // Ignore bot messages and messages without text
      if (subtype === 'bot_message' || !text || text.trim() === '') {
        return;
      }

      // Ignore messages from the bot itself
      if (user === 'USLACKBOT' || user?.startsWith('B')) {
        console.log('⏭️  Ignoring bot user message:', { user });
        return;
      }

      // Only respond to messages that mention the bot
      const mentionsBot = text.includes('<@') && text.includes('>');
      
      if (!mentionsBot) {
        return;
      }

      console.log('✅ Processing message:', { 
        mentionsBot, 
        text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
        user,
        channel,
        thread_ts
      });

      // Get or create session
      const sessionKey = this.sessionManager.getSessionKey(user, channel, thread_ts);
      const session = this.sessionManager.getOrCreateSession(user, channel, thread_ts);

      // Cancel existing request
      const existingController = this.sessionManager.activeControllers.get(sessionKey);
      if (existingController) {
        existingController.abort();
      }

      const abortController = new AbortController();
      this.sessionManager.activeControllers.set(sessionKey, abortController);

      let statusMessageTs: string | undefined;

      try {
        // Determine the thread context for this conversation
        const threadContext = thread_ts || ts;
        
        // Send initial status
        const statusResult = await say({
          text: formatTextForSlack('🤔 *Thinking...*'),
          thread_ts: threadContext,
        });
        statusMessageTs = statusResult.ts;

        // Process the message
        await this.processMessage(text, session, say, client, abortController, statusMessageTs, threadContext);

      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Error processing message:', error);
          
          if (statusMessageTs) {
            await client.chat.update({
              channel,
              ts: statusMessageTs,
              text: formatTextForSlack('❌ *Error occurred*'),
            });
          }
          
          await say({
            text: formatTextForSlack(`Error: ${error.message}`),
            thread_ts: thread_ts || ts,
          });
        }
      } finally {
        this.sessionManager.activeControllers.delete(sessionKey);
      }
    });

    // App mention handler
    this.app.event('app_mention', async ({ event, say }) => {
      await say({
        text: formatTextForSlack(`👋 Hi! I'm Claude, running through the XMTP Slack Bot. I can help you with XMTP testing, development, and any questions you have. Just start chatting!`),
        thread_ts: event.ts,
      });
    });
  }

  private async processMessage(
    text: string, 
    session: Session, 
    say: any, 
    client: any, 
    abortController: AbortController,
    statusMessageTs?: string,
    threadContext?: string
  ): Promise<void> {
    
    // Handle empty or undefined text
    if (!text || text.trim() === '') {
      await say({
        text: 'Please provide a command or message.',
      });
      return;
    }

    // Remove mention from text and add user message to session
    const cleanText = text.replace(/<@[A-Z0-9]+>/g, '').trim();
    session.messages.push({
      role: 'user',
      content: cleanText,
    });

    // Update status to working
    if (statusMessageTs) {
      await client.chat.update({
        channel: session.channelId,
        ts: statusMessageTs,
        text: formatTextForSlack('🤔 *Thinking...*'),
      });
    }

    // Stream response from Claude
    let fullResponse = '';
    let responseMessageTs: string | undefined;

    try {
      console.log('🔄 Starting to stream response from Claude...');
      for await (const chunk of this.claudeHandler.streamFromClaude(session.messages, abortController)) {
        if (abortController.signal.aborted) break;
        
        fullResponse += chunk;
        console.log('📤 Streaming chunk:', chunk.substring(0, 50) + (chunk.length > 50 ? '...' : ''));

        if (!responseMessageTs) {
          // Send initial response in the same thread as the thinking message
          console.log('📝 Sending initial response chunk to Slack...');
          const result = await say({
            text: formatTextForSlack(chunk),
            thread_ts: threadContext, // Use the same thread context as the thinking message
          });
          responseMessageTs = result.ts;
          console.log('✅ Sent initial response chunk, message TS:', responseMessageTs);
        } else {
          // Update the response
          console.log('🔄 Updating response in Slack...');
          await client.chat.update({
            channel: session.channelId,
            ts: responseMessageTs,
            text: formatTextForSlack(fullResponse),
          });
          console.log('✅ Updated response, total length:', fullResponse.length);
        }
      }
    } catch (error) {
      console.error('Error streaming from Claude:', error);
      if (!responseMessageTs) {
        await say({
          text: formatTextForSlack('Sorry, I encountered an error while processing your request.'),
          thread_ts: threadContext,
        });
      }
    }

    // If no response was generated, send a fallback
    if (!responseMessageTs && !fullResponse.trim()) {
      console.log('No response generated, sending fallback');
      await say({
        text: formatTextForSlack('Hello! I received your message but had trouble processing it. Please try again.'),
        thread_ts: threadContext,
      });
    }

    // Add assistant response to session
    if (fullResponse.trim()) {
      session.messages.push({
        role: 'assistant',
        content: fullResponse,
      });
    }
  }


  async start(): Promise<void> {
    await this.app.start();
    console.log('🤖 XMTP Slack Bot is running!');
  }

  async stop(): Promise<void> {
    await this.app.stop();
    console.log('🤖 XMTP Slack Bot stopped.');
  }
}

// Cleanup function to kill any existing processes
async function cleanupExistingProcesses(): Promise<void> {
  return new Promise((resolve) => {
    console.log('🧹 Checking for existing processes...');
    
    exec('ps aux | grep -E "(slack-bot|tsx.*slack)" | grep -v grep', (error, stdout) => {
      if (stdout.trim()) {
        console.log('⚠️  Found existing processes, terminating...');
        
        // Kill existing processes
        exec('pkill -f "slack-bot.ts"', () => {
          exec('pkill -f "tsx.*slack"', () => {
            console.log('✅ Existing processes terminated');
            setTimeout(resolve, 1000); // Wait 1 second for cleanup
          });
        });
      } else {
        console.log('✅ No existing processes found');
        resolve();
      }
    });
  });
}

// Main execution
async function main(): Promise<void> {
  // Clean up any existing processes first
  await cleanupExistingProcesses();
  
  // Validate environment
  if (!config.slack.token || !config.slack.signingSecret || !config.slack.appToken) {
    console.error('❌ Missing Slack configuration. Please set:');
    console.error('   SLACK_BOT_TOKEN');
    console.error('   SLACK_SIGNING_SECRET');
    console.error('   SLACK_APP_TOKEN');
    process.exit(1);
  }

  // Claude CLI authentication is handled automatically by the CLI tool
  console.log('✅ Using Claude CLI for authentication');

  // Create working directory
  if (!existsSync(config.xmtp.workingDir)) {
    mkdirSync(config.xmtp.workingDir, { recursive: true });
  }

  // Start the bot
  const bot = new XMTPSlackBot();
  
  // Graceful shutdown handlers
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    
    try {
      // Cancel all active requests
      const sessionManager = (bot as any).sessionManager;
      if (sessionManager) {
        sessionManager.cleanupAllSessions();
      }
      
      // Stop the bot
      await bot.stop();
      console.log('✅ Bot stopped successfully');
    } catch (error) {
      console.error('❌ Error during shutdown:', error);
    } finally {
      // Force exit after a short delay
      setTimeout(() => {
        console.log('🔴 Force exiting...');
        process.exit(0);
      }, 2000);
    }
  };

  // Handle different termination signals
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGQUIT', () => shutdown('SIGQUIT'));
  
  // Handle uncaught exceptions and unhandled rejections
  process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    shutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });

  await bot.start();
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { XMTPSlackBot };
