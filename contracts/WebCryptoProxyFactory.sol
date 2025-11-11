// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./WebCryptoProxy.sol";

/**
 * @title WebCryptoProxyFactory
 * @notice Factory contract to deploy minimal proxy contracts for users
 * @dev Uses CREATE2 for deterministic addresses based on public key
 */
contract WebCryptoProxyFactory {
    // Mapping from public key hash to proxy address
    mapping(bytes32 => address) public proxies;
    
    // Event emitted when a new proxy is deployed
    event ProxyDeployed(
        bytes32 indexed publicKeyHash,
        address indexed proxy,
        bytes32 publicKeyX,
        bytes32 publicKeyY
    );
    
    /**
     * @notice Deploy a new proxy contract for a Web Crypto public key
     * @param publicKeyX X coordinate of P-256 public key
     * @param publicKeyY Y coordinate of P-256 public key
     * @return proxy The address of the deployed proxy contract
     */
    function deployProxy(
        bytes32 publicKeyX,
        bytes32 publicKeyY
    ) external returns (address proxy) {
        // Create hash of public key for mapping
        bytes32 publicKeyHash = keccak256(abi.encodePacked(publicKeyX, publicKeyY));
        
        // Check if proxy already exists
        require(proxies[publicKeyHash] == address(0), "WebCryptoProxyFactory: Proxy already exists");
        
        // Deploy new proxy
        proxy = address(new WebCryptoProxy(publicKeyX, publicKeyY));
        
        // Store mapping
        proxies[publicKeyHash] = proxy;
        
        emit ProxyDeployed(publicKeyHash, proxy, publicKeyX, publicKeyY);
    }
    
    /**
     * @notice Get proxy address for a public key
     * @param publicKeyX X coordinate of P-256 public key
     * @param publicKeyY Y coordinate of P-256 public key
     * @return The proxy address, or address(0) if not deployed
     */
    function getProxy(
        bytes32 publicKeyX,
        bytes32 publicKeyY
    ) external view returns (address) {
        bytes32 publicKeyHash = keccak256(abi.encodePacked(publicKeyX, publicKeyY));
        return proxies[publicKeyHash];
    }
}

