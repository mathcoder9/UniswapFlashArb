import { Contract, JsonRpcProvider } from "ethers";
import { UNISWAP_V2_PAIR_ABI } from "../abi/uniswap-v2-pair-abi";
import { Pricer } from "./pricer";
import { BigNumber } from "bignumber.js";

export class UniswapV2Pricer extends Pricer {
  constructor(provider: JsonRpcProvider) {
    super(provider);
  }

  // Get price of WETH in USDC
  public async getPrice(
    poolAddress: string,
    decimals: number,
    isWethToken0: boolean
  ): Promise<BigNumber> {
    const contract = new Contract(
      poolAddress,
      UNISWAP_V2_PAIR_ABI,
      this._provider
    );
    try {
      // Call the view function
      const contractResult = await contract.getReserves();

      const [reserve0, reserve1] = contractResult
        .slice(0, 2)
        .map((n) => new BigNumber(n.toString()));

      // decimals of USDC = 6
      const adjustedReserve0 = new BigNumber(reserve0).dividedBy(
        new BigNumber(10).exponentiatedBy(decimals)
      );
      // decimals of WETH = 18
      const adjustedReserve1 = new BigNumber(reserve1).dividedBy(
        new BigNumber(10).exponentiatedBy(18)
      );

      if (isWethToken0) {
        return adjustedReserve1.dividedBy(adjustedReserve0);
      }
      return adjustedReserve0.dividedBy(adjustedReserve1);
    } catch (error) {
      console.error("Error calling contract function:", error);
    }

    return new BigNumber("-1");
  }
}
