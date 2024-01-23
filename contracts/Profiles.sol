// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {OwnerIsCreator} from "@chainlink/contracts-ccip/src/v0.8/shared/access/OwnerIsCreator.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {CCIPReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/applications/CCIPReceiver.sol";
import {IERC20} from "@chainlink/contracts-ccip/src/v0.8/vendor/openzeppelin-solidity/v4.8.0/contracts/token/ERC20/IERC20.sol";


// Creates a database of users that lives on the blockchain using CCIP
contract Profiles is CCIPReceiver, OwnerIsCreator {
    // custom errors to provide clarity
    error NoMessageReceived();
    error NotEnoughBalance(uint256 currentBalance, uint256 calculatedFees); // Used to make sure contract has enough balance.
    error NothingToWithdraw(); // Used when trying to withdraw Ether but there's nothing to withdraw.
    error FailedToWithdrawEth(address owner, address target, uint256 value); // Used when the withdrawal of Ether fails.
    error DestinationChainNotAllowlisted(uint64 destinationChainSelector); // Used when the destination chain has not been allowlisted by the contract owner.
    error SourceChainNotAllowlisted(uint64 sourceChainSelector); // Used when the source chain has not been allowlisted by the contract owner.
    error SenderNotAllowlisted(address sender); // Used when the sender has not been allowlisted by the contract owner.

    // create Objects for the profiles to be stored
    // TODO mapping address id to person struct?
  //  Person[] public people;
    uint private id;

    mapping (address => uint8) ownerProfileCount;
    mapping (bytes32 => Profile) public profileDetail;
    mapping (bytes32 => Message) public messageDetail; // Mapping from message ID to Message struct, storing details of each received message.

    bytes32[] public receivedMessages; // Array to keep track of the IDs of received messages.

    struct Profile {
        bytes32 id;
        string firstName;
        string lastName;
        string nationality;
        uint8 age;
    }

        // Struct to hold details of a message.
    struct Message {
        uint64 sourceChainSelector; // The chain selector of the source chain.
        address sender; // The address of the sender.
        Profile profile; // The content of the message.
    }

  //  Event emitted when a message is sent to another chain.
    event MessageSent(
        bytes32 indexed messageId,
        uint64 indexed destinationChainSelector,
        address receiver,
        Profile profile,
        uint256 fees
    );

        // Event emitted when a message is received from another chain.
    event MessageReceived(
        bytes32 indexed messageId,
        uint64 indexed sourceChainSelector,
        address sender,
        Profile profile 
    );


    // bytes32 private s_lastReceivedMessageId; // Store the last received messageId.
    // string private s_lastReceivedText; // Store the last received text.

    // // Mapping to keep track of allowlisted destination chains.
    // mapping(uint64 => bool) public allowlistedDestinationChains;

    // // Mapping to keep track of allowlisted source chains.
    // mapping(uint64 => bool) public allowlistedSourceChains;

    // // Mapping to keep track of allowlisted senders.
    // mapping(address => bool) public allowlistedSenders;

    // IERC20 private s_linkToken;
    address public router;

    /// @notice Constructor initializes the contract with the router address.
    /// @param _router The address of the router contract.
    constructor(address _router) CCIPReceiver(_router) {
        router = _router;
    }


    function updateRouter(address routerAddress) external {
        router = routerAddress;
    }

    function addProfile(string memory _first, string memory _last, string memory _nationality, uint8 _age, 
    uint64 destinationChainSelector, address receiver) external {
        require(ownerProfileCount[msg.sender] == 0);
        bytes32 uniqueId = keccak256(abi.encodePacked(block.timestamp, msg.sender));
        profileDetail[uniqueId] = Profile(uniqueId, _first, _last, _nationality, _age);
        ownerProfileCount[msg.sender] = 1;
        sendMessage(destinationChainSelector, receiver, profileDetail[uniqueId]);
    }

    function sendMessage(
        uint64 destinationChainSelector, 
        address receiver, 
        Profile memory profile) public returns (bytes32 messageId){
            Client.EVM2AnyMessage memory evm2AnyMessage = Client.EVM2AnyMessage({
                receiver: abi.encode(receiver),
                data: abi.encode(profile),
                tokenAmounts: new Client.EVMTokenAmount[](0),
                extraArgs: Client._argsToBytes(
                    Client.EVMExtraArgsV1({gasLimit: 400_000}) // Additional arguments, setting gas limit and non-strict sequency mode
                ),
                feeToken: address(0) // Setting feeToken to zero address, indicating native asset will be used for fees
            });
        
        // Initialize a router client instance to interact with cross-chain router
        IRouterClient client_router = IRouterClient(router);

        // Get the fee required to send the message
        uint256 fees = client_router.getFee(destinationChainSelector, evm2AnyMessage);
        
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
            fees
        );

        // Return the message ID
        return messageId;

        }

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

    function getNumberOfReceivedMessages()external view returns (uint256 number) {
        return receivedMessages.length;
    }


    function getLastReceivedMessageDetails() external view returns (
            bytes32 messageId,
            uint64 sourceChainSelector,
            address sender,
            Profile memory message
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