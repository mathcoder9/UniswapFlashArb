import { JsonRpcProvider, Wallet } from "ethers";
import dotenv from "dotenv";
import { UniswappyV2Pricer } from "./pricers/UniswapV2Pricer";
import { UniswappyV3Pricer } from "./pricers/UniswapV3Pricer";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import { FlashArb } from "./flashArb";
import BigNumber from "bignumber.js";
import { USDC_WETH_V2_POOL, USDC_WETH_V3_POOL } from "./constants";
dotenv.config();

if (!process.env.FLASH_ADDRESS) {
  console.log("Flashswap contract address must be set in .env");
  process.exit(1);
}

if (!process.env.BUNDLE_EXECUTOR) {
  console.log("Bundle Executor must be set in .env");
  process.exit(1);
}
const BUNDLE_EXECUTOR = new Wallet(process.env.BUNDLE_EXECUTOR);

if (!process.env.RPC_URL) {
  console.log("RPC URL must be set in .env");
  process.exit(1);
}
const provider = new JsonRpcProvider(process.env.RPC_URL);

if (!process.env.FLASHBOTS_RELAY_SIGNING_KEY) {
  console.log("Flashbots relay signing key must be set in .env");
  process.exit(1);
}
const flashbotsRelaySigningWallet = new Wallet(
  process.env.FLASHBOTS_RELAY_SIGNING_KEY
);

async function fetchPrices(
  v2Pricer: UniswappyV2Pricer,
  v3Pricer: UniswappyV3Pricer
): Promise<{ v2Price: BigNumber; v3Price: BigNumber }> {
  const [v2Price, v3Price] = await Promise.all([
    v2Pricer.getPrice(), // Fetch v2 price
    v3Pricer.getPrice(), // Fetch v3 price
  ]);

  return { v2Price, v3Price };
}

async function main() {
  // Flashbots provider requires passing in a standard provider
  const flashbotsProvider = await FlashbotsBundleProvider.create(
    provider, // a normal ethers.js provider, to perform gas estimiations and nonce lookups
    flashbotsRelaySigningWallet // ethers.js signer wallet, only for signing request payloads, not transactions
  );
  const v2Pricer = new UniswappyV2Pricer(USDC_WETH_V2_POOL, provider);
  const v3Pricer = new UniswappyV3Pricer(USDC_WETH_V3_POOL, provider);
  const flashArb = new FlashArb(BUNDLE_EXECUTOR, flashbotsProvider, provider);

  provider.on("block", async (block) => {
    const { v2Price, v3Price } = await fetchPrices(v2Pricer, v3Pricer);
    console.log("V2 Price:", v2Price);
    console.log("V3 Price:", v3Price);

    if (v2Price.isLessThan(v3Price.multipliedBy(0.8))) {
      try {
        await flashArb.execute(block);
      } catch (error) {
        console.log("Did not execute properly");
        console.log(error);
      }
    }
  });
}

main();
