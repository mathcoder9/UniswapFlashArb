import {
  Contract,
  ContractTransaction,
  Wallet,
  formatEther,
  parseEther,
} from "ethers";
import {
  HGR_TOKEN_ADDRESS,
  PoolHelper,
  SEPOLIA_CHAIN_ID,
  WETH,
} from "../constants";
import { FLASH_ARB_ABI } from "../abi/flash-arbitrage-abi";
import {
  FlashbotsBundleProvider,
  TransactionSimulationRevert,
} from "@flashbots/ethers-provider-bundle";

export class FlashArbHelper {
  private _executor: Wallet;
  private _flashArbContract: Contract;
  private _flashbotsBundleProvider: FlashbotsBundleProvider | null;

  constructor(
    executor: Wallet,
    flashArbAddress: string,
    flashbotsBundleProvider: FlashbotsBundleProvider | null
  ) {
    this._executor = executor;
    this._flashArbContract = new Contract(
      flashArbAddress,
      FLASH_ARB_ABI,
      executor
    );
    this._flashbotsBundleProvider = flashbotsBundleProvider;
  }

  public async execute(erc20Address: string): Promise<void> {
    const poolDetails = PoolHelper.lookupAddress(erc20Address);
    if (!poolDetails) {
      console.log(`❌ Could not find pool details for token ${erc20Address}`);
      return;
    }
    const [, , , isWethToken0] = poolDetails;
    const tx = await this.getPopulatedTransaction(erc20Address, isWethToken0);
    const txResponse = await this._executor.sendTransaction(tx);
    console.log("Submitted Flash Swap transaction, hash:", txResponse.hash);

    const receipt = await txResponse.wait();
    if (receipt.status == 1) {
      console.log(
        "✅ Flash arb transaction was mined in block:",
        receipt.blockNumber
      );
      console.log(`Gas used: ${receipt.gasUsed} units`);
      console.log(
        `Effective priority fee: ${
          this.calculateAmountToCoinbase(erc20Address) / receipt.gasUsed
        } WEI/unit`
      );
      console.log(
        `Eth sent to miner: ${formatEther(
          this.calculateAmountToCoinbase(erc20Address)
        )} ETH`
      );
      console.log(
        `Profit sent to miner: ${formatEther(
          this.calculateAmountToCoinbase(erc20Address)
        )} ETH`
      );
    } else {
      console.log("❌ Flash arb transaction failed");
    }
  }

  public async getPopulatedTransaction(
    erc20Address: string,
    isWethToken0: boolean
  ): Promise<ContractTransaction> {
    const finalWethToBorrow = this.calculateWethToBorrow(erc20Address);

    const finalAmountToCoinbase = this.calculateAmountToCoinbase(erc20Address);

    const params = {
      token0: isWethToken0 === true ? WETH : erc20Address,
      token1: isWethToken0 === true ? erc20Address : WETH,
      poolFee: 3000,
      wethToBorrow: finalWethToBorrow,
      amountToCoinbase: finalAmountToCoinbase,
    };

    const [gasLimit, block] = await Promise.all([
      this._flashArbContract.initFlash.estimateGas(params),
      this._executor.provider.getBlock("latest"),
    ]);

    // Prepare the transaction object
    const tx = await this._flashArbContract.initFlash.populateTransaction(
      params,
      {
        gasLimit: gasLimit,
        maxFeePerGas: (block.baseFeePerGas * BigInt(12)) / BigInt(10),
        maxPriorityFeePerGas: 0,
        value: 0,
      }
    );
    return tx;
  }

  private calculateAmountToCoinbase(erc20Address: string): bigint {
    if (erc20Address === HGR_TOKEN_ADDRESS) {
      return parseEther("0.001");
    }
    return parseEther("0.5");
  }

  private calculateWethToBorrow(erc20Address: string): bigint {
    if (erc20Address === HGR_TOKEN_ADDRESS) {
      return parseEther("0.01");
    }
    return parseEther("20");
  }

  public async simulate(erc20Address: string): Promise<void> {
    if (!this._flashbotsBundleProvider) {
      console.log(
        "Aborting! Flashbots Bundle Provider has not been initialised correctly!"
      );
      return;
    }

    const poolDetails = PoolHelper.lookupAddress(erc20Address);
    if (!poolDetails) {
      console.log(`❌ Could not find pool details for token ${erc20Address}`);
      return;
    }
    const [, , , isWethToken0] = poolDetails;
    const tx = await this.getPopulatedTransaction(erc20Address, isWethToken0);

    const block = await this._executor.provider.getBlock("latest");

    const signedTransactions = await this._flashbotsBundleProvider.signBundle([
      {
        signer: this._executor,
        transaction: {
          ...tx,
          chainId: SEPOLIA_CHAIN_ID,
          value: 0,
        },
      },
    ]);
    console.log(new Date());
    const simulation = await this._flashbotsBundleProvider.simulate(
      signedTransactions,
      block.number + 1
    );
    console.log(new Date());

    if ("error" in simulation) {
      console.log(`❌ Simulation Error: ${simulation.error.message}`);
    } else if (simulation.firstRevert != null) {
      console.log(
        `${(simulation.firstRevert as TransactionSimulationRevert).error}`
      );
      console.log(
        `${(simulation.firstRevert as TransactionSimulationRevert).revert}`
      );
    } else {
      console.log(`✅ Simulation Success: ${block.number}`);
      console.log(`Gas used: ${simulation.totalGasUsed} units`);
      console.log(`Base gas fee: ${block.baseFeePerGas} WEI/unit`);
      console.log(
        `Effective priority fee: ${simulation.bundleGasPrice} WEI/unit`
      );
      console.log(
        `Priority gas fee sent to miner: ${formatEther(simulation.gasFees)} ETH`
      );
      console.log(
        `Eth sent to miner: ${formatEther(simulation.ethSentToCoinbase)} ETH`
      );
      console.log(
        `Profit sent to miner: ${formatEther(simulation.coinbaseDiff)} ETH`
      );
    }

    // Logic to submit bundles
    // console.log(signedTransactions);

    // for (var i = 1; i <= 10; i++) {
    //   const bundleSubmission = this._flashbotsBundleProvider.sendRawBundle(
    //     signedTransactions,
    //     blockNumber + i
    //   );
    //   console.log("submitted for block # ", blockNumber + i);
    // }
    // console.log("bundles submitted");
  }
}
