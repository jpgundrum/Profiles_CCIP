import {time, loadFixture,} from "@nomicfoundation/hardhat-toolbox/network-helpers";
  import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
  import { expect } from "chai";
  import { ethers } from "hardhat";


  // sepolia router address
  const sepolia_router = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59";

  // optimis goerli testnet router address
  const goerli_router = "0xcc5a0B910D9E9504A7561934bed294c51285a78D";
  
  describe("Profiles", function () {
    async function deployContractFixture() {
        const [owner, otherAccount] = await ethers.getSigners();
        const Profiles = await ethers.getContractFactory("Profiles");


        const profiles = await Profiles.deploy(sepolia_router);
        return {profiles, owner, otherAccount};
    }

  describe("Deployment Testing", function () {
    it("Check owner's address", async function () {
        const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);
      //  console.log(profiles.runner.address);
        expect(owner.address).to.equal(profiles.runner.address);

    });
    it("Check other account address", async function () {
        const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);

        expect(otherAccount.address).to.equal("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");

    });
    it("Deploy the contract with sepolia router", async function () {
        const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);
        const routerAddress = await profiles.router();
        expect(routerAddress).to.equal(sepolia_router);
      });
  });
  describe("Update router and check initial values", function() {
    it("Update router", async function() {
        const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);
        await profiles.updateRouter(goerli_router);
        const routerAddress = await profiles.router();
        expect(routerAddress).to.equal(goerli_router);
    });
  });
});
  