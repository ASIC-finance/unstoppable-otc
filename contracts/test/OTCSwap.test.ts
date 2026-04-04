import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("OTCFactory + OTCPair", function () {
  async function deployFixture() {
    const [maker, taker, other] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("OTCFactory");
    const factory = await Factory.deploy();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const tokenA = await MockERC20.deploy("Token A", "TKA", 18);
    const tokenB = await MockERC20.deploy("Token B", "TKB", 18);

    const MockFeeToken = await ethers.getContractFactory("MockFeeToken");
    const feeToken = await MockFeeToken.deploy("Fee Token", "FEE", 100); // 1% fee

    // Mint tokens
    const amount = ethers.parseEther("1000");
    await tokenA.mint(maker.address, amount);
    await tokenB.mint(taker.address, amount);
    await feeToken.mint(maker.address, amount);
    await feeToken.mint(taker.address, amount);

    return { factory, tokenA, tokenB, feeToken, maker, taker, other };
  }

  async function deployWithPairFixture() {
    const base = await deployFixture();
    const { factory, tokenA, tokenB } = base;

    await factory.createPair(tokenA.target, tokenB.target);
    const pairAddr = await factory.getPair(tokenA.target, tokenB.target);
    const pair = await ethers.getContractAt("OTCPair", pairAddr);

    // Determine direction: is tokenA == token0?
    const token0 = await pair.token0();
    const sellToken0 = token0.toLowerCase() === String(tokenA.target).toLowerCase();

    return { ...base, pair, pairAddr, sellToken0 };
  }

  // ── Factory ────────────────────────────────────────────────────

  describe("OTCFactory", function () {
    it("should create a pair and emit event", async function () {
      const { factory, tokenA, tokenB } = await loadFixture(deployFixture);

      await expect(factory.createPair(tokenA.target, tokenB.target))
        .to.emit(factory, "PairCreated");

      const pairAddr = await factory.getPair(tokenA.target, tokenB.target);
      expect(pairAddr).to.not.equal(ethers.ZeroAddress);

      // Both directions resolve to the same pair
      const pairAddrReverse = await factory.getPair(tokenB.target, tokenA.target);
      expect(pairAddrReverse).to.equal(pairAddr);

      expect(await factory.allPairsLength()).to.equal(1);
    });

    it("should revert on identical tokens", async function () {
      const { factory, tokenA } = await loadFixture(deployFixture);
      await expect(
        factory.createPair(tokenA.target, tokenA.target)
      ).to.be.revertedWithCustomError(factory, "IdenticalTokens");
    });

    it("should revert on zero address", async function () {
      const { factory, tokenA } = await loadFixture(deployFixture);
      await expect(
        factory.createPair(ethers.ZeroAddress, tokenA.target)
      ).to.be.revertedWithCustomError(factory, "ZeroAddress");
    });

    it("should revert on duplicate pair", async function () {
      const { factory, tokenA, tokenB } = await loadFixture(deployFixture);
      await factory.createPair(tokenA.target, tokenB.target);
      await expect(
        factory.createPair(tokenA.target, tokenB.target)
      ).to.be.revertedWithCustomError(factory, "PairExists");
      // Reverse order also fails
      await expect(
        factory.createPair(tokenB.target, tokenA.target)
      ).to.be.revertedWithCustomError(factory, "PairExists");
    });

    it("should sort tokens so token0 < token1", async function () {
      const { factory, tokenA, tokenB } = await loadFixture(deployFixture);
      await factory.createPair(tokenA.target, tokenB.target);
      const pairAddr = await factory.getPair(tokenA.target, tokenB.target);
      const pair = await ethers.getContractAt("OTCPair", pairAddr);

      const t0 = await pair.token0();
      const t1 = await pair.token1();
      expect(BigInt(t0)).to.be.lessThan(BigInt(t1));
    });

    it("should paginate pairs", async function () {
      const { factory, maker } = await loadFixture(deployFixture);
      const MockERC20 = await ethers.getContractFactory("MockERC20");

      // Create 3 distinct pairs
      const tokens = [];
      for (let i = 0; i < 4; i++) {
        const t = await MockERC20.deploy(`T${i}`, `T${i}`, 18);
        tokens.push(t);
      }
      await factory.createPair(tokens[0].target, tokens[1].target);
      await factory.createPair(tokens[0].target, tokens[2].target);
      await factory.createPair(tokens[0].target, tokens[3].target);

      expect(await factory.allPairsLength()).to.equal(3);

      const page1 = await factory.getPairs(0, 2);
      expect(page1.length).to.equal(2);

      const page2 = await factory.getPairs(2, 2);
      expect(page2.length).to.equal(1);
    });

    it("should set factory and tokens as immutables on pair", async function () {
      const { factory, tokenA, tokenB } = await loadFixture(deployFixture);
      await factory.createPair(tokenA.target, tokenB.target);
      const pairAddr = await factory.getPair(tokenA.target, tokenB.target);
      const pair = await ethers.getContractAt("OTCPair", pairAddr);

      expect(await pair.factory()).to.equal(factory.target);
    });
  });

  // ── Pair: createOrder ─────────────────────────────────────────

  describe("OTCPair.createOrder", function () {
    it("should create an order and escrow tokens", async function () {
      const { pair, tokenA, tokenB, maker, sellToken0 } = await loadFixture(deployWithPairFixture);
      const sellAmount = ethers.parseEther("100");
      const buyAmount = ethers.parseEther("200");

      await tokenA.connect(maker).approve(pair.target, sellAmount);

      await expect(pair.connect(maker).createOrder(sellToken0, sellAmount, buyAmount))
        .to.emit(pair, "OrderCreated")
        .withArgs(0, maker.address, sellToken0, sellAmount, buyAmount);

      const order = await pair.getOrder(0);
      expect(order.maker).to.equal(maker.address);
      expect(order.sellToken0).to.equal(sellToken0);
      expect(order.sellAmount).to.equal(sellAmount);
      expect(order.buyAmount).to.equal(buyAmount);
      expect(order.status).to.equal(0); // Active
    });

    it("should handle fee-on-transfer tokens", async function () {
      const { factory, feeToken, tokenB, maker } = await loadFixture(deployFixture);
      await factory.createPair(feeToken.target, tokenB.target);
      const pairAddr = await factory.getPair(feeToken.target, tokenB.target);
      const pair = await ethers.getContractAt("OTCPair", pairAddr);

      const token0 = await pair.token0();
      const sellToken0 = token0.toLowerCase() === String(feeToken.target).toLowerCase();

      const sellAmount = ethers.parseEther("100");
      await feeToken.connect(maker).approve(pair.target, sellAmount);
      await pair.connect(maker).createOrder(sellToken0, sellAmount, ethers.parseEther("200"));

      const order = await pair.getOrder(0);
      // 1% fee: actual received = 99
      expect(order.sellAmount).to.equal(ethers.parseEther("99"));
    });

    it("should revert on zero amounts", async function () {
      const { pair, maker } = await loadFixture(deployWithPairFixture);
      await expect(
        pair.connect(maker).createOrder(true, 0, 100)
      ).to.be.revertedWithCustomError(pair, "ZeroAmount");
      await expect(
        pair.connect(maker).createOrder(true, 100, 0)
      ).to.be.revertedWithCustomError(pair, "ZeroAmount");
    });
  });

  // ── Pair: fillOrder ───────────────────────────────────────────

  describe("OTCPair.fillOrder", function () {
    it("should fill an order fully", async function () {
      const { pair, tokenA, tokenB, maker, taker, sellToken0 } = await loadFixture(deployWithPairFixture);
      const sellAmount = ethers.parseEther("100");
      const buyAmount = ethers.parseEther("200");

      await tokenA.connect(maker).approve(pair.target, sellAmount);
      await pair.connect(maker).createOrder(sellToken0, sellAmount, buyAmount);

      await tokenB.connect(taker).approve(pair.target, buyAmount);

      const makerBal = await tokenB.balanceOf(maker.address);
      const takerBal = await tokenA.balanceOf(taker.address);

      await expect(pair.connect(taker).fillOrder(0, sellAmount))
        .to.emit(pair, "OrderFilled")
        .withArgs(0, taker.address, sellAmount, buyAmount);

      expect(await tokenB.balanceOf(maker.address)).to.equal(makerBal + buyAmount);
      expect(await tokenA.balanceOf(taker.address)).to.equal(takerBal + sellAmount);

      const order = await pair.getOrder(0);
      expect(order.status).to.equal(1); // Filled
    });

    it("should fill partially", async function () {
      const { pair, tokenA, tokenB, maker, taker, sellToken0 } = await loadFixture(deployWithPairFixture);
      const sellAmount = ethers.parseEther("100");
      const buyAmount = ethers.parseEther("200");

      await tokenA.connect(maker).approve(pair.target, sellAmount);
      await pair.connect(maker).createOrder(sellToken0, sellAmount, buyAmount);

      const fillSell = ethers.parseEther("50");
      const expectedBuy = ethers.parseEther("100");
      await tokenB.connect(taker).approve(pair.target, expectedBuy);

      await pair.connect(taker).fillOrder(0, fillSell);

      const order = await pair.getOrder(0);
      expect(order.status).to.equal(0); // Still Active
      expect(order.filledSellAmount).to.equal(fillSell);
    });

    it("should allow multiple partial fills", async function () {
      const { pair, tokenA, tokenB, maker, taker, other, sellToken0 } = await loadFixture(deployWithPairFixture);
      const sellAmount = ethers.parseEther("100");
      const buyAmount = ethers.parseEther("200");

      await tokenA.connect(maker).approve(pair.target, sellAmount);
      await pair.connect(maker).createOrder(sellToken0, sellAmount, buyAmount);

      await tokenB.connect(taker).approve(pair.target, ethers.parseEther("120"));
      await pair.connect(taker).fillOrder(0, ethers.parseEther("60"));

      await tokenB.mint(other.address, ethers.parseEther("1000"));
      await tokenB.connect(other).approve(pair.target, ethers.parseEther("80"));
      await pair.connect(other).fillOrder(0, ethers.parseEther("40"));

      const order = await pair.getOrder(0);
      expect(order.status).to.equal(1); // Filled
    });

    it("should revert when not active", async function () {
      const { pair, tokenA, tokenB, maker, taker, sellToken0 } = await loadFixture(deployWithPairFixture);
      await tokenA.connect(maker).approve(pair.target, ethers.parseEther("100"));
      await pair.connect(maker).createOrder(sellToken0, ethers.parseEther("100"), ethers.parseEther("100"));
      await pair.connect(maker).cancelOrder(0);

      await expect(
        pair.connect(taker).fillOrder(0, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(pair, "OrderNotActive");
    });

    it("should revert on zero fill", async function () {
      const { pair, tokenA, maker, taker, sellToken0 } = await loadFixture(deployWithPairFixture);
      await tokenA.connect(maker).approve(pair.target, 100n);
      await pair.connect(maker).createOrder(sellToken0, 100, 100);
      await expect(pair.connect(taker).fillOrder(0, 0))
        .to.be.revertedWithCustomError(pair, "ZeroAmount");
    });

    it("should revert when exceeding remaining", async function () {
      const { pair, tokenA, maker, taker, sellToken0 } = await loadFixture(deployWithPairFixture);
      await tokenA.connect(maker).approve(pair.target, ethers.parseEther("100"));
      await pair.connect(maker).createOrder(sellToken0, ethers.parseEther("100"), ethers.parseEther("100"));
      await expect(
        pair.connect(taker).fillOrder(0, ethers.parseEther("100") + 1n)
      ).to.be.revertedWithCustomError(pair, "ExceedsRemaining");
    });

    it("should round up buyAmountIn to protect maker", async function () {
      const { pair, tokenA, tokenB, maker, taker, sellToken0 } = await loadFixture(deployWithPairFixture);
      // sell=100, buy=99. Partial fill of 50: ceil(99*50/100)=50 not 49
      await tokenA.mint(maker.address, 100n);
      await tokenA.connect(maker).approve(pair.target, 100n);
      await pair.connect(maker).createOrder(sellToken0, 100, 99);

      await tokenB.mint(taker.address, 99n);
      await tokenB.connect(taker).approve(pair.target, 99n);
      await expect(pair.connect(taker).fillOrder(0, 50))
        .to.emit(pair, "OrderFilled")
        .withArgs(0, taker.address, 50, 50); // 50 not 49
    });
  });

  // ── Pair: cancelOrder ─────────────────────────────────────────

  describe("OTCPair.cancelOrder", function () {
    it("should cancel and refund", async function () {
      const { pair, tokenA, tokenB, maker, sellToken0 } = await loadFixture(deployWithPairFixture);
      const sellAmount = ethers.parseEther("100");
      await tokenA.connect(maker).approve(pair.target, sellAmount);
      await pair.connect(maker).createOrder(sellToken0, sellAmount, sellAmount);

      const bal = await tokenA.balanceOf(maker.address);
      await expect(pair.connect(maker).cancelOrder(0))
        .to.emit(pair, "OrderCancelled").withArgs(0);
      expect(await tokenA.balanceOf(maker.address)).to.equal(bal + sellAmount);
    });

    it("should cancel partially filled and refund remaining", async function () {
      const { pair, tokenA, tokenB, maker, taker, sellToken0 } = await loadFixture(deployWithPairFixture);
      await tokenA.connect(maker).approve(pair.target, ethers.parseEther("100"));
      await pair.connect(maker).createOrder(sellToken0, ethers.parseEther("100"), ethers.parseEther("100"));

      await tokenB.connect(taker).approve(pair.target, ethers.parseEther("50"));
      await pair.connect(taker).fillOrder(0, ethers.parseEther("50"));

      const bal = await tokenA.balanceOf(maker.address);
      await pair.connect(maker).cancelOrder(0);
      expect(await tokenA.balanceOf(maker.address)).to.equal(bal + ethers.parseEther("50"));
    });

    it("should revert if not maker", async function () {
      const { pair, tokenA, maker, taker, sellToken0 } = await loadFixture(deployWithPairFixture);
      await tokenA.connect(maker).approve(pair.target, ethers.parseEther("100"));
      await pair.connect(maker).createOrder(sellToken0, ethers.parseEther("100"), ethers.parseEther("100"));
      await expect(pair.connect(taker).cancelOrder(0))
        .to.be.revertedWithCustomError(pair, "NotMaker");
    });
  });

  // ── Pair: indexed queries ─────────────────────────────────────

  describe("OTCPair.indexedQueries", function () {
    it("should track active orders across fill and cancel", async function () {
      const { pair, tokenA, tokenB, maker, taker, sellToken0 } = await loadFixture(deployWithPairFixture);
      const amt = ethers.parseEther("10");
      await tokenA.connect(maker).approve(pair.target, amt * 3n);

      await pair.connect(maker).createOrder(sellToken0, amt, amt);
      await pair.connect(maker).createOrder(sellToken0, amt, amt);
      await pair.connect(maker).createOrder(sellToken0, amt, amt);
      expect(await pair.getActiveOrderCount()).to.equal(3);

      // Fill order 1
      await tokenB.connect(taker).approve(pair.target, amt);
      await pair.connect(taker).fillOrder(1, amt);
      expect(await pair.getActiveOrderCount()).to.equal(2);

      // Cancel order 0
      await pair.connect(maker).cancelOrder(0);
      expect(await pair.getActiveOrderCount()).to.equal(1);

      const [ids] = await pair.getActiveOrders(0, 10);
      expect(ids.length).to.equal(1);
      expect(ids[0]).to.equal(2);
    });

    it("should track maker orders", async function () {
      const { pair, tokenA, tokenB, maker, taker, sellToken0 } = await loadFixture(deployWithPairFixture);
      const amt = ethers.parseEther("10");
      await tokenA.connect(maker).approve(pair.target, amt * 2n);
      await tokenB.connect(taker).approve(pair.target, amt);

      await pair.connect(maker).createOrder(sellToken0, amt, amt);
      await pair.connect(taker).createOrder(!sellToken0, amt, amt);
      await pair.connect(maker).createOrder(sellToken0, amt, amt);

      expect(await pair.getMakerOrderCount(maker.address)).to.equal(2);
      expect(await pair.getMakerOrderCount(taker.address)).to.equal(1);
    });
  });

  // ── Isolation ─────────────────────────────────────────────────

  describe("Pair isolation", function () {
    it("should keep pairs completely separate", async function () {
      const { factory, tokenA, tokenB, maker, taker } = await loadFixture(deployFixture);

      const MockERC20 = await ethers.getContractFactory("MockERC20");
      const tokenC = await MockERC20.deploy("Token C", "TKC", 18);
      await tokenC.mint(maker.address, ethers.parseEther("1000"));

      // Create two pairs
      await factory.createPair(tokenA.target, tokenB.target);
      await factory.createPair(tokenA.target, tokenC.target);

      const pair1 = await ethers.getContractAt("OTCPair", await factory.getPair(tokenA.target, tokenB.target));
      const pair2 = await ethers.getContractAt("OTCPair", await factory.getPair(tokenA.target, tokenC.target));

      const t0_1 = await pair1.token0();
      const sell0_1 = t0_1.toLowerCase() === String(tokenA.target).toLowerCase();
      const t0_2 = await pair2.token0();
      const sell0_2 = t0_2.toLowerCase() === String(tokenA.target).toLowerCase();

      // Deposit into pair 1
      await tokenA.connect(maker).approve(pair1.target, ethers.parseEther("100"));
      await pair1.connect(maker).createOrder(sell0_1, ethers.parseEther("100"), ethers.parseEther("100"));

      // Deposit into pair 2
      await tokenA.connect(maker).approve(pair2.target, ethers.parseEther("200"));
      await pair2.connect(maker).createOrder(sell0_2, ethers.parseEther("200"), ethers.parseEther("200"));

      // Pair 1 holds 100 tokenA, pair 2 holds 200 tokenA — fully isolated
      expect(await tokenA.balanceOf(pair1.target)).to.equal(ethers.parseEther("100"));
      expect(await tokenA.balanceOf(pair2.target)).to.equal(ethers.parseEther("200"));

      // Cancel pair 1 doesn't affect pair 2
      await pair1.connect(maker).cancelOrder(0);
      expect(await tokenA.balanceOf(pair2.target)).to.equal(ethers.parseEther("200"));
      expect(await pair2.getActiveOrderCount()).to.equal(1);
    });
  });
});
