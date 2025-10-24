# XMTP Copilot

A powerful XMTP copilot that provides CLI commands and Slack bot integration for XMTP protocol testing and management.

## Usage

After installation, use the `xmtp` command from anywhere:

```bash
# Start Claude Code AI assistant
xmtp ai

# Start XMTP channels
xmtp start              # Both XMTP and Slack channels
xmtp xmtp               # XMTP channel only
xmtp slack              # Slack channel only

# Quick command examples
xmtp groups --members 5 --name "My Group"
xmtp send --target 0x1234... --message "Hello!"
xmtp debug info
xmtp permissions list --group-id <group-id>
xmtp list

# Get help
xmtp --help
xmtp <command> --help
```

## Development

### Prerequisites

- Node.js (>20.18.0)
- Yarn 4.6.0
- XMTP environment access

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/xmtp-copilot
cd xmtp-copilot

# Install dependencies
yarn install

# Link globally to use 'xmtp' command anywhere
yarn link

# Add yarn global bin to your PATH (if not already added)
echo 'export PATH="$HOME/.yarn/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Environment variables

Create a `.env` file in the project root:

```bash
XMTP_WALLET_KEY=your_wallet_key
XMTP_ENCRYPTION_KEY=your_encryption_key
XMTP_ENV=dev
SLACK_BOT_TOKEN=your_slack_bot_token
SLACK_SIGNING_SECRET=your_slack_signing_secret
```
