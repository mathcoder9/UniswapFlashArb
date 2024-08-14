import BigNumber from "bignumber.js";
import { JsonRpcProvider } from "ethers";

export abstract class Pricer {
  protected _provider: JsonRpcProvider;

  constructor(provider: JsonRpcProvider) {
    this._provider = provider;
  }

  // Get price of WETH/TOKEN
  public abstract getPrice(
    poolAddress: string,
    decimals: number,
    isWethToken0: boolean
  ): Promise<BigNumber>;
}
