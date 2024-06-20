/* eslint-disable @typescript-eslint/dot-notation */
/* eslint-disable no-await-in-loop */
/* eslint-disable @typescript-eslint/naming-convention */

import { Contract, ContractFactory } from "@ethersproject/contracts"
import { expect } from "chai"
const chai = require("chai")
import { ethers } from "hardhat"
import { solidity } from "ethereum-waffle"
import { assertBNClosePercent } from "./utilities/assertions"
import { advanceBlock, getTimestamp, increaseTime, increaseTimeTo, latestBlock } from "./utilities/time"
import { BN, simpleToExactAmount, maximum } from "./utilities/math"
import { StandardAccounts } from "./utilities/machines"
import { ONE_WEEK, ONE_HOUR, ONE_DAY, ONE_YEAR, DEFAULT_DECIMALS, ZERO_ADDRESS, USDC_OWNER_ADDRESS } from "./utilities/constants"
import { Account } from "./utilities/types"
import { Address } from "hardhat-deploy/dist/types"
import { first } from "underscore"
import { assert } from "console"

chai.use(solidity)

describe("VotingEscrow", () => {
  let VoltToken: ContractFactory,
    VotingEscrow: ContractFactory,
    PenaltyHandler: ContractFactory,
    MCV2: ContractFactory,
    MCV3: ContractFactory,
    GP: ContractFactory,
    RewardPool: ContractFactory,
    ERC20: ContractFactory

  let mta: Contract,
    votingLockup: Contract,
    penaltyHandler: Contract,
    mcv2: Contract,
    mcv3: Contract,
    gp: Contract,
    rewardPool: Contract,
    mcv3Tokens: Contract[],
    mcv3Dummy: Contract,
    gpDummy: Contract,
    gpTokens: Contract[],
    gpAddys: Address[],
    gauges: Contract[],
    boss: Account,
    sa: StandardAccounts

  let mcv2VoltEmission: BN, gpVoltEmission: BN, mcv3VoltEmission: BN, gpLastCollectTS: BN

  let users: Account[]

  before("Init contract", async () => {
    await deployFresh()
  })

  const goToNextUnixWeekStart = async () => {
    const unixWeekCount = (await getTimestamp()).div(ONE_WEEK)
    const nextUnixWeek = unixWeekCount.add(1).mul(ONE_WEEK)
    await increaseTimeTo(nextUnixWeek)
  }

  const deployFresh = async () => {
    const accounts = await ethers.getSigners()
    sa = await new StandardAccounts().initAccounts(accounts)

    users = [sa.dummy1, sa.dummy2, sa.dummy3, sa.dummy4, sa.dummy5, sa.dummy6, sa.dummy7]
    boss = sa.fundManager
    sa.default = boss
    // Deploy VOLT
    VoltToken = await ethers.getContractFactory("VoltToken", boss.signer)
    mta = await VoltToken.deploy()
    await mta.deployed()

    // Mint 1e9 VOLT to deployer and users
    await mta.connect(boss.signer).mint(boss.address, simpleToExactAmount(1e9, DEFAULT_DECIMALS))
    for (let i = 0; i < users.length; i++) await mta.connect(boss.signer).mint(users[i].address, simpleToExactAmount(1e9, DEFAULT_DECIMALS))

    // Deploy MCV2
    MCV2 = await ethers.getContractFactory("MasterChefVoltV2", boss.signer)
    mcv2 = await MCV2.deploy(mta.address, boss.address, boss.address, boss.address, "19555097552900000000", await getTimestamp(), "0", "0", "0")
    await mcv2.deployed()

    // Deploy Dummy ERC20 token
    ERC20 = await ethers.getContractFactory("ERC20Mock", boss.signer)
    mcv3Dummy = await ERC20.deploy("MCV3 Dummy Token", "MCV3DUM", 1)
    await mcv3Dummy.deployed()

    // Deploy MCV3
    MCV3 = await ethers.getContractFactory("MasterChefVoltV3")
    mcv3 = await MCV3.connect(boss.signer).deploy(mcv2.address, mta.address, 0)
    await mcv3.deployed()

    // Add MCV3 Dummy token to MCV2
    await mcv2.connect(boss.signer).add(100, mcv3Dummy.address, ZERO_ADDRESS)

    // MCV3.init(mcv3Dummy.address)
    await mcv3Dummy.approve(mcv3.address, "1")
    await mcv3.connect(boss.signer).init(mcv3Dummy.address)

    // Deploy PenaltyHandler
    PenaltyHandler = await ethers.getContractFactory("PenaltyHandler")
    penaltyHandler = await PenaltyHandler.deploy(boss.address, "70", mta.address)
    await penaltyHandler.deployed()

    // Deploy veVOLT
    VotingEscrow = await ethers.getContractFactory("VotingEscrow")
    votingLockup = await VotingEscrow.deploy(mta.address, "Vote Escrow Volt", "veVOLT", boss.address, penaltyHandler.address)
    await votingLockup.deployed()

    // Deploy RewardPool
    RewardPool = await ethers.getContractFactory("RewardPool")
    rewardPool = await RewardPool.deploy(votingLockup.address, await getTimestamp(), mta.address, boss.address, boss.address)
    await rewardPool.deployed()

    // Stake veVOLT
    for (let i = 1; i < users.length; i++) {
      let _amount = Math.pow(10, i)
      await mta.connect(users[i].signer).approve(votingLockup.address, simpleToExactAmount(_amount, DEFAULT_DECIMALS))
      await votingLockup
        .connect(users[i].signer)
        .create_lock(simpleToExactAmount(_amount, DEFAULT_DECIMALS), (await getTimestamp()).add(9010285 * (i + 1)))
    }

    // Transfer VOLT ownership to MCV2
    await mta.connect(boss.signer).transferOwnership(mcv2.address)

    // Deploy GP
    GP = await ethers.getContractFactory("GaugeProxy")
    gp = await GP.connect(boss.signer).deploy(boss.address, mta.address, votingLockup.address, mcv2.address)
    await gp.deployed()
    gpDummy = await ethers.getContractAt("ERC20Mock", await gp.TOKEN())

    // Add GP Dummy token to MCV2
    await mcv2.connect(boss.signer).add(100, gpDummy.address, ZERO_ADDRESS)
    await gp.connect(boss.signer).setPID(1)
    await gp.deposit()
    gpLastCollectTS = await getTimestamp()

    // Deploy 3 LP tokens for MCV3
    mcv3Tokens = []
    for (let i = 0; i < 3; i++) {
      let tmpToken = await ERC20.deploy(`MCV3 lp Token ${i}`, `MCV3-LP-${i}`, simpleToExactAmount(1e9, DEFAULT_DECIMALS))
      await tmpToken.deployed()
      await mcv3.connect(boss.signer).add(100, tmpToken.address, ZERO_ADDRESS)
      mcv3Tokens.push(tmpToken)
    }

    // Deploy 3 LP tokens for GP
    gpTokens = []
    gauges = []
    for (let i = 0; i < 3; i++) {
      let tmpToken = await ERC20.deploy(`GP lp Token ${i}`, `GP-LP-${i}`, simpleToExactAmount(1e9, DEFAULT_DECIMALS))
      await tmpToken.deployed()
      await gp.connect(boss.signer).addGauge(tmpToken.address)
      gauges.push(await ethers.getContractAt("Gauge", await gp.gauges(tmpToken.address)))
      gpTokens.push(tmpToken)
    }

    // Transfer some LP Tokens to each of users
    for (let i = 0; i < 6; i++) {
      let tmpToken = [...gpTokens, ...mcv3Tokens][i]
      for (let j = 0; j < users.length; j++)
        await tmpToken.connect(boss.signer).transfer(users[j].address, simpleToExactAmount(1000, DEFAULT_DECIMALS))
    }

    mcv2VoltEmission = await mcv2.voltPerSec()
    mcv3VoltEmission = mcv2VoltEmission.div(2)
    gpVoltEmission = mcv3VoltEmission
    gpAddys = gpTokens.map((token) => token.address)
  }

  describe("GaugeProxy", () => {
    before(async () => {
      await deployFresh()
    })

    it("Config sanity checks", async () => {
      const _gaugeTokens = await gp.tokens()
      const _gauges = await Promise.all(
        _gaugeTokens.map(async (_token) => {
          return await gp.gauges(_token)
        })
      )
      expect(await gp.TOKEN()).eq(gpDummy.address)
      expect(await gp.VEVOLT()).eq(votingLockup.address)
      expect(await gp.VOLT()).eq(mta.address)
      expect(await gp.MASTER()).eq(mcv2.address)
      expect(await gp.TREASURY()).eq(boss.address)
      expect(await gp.pid()).eq(1)

      let gpInfo = await mcv2.poolInfo(1)
      expect(gpInfo.lpToken).eq(gpDummy.address)

      expect(_gaugeTokens.length).eq(3)
      for (let i = 0; i < 3; i++) {
        expect(_gaugeTokens[i]).eq(gpTokens[i].address)
        expect(_gauges[i]).eq(gauges[i].address)
      }
      expect(await gp.totalWeight()).eq(0)
    })
    it("Should be able to collect from MCV2", async () => {
      const prevCollect = gpLastCollectTS
      const gpBalanceBefore = await mta.balanceOf(gp.address)
      await gp.collect()
      const gpBalanceAfter = await mta.balanceOf(gp.address)
      gpLastCollectTS = await getTimestamp()

      assertBNClosePercent(gpBalanceAfter.sub(gpBalanceBefore), gpLastCollectTS.sub(prevCollect).mul(gpVoltEmission), "0.04")
    })
    it("Should reflect weight changes on gauges after voting", async () => {
      await gp.connect(users[0].signer).vote(gpAddys, [10000000, 10000000, 20000000])
      expect(await gp.weights(gpAddys[2])).eq(0) // Because user0 has no veVOLT

      await gp.connect(users[1].signer).vote(gpAddys, [1000000000, 1000000000, 2000000000])
      expect((await gp.weights(gpAddys[2])).div(2)).eq(await gp.weights(gpAddys[1])) // Because weights were zeros before user1 voted

      await gp.connect(users[6].signer).vote(gpAddys, [2, 1, 1])
      assertBNClosePercent(await gp.weights(gpAddys[0]), (await gp.weights(gpAddys[2])).add(await gp.weights(gpAddys[1])), "0.01") // user6 has substantially more power than user1
    })
    it("Should distribute weighted rewards among gauges", async () => {
      let _weights: BN[] = []
      let _weightSum: BN = BN.from(0)
      for (let i = 0; i < gpAddys.length; i++) {
        _weights.push(await gp.weights(gpAddys[i]))
        _weightSum = _weightSum.add(_weights[i])
      }

      await gp.collect()
      await gp.distribute()
      let _distributed = BN.from(0)

      for (let i = 0; i < _weights.length; i++) _distributed = _distributed.add(await mta.balanceOf(gauges[i].address))

      for (let i = 0; i < _weights.length; i++) {
        let _gaugeBal = await mta.balanceOf(gauges[i].address)
        assertBNClosePercent(_gaugeBal, _distributed.mul(_weights[i]).div(_weightSum), "0.001")
      }
    })
    it("Should add new tokens/gauges", async () => {
      let tmpToken = await ERC20.deploy("smth", "smth", 123)

      expect(gp.connect(users[6].signer).addGauge(tmpToken.address)).to.be.revertedWith("!gov")
      gp.connect(boss.signer).addGauge(tmpToken.address)
      expect(gp.connect(boss.signer).addGauge(tmpToken.address)).to.be.revertedWith("exists")
    })
  })

  describe("Gauge", () => {
    before(async () => {
      await deployFresh()
      await gp.connect(users[6].signer).vote(gpAddys, [1, 1, 1])
    })
    it("Config and stuff sanity checked", async () => {
      // TODO:
    })
    it("Users can deposit tokens", async () => {
      for (let i = 0; i < users.length; i++) {
        for (let j = 0; j < gauges.length; j++) {
          await gpTokens[j].connect(users[i].signer).approve(gauges[j].address, simpleToExactAmount(1, DEFAULT_DECIMALS))
          await gauges[j].connect(users[i].signer).deposit(simpleToExactAmount(1, DEFAULT_DECIMALS))
        }
      }
    })
    it("Users can claim their rewards", async () => {
      let uBalBefore: BN[] = await Promise.all(users.map(async (user) => await mta.balanceOf(user.address)))
      await gp.distribute()
      await Promise.all(users.map(async (user) => await gauges[1].connect(user.signer).getReward()))
      let gains = await Promise.all(users.map(async (user, i) => (await mta.balanceOf(user.address)).sub(uBalBefore[i])))
      console.log(gains)
      console.log(await votingLockup["totalSupply()"]())
      console.log(await Promise.all(users.map(async (user) => await votingLockup["balanceOf(address)"](user.address))))
    })
    it("Users with a veVOLT balance can get boosted rewards", async () => {
      // Tested in the previous test
    })
    it("Users can withdraw", async () => {
      expect(gauges[0].connect(boss.signer).exit()).to.be.revertedWith("Cannot withdraw 0")
      await gauges[0].connect(users[1].signer).exit()
    })
    it("Users can kick(user)", async () => {
      await votingLockup.connect(users[6].signer).force_withdraw()
      await gauges[1].connect(users[1].signer).kick(users[6].address)
      await gp.distribute()
      await gauges[1].connect(users[6].signer).getReward()

      await increaseTime(3600 * 24 * 10)

      let u6Bal = await mta.balanceOf(users[6].address)
      let u0Bal = await mta.balanceOf(users[0].address)

      await gp.distribute()
      await gauges[1].connect(users[0].signer).getReward()
      await gauges[1].connect(users[6].signer).getReward()

      // Now user6 and user0 should earn almost the same after user6 has no more veVOLT
      assertBNClosePercent((await mta.balanceOf(users[6].address)).sub(u6Bal), (await mta.balanceOf(users[0].address)).sub(u0Bal), "1.5")
    })
  })
  describe("RewardPool", () => {
    /**
     * TODO:
     * - Config and sanity checks
     * - Admins can set epoch fees and stuff
     * - Users can claim for last epoch depending on their last veVOLT balance
     * - What else??
     */

    it("Config sanity checked", async () => {
      // TODO:
    })
    it("Admins can set epoch fees to be distributed", async () => {
      // TODO:
    })
    it("Users can claim for last epch depending on their veVOLT balance", async () => {
      // TODO:
    })
    it("What else???", async () => {
      // TODO:
    })
  })
})
