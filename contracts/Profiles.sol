// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {OwnerIsCreator} from "@chainlink/contracts-ccip/src/v0.8/shared/access/OwnerIsCreator.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import {IERC20} from "@chainlink/contracts-ccip/src/v0.8/vendor/openzeppelin-solidity/v4.8.0/contracts/token/ERC20/IERC20.sol";

import {MockRouterClient} from "./MockRouterClient.sol";

/**
 * THIS IS AN EXAMPLE CONTRACT THAT USES HARDCODED VALUES FOR CLARITY.
 * THIS IS AN EXAMPLE CONTRACT THAT USES UN-AUDITED CODE.
 * DO NOT USE THIS CODE IN PRODUCTION.
 * 
 * Creates a user profile that gets sent to another chain using CCIP
 */

contract Profiles is CCIPReceiver, OwnerIsCreator {
    // custom errors to provide clarity
    error NoMessageReceived();
    error NotEnoughBalance(uint256 currentBalance, uint256 calculatedFees); // Used to make sure contract has enough balance.

    // initialize mappings for profile count, profile and message details
    mapping (address => uint8) ownerProfileCount;
    mapping (bytes32 => Profile) public profileDetail;
    mapping (bytes32 => Message) public messageDetail;


    bytes32[] public receivedMessages;

    // holds user's information
    struct Profile {
        bytes32 id;
        string firstName;
        string lastName;
        string nationality;
        uint8 age;
    }

    // holds new ccip message information
    struct Message {
        uint64 sourceChainSelector;
        address sender;
        Profile profile;
    }

    // emitted when a message is sent to another chain.
    event MessageSent(
        bytes32 indexed messageId,
        uint64 indexed destinationChainSelector,
        address receiver,
        Profile profile,
        address feeToken,
        uint256 fees
    );

    // emitted when a message is received from another chain.
    event MessageReceived(
        bytes32 indexed messageId,
        uint64 indexed sourceChainSelector,
        address sender,
        Profile profile 
    );

    address public router;

    /**
    * Sets router address value for CCIPReceiver and sender
    * 
    * Parameters:
    * -----------
    * address: _router
    *   Router address for the starting network
    *       - https://docs.chain.link/ccip/supported-networks
    */
    constructor(address _router) CCIPReceiver(_router) {
        router = _router;
    }


    /**
    * Updates router address 
    * 
    * Parameters:
    * -----------
    * address: routerAddress
    *    New router address for the sending chain
    */
    function updateRouter(address routerAddress) external {
        router = routerAddress;
    }

    /**
    * Adds a new user profile that is sent to another chain using CCIP
    * 
    * Parameters:
    * -----------
    * string: _first
    *   First name of the profile user
    * string: _last
    *   Last name of the profile user
    * stirng: _nationality
    *   Country the user is from
    * uint8: _age
    *   Age of the user in years
    * uint64: destinationChainSelector
    *   Identifier for the chain the data will be sent to
    * address: receiver
    *   Contract on the new chain that will obtain the profile data
    * 
    * Require:
    * --------
    * The msg.sender must have no profiles established to execute the function
    */
    function addProfile(string memory _first, string memory _last, string memory _nationality, uint8 _age, 
    uint64 destinationChainSelector, address receiver) external {
        require(ownerProfileCount[msg.sender] == 0);
        bytes32 uniqueId = keccak256(abi.encodePacked(block.timestamp, msg.sender));
        profileDetail[uniqueId] = Profile(uniqueId, _first, _last, _nationality, _age);
        ownerProfileCount[msg.sender] = 1;

        sendMessage(destinationChainSelector, receiver, profileDetail[uniqueId]);
    }

    /**
    * Sends profile data to the chain specified by the chain selector argument
    * 
    * Parameters:
    * -----------
    * uint64: destinationChainSelector
    *   Identifier for the chain the data will be sent to
    * address: receiver
    *   Contract on the new chain that will obtain the profile data
    * Profile: profile
    *   Struct that contains user's profile data
    * 
    * Events:
    * --------
    * MessageSent: Emits after a profile was sent to the specified chain 
    * 
    * Reverts:
    * --------
    * NotEnoughBalance: When user doesn't have enough native token to cover gas fees
    * 
    * Returns:
    * --------
    * messageId of the CCIP transaction
    */
    function sendMessage(
        uint64 destinationChainSelector, 
        address receiver, 
        Profile memory profile) public returns (bytes32 messageId){
            Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
                receiver: abi.encode(receiver),
                data: abi.encode(profile),
                tokenAmounts: new Client.EVMTokenAmount[](0),
                extraArgs: Client._argsToBytes(
                    Client.EVMExtraArgsV1({gasLimit: 400_000})
                ),
                feeToken: address(0)
            });
        

        // Initialize a router client instance to interact with cross-chain router
        IRouterClient client_router = IRouterClient(router);

        // Get the fee required to send the message
        uint256 fees = client_router.getFee(destinationChainSelector, evm2AnyMessage);
        
        // make sure user has enough native token
        if (fees > address(this).balance)
            revert NotEnoughBalance(address(this).balance, fees);

        

        // Send the message through the router and store the returned message ID
        messageId = client_router.ccipSend{value: fees}(
            destinationChainSelector,
            evm2AnyMessage
        );

        // Emit an event with message details
        emit MessageSent(
            messageId,
            destinationChainSelector,
            receiver,
            profile,
            address(this),
            fees
        );

        // Return the message ID
        return messageId;

        }

    /**
    * Receives the most recent CCIP message based on the messageId
    * 
    * Parameters:
    * -----------
    * Client.Any2EVMMessage: any2EvmMessage
    *   Message object returned after CCIP was used to send user data
    * 
    * Events:
    * --------
    * MessageReceived: Emitted when a message was successfully received
    */
    function _ccipReceive(Client.Any2EVMMessage memory any2EvmMessage) internal override {
            bytes32 messageId = any2EvmMessage.messageId; // fetch the messageId
            uint64 sourceChainSelector = any2EvmMessage.sourceChainSelector; // fetch the source chain identifier (aka selector)
            address sender = abi.decode(any2EvmMessage.sender, (address)); // abi-decoding of the sender address
            Profile memory message = abi.decode(any2EvmMessage.data, (Profile)); // abi-decoding of the sent string message
            receivedMessages.push(messageId);
            Message memory detail = Message(sourceChainSelector, sender, message);
            messageDetail[messageId] = detail;
            emit MessageReceived(messageId, sourceChainSelector, sender, message);
        }

    /**
    * Returns the number of messages received
    * 
    * Returns:
    * --------
    * uint256: number
    *   Number of messages received
    */
    function getNumberOfReceivedMessages()external view returns (uint256 number) {
        return receivedMessages.length;
    }


    /**
    * Returns the detailed last message received information
    * 
    * Reverts:
    * --------
    * NoMessageReceived: When there is no messages have been received
    * 
    * Returns:
    * --------
    * bytes32: messageId
    *   Specfific identifier of the last sent message
    * uint64: sourceChainSelector
    *   Selector for the chain that sent the data
    * address: sender
    *   Address of the contract that sent the data over w CCIP
    * Profile: profile
    *   User's profile data
    */
    function getLastReceivedMessageDetails() external view returns (
            bytes32 messageId,
            uint64 sourceChainSelector,
            address sender,
            Profile memory profile
        )
    {
        // Revert if no messages have been received
        if (receivedMessages.length == 0) revert NoMessageReceived();

        // Fetch the last received message ID
        messageId = receivedMessages[receivedMessages.length - 1];

        // Fetch the details of the last received message
        Message memory detail = messageDetail[messageId];

        return (
            messageId,
            detail.sourceChainSelector,
            detail.sender,
            detail.profile
        );
    }

    receive() external payable {}

}