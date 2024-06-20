const { ethers } = require("hardhat")
import { BN } from "./math";
import { Block } from "@ethersproject/abstract-provider";
const { BigNumber } = ethers

export async function advanceBlock() {
  return ethers.provider.send("evm_mine", [])
}

export async function advanceBlockTo(blockNumber) {
  for (let i = await ethers.provider.getBlockNumber(); i < blockNumber; i++) {
    await advanceBlock()
  }
}

export async function increase(value) {
  await ethers.provider.send("evm_increaseTime", [value.toNumber()])
  await advanceBlock()
}

export const increaseTime = async (length: BN | number): Promise<void> => {
  await ethers.provider.send("evm_increaseTime", [BN.from(length).toNumber()]);
  await advanceBlock();
};

export const latestBlock = async (): Promise<Block> =>
  ethers.provider.getBlock(await ethers.provider.getBlockNumber());

export const getTimestamp = async (): Promise<BN> =>
  BN.from((await latestBlock()).timestamp);

export const increaseTimeTo = async (target: BN | number): Promise<void> => {
  const now = await getTimestamp();
  const later = BN.from(target);
  if (later.lt(now))
    throw Error(
      `Cannot increase current time (${now.toNumber()}) to a moment in the past (${later.toNumber()})`
    );
  const diff = later.sub(now);
  await increaseTime(diff);
};

export async function latest() {
  const block = await ethers.provider.getBlock("latest")
  return BigNumber.from(block.timestamp)
}

export async function advanceTimeAndBlock(time) {
  await advanceTime(time)
  await advanceBlock()
}

export async function advanceTime(time) {
  await ethers.provider.send("evm_increaseTime", [time])
}

export async function takeSnapshot() {
  const snapshotId: string = await ethers.provider.send("evm_snapshot", []);
  return snapshotId;
}

export async function revertToSnapShot(id: string) {
  await ethers.provider.send("evm_revert", [id]);
}


export const duration = {
  seconds: function (val) {
    return BigNumber.from(val)
  },
  minutes: function (val) {
    return BigNumber.from(val).mul(this.seconds("60"))
  },
  hours: function (val) {
    return BigNumber.from(val).mul(this.minutes("60"))
  },
  days: function (val) {
    return BigNumber.from(val).mul(this.hours("24"))
  },
  weeks: function (val) {
    return BigNumber.from(val).mul(this.days("7"))
  },
  years: function (val) {
    return BigNumber.from(val).mul(this.days("365"))
  },
}
