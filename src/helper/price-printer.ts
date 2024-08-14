import BigNumber from "bignumber.js";
import { PoolHelper } from "../constants";
import { Pricer } from "../pricers/pricer";

export class PricePrinter {
  private _v2Pricer: Pricer;
  private _v3Pricer: Pricer;

  constructor(v2Pricer: Pricer, v3Pricer: Pricer) {
    this._v2Pricer = v2Pricer;
    this._v3Pricer = v3Pricer;
  }

  public async print(
    erc20TokenToTry: [string, string]
  ): Promise<[BigNumber, BigNumber]> {
    const [tokenName, tokenAddress] = erc20TokenToTry;
    const lookup = PoolHelper.lookupAddress(tokenAddress);
    if (!lookup) {
      console.log(
        `Could not find pool data for WETH + ${tokenName}(${tokenAddress})`
      );
      return;
    }
    try {
      const [v2PoolAddress, v3PoolAddress, decimals, isWethToken0] = lookup;
      const [v2Price, v3Price] = await Promise.all([
        this._v2Pricer.getPrice(v2PoolAddress, decimals, isWethToken0), // Fetch v2 price
        this._v3Pricer.getPrice(v3PoolAddress, decimals, isWethToken0), // Fetch v3 price
      ]);
      console.log(
        `Prices for WETH/${tokenName}: V2 ${v2Price.toFixed(
          3
        )}, V3 ${v3Price.toFixed(3)}`
      );
      return [v2Price, v3Price];
    } catch (error) {
      console.log(
        `Error when getting prices for WETH/${tokenName}(${tokenAddress})`
      );
    }
    return [new BigNumber(-1), new BigNumber(-1)];
  }
}
