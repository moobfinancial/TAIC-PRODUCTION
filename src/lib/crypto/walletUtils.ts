import { ethers } from 'ethers';

// Supported networks configuration
export const SUPPORTED_NETWORKS = {
  FANTOM: {
    chainId: 250,
    name: 'Fantom Opera',
    symbol: 'FTM',
    rpcUrl: 'https://rpc.ftm.tools/',
    explorerUrl: 'https://ftmscan.com',
    isTestnet: false
  },
  ETHEREUM: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
    explorerUrl: 'https://etherscan.io',
    isTestnet: false
  },
  POLYGON: {
    chainId: 137,
    name: 'Polygon Mainnet',
    symbol: 'MATIC',
    rpcUrl: 'https://polygon-rpc.com/',
    explorerUrl: 'https://polygonscan.com',
    isTestnet: false
  },
  BSC: {
    chainId: 56,
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    rpcUrl: 'https://bsc-dataseed1.binance.org/',
    explorerUrl: 'https://bscscan.com',
    isTestnet: false
  },
  BITCOIN: {
    chainId: 0, // Bitcoin doesn't use EVM chainId
    name: 'Bitcoin',
    symbol: 'BTC',
    rpcUrl: 'https://blockstream.info/api',
    explorerUrl: 'https://blockstream.info',
    isTestnet: false
  }
} as const;

export type NetworkType = keyof typeof SUPPORTED_NETWORKS;

// TAIC Token Contract Addresses (placeholder - update with actual addresses)
export const TAIC_TOKEN_ADDRESSES = {
  FANTOM: '0x1234567890abcdef1234567890abcdef12345678', // Placeholder
  ETHEREUM: '0x1234567890abcdef1234567890abcdef12345678', // Placeholder
  POLYGON: '0x1234567890abcdef1234567890abcdef12345678', // Placeholder
  BSC: '0x1234567890abcdef1234567890abcdef12345678', // Placeholder
} as const;

// ERC-20 ABI for TAIC token interactions
export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)'
];

/**
 * Validates a wallet address for the specified network
 */
export function validateWalletAddress(address: string, network: NetworkType): boolean {
  try {
    if (network === 'BITCOIN') {
      // Bitcoin address validation (simplified)
      return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/.test(address);
    } else {
      // Ethereum-based networks
      return ethers.isAddress(address);
    }
  } catch (error) {
    console.error('Error validating wallet address:', error);
    return false;
  }
}

/**
 * Formats a wallet address for display (truncated)
 */
export function formatWalletAddress(address: string, startChars = 6, endChars = 4): string {
  if (!address) return '';
  if (address.length <= startChars + endChars) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/**
 * Gets the network provider for the specified network
 */
export function getNetworkProvider(network: NetworkType): ethers.JsonRpcProvider | null {
  try {
    if (network === 'BITCOIN') {
      // Bitcoin doesn't use ethers provider
      return null;
    }
    
    const networkConfig = SUPPORTED_NETWORKS[network];
    return new ethers.JsonRpcProvider(networkConfig.rpcUrl);
  } catch (error) {
    console.error(`Error creating provider for ${network}:`, error);
    return null;
  }
}

/**
 * Gets TAIC token balance for an address on the specified network
 */
export async function getTAICBalance(address: string, network: NetworkType): Promise<string> {
  try {
    if (network === 'BITCOIN') {
      throw new Error('TAIC token not available on Bitcoin network');
    }

    const provider = getNetworkProvider(network);
    if (!provider) {
      throw new Error(`Failed to get provider for ${network}`);
    }

    const tokenAddress = TAIC_TOKEN_ADDRESSES[network as keyof typeof TAIC_TOKEN_ADDRESSES];
    if (!tokenAddress) {
      throw new Error(`TAIC token address not configured for ${network}`);
    }

    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const balance = await contract.balanceOf(address);
    const decimals = await contract.decimals();
    
    return ethers.formatUnits(balance, decimals);
  } catch (error) {
    console.error(`Error getting TAIC balance for ${address} on ${network}:`, error);
    throw error;
  }
}

/**
 * Estimates gas fee for a TAIC transfer on the specified network
 */
export async function estimateTransferGas(
  fromAddress: string,
  toAddress: string,
  amount: string,
  network: NetworkType
): Promise<{ gasLimit: string; gasPrice: string; estimatedFee: string }> {
  try {
    if (network === 'BITCOIN') {
      throw new Error('Gas estimation not applicable for Bitcoin network');
    }

    const provider = getNetworkProvider(network);
    if (!provider) {
      throw new Error(`Failed to get provider for ${network}`);
    }

    const tokenAddress = TAIC_TOKEN_ADDRESSES[network as keyof typeof TAIC_TOKEN_ADDRESSES];
    if (!tokenAddress) {
      throw new Error(`TAIC token address not configured for ${network}`);
    }

    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const decimals = await contract.decimals();
    const amountWei = ethers.parseUnits(amount, decimals);

    // Estimate gas for transfer
    const gasLimit = await contract.transfer.estimateGas(toAddress, amountWei);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');

    const estimatedFee = gasLimit * gasPrice;

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: ethers.formatUnits(gasPrice, 'gwei'),
      estimatedFee: ethers.formatEther(estimatedFee)
    };
  } catch (error) {
    console.error(`Error estimating gas for transfer on ${network}:`, error);
    throw error;
  }
}

/**
 * Validates if an address has sufficient balance for a transfer including gas fees
 */
export async function validateSufficientBalance(
  address: string,
  transferAmount: string,
  network: NetworkType
): Promise<{ sufficient: boolean; balance: string; required: string; gasEstimate?: string }> {
  try {
    if (network === 'BITCOIN') {
      // Bitcoin balance validation would require different implementation
      throw new Error('Bitcoin balance validation not implemented');
    }

    const provider = getNetworkProvider(network);
    if (!provider) {
      throw new Error(`Failed to get provider for ${network}`);
    }

    // Get TAIC balance
    const taicBalance = await getTAICBalance(address, network);
    
    // Get native token balance for gas fees
    const nativeBalance = await provider.getBalance(address);
    const nativeBalanceFormatted = ethers.formatEther(nativeBalance);

    // Estimate gas fees
    const gasEstimate = await estimateTransferGas(address, address, transferAmount, network);
    
    const sufficient = parseFloat(taicBalance) >= parseFloat(transferAmount) && 
                      parseFloat(nativeBalanceFormatted) >= parseFloat(gasEstimate.estimatedFee);

    return {
      sufficient,
      balance: taicBalance,
      required: transferAmount,
      gasEstimate: gasEstimate.estimatedFee
    };
  } catch (error) {
    console.error(`Error validating balance for ${address} on ${network}:`, error);
    throw error;
  }
}

/**
 * Gets the explorer URL for a transaction
 */
export function getTransactionExplorerUrl(txHash: string, network: NetworkType): string {
  const networkConfig = SUPPORTED_NETWORKS[network];
  return `${networkConfig.explorerUrl}/tx/${txHash}`;
}

/**
 * Gets the explorer URL for an address
 */
export function getAddressExplorerUrl(address: string, network: NetworkType): string {
  const networkConfig = SUPPORTED_NETWORKS[network];
  if (network === 'BITCOIN') {
    return `${networkConfig.explorerUrl}/address/${address}`;
  }
  return `${networkConfig.explorerUrl}/address/${address}`;
}

/**
 * Converts amount to the smallest unit for the network
 */
export function toWei(amount: string, network: NetworkType): string {
  if (network === 'BITCOIN') {
    // Bitcoin uses satoshis (8 decimals)
    return (parseFloat(amount) * 100000000).toString();
  } else {
    // EVM networks typically use 18 decimals for tokens
    return ethers.parseUnits(amount, 18).toString();
  }
}

/**
 * Converts amount from the smallest unit for the network
 */
export function fromWei(amount: string, network: NetworkType): string {
  if (network === 'BITCOIN') {
    // Bitcoin uses satoshis (8 decimals)
    return (parseFloat(amount) / 100000000).toString();
  } else {
    // EVM networks typically use 18 decimals for tokens
    return ethers.formatUnits(amount, 18);
  }
}

/**
 * Checks if a network supports smart contracts
 */
export function isSmartContractNetwork(network: NetworkType): boolean {
  return network !== 'BITCOIN';
}

/**
 * Gets the minimum payout amount for a network (in TAIC)
 */
export function getMinimumPayoutAmount(network: NetworkType): number {
  switch (network) {
    case 'ETHEREUM':
      return 50; // Higher minimum due to gas costs
    case 'BITCOIN':
      return 100; // Higher minimum due to transaction fees
    case 'FANTOM':
    case 'POLYGON':
    case 'BSC':
      return 10; // Lower gas costs
    default:
      return 10;
  }
}
