// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {OTCFactory} from "../../contracts/OTCFactory.sol";
import {OTCPair} from "../../contracts/OTCPair.sol";
import {MockERC20} from "../../contracts/mocks/MockERC20.sol";
/// @dev Shared setup for all OTC tests
abstract contract OTCTestBase is Test {
    OTCFactory internal factory;
    MockERC20 internal tokenA;
    MockERC20 internal tokenB;

    address internal maker = makeAddr("maker");
    address internal taker = makeAddr("taker");
    address internal other = makeAddr("other");

    uint256 internal constant INITIAL_BALANCE = 1_000_000e18;
    /// @dev Default slippage tolerance used by most tests: zero slippage allowed.
    /// Standard ERC-20 tokens (no fee-on-transfer) always satisfy this.
    uint16 internal constant DEFAULT_MIN_BUY_BPS = 10_000;
    /// @dev Pass-any-price max used by most fill tests — the contract
    /// computes the actual cost deterministically, so infinity is safe here.
    uint256 internal constant MAX_BUY = type(uint256).max;

    function setUp() public virtual {
        factory = new OTCFactory();
        tokenA = new MockERC20("Token A", "TKA", 18);
        tokenB = new MockERC20("Token B", "TKB", 18);

        tokenA.mint(maker, INITIAL_BALANCE);
        tokenB.mint(taker, INITIAL_BALANCE);
        tokenA.mint(taker, INITIAL_BALANCE);
        tokenB.mint(maker, INITIAL_BALANCE);
    }

    /// @dev Deploy a pair and return it with the sellToken0 direction for tokenA
    function _createPair() internal returns (OTCPair pair, bool sellToken0) {
        factory.createPair(address(tokenA), address(tokenB));
        address pairAddr = factory.getPair(address(tokenA), address(tokenB));
        pair = OTCPair(pairAddr);
        sellToken0 = pair.token0() == address(tokenA);
    }

    /// @dev Approve and create an order as maker — default `minBuyBps` = 10000.
    function _makerCreateOrder(
        OTCPair pair,
        bool sellToken0,
        uint256 sellAmount,
        uint256 buyAmount
    ) internal returns (uint256 orderId) {
        return _makerCreateOrder(pair, sellToken0, sellAmount, buyAmount, DEFAULT_MIN_BUY_BPS);
    }

    function _makerCreateOrder(
        OTCPair pair,
        bool sellToken0,
        uint256 sellAmount,
        uint256 buyAmount,
        uint16 minBuyBps
    ) internal returns (uint256 orderId) {
        MockERC20 sellToken = sellToken0 ? tokenA : tokenB;
        vm.startPrank(maker);
        sellToken.approve(address(pair), sellAmount);
        orderId = pair.createOrder(sellToken0, sellAmount, buyAmount, minBuyBps);
        vm.stopPrank();
    }

    /// @dev Approve and fill an order as taker with max-price = infinity.
    function _takerFillOrder(
        OTCPair pair,
        bool sellToken0,
        uint256 orderId,
        uint256 sellAmountOut,
        uint256 approveAmount
    ) internal {
        MockERC20 buyToken = sellToken0 ? tokenB : tokenA;
        vm.startPrank(taker);
        buyToken.approve(address(pair), approveAmount);
        pair.fillOrder(orderId, sellAmountOut, MAX_BUY);
        vm.stopPrank();
    }
}
