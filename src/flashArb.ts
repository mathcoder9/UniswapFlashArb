import * as _ from "lodash";
import dotenv from "dotenv";
import {
  Contract,
  ContractTransaction,
  JsonRpcProvider,
  Wallet,
  parseUnits,
} from "ethers";
import { FlashbotsBundleProvider } from "@flashbots/ethers-provider-bundle";
import { FLASH_ARB_ABI } from "./abi/FlashArbitrageABI";
import { USDC, WETH } from "./constants";
dotenv.config();

export class FlashArb {
  private flashbotsProvider: FlashbotsBundleProvider;
  private flashContract: Contract;
  private executorWallet: Wallet;

  constructor(
    executorWallet: Wallet,
    flashbotsProvider: FlashbotsBundleProvider,
    provider: JsonRpcProvider
  ) {
    this.executorWallet = executorWallet;
    this.flashbotsProvider = flashbotsProvider;
    this.flashContract = new Contract(
      process.env.FLASH_ADDRESS,
      FLASH_ARB_ABI,
      provider
    );
  }

  async execute(blockNumber: number): Promise<void> {
    const flashParams = {
      token0: USDC, // Replace with actual token0 address
      token1: WETH, // Replace with actual token1 address
      fee1: 3000, // Replace with actual fee1 value
      wethToBorrow: parseUnits("1.0", 18), // Replace with the amount of WETH to borrow (in wei)
      amountToCoinbase: parseUnits("0.5", 18), // Replace with the amount to coinbase (in wei)
    };
    const transaction: ContractTransaction =
      await this.flashContract.initFlash.populateTransaction(flashParams);

    try {
      const estimateGas = await this.flashContract.provider.estimateGas({
        ...transaction,
        from: this.executorWallet.address,
      });
      if (estimateGas > 1400000) {
        console.log(
          "EstimateGas succeeded, but suspiciously large: " +
            estimateGas.toString()
        );
        return;
      }
      transaction.gasLimit = estimateGas * BigInt(2);
    } catch (e) {
      console.warn("Estimate gas failure");
      return;
    }
    const bundledTransactions = [
      {
        signer: this.executorWallet,
        transaction: transaction,
      },
    ];
    console.log(bundledTransactions);
    const signedBundle = await this.flashbotsProvider.signBundle(
      bundledTransactions
    );
    //
    const simulation = await this.flashbotsProvider.simulate(
      signedBundle,
      blockNumber + 1
    );
    if ("error" in simulation || simulation.firstRevert !== undefined) {
      console.log(`Simulation Error`);
      return;
    }
    console.log("Submitting bundle");
    const bundlePromises = _.map(
      [blockNumber + 1, blockNumber + 2],
      (targetBlockNumber) =>
        this.flashbotsProvider.sendRawBundle(signedBundle, targetBlockNumber)
    );
    await Promise.all(bundlePromises);
    return;

    throw new Error("No arbitrage submitted to relay");
  }
}
