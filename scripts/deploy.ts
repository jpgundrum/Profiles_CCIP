import { ethers } from "hardhat";

// sepolia router address
const sepolia_router = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59";

// optimis goerli testnet router address
const goerli_router = "0xcc5a0B910D9E9504A7561934bed294c51285a78D";

async function main() {
  const Profiles = await ethers.getContractFactory("Profiles");
  const profiles = await Profiles.deploy(sepolia_router);

  await profiles.waitForDeployment();
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
