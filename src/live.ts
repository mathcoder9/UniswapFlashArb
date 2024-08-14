import dotenv from "dotenv";
import { JsonRpcProvider, Wallet, formatEther } from "ethers";
import { FlashArbHelper } from "./helper/flash-arb-helper";
import { PricePrinter } from "./helper/price-printer";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import { MAINNET_CHAIN_ID, SEPOLIA_CHAIN_ID } from "./constants";
import { createInterface } from "readline";

dotenv.config();

if (!process.env.LIVE_FLASHARB_ADDRESS) {
  console.log("LIVE_FLASHARB_ADDRESS must be set in .env");
  process.exit(1);
}

if (!process.env.LIVE_EXECUTOR_PRIVATE_KEY) {
  console.log("LIVE_EXECUTOR_PRIVATE_KEY must be set in .env");
  process.exit(1);
}

if (!process.env.LIVE_PRICE_THRESHOLD) {
  console.log("LIVE_PRICE_THRESHOLD must be set in .env");
  process.exit(1);
}
const threshold = process.env.LIVE_PRICE_THRESHOLD;

if (!process.env.LIVE_RPC_URL) {
  console.log("LIVE_RPC_URL must be set in .env");
  process.exit(1);
}
const provider = new JsonRpcProvider(process.env.LIVE_RPC_URL);

if (!process.env.LIVE_FLASHBOTS_RELAY_SIGNING_PRIVATE_KEY) {
  console.log("LIVE_FLASHBOTS_RELAY_SIGNING_PRIVATE_KEY must be set in .env");
  process.exit(1);
}
const authSigner = new Wallet(
  process.env.LIVE_FLASHBOTS_RELAY_SIGNING_PRIVATE_KEY,
  provider
);
const BUNDLE_EXECUTOR = new Wallet(
  process.env.LIVE_EXECUTOR_PRIVATE_KEY,
  provider
);

const erc20TokenToTry: [tokenName: string, tokenAddress: string] = [
  "HGR",
  "0xD6Af5333dee494DDfB6f72AdA7B4ED950bE585a6",
];

async function confirmOnChain() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  // Await user input directly
  const question = (query) =>
    new Promise((resolve) => rl.question(query, resolve));

  const answer = await question(
    "Are you sure you want to run on-chain? (y/n) "
  );

  if (answer.toString().toLowerCase() === "y") {
    console.log("Environment: live");
  } else {
    console.log("Aborting...");
    process.exit(1);
  }

  rl.close();
}

function checkChainIsSepolia() {
  if (!process.env.EXECUTION_CHAIN_ID) {
    console.log("EXECUTION_CHAIN_ID must be set in .env");
    process.exit(1);
  }
  let chainId: number;
  try {
    chainId = Number(process.env.EXECUTION_CHAIN_ID);
    console.log(`ChainId: ${chainId}`);
    if (chainId == MAINNET_CHAIN_ID) {
      throw new Error(
        "Mainnet is not supported for live environment. Try Sepolia!"
      );
    } else if (chainId == SEPOLIA_CHAIN_ID) {
      console.log("Sepolia!");
    } else {
      throw new Error("Unknown Chain Id");
    }
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
}

async function main() {
  await confirmOnChain();
  checkChainIsSepolia();
  const pricePrinter = new PricePrinter(provider);
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider,
    authSigner,
    "https://relay-sepolia.flashbots.net",
    "sepolia"
  );
  const flashArbHelper = new FlashArbHelper(
    BUNDLE_EXECUTOR,
    process.env.LIVE_FLASHARB_ADDRESS,
    flashbotsProvider
  );

  pricePrinter.print(erc20TokenToTry);

  let previousBalance = await provider.getBalance(BUNDLE_EXECUTOR.address);
  console.log(`Initial wallet balance: ${formatEther(previousBalance)} ETH`);

  provider.on("block", async (blockNumber) => {
    const [block, currentBalance] = await Promise.all([
      provider.getBlock(blockNumber),
      provider.getBalance(BUNDLE_EXECUTOR.address),
    ]);
    console.log("Block number: ", block.number);
    console.log(
      `Wallet Balance: ${formatEther(previousBalance)} ETH -> ${formatEther(
        currentBalance
      )} ETH`
    );
    previousBalance = currentBalance;

    const [v2Price, v3Price] = await pricePrinter.print(erc20TokenToTry);

    if (v2Price.isLessThan(v3Price.multipliedBy(threshold))) {
      console.log(`🚀 Simulating flash arb`);
      try {
        flashArbHelper.simulate(erc20TokenToTry[1]);
      } catch (error) {
        console.log("❌ Error in flash arb simulation");
        console.log(error);
      }
    } else {
      console.log("Execution criteria is not met");
    }
  });
}

main();
