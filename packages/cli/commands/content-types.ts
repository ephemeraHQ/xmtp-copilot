#!/usr/bin/env node

import { Command } from "commander";
import { Agent } from "@xmtp/agent-sdk";
import { IdentifierKind } from "@xmtp/node-sdk";
import { ContentTypeMarkdown } from "@xmtp/content-type-markdown";
import { ContentTypeReply } from "@xmtp/content-type-reply";
import { ContentTypeReaction } from "@xmtp/content-type-reaction";
import { ContentTypeText } from "@xmtp/content-type-text";
import "dotenv/config";

const program = new Command();

program
  .name("content")
  .description("Content type operations")
  .argument(
    "[operation]",
    "Operation: text, markdown, attachment, transaction, deeplink, miniapp",
    "text",
  )
  .option("--target <address>", "Target wallet address")
  .option("--group-id <id>", "Group ID")
  .option("--amount <amount>", "Amount for transaction", "0.1")
  .action(async (operation, options) => {
    if (!options.target && !options.groupId) {
      console.error(`❌ Either --target or --group-id is required`);
      process.exit(1);
    }

    switch (operation) {
      case "text":
        await sendTextContent(options);
        break;
      case "markdown":
        await sendMarkdownContent(options);
        break;
      case "attachment":
        await sendAttachmentContent(options);
        break;
      case "transaction":
        await sendTransactionContent(options);
        break;
      case "deeplink":
        await sendDeeplinkContent(options);
        break;
      case "miniapp":
        await sendMiniAppContent(options);
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
  const { TextCodec } = await import("@xmtp/content-type-text");
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
      new TextCodec(),
      new MarkdownCodec(),
      new ReactionCodec(),
      new ReplyCodec(),
      new RemoteAttachmentCodec(),
      new AttachmentCodec(),
      new WalletSendCallsCodec(),
    ],
  });
}

async function getOrCreateConversation(
  options: { target?: string; groupId?: string },
  agent: Agent,
) {
  if (options.groupId) {
    const conversation = await agent.client.conversations.getConversationById(
      options.groupId,
    );
    if (!conversation) {
      throw new Error(`Group not found: ${options.groupId}`);
    }
    return conversation;
  } else {
    return await agent.client.conversations.newDmWithIdentifier({
      identifier: options.target!,
      identifierKind: IdentifierKind.Ethereum,
    });
  }
}

async function sendTextContent(options: {
  target?: string;
  groupId?: string;
}): Promise<void> {
  const agent = await getAgent();
  const conversation = await getOrCreateConversation(options, agent);

  await conversation.send("📝 This is a text message!");
  await new Promise((resolve) => setTimeout(resolve, 500));

  const messages = await conversation.messages();
  const lastMessage = messages[messages.length - 1];

  await conversation.send(
    {
      content: "💬 This is a reply!",
      reference: lastMessage.id,
      contentType: ContentTypeText,
    },
    ContentTypeReply,
  );

  await new Promise((resolve) => setTimeout(resolve, 500));

  await conversation.send(
    {
      reference: lastMessage.id,
      action: "added",
      content: "❤️",
      schema: "unicode",
    },
    ContentTypeReaction,
  );

  console.log(`✅ Sent text, reply, and reaction`);
}

async function sendMarkdownContent(options: {
  target?: string;
  groupId?: string;
}): Promise<void> {
  const agent = await getAgent();
  const conversation = await getOrCreateConversation(options, agent);

  const markdown = `# Markdown Demo

This is **markdown** formatted text!

- Item 1
- Item 2
- Item 3`;

  await conversation.send(markdown, ContentTypeMarkdown);
  console.log(`✅ Sent markdown content`);
}

async function sendAttachmentContent(options: {
  target?: string;
  groupId?: string;
}): Promise<void> {
  console.log(
    `\n⚠️  Remote attachment sending requires a storage provider integration.\n`,
  );
  console.log(
    `The attachment content type is configured correctly with RemoteAttachmentCodec.`,
  );
  console.log(
    `However, to actually send attachments, you need to integrate with a storage provider.\n`,
  );
  console.log(`📋 Implementation steps:`);
  console.log(`   1. Load your file into memory as a Uint8Array`);
  console.log(`   2. Encrypt it using RemoteAttachmentCodec.encodeEncrypted()`);
  console.log(`   3. Upload encryptedEncoded.payload to your storage (IPFS, S3, etc.)`);
  console.log(`   4. Get the HTTPS URL of the uploaded file`);
  console.log(`   5. Create remoteAttachment object with the URL`);
  console.log(`   6. Send using conversation.send(remoteAttachment, { contentType: ContentTypeRemoteAttachment })\n`);
  
  console.log(`📖 For examples, see:`);
  console.log(`   https://github.com/ephemeraHQ/xmtp-agent-examples/tree/main/examples/xmtp-attachments\n`);
  
  console.log(`💡 The codec is properly configured in your agent setup.`);
  console.log(`   Ready for you to implement the storage provider integration.\n`);
}

async function sendTransactionContent(options: {
  target?: string;
  groupId?: string;
  amount?: string;
}): Promise<void> {
  const agent = await getAgent();
  await getOrCreateConversation(options, agent);

  // Simplified transaction - in practice you'd create proper wallet send calls
  console.log(
    `⚠️  Transaction sending requires wallet integration - simplified for now`,
  );
  console.log(`✅ Would send transaction content`);
}

async function sendDeeplinkContent(options: {
  target?: string;
  groupId?: string;
}): Promise<void> {
  const agent = await getAgent();
  const conversation = await getOrCreateConversation(options, agent);

  const address = agent.client.accountIdentifier?.identifier || "";
  const deeplink = `cbwallet://messaging/${address}`;

  await conversation.send(`💬 Start a conversation: ${deeplink}`);
  console.log(`✅ Sent deeplink`);
}

async function sendMiniAppContent(options: {
  target?: string;
  groupId?: string;
}): Promise<void> {
  const agent = await getAgent();
  const conversation = await getOrCreateConversation(options, agent);

  await conversation.send("https://squabble.lol/");
  console.log(`✅ Sent mini app URL`);
}

program.parse();
