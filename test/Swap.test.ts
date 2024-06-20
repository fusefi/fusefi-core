import { network } from "hardhat"
import { expect } from "chai"
import { prepare, deploy, getBigNumber, createSLP } from "./utilities"

describe("Swap", function () {
    before(async function () {
        await prepare(this, ["Swap", "ERC20Mock", "UniswapV2Factory", "UniswapV2Pair"])
    })

    beforeEach(async function () {
        await deploy(this, [
            ["volt", this.ERC20Mock, ["VOLT", "VOLT", getBigNumber("100000")]],
            ["dai", this.ERC20Mock, ["DAI", "DAI", getBigNumber("10000000")]],
            ["usdc", this.ERC20Mock, ["USDC", "USDC", getBigNumber("100000")]],
            ["weth", this.ERC20Mock, ["WETH", "ETH", getBigNumber("100000")]],
            ["factory", this.UniswapV2Factory, [this.alice.address]],
        ])

        await deploy(this, [["swap", this.Swap, [this.factory.address]]])

        await createSLP(this, "voltEth", this.volt, this.weth, getBigNumber(100))
        await createSLP(this, "daiUSDC", this.dai, this.usdc, getBigNumber(100))
    })

    describe("getAmountOut", function () {
        it("should return output amount", async function () {
            const amountOut = await this.swap.getAmountOut(this.volt.address, this.weth.address, getBigNumber(1))
            expect(amountOut).to.equal('987158034397061298')
        })
    })

    describe("swapToken", function () {
        it("should swap from volt to weth", async function () {
            await this.volt.approve(this.swap.address, getBigNumber('1'))
            await this.swap.swapToken(this.volt.address, this.weth.address, getBigNumber('1'), this.bob.address)
            expect(await this.weth.balanceOf(this.bob.address)).to.equal('987158034397061298')
        })
    })
})
