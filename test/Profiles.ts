import {time, loadFixture,} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
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

  // Example Any2AnyMessage
  let Any2EVMMessage = {
    messageId: "0x6d65737361676549640000000000000000000000000000000000000000000000", // MessageId corresponding to ccipSend on source.
    sourceChainSelector: sepolia_chain_selector,       // Source chain selector.
    sender: "",                                     // abi.decode(sender) if coming from an EVM chain.
    data: {},                                     // payload sent in original message.
    destTokenAmounts: []                             // Tokens and their amounts in their destination chain representation.
  }

  /**
   * Tests the MockedProfiles.sol contract. Mocked contract is used to test
   * the Profiles contract that has extenal API calls.
   */
  describe("Profiles", function () {
    /**
     * Fixture to be run before a subset of tests that will deploy the 
     * contract and return relevant data to be called/checked
     * 
     * Returns:
     * --------
     * const: profiles
     *    Object representation of the contract that was deployed
     * const: owner
     *    Owner of the contract that deployed the contract
     * const: otherAccount
     *    Another owner of the contract
     */
    async function deployContractFixture() {
        const [owner, otherAccount] = await ethers.getSigners();
        const Profiles = await ethers.getContractFactory("MockedProfiles");
        const profiles = await Profiles.deploy(sepolia_router);

        return {profiles, owner, otherAccount};
    }

    /**
     * Fixture to be run before a subset of test that when a transaction
     * is sent. Deploys the contract and then deploys the mocked router
     * client to have functionality in the sendMessage function.
     * 
     * Returns:
     * --------
     * const: profiles
     *    Object representation of the contract that was deployed
     * const: owner
     *    Owner of the contract that deployed the contract
     * const: mockedObject
     *    Router object that is hardcoded to test funtionality of contract
     */
    async function deployContractFixture2() {
      const [owner, otherAccount] = await ethers.getSigners();
      const Profiles = await ethers.getContractFactory("MockedProfiles");
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

  /**
   * Encapsulates tests that check for proper contract deployment
   */
  describe("Deployment Testing", function () {
    // Owner address is as expected
    it("Check owner's address", async function () {
        const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);

        expect(owner.address).to.equal(profiles.runner.address);

    });
    // Other account's address is as expected
    it("Check other account address", async function () {
        const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);

        expect(otherAccount.address).to.equal("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");

    });
    // Sepolia router is being used
    it("Check deployment to the contract with sepolia router", async function () {
        const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);
        const routerAddress = await profiles.router();
        expect(routerAddress).to.equal(sepolia_router);
      });
  });

  /**
   * Encapsulates tests that check initial values and updating
   * the router
   */
  describe("Update router and check initial values", function() {
    // Router update works
    it("Check update router", async function() {
        const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);
        await profiles.updateRouter(goerli_router);
        const routerAddress = await profiles.router();
        expect(routerAddress).to.equal(goerli_router);
    });
    // Received messages initally set to 0
    it("Check getNumberOfReceivedMessages initial return value", async function() {
      const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);
      const numMessages = await profiles.getNumberOfReceivedMessages();
      expect(numMessages).to.equal(0);
    });
    // No message received revertion when there has been no messages
    it("Check getLastReceivedMessageDetails when 0 messages received", async function() {
      const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);
      expect(profiles.getLastReceivedMessageDetails()).to.be.revertedWith("NoMessageReceived");
    });
  });

  /**
   * Encapsulates tests that check for sending a profile message
   */
  describe("Test sending message functionality", function() {
    // Check message from address to make sure it is from contract owner
    it("Check sendMessage from owner is correct" , async function() {
      const {profiles, owner, mockedObject} = await loadFixture(deployContractFixture2);
      const messageId = await profiles.sendMessage(goerli_chain_selector, profiles.target, Profile, mockedObject);

      expect(messageId.from).to.equal(owner.address);
    });
    // Check message to address to make sure it is from contract target
    it("Check sendMessage to profile contract is correct" , async function() {
      const {profiles, owner, mockedObject} = await loadFixture(deployContractFixture2);
      const messageId = await profiles.sendMessage(goerli_chain_selector, profiles.target, Profile, mockedObject);
      
      expect(messageId.to).to.equal(profiles.target);
    });
  });

  /**
   * Encapsulates tests that check the event logs after
   * sending a profile message
   */
  describe("Test event/emit functionality in sendMessage", function() {
    // Event is present in the logs called MessageSent
    it("Check sendMessage emits correct MessageSent event" , async function() {
      const {profiles, owner, mockedObject} = await loadFixture(deployContractFixture2);
      const transaction = await profiles.sendMessage(goerli_chain_selector, profiles.target, Profile, mockedObject);
      const receipt = await transaction.wait();

      expect(receipt.logs[0].fragment.type).to.equal("event");
      expect(receipt.logs[0].fragment.name).to.equal("MessageSent");
    });
    // Emitted message event format is as expected
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
    // Emitted message event for profile data is as expected
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

  /**
   * Encapsulates tests that check the addProfile function
   */
  describe("Test addProfile function", function() {
    // Check that the created userId has the correct format
    it("Check userId" , async function() {
      const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);
      await profiles.addProfile("John", "Doe", "American", 30, goerli_chain_selector, profiles.target);
      const userId = await profiles.getUniqueIdByUser(owner.address);

      const regExp = /^0x[a-fA-F0-9]{64}$/;
      expect(userId).to.match(regExp, 'The ID does not match the expected format');
    });
    // Check that the profile created as the expected values
    it("Check user Profile" , async function() {
      const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);
      await profiles.addProfile("John", "Doe", "American", 30, goerli_chain_selector, profiles.target);
      const userId = await profiles.getUniqueIdByUser(owner.address);

      const profile = await profiles.getProfile(userId);
      expect(profile[1]).to.equal("John");
      expect(profile[2]).to.equal("Doe");
      expect(profile[3]).to.equal("American");
      expect(profile[4]).to.equal(30);
    });
    // Check that multiple profiles cannot be created; a revert statement should be thrown
    it("Check that user can't make multiple Profiles" , async function() {
      const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);
      await profiles.addProfile("John", "Doe", "American", 30, goerli_chain_selector, profiles.target);

      expect(profiles.addProfile("Jane", "Deer", "German", 45, goerli_chain_selector, profiles.target)
      ).to.be.revertedWith("Sender already has a profile");
    });
  });

  describe("Testing _ccipReceive function and fields that change", function() {
    it("Check userId" , async function() {
      const {profiles, owner, otherAccount} = await loadFixture(deployContractFixture);
      // TODO see why line 255 is not working when trying to encode data to send
      // let { ethers } = require("ethers");
      // let abiCoder = ethers.utils.defaultAbiCoder;
      // Any2EVMMessage.sender = abiCoder.encode(owner.address);
      // Any2EVMMessage.data =  ethers.utils.defaultAbiCoder(Profile);

      await profiles.testCcipReceive(Any2EVMMessage);
    });
  });

});
  
  /**
   * Converts a string to bytes
   * 
   * Parameters:
   * -----------
   * str: string
   *    string to be converted to bytes
   * 
   * Returns:
   * --------
   * object that is represented in bytes
   */
function toBytes32(str: string): string {
  let hexStr = Buffer.from(str).toString('hex');
  while (hexStr.length < 64) {
      hexStr += '0';
  }
  return '0x' + hexStr;
}