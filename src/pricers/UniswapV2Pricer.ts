import { Contract, JsonRpcProvider } from "ethers";
import BigNumber from "bignumber.js";
import { Pricer } from "./Pricer";
import { UNISWAP_V2_PAIR_ABI } from "../abi/UniswapV2PairABI";

export class UniswappyV2Pricer extends Pricer {
  private _contract;

  constructor(address: string, provider: JsonRpcProvider) {
    super(address, provider);
    this._contract = new Contract(this._address, UNISWAP_V2_PAIR_ABI, provider);
  }

  // Get price of WETH in USDC
  public async getPrice(): Promise<BigNumber> {
    try {
      if (!this._contract) {
        throw Error("Contract must be initalised");
      }
      // Call the view function
      const contractResult = await this._contract.getReserves();

      const [reserve0, reserve1] = contractResult
        .slice(0, 2)
        .map((n) => new BigNumber(n.toString()));

      // decimals of USDC = 6
      const adjustedReserve0 = new BigNumber(reserve0).dividedBy(
        new BigNumber(10).exponentiatedBy(6)
      );
      // decimals of WETH = 18
      const adjustedReserve1 = new BigNumber(reserve1).dividedBy(
        new BigNumber(10).exponentiatedBy(18)
      );

      return adjustedReserve0.dividedBy(adjustedReserve1);
    } catch (error) {
      console.error("Error calling contract function:", error);
    }

    return new BigNumber("-1");
  }
}
