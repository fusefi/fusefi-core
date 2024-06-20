module.exports = async function ({ ethers, deployments, getNamedAccounts }) {
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();



  const VOLT = await ethers.getContract("VoltToken");
  const veVOLT = await ethers.getContract("VotingEscrow");
  const MCV2 = await ethers.getContract("MasterChefVoltV2")
  const MCV3 = await ethers.getContract("MasterChefVoltV3")

  await (await VOLT.mint(deployer, "1000000000000000000000000000")).wait()
  await (await VOLT.transferOwnership(MCV2.address)).wait()

  const multisig = deployer

  const { address } = await deploy("GaugeProxy", {
    from: deployer,
    args: [
      multisig,
      VOLT.address,
      veVOLT.address,
      MCV2.address
    ],
    log: true,
    deterministicDeployment: false,
  });

  const GP = await ethers.getContract("GaugeProxy");
  const mvVOLT = await GP.TOKEN();


  await (await MCV2.add(100, mvVOLT, "0x0000000000000000000000000000000000000000")).wait();
  await (await GP.setPID(1)).wait()

  for(let i=0 ; i<3 ; i++){
    const {address: addy} = await deploy("ERC20Mock", {
      from: deployer,
      args: [`Dummy Token #${i}`, `DUMMY${i}`, "1"],
      log: true,
      deterministicDeployment: false,
    });

    await (await GP.addGauge(addy)).wait()
  }
  
  for(let i=0 ; i<3 ; i++){
    const {address: addy} = await deploy("ERC20Mock", {
      from: deployer,
      args: [`LALADODO #${i}`, `LALADODO${i}`, "1"],
      log: true,
      deterministicDeployment: false,
    });

    await (await MCV3.add(100, addy, "0x0000000000000000000000000000000000000000")).wait()
  }
};

module.exports.tags = ["GaugeProxy", "chef"];
module.exports.dependencies = ["MasterChefVoltV2", "MasterChefVoltV3", "VoteEscrowVolt", "VoltToken"]
