## USDC WETH flash swaps

This bot is not intended to land transactions but to practise:

- foundry
- interacting with Uniswap v2 and v3
- reading from storage and calling contracts
- sending transactions using flashbots

This bot looks for price differences between Uniswap v2 and v3 pools and uses flash swaps to capture arbitrage.

## Forge tests

```bash
forge build

# RPC_URL=https://mainnet.infura.io/v3/<PROJECT_ID>
forge test -f $RPC_URL -vvv
```

## Set up

- Install Node.js (v18.17.1) with npm (9.6.7)
- `npm install`
- Deploy `contracts/FlashArbitrage.sol`.
- Copy .env.example to .env file in project root.
- Complete .env file.
- Start by running `npm run start`
