# XMTP Copilot

A powerful XMTP copilot that provides Slack bot integration for XMTP protocol testing and management.

![](./screenshot.png)

## Usage

Start the XMTP Copilot service:

```bash
# Start both XMTP and Slack channels
yarn start

# Start XMTP channel only
yarn dev:xmtp

# Start Slack channel only
yarn dev:slack
```

## Getting Started

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
```

### Environment variables

Create a `.env` file in the project root:

```bash
XMTP_ENV= dev # local, dev, production

# public key is 0x3de2787073732369f2e984ca5b981feCbF0f7FC5
ANTHROPIC_API_KEY=

# keys for xmtp-code
XMTP_WALLET_KEY=
XMTP_DB_ENCRYPTION_KEY=
# public key is 0x3FaA46B76dBD83117d17c190e69a9147F98edB3D

SLACK_BOT_TOKEN=
SLACK_APP_TOKEN=
SLACK_SIGNING_SECRET=
```
