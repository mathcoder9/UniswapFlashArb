import dotenv from "dotenv";
dotenv.config();

const activeChain: number = Number(process.env.EXECUTION_CHAIN_ID);
export const MAINNET_CHAIN_ID = 1;
export const SEPOLIA_CHAIN_ID = 11155111;

export class PoolHelper {
  private static WETH_IS_TOKEN0: boolean = true;
  private static WETH_IS_TOKEN1: boolean = false;
  private static activeChain: number;
  // erc20 token address -> (v2 pool address, v3 pool address, decimals, isWethToken0)
  private static addressMap: Map<string, [string, string, number, boolean]>;

  static {
    PoolHelper.activeChain = Number(process.env.EXECUTION_CHAIN_ID);
    PoolHelper.addressMap = new Map();
    PoolHelper.initaliseMaps();
  }

  private static updateAddressMap(
    chainId: number,
    address: string,
    v2PoolAddress: string,
    v3PoolAddress: string,
    decimals: number,
    isWethToken0: boolean
  ): void {
    if (chainId === PoolHelper.activeChain) {
      PoolHelper.addressMap.set(address, [
        v2PoolAddress,
        v3PoolAddress,
        decimals,
        isWethToken0,
      ]);
    }
  }

  private static initaliseMaps(): void {
    // USDC
    PoolHelper.updateAddressMap(
      MAINNET_CHAIN_ID,
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc",
      "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
      6,
      PoolHelper.WETH_IS_TOKEN1
    );
    //ZRX
    PoolHelper.updateAddressMap(
      MAINNET_CHAIN_ID,
      "0xE41d2489571d322189246DaFA5ebDe1F4699F498",
      "0xc6f348dd3b91a56d117ec0071c1e9b83c0996de4",
      "0x14424eEeCbfF345B38187d0B8b749E56FAA68539",
      18,
      PoolHelper.WETH_IS_TOKEN0
    );
    // HGR
    PoolHelper.updateAddressMap(
      SEPOLIA_CHAIN_ID,
      "0xD6Af5333dee494DDfB6f72AdA7B4ED950bE585a6",
      "0xf5280DE209E5162DA118E6d587542B42ab0605C0",
      "0x459a27D2f46AB5784C5297F0547936a475Fe3fDa",
      18,
      PoolHelper.WETH_IS_TOKEN0
    );
  }

  public static lookupAddress(
    address: string
  ): [string, string, number, boolean] | undefined {
    return PoolHelper.addressMap.get(address);
  }
}

export const WETH =
  activeChain == MAINNET_CHAIN_ID
    ? "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    : activeChain == SEPOLIA_CHAIN_ID
    ? "0x788EEF099ae11eBF763bC82B043301A62441698D"
    : "";

export const UNISWAP_V2_ROUTER =
  activeChain == MAINNET_CHAIN_ID
    ? "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
    : activeChain == SEPOLIA_CHAIN_ID
    ? "0xdf0F7cdbbDc5aa2546853Da2d8105532e97be0F2"
    : "";

export const HGR_TOKEN_ADDRESS = "0xD6Af5333dee494DDfB6f72AdA7B4ED950bE585a6";
