import BigNumber from "bignumber.js";
import { PoolHelper } from "../constants";
import { Pricer } from "../pricers/pricer";
import { UniswapV2Pricer } from "../pricers/uni-v2-pricer";
import { UniswapV3Pricer } from "../pricers/uni-v3-pricer";
import { JsonRpcProvider } from "ethers";

export class PricePrinter {
  private _v2Pricer: Pricer;
  private _v3Pricer: Pricer;

  constructor(provider: JsonRpcProvider) {
    this._v2Pricer = new UniswapV2Pricer(provider);
    this._v3Pricer = new UniswapV3Pricer(provider);
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
