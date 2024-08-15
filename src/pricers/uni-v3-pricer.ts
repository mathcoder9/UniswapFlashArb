import { JsonRpcProvider } from "ethers";
import { Pricer } from "./pricer";
import { BigNumber } from "bignumber.js";

export class UniswapV3Pricer extends Pricer {
  constructor(provider: JsonRpcProvider) {
    super(provider);
  }

  // Get price of WETH/TOKEN - directly accessing a slot and parsing
  public async getPrice(
    poolAddress: string,
    decimals: number,
    isWethToken0: boolean
  ): Promise<BigNumber> {
    // get slot 0
    const storage = await this._provider.getStorage(poolAddress, 0);

    // uint160 sqrtPriceX96 is packed into slot 0 first - get last 20 bytes;
    const sqrtPriceX96 = new BigNumber(storage.substring(26), 16);
    return this.convertSqrtPriceX96(sqrtPriceX96, decimals, isWethToken0);
  }

  private convertSqrtPriceX96(
    sqrtPriceX96: BigNumber,
    decimals: number,
    isWethToken0: boolean
  ): BigNumber {
    const priceX96 = sqrtPriceX96.exponentiatedBy(2);
    const powerOf96 = new BigNumber(2).exponentiatedBy(192);
    const scaledPriceX96 = priceX96.dividedBy(powerOf96);
    const decimalScaledPriceX96 = scaledPriceX96.dividedBy(
      10 ** (18 - decimals)
    );
    if (!isWethToken0) {
      return new BigNumber(1).dividedBy(decimalScaledPriceX96);
    }
    return decimalScaledPriceX96;
  }
}
