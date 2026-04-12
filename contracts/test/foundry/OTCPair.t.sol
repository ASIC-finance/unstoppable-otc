// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OTCTestBase} from "./Helpers.sol";
import {OTCPair} from "../../contracts/OTCPair.sol";
import {MockERC20} from "../../contracts/mocks/MockERC20.sol";
import {MockFeeToken} from "../../contracts/mocks/MockFeeToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract OTCPairTest is OTCTestBase {
    OTCPair internal pair;
    bool internal sellToken0;

    function setUp() public override {
        super.setUp();
        (pair, sellToken0) = _createPair();
    }

    // ── Helpers ────────────────────────────────────────────────────

    function _ceilDiv(uint256 a, uint256 b) internal pure returns (uint256) {
        return a == 0 ? 0 : (a - 1) / b + 1;
    }

    // ====================================================================
    //                          CREATE ORDER
    // ====================================================================

    function test_createOrder_basicFlow() public {
        uint256 sellAmt = 100e18;
        uint256 buyAmt = 200e18;

        uint256 orderId = _makerCreateOrder(pair, sellToken0, sellAmt, buyAmt);
        assertEq(orderId, 0);

        OTCPair.Order memory order = pair.getOrder(orderId);
        assertEq(order.maker, maker);
        assertEq(order.sellToken0, sellToken0);
        assertEq(order.sellAmount, sellAmt);
        assertEq(order.buyAmount, buyAmt);
        assertEq(order.filledSellAmount, 0);
        assertTrue(order.status == OTCPair.OrderStatus.Active);
        assertEq(pair.getActiveOrderCount(), 1);
    }

    function test_createOrder_revertsZeroSellAmount() public {
        vm.prank(maker);
        vm.expectRevert(OTCPair.ZeroAmount.selector);
        pair.createOrder(sellToken0, 0, 100);
    }

    function test_createOrder_revertsZeroBuyAmount() public {
        vm.prank(maker);
        vm.expectRevert(OTCPair.ZeroAmount.selector);
        pair.createOrder(sellToken0, 100, 0);
    }

    function test_createOrder_feeOnTransfer() public {
        MockFeeToken feeToken = new MockFeeToken("Fee", "FEE", 100); // 1%
        feeToken.mint(maker, INITIAL_BALANCE);

        factory.createPair(address(feeToken), address(tokenB));
        OTCPair feePair = OTCPair(factory.getPair(address(feeToken), address(tokenB)));
        bool feeSellToken0 = feePair.token0() == address(feeToken);

        uint256 sellAmt = 100e18;
        vm.startPrank(maker);
        feeToken.approve(address(feePair), sellAmt);
        feePair.createOrder(feeSellToken0, sellAmt, 200e18);
        vm.stopPrank();

        // 1% fee → 99e18 actually received
        OTCPair.Order memory order = feePair.getOrder(0);
        assertEq(order.sellAmount, 99e18);
    }

    // ====================================================================
    //                           FILL ORDER
    // ====================================================================

    function test_fillOrder_full() public {
        uint256 sellAmt = 100e18;
        uint256 buyAmt = 200e18;

        _makerCreateOrder(pair, sellToken0, sellAmt, buyAmt);

        uint256 makerBuyBefore = (sellToken0 ? tokenB : tokenA).balanceOf(maker);
        uint256 takerSellBefore = (sellToken0 ? tokenA : tokenB).balanceOf(taker);

        _takerFillOrder(pair, sellToken0, 0, sellAmt, buyAmt);

        assertEq((sellToken0 ? tokenB : tokenA).balanceOf(maker), makerBuyBefore + buyAmt);
        assertEq((sellToken0 ? tokenA : tokenB).balanceOf(taker), takerSellBefore + sellAmt);

        OTCPair.Order memory order = pair.getOrder(0);
        assertTrue(order.status == OTCPair.OrderStatus.Filled);
        assertEq(pair.getActiveOrderCount(), 0);
    }

    function test_fillOrder_partial() public {
        uint256 sellAmt = 100e18;
        uint256 buyAmt = 200e18;

        _makerCreateOrder(pair, sellToken0, sellAmt, buyAmt);

        uint256 fillSell = 50e18;
        uint256 expectedBuy = 100e18; // 200 * 50 / 100

        _takerFillOrder(pair, sellToken0, 0, fillSell, expectedBuy);

        OTCPair.Order memory order = pair.getOrder(0);
        assertTrue(order.status == OTCPair.OrderStatus.Active);
        assertEq(order.filledSellAmount, fillSell);
        assertEq(pair.getActiveOrderCount(), 1);
    }

    function test_fillOrder_multiplePartials() public {
        uint256 sellAmt = 100e18;
        uint256 buyAmt = 200e18;

        _makerCreateOrder(pair, sellToken0, sellAmt, buyAmt);

        // First fill: 60/100
        _takerFillOrder(pair, sellToken0, 0, 60e18, 120e18);

        // Second fill from a different account: 40/100
        MockERC20 buyToken = sellToken0 ? tokenB : tokenA;
        buyToken.mint(other, INITIAL_BALANCE);
        vm.startPrank(other);
        buyToken.approve(address(pair), 80e18);
        pair.fillOrder(0, 40e18);
        vm.stopPrank();

        OTCPair.Order memory order = pair.getOrder(0);
        assertTrue(order.status == OTCPair.OrderStatus.Filled);
        assertEq(order.filledSellAmount, sellAmt);
    }

    function test_fillOrder_revertsNotActive() public {
        _makerCreateOrder(pair, sellToken0, 100e18, 100e18);

        vm.prank(maker);
        pair.cancelOrder(0);

        vm.expectRevert(OTCPair.OrderNotActive.selector);
        vm.prank(taker);
        pair.fillOrder(0, 100e18);
    }

    function test_fillOrder_revertsZeroAmount() public {
        _makerCreateOrder(pair, sellToken0, 100e18, 100e18);

        vm.expectRevert(OTCPair.ZeroAmount.selector);
        vm.prank(taker);
        pair.fillOrder(0, 0);
    }

    function test_fillOrder_revertsExceedsRemaining() public {
        _makerCreateOrder(pair, sellToken0, 100e18, 100e18);

        vm.expectRevert(OTCPair.ExceedsRemaining.selector);
        vm.prank(taker);
        pair.fillOrder(0, 100e18 + 1);
    }

    function test_fillOrder_ceilDivProtectsMaker() public {
        // sell=100, buy=99 → partial fill of 50 should cost ceil(99*50/100) = 50, not 49
        vm.startPrank(maker);
        (sellToken0 ? tokenA : tokenB).approve(address(pair), 100);
        pair.createOrder(sellToken0, 100, 99);
        vm.stopPrank();

        MockERC20 buyToken = sellToken0 ? tokenB : tokenA;
        uint256 makerBuyBefore = buyToken.balanceOf(maker);

        vm.startPrank(taker);
        buyToken.approve(address(pair), 99);
        pair.fillOrder(0, 50);
        vm.stopPrank();

        // Maker should receive 50 (ceil(99*50/100) = 50), not 49
        assertEq(buyToken.balanceOf(maker) - makerBuyBefore, 50);
    }

    // ====================================================================
    //                         CANCEL ORDER
    // ====================================================================

    function test_cancelOrder_refunds() public {
        uint256 sellAmt = 100e18;
        _makerCreateOrder(pair, sellToken0, sellAmt, sellAmt);

        MockERC20 sellToken = sellToken0 ? tokenA : tokenB;
        uint256 balBefore = sellToken.balanceOf(maker);

        vm.prank(maker);
        pair.cancelOrder(0);

        assertEq(sellToken.balanceOf(maker), balBefore + sellAmt);

        OTCPair.Order memory order = pair.getOrder(0);
        assertTrue(order.status == OTCPair.OrderStatus.Cancelled);
        assertEq(pair.getActiveOrderCount(), 0);
    }

    function test_cancelOrder_partiallyFilled_refundsRemaining() public {
        uint256 sellAmt = 100e18;
        _makerCreateOrder(pair, sellToken0, sellAmt, sellAmt);

        // Fill 50%
        _takerFillOrder(pair, sellToken0, 0, 50e18, 50e18);

        MockERC20 sellToken = sellToken0 ? tokenA : tokenB;
        uint256 balBefore = sellToken.balanceOf(maker);

        vm.prank(maker);
        pair.cancelOrder(0);

        assertEq(sellToken.balanceOf(maker), balBefore + 50e18);
    }

    function test_cancelOrder_revertsNotMaker() public {
        _makerCreateOrder(pair, sellToken0, 100e18, 100e18);

        vm.expectRevert(OTCPair.NotMaker.selector);
        vm.prank(taker);
        pair.cancelOrder(0);
    }

    function test_cancelOrder_revertsNotActive() public {
        _makerCreateOrder(pair, sellToken0, 100e18, 100e18);

        vm.prank(maker);
        pair.cancelOrder(0);

        vm.expectRevert(OTCPair.OrderNotActive.selector);
        vm.prank(maker);
        pair.cancelOrder(0);
    }

    // ====================================================================
    //                       INDEXED QUERIES
    // ====================================================================

    function test_activeOrders_trackCorrectly() public {
        // Create 3 orders
        _makerCreateOrder(pair, sellToken0, 10e18, 10e18);
        _makerCreateOrder(pair, sellToken0, 10e18, 10e18);
        _makerCreateOrder(pair, sellToken0, 10e18, 10e18);
        assertEq(pair.getActiveOrderCount(), 3);

        // Fill order 1
        _takerFillOrder(pair, sellToken0, 1, 10e18, 10e18);
        assertEq(pair.getActiveOrderCount(), 2);

        // Cancel order 0
        vm.prank(maker);
        pair.cancelOrder(0);
        assertEq(pair.getActiveOrderCount(), 1);

        // Only order 2 remains
        (uint256[] memory ids,) = pair.getActiveOrders(0, 10);
        assertEq(ids.length, 1);
        assertEq(ids[0], 2);
    }

    function test_makerOrders_trackCorrectly() public {
        _makerCreateOrder(pair, sellToken0, 10e18, 10e18);
        _makerCreateOrder(pair, sellToken0, 10e18, 10e18);

        // Taker creates an order in the opposite direction (selling tokenB)
        vm.startPrank(taker);
        (sellToken0 ? tokenB : tokenA).approve(address(pair), 10e18);
        pair.createOrder(!sellToken0, 10e18, 10e18);
        vm.stopPrank();

        assertEq(pair.getMakerOrderCount(maker), 2);
        assertEq(pair.getMakerOrderCount(taker), 1);
    }

    // ====================================================================
    //                     PAIR ISOLATION
    // ====================================================================

    function test_pairIsolation() public {
        MockERC20 tokenC = new MockERC20("Token C", "TKC", 18);
        tokenC.mint(maker, INITIAL_BALANCE);

        factory.createPair(address(tokenA), address(tokenC));
        OTCPair pair2 = OTCPair(factory.getPair(address(tokenA), address(tokenC)));
        bool sell0_2 = pair2.token0() == address(tokenA);

        // Deposit into pair 1
        _makerCreateOrder(pair, sellToken0, 100e18, 100e18);

        // Deposit into pair 2
        vm.startPrank(maker);
        tokenA.approve(address(pair2), 200e18);
        pair2.createOrder(sell0_2, 200e18, 200e18);
        vm.stopPrank();

        // Balances are isolated
        assertEq(tokenA.balanceOf(address(pair)), sellToken0 ? 100e18 : 0);
        assertEq(tokenA.balanceOf(address(pair2)), sell0_2 ? 200e18 : 0);

        // Cancel pair 1 doesn't affect pair 2
        vm.prank(maker);
        pair.cancelOrder(0);
        assertEq(pair2.getActiveOrderCount(), 1);
    }

    // ====================================================================
    //                         FUZZ TESTS
    // ====================================================================

    function testFuzz_createAndFillOrder(
        uint256 sellAmt,
        uint256 buyAmt,
        uint256 fillAmt
    ) public {
        // Bound to reasonable values: 1 wei to 1B tokens
        sellAmt = bound(sellAmt, 1, 1_000_000_000e18);
        buyAmt = bound(buyAmt, 1, 1_000_000_000e18);
        fillAmt = bound(fillAmt, 1, sellAmt);

        // Ensure buyAmountIn won't be zero
        uint256 buyAmountIn = _ceilDiv(buyAmt * fillAmt, sellAmt);
        vm.assume(buyAmountIn > 0);

        // Mint sufficient tokens
        MockERC20 sellToken = sellToken0 ? tokenA : tokenB;
        MockERC20 buyToken = sellToken0 ? tokenB : tokenA;
        sellToken.mint(maker, sellAmt);
        buyToken.mint(taker, buyAmountIn);

        // Create order
        vm.startPrank(maker);
        sellToken.approve(address(pair), sellAmt);
        pair.createOrder(sellToken0, sellAmt, buyAmt);
        vm.stopPrank();

        uint256 orderId = pair.getOrderCount() - 1;

        // Fill
        vm.startPrank(taker);
        buyToken.approve(address(pair), buyAmountIn);
        pair.fillOrder(orderId, fillAmt);
        vm.stopPrank();

        OTCPair.Order memory order = pair.getOrder(orderId);
        assertEq(order.filledSellAmount, fillAmt);

        if (fillAmt == sellAmt) {
            assertTrue(order.status == OTCPair.OrderStatus.Filled);
        } else {
            assertTrue(order.status == OTCPair.OrderStatus.Active);
        }
    }

    function testFuzz_partialFillAccounting(
        uint256 sellAmt,
        uint256 buyAmt,
        uint256 fill1,
        uint256 fill2
    ) public {
        sellAmt = bound(sellAmt, 2, 1_000_000_000e18);
        buyAmt = bound(buyAmt, 1, 1_000_000_000e18);
        fill1 = bound(fill1, 1, sellAmt - 1);
        fill2 = bound(fill2, 1, sellAmt - fill1);

        uint256 buyIn1 = _ceilDiv(buyAmt * fill1, sellAmt);
        uint256 buyIn2 = _ceilDiv(buyAmt * fill2, sellAmt);
        vm.assume(buyIn1 > 0 && buyIn2 > 0);

        MockERC20 sellToken = sellToken0 ? tokenA : tokenB;
        MockERC20 buyToken = sellToken0 ? tokenB : tokenA;
        sellToken.mint(maker, sellAmt);
        buyToken.mint(taker, buyIn1 + buyIn2);

        vm.startPrank(maker);
        sellToken.approve(address(pair), sellAmt);
        pair.createOrder(sellToken0, sellAmt, buyAmt);
        vm.stopPrank();

        // Fill 1
        vm.startPrank(taker);
        buyToken.approve(address(pair), buyIn1 + buyIn2);
        pair.fillOrder(0, fill1);

        // Fill 2
        pair.fillOrder(0, fill2);
        vm.stopPrank();

        OTCPair.Order memory order = pair.getOrder(0);
        assertEq(order.filledSellAmount, fill1 + fill2);

        // Invariant: filledSellAmount <= sellAmount
        assertTrue(order.filledSellAmount <= order.sellAmount);
    }

    function testFuzz_ceilDivProtectsMaker(
        uint256 sellAmt,
        uint256 buyAmt,
        uint256 fillAmt
    ) public {
        sellAmt = bound(sellAmt, 1, 1_000_000_000e18);
        buyAmt = bound(buyAmt, 1, 1_000_000_000e18);
        fillAmt = bound(fillAmt, 1, sellAmt);

        uint256 buyAmountIn = _ceilDiv(buyAmt * fillAmt, sellAmt);
        vm.assume(buyAmountIn > 0);

        // Floor division value (what taker would ideally pay)
        uint256 floorBuy = (buyAmt * fillAmt) / sellAmt;

        // Ceil must be >= floor (maker never gets less)
        assertTrue(buyAmountIn >= floorBuy, "ceil must be >= floor");

        // Ceil must be at most floor + 1
        assertTrue(buyAmountIn <= floorBuy + 1, "ceil must be <= floor + 1");
    }

    function testFuzz_feeOnTransfer(
        uint256 sellAmt,
        uint256 buyAmt,
        uint256 feeBps
    ) public {
        sellAmt = bound(sellAmt, 100, 1_000_000_000e18);
        buyAmt = bound(buyAmt, 1, 1_000_000_000e18);
        feeBps = bound(feeBps, 1, 5000); // 0.01% to 50%

        MockFeeToken feeToken = new MockFeeToken("Fee", "FEE", feeBps);
        feeToken.mint(maker, sellAmt);

        factory.createPair(address(feeToken), address(tokenB));
        OTCPair feePair = OTCPair(factory.getPair(address(feeToken), address(tokenB)));
        bool feeSellToken0 = feePair.token0() == address(feeToken);

        vm.startPrank(maker);
        feeToken.approve(address(feePair), sellAmt);
        feePair.createOrder(feeSellToken0, sellAmt, buyAmt);
        vm.stopPrank();

        OTCPair.Order memory order = feePair.getOrder(0);

        // Actual escrowed amount should be sellAmt minus the fee
        uint256 fee = (sellAmt * feeBps) / 10_000;
        uint256 expectedReceived = sellAmt - fee;
        assertEq(order.sellAmount, expectedReceived, "escrow must equal post-fee amount");

        // Contract balance must match
        assertEq(
            feeToken.balanceOf(address(feePair)),
            expectedReceived,
            "contract balance must match order.sellAmount"
        );
    }

    // ====================================================================
    //                      INVARIANT: BALANCE SOLVENCY
    // ====================================================================

    function test_invariant_balanceSolvency_afterOperations() public {
        // Create multiple orders, fill some, cancel some, verify balance invariant
        MockERC20 sellToken = sellToken0 ? tokenA : tokenB;
        MockERC20 buyToken = sellToken0 ? tokenB : tokenA;

        // Create 3 orders
        _makerCreateOrder(pair, sellToken0, 100e18, 200e18);
        _makerCreateOrder(pair, sellToken0, 50e18, 100e18);
        _makerCreateOrder(pair, sellToken0, 75e18, 150e18);

        // Verify initial balance: 100 + 50 + 75 = 225
        assertEq(sellToken.balanceOf(address(pair)), 225e18);

        // Fill order 0 partially (60 out of 100)
        uint256 buyNeeded = _ceilDiv(200e18 * 60e18, 100e18);
        _takerFillOrder(pair, sellToken0, 0, 60e18, buyNeeded);

        // Balance should be 225 - 60 = 165
        assertEq(sellToken.balanceOf(address(pair)), 165e18);

        // Cancel order 1 (full refund of 50)
        vm.prank(maker);
        pair.cancelOrder(1);

        // Balance should be 165 - 50 = 115
        assertEq(sellToken.balanceOf(address(pair)), 115e18);

        // Fill remaining of order 0 (40 out of 100)
        buyNeeded = _ceilDiv(200e18 * 40e18, 100e18);
        _takerFillOrder(pair, sellToken0, 0, 40e18, buyNeeded);

        // Balance should be 115 - 40 = 75 (just order 2 remains)
        assertEq(sellToken.balanceOf(address(pair)), 75e18);

        // Verify: remaining balance == unfilled amount of active orders
        uint256 unfilled = 0;
        for (uint256 i = 0; i < pair.getOrderCount(); i++) {
            OTCPair.Order memory order = pair.getOrder(i);
            if (order.status == OTCPair.OrderStatus.Active) {
                unfilled += order.sellAmount - order.filledSellAmount;
            }
        }
        assertEq(sellToken.balanceOf(address(pair)), unfilled);
    }

    function testFuzz_invariant_filledNeverExceedsSell(
        uint256 sellAmt,
        uint256 buyAmt,
        uint256 fillAmt
    ) public {
        sellAmt = bound(sellAmt, 1, 1_000_000_000e18);
        buyAmt = bound(buyAmt, 1, 1_000_000_000e18);
        fillAmt = bound(fillAmt, 1, sellAmt);

        uint256 buyIn = _ceilDiv(buyAmt * fillAmt, sellAmt);
        vm.assume(buyIn > 0);

        MockERC20 sellToken = sellToken0 ? tokenA : tokenB;
        MockERC20 buyToken = sellToken0 ? tokenB : tokenA;
        sellToken.mint(maker, sellAmt);
        buyToken.mint(taker, buyIn);

        vm.startPrank(maker);
        sellToken.approve(address(pair), sellAmt);
        pair.createOrder(sellToken0, sellAmt, buyAmt);
        vm.stopPrank();

        vm.startPrank(taker);
        buyToken.approve(address(pair), buyIn);
        pair.fillOrder(0, fillAmt);
        vm.stopPrank();

        OTCPair.Order memory order = pair.getOrder(0);
        assertTrue(order.filledSellAmount <= order.sellAmount, "filled must never exceed sell");
    }
}
