# Claude Code Prompts for XMTP CLI

This are examples of potential prompts asked by the user and how you may react to them via CLI commands.

### Basic message sending

```bash
send the same message 2 times to 0xe709fDa144F82Fd0A250f4E6d052c41c98087cF5 (a nice message)
```

**cli commands:**

> yarn send --target 0x1234... --message "Hello!"

### Group creation

```bash
create a group with 0xe709fDa144F82Fd0A250f4E6d052c41c98087cF5 and send 3 messages. add 3 random address to the group
```

**cli commands:**

> yarn groups create --name "My Group" --members 5
> yarn groups add-members --group-id <group-id> --members 0x1234...,0x5678...
> yarn send --group-id <group-id> --message "Hello!"

### Debug address

```bash
get information for the address 0xe709fDa144F82Fd0A250f4E6d052c41c98087cF5
```

**cli commands:**

> yarn debug address --address 0xe709fDa144F82Fd0A250f4E6d052c41c98087cF5   

### agent health

```bash
check the health of the agent bankr
```

**cli commands:**

> check /data/agents.ts for the address and then run the command
> yarn send --target 0x7f1c0d2955f873fc91f1728c19b2ed7be7a9684d --message "hi"
> sleep 10 seconds
> yarn list messages --conversation-id <conversation-id> and check if the message is there