import {time, loadFixture,} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
//import { ethers } from 'ethers';
const { ethers } = require("hardhat");

  // sepolia router address
  const sepolia_router = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59";
  const sepolia_chain_selector: bigint = BigInt("16015286601757825753");

  // optimis goerli testnet router address
  const goerli_router = "0xcc5a0B910D9E9504A7561934bed294c51285a78D";
  let goerli_chain_selector: bigint = BigInt("2664363617261496610");
  
    // Example profile
    let Profile = {
      id: toBytes32("myString"),
      firstName: "John",
      lastName: "Doe",
      nationality: "American",
      age: 30
    };


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

        expect(owner.address).to.equal(profiles.runner.address);

    });
    it("Check other account address", async function () {
        const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);

        expect(otherAccount.address).to.equal("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");

    });
    it("Check deployment to the contract with sepolia router", async function () {
        const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);
        const routerAddress = await profiles.router();
        expect(routerAddress).to.equal(sepolia_router);
      });
  });

  describe("Update router and check initial values", function() {
    it("Check update router", async function() {
        const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);
        await profiles.updateRouter(goerli_router);
        const routerAddress = await profiles.router();
        expect(routerAddress).to.equal(goerli_router);
    });
    it("Check getNumberOfReceivedMessages initial return value", async function() {
      const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);
      const numMessages = await profiles.getNumberOfReceivedMessages();
      expect(numMessages).to.equal(0);
    });
    it("Check getLastReceivedMessageDetails when 0 messages received", async function() {
      const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);
      expect(profiles.getLastReceivedMessageDetails()).to.be.revertedWith("NoMessageReceived");
    });
  });

  describe("Test sending message functionality", function() {
    it("Check sendMessage functionality to from sepolia->goerli" , async function() {
      const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);
      const deployed_contract = profiles.target;
      const messageId = await profiles.sendMessage(goerli_chain_selector, deployed_contract, Profile);
      //expect(messageId).to.equal(0);
    });
  
  });
});
  

function toBytes32(str: string): string {
  let hexStr = Buffer.from(str).toString('hex');
  while (hexStr.length < 64) {
      hexStr += '0';
  }
  return '0x' + hexStr;
}