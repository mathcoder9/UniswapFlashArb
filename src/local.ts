import dotenv from "dotenv";
import { JsonRpcProvider, Wallet, formatEther } from "ethers";
import { inflateV2Pool } from "./helper/inflate-v2";
import { FlashArbHelper } from "./helper/flash-arb-helper";
import { PricePrinter } from "./helper/price-printer";
import { MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID } from "./constants";

dotenv.config();

console.log("Environment: local");

if (!process.env.EXECUTION_CHAIN_ID) {
  console.log("EXECUTION_CHAIN_ID must be set in .env");
  process.exit(1);
}
let chainId: number;
try {
  chainId = Number(process.env.EXECUTION_CHAIN_ID);
  console.log(`ChainId: ${chainId}`);
  if (chainId == MAINNET_CHAIN_ID) {
    console.log(`Mainnet!`);
  } else if (chainId == SEPOLIA_CHAIN_ID) {
    console.log("Sepolia!");
  } else {
    throw new Error("Unknown Chain Id");
  }
} catch (error) {
  console.log(error);
  process.exit(1);
}

if (!process.env.LOCAL_FLASHARB_ADDRESS) {
  console.log("LOCAL_FLASHARB_ADDRESS must be set in .env");
  process.exit(1);
}

if (!process.env.LOCAL_EXECUTOR_PRIVATE_KEY) {
  console.log("LOCAL_EXECUTOR_PRIVATE_KEY must be set in .env");
  process.exit(1);
}

if (!process.env.LOCAL_PRICE_THRESHOLD) {
  console.log("LOCAL_PRICE_THRESHOLD must be set in .env");
  process.exit(1);
}
const threshold = process.env.LOCAL_PRICE_THRESHOLD;

if (!process.env.LOCAL_RPC_URL) {
  console.log("LOCAL_RPC_URL must be set in .env");
  process.exit(1);
}
console.log("RPC URL: ", process.env.LOCAL_RPC_URL);
const provider = new JsonRpcProvider(process.env.LOCAL_RPC_URL);

const BUNDLE_EXECUTOR = new Wallet(
  process.env.LOCAL_EXECUTOR_PRIVATE_KEY,
  provider
);

const erc20TokenToTry: [tokenName: string, tokenAddress: string] =
  chainId == MAINNET_CHAIN_ID
    ? // ["ZRX", "0xE41d2489571d322189246DaFA5ebDe1F4699F498"], // example of a case where WETH is token0
      ["USDC", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"]
    : ["HGR", "0xD6Af5333dee494DDfB6f72AdA7B4ED950bE585a6"];

async function main() {
  const pricePrinter = new PricePrinter(provider);
  const flashArbHelper = new FlashArbHelper(
    BUNDLE_EXECUTOR,
    process.env.LOCAL_FLASHARB_ADDRESS,
    null
  );

  pricePrinter.print(erc20TokenToTry);

  if (chainId == MAINNET_CHAIN_ID) {
    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);
    console.log("Inflating V2 Pool...");
    try {
      await inflateV2Pool(
        BUNDLE_EXECUTOR,
        block.timestamp + 10000,
        erc20TokenToTry[1]
      );
    } catch (error) {
      console.log("❌ Could not inflate the V2 pool");
      console.log(error);
      process.exit(1);
    }
    pricePrinter.print(erc20TokenToTry);
  }

  let previousBalance = await provider.getBalance(BUNDLE_EXECUTOR.address);
  console.log(`Initial wallet balance: ${formatEther(previousBalance)}`);

  provider.on("block", async (blockNumber) => {
    const [block, currentBalance] = await Promise.all([
      provider.getBlock(blockNumber),
      provider.getBalance(BUNDLE_EXECUTOR.address),
    ]);
    console.log("Block number: ", block.number);
    console.log(
      `Wallet Balance: ${formatEther(previousBalance)} -> ${formatEther(
        currentBalance
      )}`
    );
    previousBalance = currentBalance;

    const [v2Price, v3Price] = await pricePrinter.print(erc20TokenToTry);
    if (v2Price.isLessThan(v3Price.multipliedBy(threshold))) {
      console.log("🚀 Attempting flash arb");
      try {
        await flashArbHelper.execute(erc20TokenToTry[1]);
      } catch (error) {
        console.log("❌ Error in flash arb call");
        console.log(error);
      }
    } else {
      console.log("Execution criteria is not met");
    }
  });
}

main();
