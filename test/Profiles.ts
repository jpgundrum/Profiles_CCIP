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

    // Used when testing sendTransaction function
    // note different return value
    async function deployContractFixture2() {
      const [owner, otherAccount] = await ethers.getSigners();
      const Profiles = await ethers.getContractFactory("Profiles");
      const profiles = await Profiles.deploy(sepolia_router);

      const deployed_contract = profiles.target;

      const Mock = await ethers.getContractFactory("MockRouterClient");
      const mockedObject = await Mock.deploy(2, toBytes32("messageId"));

      const transaction = {
        to: profiles.target, 
        value: 10
    };
      await owner.sendTransaction(transaction);

      return {profiles, owner, mockedObject};
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
    it("Check sendMessage from owner is correct" , async function() {
      const {profiles, owner, mockedObject} = await loadFixture(deployContractFixture2);
      const messageId = await profiles.sendMessage(goerli_chain_selector, profiles.target, Profile, mockedObject);

      expect(messageId.from).to.equal(owner.address);
    });
    it("Check sendMessage to profile contract is correct" , async function() {
      const {profiles, owner, mockedObject} = await loadFixture(deployContractFixture2);
      const messageId = await profiles.sendMessage(goerli_chain_selector, profiles.target, Profile, mockedObject);
      
      expect(messageId.to).to.equal(profiles.target);
    });
  });

// message event has form:     
    // event MessageSent(
    //     bytes32 indexed messageId,
    //     uint64 indexed destinationChainSelector,
    //     address receiver,
    //     Profile profile,
    //     address feeToken,
    //     uint256 fees
    // );
// check to make sure each property is correct
  describe("Test event/emit functionality in sendMessage", function() {
    it("Check sendMessage emits correct MessageSent event" , async function() {
      const {profiles, owner, mockedObject} = await loadFixture(deployContractFixture2);
      const transaction = await profiles.sendMessage(goerli_chain_selector, profiles.target, Profile, mockedObject);
      const receipt = await transaction.wait();

      expect(receipt.logs[0].fragment.type).to.equal("event");
      expect(receipt.logs[0].fragment.name).to.equal("MessageSent");
    });
    it("Check sendMessage emits correct MessageSent content" , async function() {
      const {profiles, owner, mockedObject} = await loadFixture(deployContractFixture2);
      const transaction = await profiles.sendMessage(goerli_chain_selector, profiles.target, Profile, mockedObject);
      const receipt = await transaction.wait();

      // check each property except profile
      // messageId
      expect(receipt.logs[0].args[0]).to.equal("0x6d65737361676549640000000000000000000000000000000000000000000000");
      // detinationChainSelector
      expect(receipt.logs[0].args[1]).to.equal(goerli_chain_selector);
      // receiver
      expect(receipt.logs[0].args[2]).to.equal(profiles.target);
      // feeToken
      expect(receipt.logs[0].args[4]).to.equal(profiles.target); // TODO may need to change later?
      // fees
      expect(receipt.logs[0].args[5]).to.equal(2);
    });
    it("Check sendMessage emits correct MessageSent content" , async function() {
      const {profiles, owner, mockedObject} = await loadFixture(deployContractFixture2);
      const transaction = await profiles.sendMessage(goerli_chain_selector, profiles.target, Profile, mockedObject);
      const receipt = await transaction.wait();

      // check each property in the user's profile
      // user profile id
      expect(receipt.logs[0].args[3][0]).to.equal(toBytes32("myString"));
      // user first name
      expect(receipt.logs[0].args[3][1]).to.equal("John");
      // user last name
      expect(receipt.logs[0].args[3][2]).to.equal("Doe");
      // user nationality
      expect(receipt.logs[0].args[3][3]).to.equal("American");
      // user age
      expect(receipt.logs[0].args[3][4]).to.equal(30);
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