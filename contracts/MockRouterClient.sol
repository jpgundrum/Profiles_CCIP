import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";

// TDOD change id to bytes
contract MockRouterClient {
    uint256 private fee;
    bytes32 private messageId;

    constructor(uint256 _fee, bytes32 _messageId) {
        fee = _fee;
        messageId = _messageId;
    }

    function getFee(uint64 destinationChainSelector,Client.EVM2AnyMessage memory message) 
        external view returns (uint256 _fee){
            return fee;
        }

    function ccipSend(uint64 destinationChainSelector, Client.EVM2AnyMessage calldata message)
        external payable returns (bytes32){
            return messageId;
        }
}