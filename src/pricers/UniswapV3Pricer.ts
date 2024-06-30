import { JsonRpcProvider } from "ethers";
import BigNumber from "bignumber.js";
import { Pricer } from "./Pricer";

export class UniswappyV3Pricer extends Pricer {
  constructor(address: string, provider: JsonRpcProvider) {
    super(address, provider);
  }

  // Get price of WETH in USDC
  public async getPrice(): Promise<BigNumber> {
    // get slot 0
    const storage = await this._provider.getStorage(this._address, 0);

    // uint160 sqrtPriceX96 is packed into slot 0 first - get last 20 bytes;
    const sqrtPriceX96 = new BigNumber(storage.substring(26), 16);
    const priceX96 = sqrtPriceX96.exponentiatedBy(2);
    const powerOf96 = new BigNumber("2").exponentiatedBy(192);
    const scaledPriceX96 = priceX96.dividedBy(powerOf96);
  
    const decimalScaledPriceX96 = scaledPriceX96.dividedBy(10 ** 12);
    // return price of ETH/USDC
    return new BigNumber("1").dividedBy(decimalScaledPriceX96);
  }
}
