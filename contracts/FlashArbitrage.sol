// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;
pragma abicoder v2;

import {IUniswapV3SwapCallback} from "@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol";
import {LowGasSafeMath} from "@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol";
import {PoolAddress} from "@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol";
import {TransferHelper} from "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

import {IUniswapV2Router02} from "@uniswap-v2/periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {IWETH9} from "./helper/IWETH9.sol";
import {IERC20} from "./helper/IERC20.sol";

/// @title Flash contract implementation
/// @notice An example contract using the Uniswap V3 flash function
contract FlashArbitrage is IUniswapV3SwapCallback {
    using LowGasSafeMath for uint256;
    using LowGasSafeMath for int256;

    IUniswapV2Router02 public immutable swapRouter;
    address public immutable factory;
    address public immutable WETH9;
    address private immutable owner;
    address private executor;

    modifier onlyExecutor() {
        require(msg.sender == executor, "Exec Only");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Owner Only");
        _;
    }

    constructor(
        address _swapRouter,
        address _factory,
        address _weth9,
        address _executor
    ) {
        swapRouter = IUniswapV2Router02(_swapRouter);
        WETH9 = _weth9;
        factory = _factory;
        executor = _executor;
        owner = msg.sender;
    }

    function setExecutor(address _newExecutor) external onlyOwner {
        executor = _newExecutor;
    }

    /// @param amount0Delta The amount of token0 that was sent (negative) or must be received (positive) by the pool by
    /// the end of the swap. If positive, the callback must send that amount of token0 to the pool.
    /// @param amount1Delta The amount of token1 that was sent (negative) or must be received (positive) by the pool by
    /// the end of the swap. If positive, the callback must send that amount of token1 to the pool.
    /// @param data Any data passed through by the caller via the IUniswapV3PoolActions#swap call
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external override {
        FlashCallbackData memory decoded = abi.decode(
            data,
            (FlashCallbackData)
        );

        require(
            msg.sender == PoolAddress.computeAddress(factory, decoded.poolKey),
            "Function must be called from pool"
        );

        uint256 _wethBalanceBefore = IWETH9(WETH9).balanceOf(address(this));

        address token0 = decoded.poolKey.token0;
        address token1 = decoded.poolKey.token1;

        address[] memory path;
        path = new address[](2);
        uint amountIn;
        uint amountOwed;

        if (decoded.token0IsWeth) {
            require(amount0Delta > 0 && amount1Delta < 0, "Must borrow WETH");
            amountIn = uint(-amount1Delta);
            amountOwed = uint(amount0Delta);
            TransferHelper.safeApprove(token1, address(swapRouter), amountIn);
            path[0] = token1;
            path[1] = token0;
        } else {
            require(amount0Delta < 0 && amount1Delta > 0, "Must borrow WETH");
            amountIn = uint(-amount0Delta);
            amountOwed = uint(amount1Delta);
            TransferHelper.safeApprove(token0, address(swapRouter), amountIn);
            path[0] = token0;
            path[1] = token1;
        }

        swapRouter.swapExactTokensForTokens(
            amountIn,
            amountOwed,
            path,
            address(this),
            block.timestamp
        );

        if (decoded.token0IsWeth) {
            TransferHelper.safeApprove(token0, address(this), amountOwed);
            pay(token0, address(this), msg.sender, amountOwed);
        } else {
            TransferHelper.safeApprove(token1, address(this), amountOwed);
            pay(token1, address(this), msg.sender, amountOwed);
        }

        uint256 currentBalance = IWETH9(WETH9).balanceOf(address(this));
        uint256 totalBalanceNeeded = _wethBalanceBefore +
            decoded.amountToCoinbase;

        // Make sure that we have enough balance
        require(currentBalance >= totalBalanceNeeded, "Not profitable");

        // Calculate profit safely
        uint256 profit = currentBalance - totalBalanceNeeded;

        IWETH9(WETH9).withdraw(decoded.amountToCoinbase + profit);
        block.coinbase.transfer(decoded.amountToCoinbase);
        payable(executor).transfer(profit);
    }

    struct FlashParams {
        address token0;
        address token1;
        uint24 fee1;
        uint256 wethToBorrow;
        uint256 amountToCoinbase;
    }
    //
    struct FlashCallbackData {
        address payer;
        PoolAddress.PoolKey poolKey;
        uint256 amountToCoinbase;
        bool token0IsWeth;
    }

    /// @param params The parameters necessary for flash swap and the callback, passed in as FlashParams
    /// @notice Calls the pools swap with data needed in `uniswapV3SwapCallback`. WETH is to be borrowed and the other token is to be paid back.
    function initFlash(FlashParams calldata params) external onlyExecutor {
        require(
            (params.token0 == WETH9 && params.token1 != WETH9) ||
                (params.token0 != WETH9 && params.token1 == WETH9),
            "Must be a WETH pair"
        );

        require(params.token0 < params.token1, "Pair order wrong");

        PoolAddress.PoolKey memory poolKey = PoolAddress.PoolKey({
            token0: params.token0,
            token1: params.token1,
            fee: params.fee1
        });
        IUniswapV3Pool pool = IUniswapV3Pool(
            PoolAddress.computeAddress(factory, poolKey)
        );

        bool token0IsWeth = (params.token0 == WETH9);
        // sqrtPriceLimitX96 is hard coded as TickMath.MIN_SQRT_RATIO + 1 or TickMath.MAX_SQRT_RATIO - 1
        uint160 sqrtPriceLimitX96 = token0IsWeth
            ? 4295128739 + 1
            : 1461446703485210103287273052203988822378723970340;
        pool.swap(
            address(this),
            token0IsWeth,
            int256(params.wethToBorrow),
            sqrtPriceLimitX96,
            abi.encode(
                FlashCallbackData({
                    payer: msg.sender,
                    poolKey: poolKey,
                    amountToCoinbase: params.amountToCoinbase,
                    token0IsWeth: token0IsWeth
                })
            )
        );
    }

    /// @param token The token to pay
    /// @param payer The entity that must pay
    /// @param recipient The entity that will receive payment
    /// @param value The amount to pay
    /// @dev copied from uniswap v3-periphery 0.8 branch
    function pay(
        address token,
        address payer,
        address recipient,
        uint256 value
    ) internal {
        if (token == WETH9 && address(this).balance >= value) {
            // pay with WETH9
            IWETH9(WETH9).deposit{value: value}(); // wrap only what is needed to pay
            IWETH9(WETH9).transfer(recipient, value);
        } else if (payer == address(this)) {
            // pay with tokens already in the contract (for the exact input multihop case)
            TransferHelper.safeTransfer(token, recipient, value);
        } else {
            // pull payment
            TransferHelper.safeTransferFrom(token, payer, recipient, value);
        }
    }

    receive() external payable {}

    fallback() external payable {}
}
