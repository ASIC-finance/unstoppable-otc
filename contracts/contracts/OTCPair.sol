// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title OTCPair - Isolated order book for a single token pair
/// @notice Each pair is deployed by OTCFactory and holds only two tokens.
///         A malicious token can only affect its own pair, not the platform.
/// @dev Fee-on-transfer tokens are supported on both sides — makers pick a
///      per-order `minBuyBps` to express the minimum post-fee amount they
///      are willing to accept (default `10000` = reject any inbound/outbound
///      fee). Rebasing tokens are not supported: the escrow only tracks the
///      amount deposited, so any post-deposit supply change is unaccounted.
///
///      Reentrancy protection uses transient storage (EIP-1153). Target
///      chains must be on Cancun/Prague or later. Ethereum mainnet and
///      PulseChain both support this as of 2024.
contract OTCPair is ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    uint16 private constant BPS_DENOMINATOR = 10_000;

    enum OrderStatus { Active, Filled, Cancelled }

    /// @dev Storage layout — fields are packed into 4 slots:
    ///   slot 0: maker (20) + sellToken0 (1) + status (1) + minBuyBps (2) + 8B free
    ///   slot 1: sellAmount
    ///   slot 2: buyAmount
    ///   slot 3: filledSellAmount
    struct Order {
        address maker;
        bool sellToken0;           // true = selling token0 for token1
        OrderStatus status;
        /// @notice Minimum fraction (in bps) of `buyAmountIn` the maker
        /// must actually receive for a fill to succeed. `10000` = exact
        /// (no fee-on-transfer tolerated). Required range: `1..=10000`.
        uint16 minBuyBps;
        uint256 sellAmount;
        uint256 buyAmount;
        uint256 filledSellAmount;
    }

    address public immutable factory;
    address public immutable token0;
    address public immutable token1;

    uint256 public nextOrderId;
    mapping(uint256 => Order) public orders;

    // Pair-wide active-order index — swap-and-pop for O(1) removal.
    uint256[] private _activeOrderIds;
    mapping(uint256 => uint256) private _activeIndex;

    // Per-maker indices: full history (append-only) and active-only (mutable).
    // The active index lets the frontend fetch a maker's live orders without
    // paginating through cancelled/filled history.
    mapping(address => uint256[]) private _makerOrderIds;
    mapping(address => uint256[]) private _activeMakerOrderIds;
    mapping(uint256 => uint256) private _activeMakerIndex;

    event OrderCreated(
        uint256 indexed orderId,
        address indexed maker,
        bool sellToken0,
        uint256 sellAmount,
        uint256 buyAmount,
        uint16 minBuyBps
    );

    event OrderFilled(
        uint256 indexed orderId,
        address indexed taker,
        uint256 sellAmountOut,
        uint256 buyAmountDelivered // amount the maker's balance actually increased by
    );

    event OrderCancelled(uint256 indexed orderId, address indexed recipient);

    error ZeroAmount();
    error ZeroAddress();
    error OrderNotActive();
    error NotMaker();
    error ExceedsRemaining();
    error ExceedsMaxBuy();
    error SlippageExceeded();
    error InvalidMinBuyBps();
    error InvalidActiveIndex();

    constructor(address _token0, address _token1) {
        factory = msg.sender;
        token0 = _token0;
        token1 = _token1;
    }

    // ── Helpers ─────────────────────────────────────────────────────

    function _sellToken(bool sellToken0_) private view returns (IERC20) {
        return IERC20(sellToken0_ ? token0 : token1);
    }

    function _buyToken(bool sellToken0_) private view returns (IERC20) {
        return IERC20(sellToken0_ ? token1 : token0);
    }

    function _removeFromActive(uint256 orderId) private {
        uint256 len = _activeOrderIds.length;
        if (len == 0) revert InvalidActiveIndex();
        uint256 idx = _activeIndex[orderId];
        if (idx >= len || _activeOrderIds[idx] != orderId) revert InvalidActiveIndex();
        uint256 lastId = _activeOrderIds[len - 1];
        _activeOrderIds[idx] = lastId;
        _activeIndex[lastId] = idx;
        _activeOrderIds.pop();
        delete _activeIndex[orderId];
    }

    function _removeFromActiveMaker(address maker, uint256 orderId) private {
        uint256[] storage list = _activeMakerOrderIds[maker];
        uint256 len = list.length;
        if (len == 0) revert InvalidActiveIndex();
        uint256 idx = _activeMakerIndex[orderId];
        if (idx >= len || list[idx] != orderId) revert InvalidActiveIndex();
        uint256 lastId = list[len - 1];
        list[idx] = lastId;
        _activeMakerIndex[lastId] = idx;
        list.pop();
        delete _activeMakerIndex[orderId];
    }

    // ── Mutations ───────────────────────────────────────────────────

    /// @notice Create a new order in this pair
    /// @param sellToken0_ true = sell token0 for token1, false = sell token1 for token0
    /// @param sellAmount Amount of the sell token to deposit
    /// @param buyAmount Amount of the buy token wanted for the full order
    /// @param minBuyBps Minimum fraction of quoted `buyAmountIn` the maker will
    ///        actually accept (post fee-on-transfer), in basis points. Pass
    ///        `10000` for zero slippage (the recommended default for standard
    ///        ERC-20 buy tokens). Must be in [1, 10000].
    function createOrder(
        bool sellToken0_,
        uint256 sellAmount,
        uint256 buyAmount,
        uint16 minBuyBps
    ) external nonReentrant returns (uint256 orderId) {
        if (sellAmount == 0 || buyAmount == 0) revert ZeroAmount();
        if (minBuyBps == 0 || minBuyBps > BPS_DENOMINATOR) revert InvalidMinBuyBps();

        IERC20 sell = _sellToken(sellToken0_);

        // Fee-on-transfer: record actual received
        uint256 balBefore = sell.balanceOf(address(this));
        sell.safeTransferFrom(msg.sender, address(this), sellAmount);
        uint256 actualReceived = sell.balanceOf(address(this)) - balBefore;
        if (actualReceived == 0) revert ZeroAmount();

        orderId = nextOrderId++;
        orders[orderId] = Order({
            maker: msg.sender,
            sellToken0: sellToken0_,
            status: OrderStatus.Active,
            minBuyBps: minBuyBps,
            sellAmount: actualReceived,
            buyAmount: buyAmount,
            filledSellAmount: 0
        });

        _activeIndex[orderId] = _activeOrderIds.length;
        _activeOrderIds.push(orderId);

        _makerOrderIds[msg.sender].push(orderId);
        _activeMakerIndex[orderId] = _activeMakerOrderIds[msg.sender].length;
        _activeMakerOrderIds[msg.sender].push(orderId);

        emit OrderCreated(orderId, msg.sender, sellToken0_, actualReceived, buyAmount, minBuyBps);
    }

    /// @notice Fill an order (fully or partially)
    /// @param orderId The order to fill
    /// @param sellAmountOut How much of the sell token the taker wants
    /// @param maxBuyAmountIn Revert if the ceiling-rounded cost exceeds this.
    ///        Passing the exact quoted cost locks the price. Use `type(uint256).max`
    ///        to accept any price (rare — almost never correct for a UI).
    function fillOrder(
        uint256 orderId,
        uint256 sellAmountOut,
        uint256 maxBuyAmountIn
    ) external nonReentrant {
        Order storage order = orders[orderId];

        if (order.status != OrderStatus.Active) revert OrderNotActive();
        if (sellAmountOut == 0) revert ZeroAmount();

        uint256 remaining = order.sellAmount - order.filledSellAmount;
        if (sellAmountOut > remaining) revert ExceedsRemaining();

        // Round UP to protect maker's price (overflow-safe via 512-bit intermediate).
        // Invariant: with sellAmountOut >= 1, buyAmount >= 1, sellAmount >= 1, the
        // result is always >= 1 — no ZeroCost check needed.
        uint256 buyAmountIn = Math.mulDiv(
            order.buyAmount, sellAmountOut, order.sellAmount, Math.Rounding.Ceil
        );
        if (buyAmountIn > maxBuyAmountIn) revert ExceedsMaxBuy();

        // Effects before interactions
        order.filledSellAmount += sellAmountOut;
        if (order.filledSellAmount == order.sellAmount) {
            order.status = OrderStatus.Filled;
            _removeFromActive(orderId);
            _removeFromActiveMaker(order.maker, orderId);
        }

        IERC20 buy = _buyToken(order.sellToken0);
        IERC20 sell = _sellToken(order.sellToken0);

        // Receive buy tokens from taker (fee-on-transfer safe).
        uint256 pairBefore = buy.balanceOf(address(this));
        buy.safeTransferFrom(msg.sender, address(this), buyAmountIn);
        uint256 actualBuyReceived = buy.balanceOf(address(this)) - pairBefore;

        // Forward to maker and measure real balance delta — this captures
        // outbound fee-on-transfer losses too, so `delivered` is exactly
        // what the maker's balance increased by.
        uint256 makerBefore = buy.balanceOf(order.maker);
        buy.safeTransfer(order.maker, actualBuyReceived);
        uint256 delivered = buy.balanceOf(order.maker) - makerBefore;

        // Slippage gate — measured post-all-fees. `delivered` must be at
        // least the maker-chosen fraction of what the taker was quoted to pay.
        uint256 minDelivered = Math.mulDiv(buyAmountIn, order.minBuyBps, BPS_DENOMINATOR);
        if (delivered < minDelivered) revert SlippageExceeded();

        sell.safeTransfer(msg.sender, sellAmountOut);

        emit OrderFilled(orderId, msg.sender, sellAmountOut, delivered);
    }

    /// @notice Cancel an active order and refund remaining tokens to the maker
    function cancelOrder(uint256 orderId) external nonReentrant {
        _cancelTo(orderId, address(0));
    }

    /// @notice Cancel an active order and send remaining tokens to `recipient`
    /// @dev Allows maker to rescue funds when their address is blocklisted by the sell token
    function cancelOrderTo(uint256 orderId, address recipient) external nonReentrant {
        if (recipient == address(0)) revert ZeroAddress();
        _cancelTo(orderId, recipient);
    }

    function _cancelTo(uint256 orderId, address recipient) private {
        Order storage order = orders[orderId];

        if (order.status != OrderStatus.Active) revert OrderNotActive();
        if (msg.sender != order.maker) revert NotMaker();

        order.status = OrderStatus.Cancelled;
        _removeFromActive(orderId);
        _removeFromActiveMaker(order.maker, orderId);

        address to = recipient == address(0) ? order.maker : recipient;
        uint256 refund = order.sellAmount - order.filledSellAmount;
        if (refund > 0) {
            _sellToken(order.sellToken0).safeTransfer(to, refund);
        }

        emit OrderCancelled(orderId, to);
    }

    // ── Views ───────────────────────────────────────────────────────

    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }

    function getOrderCount() external view returns (uint256) {
        return nextOrderId;
    }

    function getOrders(uint256 fromId, uint256 toId) external view returns (Order[] memory) {
        if (toId > nextOrderId) toId = nextOrderId;
        if (fromId >= toId) return new Order[](0);
        Order[] memory result = new Order[](toId - fromId);
        for (uint256 i = fromId; i < toId; i++) {
            result[i - fromId] = orders[i];
        }
        return result;
    }

    function getActiveOrderCount() external view returns (uint256) {
        return _activeOrderIds.length;
    }

    function getActiveOrders(uint256 offset, uint256 limit)
        external view
        returns (uint256[] memory ids, Order[] memory result)
    {
        uint256 total = _activeOrderIds.length;
        if (offset >= total) return (new uint256[](0), new Order[](0));
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;
        ids = new uint256[](count);
        result = new Order[](count);
        for (uint256 i = 0; i < count; i++) {
            uint256 oid = _activeOrderIds[offset + i];
            ids[i] = oid;
            result[i] = orders[oid];
        }
    }

    /// @notice Total number of orders ever created by `maker` (active + historical).
    function getMakerOrderCount(address maker) external view returns (uint256) {
        return _makerOrderIds[maker].length;
    }

    /// @notice Paginated window over a maker's full order history (active + historical).
    function getMakerOrders(address maker, uint256 offset, uint256 limit)
        external view
        returns (uint256[] memory ids, Order[] memory result)
    {
        uint256 total = _makerOrderIds[maker].length;
        if (offset >= total) return (new uint256[](0), new Order[](0));
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;
        ids = new uint256[](count);
        result = new Order[](count);
        for (uint256 i = 0; i < count; i++) {
            uint256 oid = _makerOrderIds[maker][offset + i];
            ids[i] = oid;
            result[i] = orders[oid];
        }
    }

    /// @notice Count of currently-active orders created by `maker`. Cheap to
    /// read — the frontend can use this to know how many pages to fetch.
    function getActiveMakerOrderCount(address maker) external view returns (uint256) {
        return _activeMakerOrderIds[maker].length;
    }

    /// @notice Paginated window over a maker's currently-active orders only.
    /// Use this for the "My open orders" view to avoid paginating through
    /// cancelled/filled history.
    function getActiveMakerOrders(address maker, uint256 offset, uint256 limit)
        external view
        returns (uint256[] memory ids, Order[] memory result)
    {
        uint256[] storage list = _activeMakerOrderIds[maker];
        uint256 total = list.length;
        if (offset >= total) return (new uint256[](0), new Order[](0));
        uint256 end = offset + limit;
        if (end > total) end = total;
        uint256 count = end - offset;
        ids = new uint256[](count);
        result = new Order[](count);
        for (uint256 i = 0; i < count; i++) {
            uint256 oid = list[offset + i];
            ids[i] = oid;
            result[i] = orders[oid];
        }
    }
}
