module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();


  const PID = 0;

  await deploy("ERC20Mock", {
    from: deployer,
    args: ["Volt Dummy Token", "DUMMY", "1"],
    log: true,
    deterministicDeployment: false,
  });
  
  const dummyToken = await ethers.getContract("ERC20Mock");
  // await dummyToken.renounceOwnership();
  const volt = await ethers.getContract("VoltToken");
  const MCV2 = await ethers.getContract("MasterChefVoltV2");

  await deploy("MasterChefVoltV3", {
    from: deployer,
    args: [MCV2.address, volt.address, PID],
    log: true,
    deterministicDeployment: false,
  });
  
  const MCV3 = await ethers.getContract("MasterChefVoltV3");
  await (await MCV2.add(100, dummyToken.address, "0x0000000000000000000000000000000000000000")).wait();
  await (await dummyToken.approve(MCV3.address, "1")).wait();
  await (await MCV3.init(dummyToken.address, {
    gasLimit: 245000,
  })).wait();
};

module.exports.tags = ["MasterChefVoltV3"];
module.exports.dependencies = ["VoltToken", "MasterChefVoltV2"];
