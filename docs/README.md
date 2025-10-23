# XMTP code

### Environment variables

```bash
XMTP_ENV=

# public key is 0x3de2787073732369f2e984ca5b981feCbF0f7FC5
ANTHROPIC_API_KEY=


# Pinata API Key
PINATA_API_KEY=
PINATA_SECRET_KEY=
# keys for xmtp-attachments

# keys for xmtp-code
XMTP_WALLET_KEY=
XMTP_DB_ENCRYPTION_KEY=
# public key is 0x3FaA46B76dBD83117d17c190e69a9147F98edB3D

SLACK_BOT_TOKEN=
SLACK_APP_TOKEN=
SLACK_SIGNING_SECRET=
```

### Claude setttings

```json
{
  "env": {
    "XMTP_ENV": "production",
    "NODE_ENV": "development"
  },
  "permissions": {
    "allow": [
      "*",
      "Bash(yarn groups:*)",
      "Bash(yarn send:*)",
      "Bash(yarn permissions:*)",
      "Bash(yarn installations:*)",
      "Bash(yarn generate:*)",
      "Bash(yarn revoke:*)",
      "Bash(yarn debug:*)"
    ],
    "deny": [],
    "ask": []
  }
}
```