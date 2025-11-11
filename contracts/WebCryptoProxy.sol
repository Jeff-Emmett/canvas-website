// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WebCryptoProxy
 * @notice Minimal proxy contract that verifies Web Crypto API (P-256) signatures
 *         and executes transactions. Designed to minimize gas costs and complexity.
 * @dev Each user deploys their own proxy contract, which stores their Web Crypto public key
 *      and verifies P-256 signatures before executing transactions.
 */
contract WebCryptoProxy {
    // Web Crypto P-256 public key (stored as bytes32 for gas efficiency)
    // P-256 public keys are 65 bytes (0x04 || 32-byte X || 32-byte Y)
    // We store the X coordinate (32 bytes) and Y coordinate (32 bytes) separately
    bytes32 public publicKeyX;
    bytes32 public publicKeyY;
    
    // Replay protection: nonce tracking
    mapping(uint256 => bool) public usedNonces;
    
    // Events
    event TransactionExecuted(
        address indexed to,
        uint256 value,
        bytes data,
        uint256 nonce
    );
    
    event PublicKeySet(bytes32 indexed publicKeyX, bytes32 indexed publicKeyY);
    
    /**
     * @notice Constructor sets the Web Crypto public key
     * @param _publicKeyX X coordinate of P-256 public key (32 bytes)
     * @param _publicKeyY Y coordinate of P-256 public key (32 bytes)
     */
    constructor(bytes32 _publicKeyX, bytes32 _publicKeyY) {
        publicKeyX = _publicKeyX;
        publicKeyY = _publicKeyY;
        emit PublicKeySet(_publicKeyX, _publicKeyY);
    }
    
    /**
     * @notice Execute a transaction if signature is valid
     * @param to Target address for the transaction
     * @param value Amount of ETH to send (in wei)
     * @param data Transaction data (contract call data)
     * @param nonce Unique nonce for replay protection
     * @param deadline Transaction expiration timestamp
     * @param signature Web Crypto P-256 signature (r, s, v format)
     * @dev Signature verification uses P-256 curve, not secp256k1
     *      This requires a custom verification library or precompile
     */
    function execute(
        address to,
        uint256 value,
        bytes calldata data,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external {
        // Check deadline
        require(block.timestamp <= deadline, "WebCryptoProxy: Transaction expired");
        
        // Check nonce hasn't been used
        require(!usedNonces[nonce], "WebCryptoProxy: Nonce already used");
        
        // Mark nonce as used
        usedNonces[nonce] = true;
        
        // Verify signature
        // Note: P-256 signature verification requires a library or precompile
        // For now, this is a placeholder - you'll need to implement or import
        // a P-256 verification function
        bytes32 messageHash = keccak256(
            abi.encodePacked(
                "\x19\x01", // EIP-712 prefix
                keccak256(abi.encode(
                    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                    keccak256(bytes("WebCryptoProxy")),
                    keccak256(bytes("1")),
                    block.chainid,
                    address(this)
                )),
                keccak256(abi.encode(
                    keccak256("Transaction(address to,uint256 value,bytes data,uint256 nonce,uint256 deadline)"),
                    to,
                    value,
                    keccak256(data),
                    nonce,
                    deadline
                ))
            )
        );
        
        // TODO: Verify P-256 signature
        // This requires a P-256 signature verification library
        // Options:
        // 1. Use a precompile (if available on your chain)
        // 2. Import a P-256 verification library
        // 3. Use a verification contract
        // For now, we'll use a simplified check
        // In production, replace this with proper P-256 verification
        require(verifyP256Signature(messageHash, signature), "WebCryptoProxy: Invalid signature");
        
        // Execute the transaction
        (bool success, ) = to.call{value: value}(data);
        require(success, "WebCryptoProxy: Transaction failed");
        
        emit TransactionExecuted(to, value, data, nonce);
    }
    
    /**
     * @notice Verify P-256 signature
     * @dev This is a placeholder - implement with proper P-256 verification
     *      You can use libraries like:
     *      - A precompile if your chain supports it
     *      - A P-256 verification library (e.g., from OpenZeppelin or custom)
     *      - An external verification contract
     * @param messageHash The message hash to verify
     * @param signature The signature (needs to be parsed for r, s, v)
     * @return true if signature is valid
     */
    function verifyP256Signature(
        bytes32 messageHash,
        bytes calldata signature
    ) internal view returns (bool) {
        // TODO: Implement P-256 signature verification
        // For now, this is a placeholder that always returns false for safety
        // In production, you must implement proper P-256 verification
        
        // Example structure (you'll need to adapt based on your verification method):
        // 1. Parse signature to extract r, s, v (or r, s for P-256)
        // 2. Recover public key from signature
        // 3. Compare recovered public key with stored publicKeyX and publicKeyY
        // 4. Return true if they match
        
        // Placeholder: This will reject all signatures until properly implemented
        // Remove this and implement actual verification
        revert("WebCryptoProxy: P-256 verification not yet implemented");
        
        // Uncomment and implement when you have P-256 verification:
        // bytes32 r = ...;
        // bytes32 s = ...;
        // (bytes32 recoveredX, bytes32 recoveredY) = recoverP256PublicKey(messageHash, r, s);
        // return (recoveredX == publicKeyX && recoveredY == publicKeyY);
    }
    
    /**
     * @notice Receive ETH
     */
    receive() external payable {}
    
    /**
     * @notice Fallback function
     */
    fallback() external payable {}
}

