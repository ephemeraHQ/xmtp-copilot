#!/usr/bin/env node

import { Command } from "commander";
import { Agent } from "@xmtp/agent-sdk";
import { type Group } from "@xmtp/node-sdk";
import "dotenv/config";

const program = new Command();

program
  .name("list")
  .description("List conversations and messages")
  .argument("[operation]", "Operation: conversations, members, messages, find", "conversations")
  .option("--conversation-id <id>", "Conversation ID")
  .option("--limit <count>", "Limit number of results", "50")
  .option("--offset <count>", "Offset for pagination", "0")
  .option("--inbox-id <id>", "Inbox ID for find operation")
  .option("--address <address>", "Ethereum address for find operation")
  .action(async (operation, options) => {
    const limit = parseInt(options.limit) || 50;
    const offset = parseInt(options.offset) || 0;

    switch (operation) {
      case "conversations":
        await runConversationsOperation({ limit, offset });
        break;
      case "members":
        await runMembersOperation(options.conversationId);
        break;
      case "messages":
        await runMessagesOperation({ conversationId: options.conversationId, limit, offset });
        break;
      case "find":
        await runFindOperation({ inboxId: options.inboxId, address: options.address, limit, offset });
        break;
      default:
        console.error(`❌ Unknown operation: ${operation}`);
        program.help();
    }
  });

async function getAgent(): Promise<Agent> {
  const { MarkdownCodec } = await import("@xmtp/content-type-markdown");
  const { ReactionCodec } = await import("@xmtp/content-type-reaction");
  const { ReplyCodec } = await import("@xmtp/content-type-reply");
  const { RemoteAttachmentCodec, AttachmentCodec } = await import(
    "@xmtp/content-type-remote-attachment"
  );
  const { WalletSendCallsCodec } = await import(
    "@xmtp/content-type-wallet-send-calls"
  );

  return Agent.createFromEnv({
    dbPath: (inboxId) =>
      `${process.env.RAILWAY_VOLUME_MOUNT_PATH ?? ".xmtp"}/${process.env.XMTP_ENV}-${inboxId.slice(0, 8)}.db3`,
    codecs: [
      new MarkdownCodec(),
      new ReactionCodec(),
      new ReplyCodec(),
      new RemoteAttachmentCodec(),
      new AttachmentCodec(),
      new WalletSendCallsCodec(),
    ],
  });
}

async function runConversationsOperation(config: { limit: number; offset: number }): Promise<void> {
  const agent = await getAgent();

  try {
    const conversations = await agent.client.conversations.list();
    const paginated = conversations.slice(config.offset, config.offset + config.limit);

    console.log(`\n📋 Conversations:`);
    console.log(`   Total: ${conversations.length}`);
    console.log(`   Showing: ${paginated.length} (offset: ${config.offset}, limit: ${config.limit})`);

    paginated.forEach((conv, i) => {
      const isGroup = "groupName" in conv;
      console.log(`\n   ${i + 1 + config.offset}. ${isGroup ? "👥 Group" : "💬 DM"}: ${conv.id}`);
      if (isGroup) {
        const group = conv as Group;
        console.log(`      Name: ${group.name || "No name"}`);
      }
    });
  } catch (error) {
    console.error(`❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

async function runMembersOperation(conversationId?: string): Promise<void> {
  if (!conversationId) {
    console.error(`❌ --conversation-id is required`);
    process.exit(1);
  }

  const agent = await getAgent();

  try {
    const conversation = await agent.client.conversations.getConversationById(conversationId);
    if (!conversation) {
      console.error(`❌ Conversation not found`);
      process.exit(1);
    }

    const isGroup = "groupName" in conversation;
    if (!isGroup) {
      console.log(`📋 This is a Direct Message`);
      return;
    }

    const group = conversation as Group;
    const members = await group.members();

    console.log(`\n👥 Members:`);
    console.log(`   Total: ${members.length}`);
    members.forEach((member, i) => {
      console.log(`   ${i + 1}. ${(member as any).inboxId || "Unknown"}`);
    });
  } catch (error) {
    console.error(`❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

async function runMessagesOperation(config: {
  conversationId?: string;
  limit: number;
  offset: number;
}): Promise<void> {
  if (!config.conversationId) {
    console.error(`❌ --conversation-id is required`);
    process.exit(1);
  }

  const agent = await getAgent();

  try {
    const conversation = await agent.client.conversations.getConversationById(config.conversationId);
    if (!conversation) {
      console.error(`❌ Conversation not found`);
      process.exit(1);
    }

    const messages = await conversation.messages();
    const paginated = messages.slice(config.offset, config.offset + config.limit);

    console.log(`\n📝 Messages:`);
    console.log(`   Total: ${messages.length}`);
    console.log(`   Showing: ${paginated.length} (offset: ${config.offset}, limit: ${config.limit})`);

    paginated.forEach((msg, i) => {
      console.log(`\n   ${i + 1 + config.offset}. [${msg.sentAt ? new Date(msg.sentAt).toISOString() : "Unknown"}]`);
      console.log(`      From: ${msg.senderInboxId || "Unknown"}`);
      console.log(`      Content: ${msg.content}`);
    });
  } catch (error) {
    console.error(`❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

async function runFindOperation(config: {
  inboxId?: string;
  address?: string;
  limit: number;
  offset: number;
}): Promise<void> {
  if (!config.inboxId && !config.address) {
    console.error(`❌ Either --inbox-id or --address is required`);
    process.exit(1);
  }

  const agent = await getAgent();

  try {
    let targetInboxId: string;

    if (config.inboxId) {
      targetInboxId = config.inboxId;
    } else {
      const resolved = await agent.client.getInboxIdByIdentifier({
        identifier: config.address!,
        identifierKind: 0,
      });

      if (!resolved) {
        console.error(`❌ No inbox found for address`);
        process.exit(1);
      }

      targetInboxId = resolved;
    }

    const conversations = await agent.client.conversations.list();
    let foundConversation = null;

    for (const conv of conversations) {
      const messages = await conv.messages();
      if (messages.length > 0 && messages[0].senderInboxId === targetInboxId) {
        foundConversation = conv;
        break;
      }
    }

    if (!foundConversation) {
      console.error(`❌ No conversation found`);
      process.exit(1);
    }

    const messages = await foundConversation.messages();
    const paginated = messages.slice(config.offset, config.offset + config.limit);

    console.log(`\n✅ Found conversation: ${foundConversation.id}`);
    console.log(`   Total messages: ${messages.length}`);
    console.log(`   Showing: ${paginated.length}`);

    paginated.forEach((msg, i) => {
      console.log(`\n   ${i + 1 + config.offset}. [${msg.sentAt ? new Date(msg.sentAt).toISOString() : "Unknown"}]`);
      console.log(`      From: ${msg.senderInboxId || "Unknown"}`);
      console.log(`      Content: ${msg.content}`);
    });
  } catch (error) {
    console.error(`❌ Failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

program.parse();
