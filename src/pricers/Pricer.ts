import BigNumber from "bignumber.js";
import { JsonRpcProvider } from "ethers";

export abstract class Pricer {
  protected _address: string;
  protected _provider: JsonRpcProvider;

  constructor(address: string, provider: JsonRpcProvider) {
    this._address = address;
    this._provider = provider;
  }

  // Get price of WETH in USDC
  public abstract getPrice(): Promise<BigNumber>;
}
