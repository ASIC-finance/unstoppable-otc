// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {OTCTestBase} from "./Helpers.sol";
import {OTCPair} from "../../contracts/OTCPair.sol";
import {MockERC20} from "../../contracts/mocks/MockERC20.sol";
import {MockFeeToken} from "../../contracts/mocks/MockFeeToken.sol";
import {MockReentrantToken} from "../../contracts/mocks/MockReentrantToken.sol";

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
        assertEq(order.minBuyBps, DEFAULT_MIN_BUY_BPS);
        assertTrue(order.status == OTCPair.OrderStatus.Active);
        assertEq(pair.getActiveOrderCount(), 1);
        assertEq(pair.getActiveMakerOrderCount(maker), 1);
    }

    function test_createOrder_revertsZeroSellAmount() public {
        vm.prank(maker);
        vm.expectRevert(OTCPair.ZeroAmount.selector);
        pair.createOrder(sellToken0, 0, 100, DEFAULT_MIN_BUY_BPS);
    }

    function test_createOrder_revertsZeroBuyAmount() public {
        vm.prank(maker);
        vm.expectRevert(OTCPair.ZeroAmount.selector);
        pair.createOrder(sellToken0, 100, 0, DEFAULT_MIN_BUY_BPS);
    }

    function test_createOrder_revertsMinBuyBpsZero() public {
        vm.prank(maker);
        vm.expectRevert(OTCPair.InvalidMinBuyBps.selector);
        pair.createOrder(sellToken0, 100, 100, 0);
    }

    function test_createOrder_revertsMinBuyBpsTooHigh() public {
        vm.prank(maker);
        vm.expectRevert(OTCPair.InvalidMinBuyBps.selector);
        pair.createOrder(sellToken0, 100, 100, 10_001);
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
        feePair.createOrder(feeSellToken0, sellAmt, 200e18, DEFAULT_MIN_BUY_BPS);
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
        assertEq(pair.getActiveMakerOrderCount(maker), 0);
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
        pair.fillOrder(0, 40e18, MAX_BUY);
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
        pair.fillOrder(0, 100e18, MAX_BUY);
    }

    function test_fillOrder_revertsZeroAmount() public {
        _makerCreateOrder(pair, sellToken0, 100e18, 100e18);

        vm.expectRevert(OTCPair.ZeroAmount.selector);
        vm.prank(taker);
        pair.fillOrder(0, 0, MAX_BUY);
    }

    function test_fillOrder_revertsExceedsRemaining() public {
        _makerCreateOrder(pair, sellToken0, 100e18, 100e18);

        vm.expectRevert(OTCPair.ExceedsRemaining.selector);
        vm.prank(taker);
        pair.fillOrder(0, 100e18 + 1, MAX_BUY);
    }

    function test_fillOrder_revertsExceedsMaxBuy() public {
        _makerCreateOrder(pair, sellToken0, 100e18, 100e18);
        // Taker will only pay up to 50 — but 100/100 * 100 = 100 > 50.
        vm.expectRevert(OTCPair.ExceedsMaxBuy.selector);
        vm.prank(taker);
        pair.fillOrder(0, 100e18, 50e18);
    }

    function test_fillOrder_ceilDivProtectsMaker() public {
        // sell=100, buy=99 → partial fill of 50 should cost ceil(99*50/100) = 50, not 49
        vm.startPrank(maker);
        (sellToken0 ? tokenA : tokenB).approve(address(pair), 100);
        pair.createOrder(sellToken0, 100, 99, DEFAULT_MIN_BUY_BPS);
        vm.stopPrank();

        MockERC20 buyToken = sellToken0 ? tokenB : tokenA;
        uint256 makerBuyBefore = buyToken.balanceOf(maker);

        vm.startPrank(taker);
        buyToken.approve(address(pair), 99);
        pair.fillOrder(0, 50, MAX_BUY);
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
        assertEq(pair.getActiveMakerOrderCount(maker), 0);
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
        assertEq(pair.getActiveMakerOrderCount(maker), 3);

        // Fill order 1
        _takerFillOrder(pair, sellToken0, 1, 10e18, 10e18);
        assertEq(pair.getActiveOrderCount(), 2);
        assertEq(pair.getActiveMakerOrderCount(maker), 2);

        // Cancel order 0
        vm.prank(maker);
        pair.cancelOrder(0);
        assertEq(pair.getActiveOrderCount(), 1);
        assertEq(pair.getActiveMakerOrderCount(maker), 1);

        // Only order 2 remains
        (uint256[] memory ids,) = pair.getActiveOrders(0, 10);
        assertEq(ids.length, 1);
        assertEq(ids[0], 2);

        (uint256[] memory makerIds,) = pair.getActiveMakerOrders(maker, 0, 10);
        assertEq(makerIds.length, 1);
        assertEq(makerIds[0], 2);
    }

    function test_makerOrders_trackCorrectly() public {
        _makerCreateOrder(pair, sellToken0, 10e18, 10e18);
        _makerCreateOrder(pair, sellToken0, 10e18, 10e18);

        // Taker creates an order in the opposite direction (selling tokenB)
        vm.startPrank(taker);
        (sellToken0 ? tokenB : tokenA).approve(address(pair), 10e18);
        pair.createOrder(!sellToken0, 10e18, 10e18, DEFAULT_MIN_BUY_BPS);
        vm.stopPrank();

        // Full-history index
        assertEq(pair.getMakerOrderCount(maker), 2);
        assertEq(pair.getMakerOrderCount(taker), 1);

        // Active-only index matches (nothing filled/cancelled yet)
        assertEq(pair.getActiveMakerOrderCount(maker), 2);
        assertEq(pair.getActiveMakerOrderCount(taker), 1);
    }

    function test_activeMakerOrders_divergesFromHistoryAfterFill() public {
        _makerCreateOrder(pair, sellToken0, 10e18, 10e18); // id 0
        _makerCreateOrder(pair, sellToken0, 10e18, 10e18); // id 1

        _takerFillOrder(pair, sellToken0, 0, 10e18, 10e18);

        // History keeps id 0; active-only only has id 1.
        assertEq(pair.getMakerOrderCount(maker), 2);
        assertEq(pair.getActiveMakerOrderCount(maker), 1);

        (uint256[] memory activeIds,) = pair.getActiveMakerOrders(maker, 0, 10);
        assertEq(activeIds.length, 1);
        assertEq(activeIds[0], 1);
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
        pair2.createOrder(sell0_2, 200e18, 200e18, DEFAULT_MIN_BUY_BPS);
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
    //                       VIEW FUNCTIONS
    // ====================================================================

    function test_getOrders_rangeQuery() public {
        _makerCreateOrder(pair, sellToken0, 10e18, 20e18);
        _makerCreateOrder(pair, sellToken0, 30e18, 40e18);
        _makerCreateOrder(pair, sellToken0, 50e18, 60e18);

        OTCPair.Order[] memory all = pair.getOrders(0, 3);
        assertEq(all.length, 3);
        assertEq(all[0].sellAmount, 10e18);
        assertEq(all[1].sellAmount, 30e18);
        assertEq(all[2].sellAmount, 50e18);

        // Partial range
        OTCPair.Order[] memory slice = pair.getOrders(1, 2);
        assertEq(slice.length, 1);
        assertEq(slice[0].sellAmount, 30e18);

        // Beyond range clamps
        OTCPair.Order[] memory clamped = pair.getOrders(0, 100);
        assertEq(clamped.length, 3);

        // Empty range
        OTCPair.Order[] memory empty = pair.getOrders(5, 10);
        assertEq(empty.length, 0);
    }

    function test_getMakerOrders_pagination() public {
        _makerCreateOrder(pair, sellToken0, 10e18, 10e18);
        _makerCreateOrder(pair, sellToken0, 20e18, 20e18);
        _makerCreateOrder(pair, sellToken0, 30e18, 30e18);

        // Page 1: offset=0, limit=2
        (uint256[] memory ids1, OTCPair.Order[] memory orders1) = pair.getMakerOrders(maker, 0, 2);
        assertEq(ids1.length, 2);
        assertEq(orders1[0].sellAmount, 10e18);
        assertEq(orders1[1].sellAmount, 20e18);

        // Page 2: offset=2, limit=2
        (uint256[] memory ids2, OTCPair.Order[] memory orders2) = pair.getMakerOrders(maker, 2, 2);
        assertEq(ids2.length, 1);
        assertEq(orders2[0].sellAmount, 30e18);
    }

    function test_getActiveMakerOrders_pagination() public {
        _makerCreateOrder(pair, sellToken0, 10e18, 10e18);
        _makerCreateOrder(pair, sellToken0, 20e18, 20e18);
        _makerCreateOrder(pair, sellToken0, 30e18, 30e18);

        (uint256[] memory ids, OTCPair.Order[] memory orders) = pair.getActiveMakerOrders(maker, 1, 2);
        assertEq(ids.length, 2);
        assertEq(orders[0].sellAmount, 20e18);
        assertEq(orders[1].sellAmount, 30e18);

        // Out-of-range returns empty
        (uint256[] memory none,) = pair.getActiveMakerOrders(maker, 5, 10);
        assertEq(none.length, 0);
    }

    // ====================================================================
    //                        REENTRANCY
    // ====================================================================

    function test_fillOrder_reentrancyGuardBlocksReentry() public {
        MockReentrantToken reentrantToken = new MockReentrantToken();
        reentrantToken.mint(taker, INITIAL_BALANCE);

        // Create pair: tokenA / reentrantToken (reentrant token is the BUY token)
        factory.createPair(address(tokenA), address(reentrantToken));
        OTCPair reentrantPair = OTCPair(factory.getPair(address(tokenA), address(reentrantToken)));
        bool tokenAIsSellToken0 = reentrantPair.token0() == address(tokenA);

        // Maker creates order selling tokenA, wanting reentrantToken in return
        vm.startPrank(maker);
        tokenA.approve(address(reentrantPair), 100e18);
        reentrantPair.createOrder(tokenAIsSellToken0, 100e18, 100e18, DEFAULT_MIN_BUY_BPS);
        vm.stopPrank();

        // Arm the reentrant token: when taker transfers reentrantToken TO the pair
        // during fillOrder, the token callback tries to re-enter fillOrder for another 50e18.
        // The ReentrancyGuardTransient reverts the inner call, but the mock swallows the
        // failure, so the outer fill completes. We verify only one fill took effect.
        bytes memory attackCalldata = abi.encodeCall(OTCPair.fillOrder, (0, 50e18, MAX_BUY));
        reentrantToken.arm(address(reentrantPair), attackCalldata);

        vm.startPrank(taker);
        reentrantToken.approve(address(reentrantPair), 100e18);
        reentrantPair.fillOrder(0, 50e18, MAX_BUY);
        vm.stopPrank();

        // Verify only the legitimate fill went through (50e18), not 100e18
        OTCPair.Order memory order = reentrantPair.getOrder(0);
        assertEq(order.filledSellAmount, 50e18, "only one fill should succeed");
        assertTrue(order.status == OTCPair.OrderStatus.Active, "order should still be active");
    }

    // ====================================================================
    //                       SLIPPAGE (H-1 fix)
    // ====================================================================

    function test_fillOrder_rejectsFotBuyTokenAtZeroSlippage() public {
        // Maker posts with default 0% slippage; buy token is 1% FoT → reverts.
        MockFeeToken buy = new MockFeeToken("Fee", "FEE", 100); // 1%
        buy.mint(taker, 10_000e18);

        factory.createPair(address(tokenA), address(buy));
        OTCPair p = OTCPair(factory.getPair(address(tokenA), address(buy)));
        bool s0 = p.token0() == address(tokenA);

        vm.startPrank(maker);
        tokenA.approve(address(p), 100e18);
        p.createOrder(s0, 100e18, 100e18, DEFAULT_MIN_BUY_BPS);
        vm.stopPrank();

        vm.startPrank(taker);
        buy.approve(address(p), 100e18);
        vm.expectRevert(OTCPair.SlippageExceeded.selector);
        p.fillOrder(0, 100e18, MAX_BUY);
        vm.stopPrank();
    }

    function test_fillOrder_allowsFotBuyTokenWhenSlippageOptedIn() public {
        // Maker explicitly accepts up to 3% slippage; 1% FoT (inbound + outbound
        // → ~1.99% net) fits within budget → fill succeeds.
        MockFeeToken buy = new MockFeeToken("Fee", "FEE", 100); // 1%
        buy.mint(taker, 10_000e18);

        factory.createPair(address(tokenA), address(buy));
        OTCPair p = OTCPair(factory.getPair(address(tokenA), address(buy)));
        bool s0 = p.token0() == address(tokenA);

        uint16 minBps = 9_700; // 3% slippage allowed

        vm.startPrank(maker);
        tokenA.approve(address(p), 100e18);
        p.createOrder(s0, 100e18, 100e18, minBps);
        vm.stopPrank();

        uint256 makerBefore = buy.balanceOf(maker);

        vm.startPrank(taker);
        buy.approve(address(p), 100e18);
        p.fillOrder(0, 100e18, MAX_BUY);
        vm.stopPrank();

        uint256 delivered = buy.balanceOf(maker) - makerBefore;
        // Inbound fee 1%: pair gets 99e18; outbound 1%: maker gets 98.01e18.
        assertEq(delivered, 98.01e18, "maker receives amount net of both fees");
    }

    function test_fillOrder_hundredPercentFeeDrainsBlocked() public {
        // Regression for the H-1 POC: 100% fee buy token is blocked at 0% slippage.
        MockFeeToken buy = new MockFeeToken("Fee", "FEE", 10_000);
        buy.mint(taker, 10_000e18);

        factory.createPair(address(tokenA), address(buy));
        OTCPair p = OTCPair(factory.getPair(address(tokenA), address(buy)));
        bool s0 = p.token0() == address(tokenA);

        vm.startPrank(maker);
        tokenA.approve(address(p), 100e18);
        p.createOrder(s0, 100e18, 100e18, DEFAULT_MIN_BUY_BPS);
        vm.stopPrank();

        vm.startPrank(taker);
        buy.approve(address(p), 100e18);
        vm.expectRevert(OTCPair.SlippageExceeded.selector);
        p.fillOrder(0, 100e18, MAX_BUY);
        vm.stopPrank();

        // Maker's escrow is still intact.
        OTCPair.Order memory order = p.getOrder(0);
        assertEq(order.filledSellAmount, 0);
        assertTrue(order.status == OTCPair.OrderStatus.Active);
    }

    function test_fillOrder_eventReportsPostOutboundFotDelivered() public {
        // M-2 regression: OrderFilled.buyAmountDelivered is the actual maker
        // balance delta, not the pre-outbound-fee amount.
        MockFeeToken buy = new MockFeeToken("Fee", "FEE", 100); // 1%
        buy.mint(taker, 10_000e18);

        factory.createPair(address(tokenA), address(buy));
        OTCPair p = OTCPair(factory.getPair(address(tokenA), address(buy)));
        bool s0 = p.token0() == address(tokenA);

        vm.startPrank(maker);
        tokenA.approve(address(p), 100e18);
        p.createOrder(s0, 100e18, 100e18, 9_700);
        vm.stopPrank();

        vm.startPrank(taker);
        buy.approve(address(p), 100e18);
        // Expect event with delivered = 98.01e18 (post both fees).
        vm.expectEmit(true, true, false, true);
        emit OTCPair.OrderFilled(0, taker, 100e18, 98.01e18);
        p.fillOrder(0, 100e18, MAX_BUY);
        vm.stopPrank();
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
        pair.createOrder(sellToken0, sellAmt, buyAmt, DEFAULT_MIN_BUY_BPS);
        vm.stopPrank();

        uint256 orderId = pair.getOrderCount() - 1;

        // Fill
        vm.startPrank(taker);
        buyToken.approve(address(pair), buyAmountIn);
        pair.fillOrder(orderId, fillAmt, MAX_BUY);
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
        pair.createOrder(sellToken0, sellAmt, buyAmt, DEFAULT_MIN_BUY_BPS);
        vm.stopPrank();

        // Fill 1
        vm.startPrank(taker);
        buyToken.approve(address(pair), buyIn1 + buyIn2);
        pair.fillOrder(0, fill1, MAX_BUY);

        // Fill 2
        pair.fillOrder(0, fill2, MAX_BUY);
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
    ) public pure {
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
        feePair.createOrder(feeSellToken0, sellAmt, buyAmt, DEFAULT_MIN_BUY_BPS);
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

    function testFuzz_slippageBoundary(uint16 feeBps, uint16 minBps) public {
        // minBps must be feasible given the known inbound+outbound fee loss.
        feeBps = uint16(bound(uint256(feeBps), 1, 2_000)); // 0.01% to 20% fee per hop
        minBps = uint16(bound(uint256(minBps), 1, 10_000));

        MockFeeToken buy = new MockFeeToken("Fee", "FEE", feeBps);
        buy.mint(taker, 1_000e18);

        factory.createPair(address(tokenA), address(buy));
        OTCPair p = OTCPair(factory.getPair(address(tokenA), address(buy)));
        bool s0 = p.token0() == address(tokenA);

        vm.startPrank(maker);
        tokenA.approve(address(p), 100e18);
        p.createOrder(s0, 100e18, 100e18, minBps);
        vm.stopPrank();

        // delivered ≈ buyAmountIn * (1 - fee)^2
        uint256 buyAmountIn = 100e18;
        uint256 afterInbound = buyAmountIn - (buyAmountIn * feeBps) / 10_000;
        uint256 delivered = afterInbound - (afterInbound * feeBps) / 10_000;
        uint256 minDelivered = (buyAmountIn * minBps) / 10_000;

        vm.startPrank(taker);
        buy.approve(address(p), buyAmountIn);
        if (delivered < minDelivered) {
            vm.expectRevert(OTCPair.SlippageExceeded.selector);
            p.fillOrder(0, 100e18, MAX_BUY);
        } else {
            p.fillOrder(0, 100e18, MAX_BUY);
            OTCPair.Order memory order = p.getOrder(0);
            assertTrue(order.status == OTCPair.OrderStatus.Filled);
        }
        vm.stopPrank();
    }

    // ====================================================================
    //                      INVARIANT: BALANCE SOLVENCY
    // ====================================================================

    function test_invariant_balanceSolvency_afterOperations() public {
        // Create multiple orders, fill some, cancel some, verify balance invariant
        MockERC20 sellToken = sellToken0 ? tokenA : tokenB;

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
        pair.createOrder(sellToken0, sellAmt, buyAmt, DEFAULT_MIN_BUY_BPS);
        vm.stopPrank();

        vm.startPrank(taker);
        buyToken.approve(address(pair), buyIn);
        pair.fillOrder(0, fillAmt, MAX_BUY);
        vm.stopPrank();

        OTCPair.Order memory order = pair.getOrder(0);
        assertTrue(order.filledSellAmount <= order.sellAmount, "filled must never exceed sell");
    }

    // ====================================================================
    //                     CANCEL ORDER TO (M-1 fix)
    // ====================================================================

    function test_cancelOrderTo_sendsToRecipient() public {
        uint256 sellAmt = 100e18;
        _makerCreateOrder(pair, sellToken0, sellAmt, sellAmt);

        MockERC20 sellToken = sellToken0 ? tokenA : tokenB;
        address recipient = makeAddr("recipient");
        uint256 recipientBefore = sellToken.balanceOf(recipient);

        // Event should emit recipient, not maker
        vm.expectEmit(true, true, false, false);
        emit OTCPair.OrderCancelled(0, recipient);

        vm.prank(maker);
        pair.cancelOrderTo(0, recipient);

        assertEq(sellToken.balanceOf(recipient), recipientBefore + sellAmt);
        OTCPair.Order memory order = pair.getOrder(0);
        assertTrue(order.status == OTCPair.OrderStatus.Cancelled);
    }

    function test_cancelOrder_emitsMakerAsRecipient() public {
        _makerCreateOrder(pair, sellToken0, 100e18, 100e18);

        // Default cancelOrder should emit maker as recipient
        vm.expectEmit(true, true, false, false);
        emit OTCPair.OrderCancelled(0, maker);

        vm.prank(maker);
        pair.cancelOrder(0);
    }

    function test_cancelOrderTo_partiallyFilled() public {
        uint256 sellAmt = 100e18;
        _makerCreateOrder(pair, sellToken0, sellAmt, sellAmt);

        _takerFillOrder(pair, sellToken0, 0, 60e18, 60e18);

        address recipient = makeAddr("recipient");
        MockERC20 sellToken = sellToken0 ? tokenA : tokenB;
        uint256 recipientBefore = sellToken.balanceOf(recipient);

        vm.prank(maker);
        pair.cancelOrderTo(0, recipient);

        assertEq(sellToken.balanceOf(recipient), recipientBefore + 40e18);
    }

    function test_cancelOrderTo_revertsZeroAddress() public {
        _makerCreateOrder(pair, sellToken0, 100e18, 100e18);

        vm.expectRevert(OTCPair.ZeroAddress.selector);
        vm.prank(maker);
        pair.cancelOrderTo(0, address(0));
    }

    function test_cancelOrderTo_revertsNotMaker() public {
        _makerCreateOrder(pair, sellToken0, 100e18, 100e18);

        vm.expectRevert(OTCPair.NotMaker.selector);
        vm.prank(taker);
        pair.cancelOrderTo(0, taker);
    }

    function test_cancelOrder_stillWorksAsDefault() public {
        uint256 sellAmt = 100e18;
        _makerCreateOrder(pair, sellToken0, sellAmt, sellAmt);

        MockERC20 sellToken = sellToken0 ? tokenA : tokenB;
        uint256 makerBefore = sellToken.balanceOf(maker);

        vm.prank(maker);
        pair.cancelOrder(0);

        // Original cancelOrder still sends to maker
        assertEq(sellToken.balanceOf(maker), makerBefore + sellAmt);
    }

    // ====================================================================
    //                  OVERFLOW-SAFE MULDIV (M-2 fix)
    // ====================================================================

    function test_fillOrder_overflowSafe_largeBuyAndSellAmounts() public {
        // Values whose product exceeds uint256: ~1.15e77
        // 1e38 * 1e38 = 1e76 (fits), but 1e39 * 1e39 = 1e78 (overflows)
        // With Math.mulDiv, this should work. Without it, it reverts.
        uint256 sellAmt = 1e39;
        uint256 buyAmt = 1e39;

        MockERC20 sellToken = sellToken0 ? tokenA : tokenB;
        MockERC20 buyToken = sellToken0 ? tokenB : tokenA;
        sellToken.mint(maker, sellAmt);
        buyToken.mint(taker, buyAmt);

        vm.startPrank(maker);
        sellToken.approve(address(pair), sellAmt);
        pair.createOrder(sellToken0, sellAmt, buyAmt, DEFAULT_MIN_BUY_BPS);
        vm.stopPrank();

        // Fill the full amount — with old code this would overflow
        vm.startPrank(taker);
        buyToken.approve(address(pair), buyAmt);
        pair.fillOrder(0, sellAmt, MAX_BUY);
        vm.stopPrank();

        OTCPair.Order memory order = pair.getOrder(0);
        assertTrue(order.status == OTCPair.OrderStatus.Filled);
        assertEq(order.filledSellAmount, sellAmt);
    }

    function test_fillOrder_overflowSafe_partialFillLargeValues() public {
        // sellAmt=2, buyAmt=type(uint256).max → buyAmt * fillAmt overflows
        // without mulDiv, but the quotient is well-defined
        uint256 sellAmt = 2;
        uint256 buyAmt = type(uint256).max;
        uint256 fillAmt = 1;

        // Expected: ceil(max * 1 / 2) = (max / 2) + 1  (max is odd)
        uint256 expectedBuyIn = (buyAmt / sellAmt) + 1;

        MockERC20 sellToken = sellToken0 ? tokenA : tokenB;
        MockERC20 buyToken = sellToken0 ? tokenB : tokenA;
        sellToken.mint(maker, sellAmt);
        buyToken.mint(taker, expectedBuyIn);

        vm.startPrank(maker);
        sellToken.approve(address(pair), sellAmt);
        pair.createOrder(sellToken0, sellAmt, buyAmt, DEFAULT_MIN_BUY_BPS);
        vm.stopPrank();

        vm.startPrank(taker);
        buyToken.approve(address(pair), expectedBuyIn);
        pair.fillOrder(0, fillAmt, MAX_BUY);
        vm.stopPrank();

        OTCPair.Order memory order = pair.getOrder(0);
        assertEq(order.filledSellAmount, fillAmt);
        assertTrue(order.status == OTCPair.OrderStatus.Active);
    }
}
