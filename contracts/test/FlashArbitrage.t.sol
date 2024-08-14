// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;
pragma abicoder v2;

import {Test} from "forge-std/Test.sol";
import "forge-std/console.sol";

import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";
import {IUniswapV3Factory} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Factory.sol";
import {PoolAddress} from "@uniswap/v3-periphery/contracts/libraries/PoolAddress.sol";
import {IUniswapV3Pool} from "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

import {IUniswapV2Router02} from "@uniswap-v2/periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {IUniswapV2Pair} from "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";

import {Address} from "../helper/Address.sol";
import {IERC20} from "../helper/IERC20.sol";
import {IWETH9} from "../helper/IWETH9.sol";

import {FlashArbitrage} from "../FlashArbitrage.sol";

contract FlashArbitrageTest is Test {
    FlashArbitrage flashArbitrage;
    address executor;

    IERC20 private constant usdc = IERC20(Address.USDC);
    IWETH9 private constant weth = IWETH9(Address.WETH9);

    IUniswapV2Router02 private constant swapRouter =
        IUniswapV2Router02(Address.UNIV2_ROUTER);
    IUniswapV2Pair v2Pair = IUniswapV2Pair(Address.UNIV2_USDC_WETH_POOL);

    function setUp() public {
        executor = vm.addr(1);
        flashArbitrage = new FlashArbitrage(
            Address.UNIV2_ROUTER,
            Address.UNIV3_FACTORY,
            address(weth),
            executor
        );
    }

    function inflateV2Pool() public {
        address priceChanger = vm.addr(2);
        vm.deal(priceChanger, 500 ether);
        vm.startPrank(priceChanger);

        address[] memory path;
        path = new address[](2);
        path[0] = address(weth);
        path[1] = address(usdc);

        swapRouter.swapExactETHForTokens{value: 500 ether}(
            10,
            path,
            msg.sender,
            block.timestamp
        );

        vm.stopPrank();
    }

    function test_swap() public {
        inflateV2Pool();
        vm.startPrank(executor);
        console.log("ETH balance before:", executor.balance);
        FlashArbitrage.FlashParams memory params = FlashArbitrage.FlashParams({
            token0: address(usdc),
            token1: address(weth),
            poolFee: 3000,
            wethToBorrow: 1 ether,
            amountToCoinbase: 0.005 ether
        });
        flashArbitrage.initFlash(params);
        console.log("ETH balance after:", executor.balance);
        vm.stopPrank();
    }

    function test_RevertIf_PairOrderWrong() public {
        vm.expectRevert("Pair order wrong");
        vm.startPrank(executor);
        FlashArbitrage.FlashParams memory params = FlashArbitrage.FlashParams({
            token0: address(weth),
            token1: address(usdc),
            poolFee: 30000,
            wethToBorrow: 0.06 ether,
            amountToCoinbase: 0.05 ether
        });
        flashArbitrage.initFlash(params);
        vm.stopPrank();
    }

    function test_RevertIf_NotProfitable() public {
        inflateV2Pool();
        vm.expectRevert("Not profitable");
        vm.startPrank(executor);
        console.log("ETH balance before:", executor.balance);
        FlashArbitrage.FlashParams memory params = FlashArbitrage.FlashParams({
            token0: address(usdc),
            token1: address(weth),
            poolFee: 3000,
            wethToBorrow: 0.06 ether,
            amountToCoinbase: 0.05 ether
        });
        flashArbitrage.initFlash(params);
        console.log("ETH balance after:", executor.balance);
        vm.stopPrank();
    }

    function test_RevertIf_NotExecutor(address nonExecutor) public {
        vm.assume(nonExecutor != executor);
        vm.expectRevert("Exec Only");
        vm.startPrank(nonExecutor);
        FlashArbitrage.FlashParams memory params = FlashArbitrage.FlashParams({
            token0: address(usdc),
            token1: address(weth),
            poolFee: 3000,
            wethToBorrow: 0.1 ether,
            amountToCoinbase: 0.05 ether
        });
        flashArbitrage.initFlash(params);
        vm.stopPrank();
    }

    function test_RevertIf_NotOwner(address nonOwner) public {
        vm.assume(nonOwner != address(this));
        vm.expectRevert("Owner Only");
        vm.startPrank(nonOwner);
        flashArbitrage.setExecutor(vm.addr(4));
        vm.stopPrank();
    }

    function test_OwnerCanSetExecutor() public {
        flashArbitrage.setExecutor(vm.addr(4));
    }

    function test_RevertIf_WrongAddressCanUseCallBack(
        address wrongAddress
    ) public {
        vm.assume(wrongAddress != Address.UNIV3_USDC_WETH_POOL);
        vm.expectRevert("Function must be called from pool");
        vm.startPrank(wrongAddress);
        flashArbitrage.uniswapV3SwapCallback(
            10,
            10,
            abi.encode(
                FlashArbitrage.FlashCallbackData({
                    payer: msg.sender,
                    poolKey: PoolAddress.PoolKey({
                        token0: address(usdc),
                        token1: address(weth),
                        fee: 3000
                    }),
                    amountToCoinbase: 0.1 ether,
                    token0IsWeth: false
                })
            )
        );
        vm.stopPrank();
    }
}
