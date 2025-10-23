import { createRequire } from "node:module";
import "dotenv/config";
import { Client, XmtpEnv } from "@xmtp/node-sdk";
import { 
  parseStandardArgs, 
  generateHelpText, 
  type StandardCliParams,
} from "../cli/cli-params";
import { 
  getAgentInstance, 
  logOperationStart,
  logOperationSuccess,
  logOperationFailure,
  logSectionHeader
} from "../core/agent";
import { 
  validateEthereumAddress,
} from "../utils/validation";
import { CliManager } from "../cli/cli-manager";

// Get XMTP SDK version from package.json
const require = createRequire(import.meta.url);
const packageJson = require("../../package.json");
const xmtpSdkVersion: string =
  packageJson.dependencies["@xmtp/agent-sdk"] ?? "unknown";

interface Config extends StandardCliParams {
  operation: "address" | "inbox" | "key-package" | "resolve" | "info" | "installations";
  // Address operations
  targetAddress?: string;
  // Inbox operations  
  inboxId?: string;
}

function showHelp() {
  const customParams = {
    operation: {
      flags: ['address', 'inbox', 'key-package', 'resolve', 'info', 'installations'],
      type: 'string' as const,
      description: 'Operation to perform',
      required: true,
    },
    targetAddress: {
      flags: ['--address', '--target-address'],
      type: 'string' as const,
      description: 'Ethereum address to query or resolve to inbox ID',
      required: false,
    },
    inboxId: {
      flags: ['--inbox-id'],
      type: 'string' as const,
      description: '64-character hexadecimal inbox ID to query',
      required: false,
    },
  };

  const examples = [
    'yarn debug address --address 0x1234...',
    'yarn debug resolve --address 0x1234...',
    'yarn debug inbox --inbox-id 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64',
    'yarn debug key-package --inbox-id 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64',
    'yarn debug installations --inbox-id 743f3805fa9daaf879103bc26a2e79bb53db688088259c23cf18dcf1ea2aee64',
    'yarn debug info',
  ];

  console.log(generateHelpText(
    'XMTP Debug CLI - Address, Inbox, Key Package, and Installation Information',
    'Get detailed information about XMTP addresses, inboxes, key packages, and installations',
    'yarn debug <operation> [options]',
    customParams,
    examples
  ));
}

function parseArgs(): Config {
  const args = process.argv.slice(2);
  
  // Handle help
  if (args.includes("--help") || args.includes("-h")) {
    showHelp();
    process.exit(0);
  }

  // Extract operation from first argument if not a flag
  let operation = "info";
  let remainingArgs = args;
  
  if (args.length > 0 && !args[0].startsWith("--")) {
    operation = args[0];
    remainingArgs = args.slice(1);
  }

  const customParams = {
    targetAddress: {
      flags: ['--address', '--target-address'],
      type: 'string' as const,
      description: 'Ethereum address to query or resolve to inbox ID',
      required: false,
    },
    inboxId: {
      flags: ['--inbox-id'],
      type: 'string' as const,
      description: '64-character hexadecimal inbox ID to query',
      required: false,
    },
  };

  const config = parseStandardArgs(remainingArgs, customParams) as Config;
  config.operation = operation as "address" | "inbox" | "key-package" | "resolve" | "info" | "installations";

  // Validation
  if (config.targetAddress && !validateEthereumAddress(config.targetAddress)) {
    throw new Error(`Invalid target address: ${config.targetAddress}`);
  }

  if (config.inboxId && !/^[a-f0-9]{64}$/i.test(config.inboxId)) {
    throw new Error(`Invalid inbox ID format: ${config.inboxId}`);
  }

  return config;
}

// Operation: Address Information
async function runAddressOperation(config: Config): Promise<void> {
  if (!config.targetAddress) {
    console.error(`❌ Error: --address is required for address operation`);
    console.log(`   Usage: yarn debug address --address <ethereum-address>`);
    return;
  }

  logOperationStart("Address Information", `Getting information for address: ${config.targetAddress}`);

  // Get agent
  const agent = await getAgentInstance();

  try {
    // Get inbox ID from address
    const inboxId = await agent.client.getInboxIdByIdentifier({
      identifier: config.targetAddress,
      identifierKind: 0,
    });

    if (!inboxId) {
      console.log(`❌ No inbox found for address: ${config.targetAddress}`);
      console.log(`   This address may not be registered with XMTP`);
      return;
    }

    // Get inbox state
    const inboxState = await agent.client.preferences.inboxStateFromInboxIds(
      [inboxId],
      true,
    );

    if (!inboxState || inboxState.length === 0) {
      console.log(`❌ No inbox state found for address: ${config.targetAddress}`);
      return;
    }

    const state = inboxState[0];
    const installations = state.installations;

    logSectionHeader("Address Information");
    console.log(`   Address: ${config.targetAddress}`);
    console.log(`   Inbox ID: ${inboxId}`);
    console.log(`   Total Installations: ${installations.length}`);
    console.log(`   Environment: ${process.env.XMTP_ENV ?? "production"}`);

    if (installations.length > 0) {
      console.log(`\n📱 Installations:`);
      installations.forEach((installation, index) => {
        console.log(`   ${index + 1}. ${installation.id}`);
      });
    }

    logOperationSuccess("Address Information");
  } catch (error) {
    logOperationFailure("Address Information", error as Error);
  }
}

// Operation: Resolve Address to Inbox ID
async function runResolveOperation(config: Config): Promise<void> {
  if (!config.targetAddress) {
    console.error(`❌ Error: --address is required for resolve operation`);
    console.log(`   Usage: yarn debug resolve --address <ethereum-address>`);
    return;
  }

  logOperationStart("Resolve Address", `Resolving address to inbox ID: ${config.targetAddress}`);

  // Get agent
  const agent = await getAgentInstance();

  try {
    const inboxId = await agent.client.getInboxIdByIdentifier({
      identifier: config.targetAddress,
      identifierKind: 0,
    });

    if (!inboxId) {
      console.log(`❌ No inbox found for address: ${config.targetAddress}`);
      console.log(`   This address may not be registered with XMTP`);
      return;
    }

    logSectionHeader("Address Resolution");
    console.log(`   Address: ${config.targetAddress}`);
    console.log(`   Inbox ID: ${inboxId}`);
    console.log(`   Environment: ${process.env.XMTP_ENV ?? "production"}`);

    logOperationSuccess("Resolve Address");
  } catch (error) {
    logOperationFailure("Resolve Address", error as Error);
  }
}

// Operation: Inbox Information
async function runInboxOperation(config: Config): Promise<void> {
  if (!config.inboxId) {
    console.error(`❌ Error: --inbox-id is required for inbox operation`);
    console.log(`   Usage: yarn debug inbox --inbox-id <inbox-id>`);
    return;
  }

  logOperationStart("Inbox Information", `Getting information for inbox: ${config.inboxId}`);

  // Get agent
  const agent = await getAgentInstance();

  try {
    // Get inbox state
    const inboxState = await agent.client.preferences.inboxStateFromInboxIds(
      [config.inboxId],
      true,
    );

    if (!inboxState || inboxState.length === 0) {
      console.log(`❌ No inbox state found for inbox ID: ${config.inboxId}`);
      return;
    }

    const state = inboxState[0];
    const installations = state.installations;
    const identifiers = state.identifiers;

    logSectionHeader("Inbox Information");
    console.log(`   Inbox ID: ${config.inboxId}`);
    console.log(`   Total Installations: ${installations.length}`);
    console.log(`   Total Identifiers: ${identifiers.length}`);
    console.log(`   Environment: ${process.env.XMTP_ENV ?? "production"}`);

    if (identifiers.length > 0) {
      console.log(`\n🏷️  Identifiers:`);
      identifiers.forEach((identifier, index) => {
        console.log(`   ${index + 1}. ${identifier.identifier} (kind: ${identifier.identifierKind})`);
      });
    }

    if (installations.length > 0) {
      console.log(`\n📱 Installations:`);
      installations.forEach((installation, index) => {
        console.log(`   ${index + 1}. ${installation.id}`);
      });
    }

    logOperationSuccess("Inbox Information");
  } catch (error) {
    logOperationFailure("Inbox Information", error as Error);
  }
}

// Operation: Key Package Information
async function runKeyPackageOperation(config: Config): Promise<void> {
  if (!config.inboxId) {
    console.error(`❌ Error: --inbox-id is required for key-package operation`);
    console.log(`   Usage: yarn debug key-package --inbox-id <inbox-id>`);
    return;
  }

  logOperationStart("Key Package Information", `Getting key package status for inbox: ${config.inboxId}`);

  // Get agent
  const agent = await getAgentInstance();

  try {
    // Get inbox state for the target inbox ID
    const inboxState = await agent.client.preferences.inboxStateFromInboxIds(
      [config.inboxId],
      true,
    );

    if (!inboxState || inboxState.length === 0) {
      console.log(`❌ No inbox state found for inbox ID: ${config.inboxId}`);
      return;
    }

    const state = inboxState[0];
    const addressFromInboxId = state.identifiers[0]?.identifier || "Unknown";
    const installations = state.installations;

    // Get installation IDs
    const installationIds = installations.map(
      (installation: { id: string }) => installation.id,
    );

    // Get key package statuses
    const status = (await agent.client.getKeyPackageStatusesForInstallationIds(
      installationIds,
    )) as Record<string, any>;

    // Count valid and invalid installations
    const totalInstallations = Object.keys(status).length;
    const validInstallations = Object.values(status).filter(
      (value) => !value?.validationError,
    ).length;
    const invalidInstallations = totalInstallations - validInstallations;

    logSectionHeader("Key Package Status");
    console.log(`   Inbox ID: ${config.inboxId}`);
    console.log(`   Address: ${addressFromInboxId}`);
    console.log(`   Total Installations: ${totalInstallations}`);
    console.log(`   Valid Installations: ${validInstallations}`);
    console.log(`   Invalid Installations: ${invalidInstallations}`);
    console.log(`   Environment: ${process.env.XMTP_ENV ?? "production"}`);

    if (totalInstallations > 0) {
      console.log(`\n🔑 Installation Details:`);
      
      for (const [installationId, installationStatus] of Object.entries(status)) {
        // Abbreviate the installation ID (first 4 and last 4 characters)
        const shortId =
          installationId.length > 8
            ? `${installationId.substring(0, 4)}...${installationId.substring(installationId.length - 4)}`
            : installationId;

        if (installationStatus?.lifetime) {
          const createdDate = new Date(
            Number(installationStatus.lifetime.notBefore) * 1000,
          );
          const expiryDate = new Date(
            Number(installationStatus.lifetime.notAfter) * 1000,
          );

          console.log(`   ✅ ${shortId}: Created ${createdDate.toLocaleDateString()}, Valid until ${expiryDate.toLocaleDateString()}`);
        } else if (installationStatus?.validationError) {
          console.log(`   ❌ ${shortId}: Error - ${installationStatus.validationError}`);
        }
      }
    }

    logOperationSuccess("Key Package Information");
  } catch (error) {
    logOperationFailure("Key Package Information", error as Error);
  }
}

// Operation: General Info
async function runInfoOperation(_config: Config): Promise<void> {
  logOperationStart("General Information", "Getting general XMTP debug information");

  // Get agent
  const agent = await getAgentInstance();

  try {
    // Get client details
    const inboxId = agent.client.inboxId;
    const installationId = agent.client.installationId;
    const appVersion = agent.client.options?.appVersion;
    const env = agent.client.options?.env ?? "dev";

    // Get inbox state and key package info
    const inboxState = await agent.client.preferences.inboxState();
    const keyPackageStatuses =
      await agent.client.getKeyPackageStatusesForInstallationIds([
        installationId,
      ]);
    const keyPackageStatus = keyPackageStatuses[installationId];

    let createdDate = new Date();
    let expiryDate = new Date();
    if (keyPackageStatus?.lifetime) {
      createdDate = new Date(
        Number(keyPackageStatus.lifetime.notBefore) * 1000,
      );
      expiryDate = new Date(Number(keyPackageStatus.lifetime.notAfter) * 1000);
    }

    // Get conversations
    const conversations = await agent.client.conversations.list();

    logSectionHeader("General Debug Information");
    console.log(`   XMTP Agent SDK: ${xmtpSdkVersion}`);
    console.log(`   Client Version: ${agent.client.constructor.name}`);
    console.log(`   App Version: ${appVersion}`);
    console.log(`   Environment: ${env}`);
    console.log(`   Inbox ID: ${inboxId}`);
    console.log(`   Installation ID: ${installationId}`);
    console.log(`   Total Installations: ${inboxState.installations.length}`);
    console.log(`   Key Package Created: ${createdDate.toLocaleString()}`);
    console.log(`   Key Package Valid Until: ${expiryDate.toLocaleString()}`);
    console.log(`   Total Conversations: ${conversations.length}`);
    console.log(`   Status: ✅ Running`);

    logOperationSuccess("General Information");
  } catch (error) {
    logOperationFailure("General Information", error as Error);
  }
}

// Operation: Installations Information
async function runInstallationsOperation(config: Config): Promise<void> {
  if (!config.inboxId) {
    console.error(`❌ Error: --inbox-id is required for installations operation`);
    console.log(`   Usage: yarn debug installations --inbox-id <inbox-id>`);
    return;
  }

  logOperationStart("Installations Information", `Getting installation information for inbox: ${config.inboxId}`);

  try {
    await getAgentInstance();

    const inboxState = await Client.inboxStateFromInboxIds(
      [config.inboxId],
      (process.env.XMTP_ENV as XmtpEnv) ?? "dev",
    );

    const installations = inboxState[0].installations;
    
    logSectionHeader("Installation Debug Information");
    console.log(`   Inbox ID: ${config.inboxId}`);
    console.log(`   Environment: ${process.env.XMTP_ENV ?? "dev"}`);
    console.log(`   Total Installations: ${installations.length}`);
    
    installations.forEach((installation, index) => {
      console.log(`\n   Installation ${index + 1}:`);
      console.log(`     ID: ${installation.id}`);
      console.log(`     Bytes Length: ${installation.bytes.length}`);
    });

    logOperationSuccess("Installations Information", "Installation information retrieved");
  } catch (error) {
    logOperationFailure("Installations Information", error as Error);
  }
}

/**
 * Check if CLI manager should be used and handle execution
 */
async function handleCliManagerExecution(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Check if CLI manager parameters are present
  const hasManagerArgs = args.some(arg => 
    arg === '--repeat' || arg === '--delay' || arg === '--continue-on-error' || arg === '--verbose'
  );
  
  if (!hasManagerArgs) {
    // No manager args, run normally
    await main();
    return;
  }
  
  // Parse manager configuration
  const { skillArgs, config: managerConfig } = CliManager.parseManagerArgs(args);
  
  if (managerConfig.repeat && managerConfig.repeat > 1) {
    console.log(`🔄 CLI Manager: Executing debug command ${managerConfig.repeat} time(s)`);
    
    const manager = new CliManager(managerConfig);
    const results = await manager.executeYarnCommand('debug', skillArgs, managerConfig);
    
    // Exit with error code if any execution failed
    const hasFailures = results.some(r => !r.success);
    process.exit(hasFailures ? 1 : 0);
  } else {
    // Single execution with manager args but no repeat
    await main();
  }
}

async function main(): Promise<void> {
  const config = parseArgs();

  switch (config.operation) {
    case "address":
      await runAddressOperation(config);
      break;
    case "resolve":
      await runResolveOperation(config);
      break;
    case "inbox":
      await runInboxOperation(config);
      break;
    case "key-package":
      await runKeyPackageOperation(config);
      break;
    case "installations":
      await runInstallationsOperation(config);
      break;
    case "info":
      await runInfoOperation(config);
      break;
    default:
      showHelp();
      break;
  }

  process.exit(0);
}

void handleCliManagerExecution();
