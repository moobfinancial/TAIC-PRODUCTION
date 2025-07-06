import { ethers } from 'ethers';
import { 
  NetworkType, 
  SUPPORTED_NETWORKS, 
  TAIC_TOKEN_ADDRESSES, 
  ERC20_ABI,
  validateWalletAddress,
  getNetworkProvider,
  getTAICBalance,
  estimateTransferGas,
  validateSufficientBalance
} from './walletUtils';

export interface PayoutTransaction {
  id: string;
  merchantId: string;
  payoutRequestId: number;
  fromAddress: string;
  toAddress: string;
  amount: string;
  network: NetworkType;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  transactionHash?: string;
  gasUsed?: string;
  gasPrice?: string;
  blockNumber?: number;
  confirmations?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletBalance {
  address: string;
  network: NetworkType;
  taicBalance: string;
  nativeBalance: string;
  lastUpdated: Date;
}

export interface PayoutEstimate {
  amount: string;
  network: NetworkType;
  gasEstimate: {
    gasLimit: string;
    gasPrice: string;
    estimatedFee: string;
  };
  netAmount: string;
  canProceed: boolean;
  errors: string[];
}

/**
 * Crypto Wallet Service for handling merchant payouts
 */
export class CryptoWalletService {
  private treasuryWallet: ethers.Wallet | null = null;
  private providers: Map<NetworkType, ethers.JsonRpcProvider> = new Map();

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize network providers
   */
  private initializeProviders(): void {
    Object.entries(SUPPORTED_NETWORKS).forEach(([network, config]) => {
      if (network !== 'BITCOIN') {
        try {
          const provider = new ethers.JsonRpcProvider(config.rpcUrl);
          this.providers.set(network as NetworkType, provider);
        } catch (error) {
          console.error(`Failed to initialize provider for ${network}:`, error);
        }
      }
    });
  }

  /**
   * Initialize treasury wallet from private key (for server-side operations)
   */
  public initializeTreasuryWallet(privateKey: string): void {
    try {
      this.treasuryWallet = new ethers.Wallet(privateKey);
      console.log('Treasury wallet initialized:', this.treasuryWallet.address);
    } catch (error) {
      console.error('Failed to initialize treasury wallet:', error);
      throw new Error('Invalid treasury wallet private key');
    }
  }

  /**
   * Get wallet balance for multiple networks
   */
  public async getWalletBalances(address: string, networks: NetworkType[]): Promise<WalletBalance[]> {
    const balances: WalletBalance[] = [];

    for (const network of networks) {
      try {
        if (network === 'BITCOIN') {
          // Bitcoin balance checking would require different implementation
          balances.push({
            address,
            network,
            taicBalance: '0',
            nativeBalance: '0',
            lastUpdated: new Date()
          });
          continue;
        }

        const provider = this.providers.get(network);
        if (!provider) {
          console.warn(`Provider not available for ${network}`);
          continue;
        }

        const [taicBalance, nativeBalance] = await Promise.all([
          getTAICBalance(address, network).catch(() => '0'),
          provider.getBalance(address).then(balance => ethers.formatEther(balance)).catch(() => '0')
        ]);

        balances.push({
          address,
          network,
          taicBalance,
          nativeBalance,
          lastUpdated: new Date()
        });
      } catch (error) {
        console.error(`Error getting balance for ${address} on ${network}:`, error);
      }
    }

    return balances;
  }

  /**
   * Estimate payout costs and validate feasibility
   */
  public async estimatePayout(
    toAddress: string,
    amount: string,
    network: NetworkType
  ): Promise<PayoutEstimate> {
    const errors: string[] = [];

    // Validate destination address
    if (!validateWalletAddress(toAddress, network)) {
      errors.push(`Invalid ${network} wallet address`);
    }

    // Validate amount
    if (parseFloat(amount) <= 0) {
      errors.push('Amount must be greater than 0');
    }

    let gasEstimate = {
      gasLimit: '0',
      gasPrice: '0',
      estimatedFee: '0'
    };

    let netAmount = amount;

    try {
      if (network !== 'BITCOIN' && this.treasuryWallet) {
        // Estimate gas costs for EVM networks
        gasEstimate = await estimateTransferGas(
          this.treasuryWallet.address,
          toAddress,
          amount,
          network
        );

        // For TAIC payouts, gas is paid by treasury, so net amount is the same
        netAmount = amount;
      }
    } catch (error) {
      errors.push(`Failed to estimate transaction costs: ${error}`);
    }

    return {
      amount,
      network,
      gasEstimate,
      netAmount,
      canProceed: errors.length === 0,
      errors
    };
  }

  /**
   * Execute a payout transaction
   */
  public async executePayout(
    payoutRequestId: number,
    merchantId: string,
    toAddress: string,
    amount: string,
    network: NetworkType
  ): Promise<PayoutTransaction> {
    if (!this.treasuryWallet) {
      throw new Error('Treasury wallet not initialized');
    }

    const transactionId = `payout_${payoutRequestId}_${Date.now()}`;

    const payoutTx: PayoutTransaction = {
      id: transactionId,
      merchantId,
      payoutRequestId,
      fromAddress: this.treasuryWallet.address,
      toAddress,
      amount,
      network,
      currency: 'TAIC',
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    try {
      // Validate inputs
      if (!validateWalletAddress(toAddress, network)) {
        throw new Error(`Invalid ${network} wallet address`);
      }

      if (network === 'BITCOIN') {
        throw new Error('Bitcoin payouts not yet implemented');
      }

      // Get provider and connect wallet
      const provider = this.providers.get(network);
      if (!provider) {
        throw new Error(`Provider not available for ${network}`);
      }

      const connectedWallet = this.treasuryWallet.connect(provider);

      // Get token contract
      const tokenAddress = TAIC_TOKEN_ADDRESSES[network as keyof typeof TAIC_TOKEN_ADDRESSES];
      if (!tokenAddress) {
        throw new Error(`TAIC token not available on ${network}`);
      }

      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, connectedWallet);

      // Get token decimals and convert amount
      const decimals = await tokenContract.decimals();
      const amountWei = ethers.parseUnits(amount, decimals);

      // Check treasury balance
      const treasuryBalance = await tokenContract.balanceOf(this.treasuryWallet.address);
      if (treasuryBalance < amountWei) {
        throw new Error('Insufficient treasury balance for payout');
      }

      payoutTx.status = 'PROCESSING';
      payoutTx.updatedAt = new Date();

      // Execute the transfer
      const tx = await tokenContract.transfer(toAddress, amountWei);
      payoutTx.transactionHash = tx.hash;

      console.log(`Payout transaction submitted: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      
      payoutTx.status = 'COMPLETED';
      payoutTx.gasUsed = receipt.gasUsed.toString();
      payoutTx.gasPrice = tx.gasPrice?.toString() || '0';
      payoutTx.blockNumber = receipt.blockNumber;
      payoutTx.confirmations = 1; // Initial confirmation
      payoutTx.updatedAt = new Date();

      console.log(`Payout completed: ${tx.hash} in block ${receipt.blockNumber}`);

      return payoutTx;

    } catch (error: any) {
      console.error(`Payout execution failed for ${transactionId}:`, error);
      
      payoutTx.status = 'FAILED';
      payoutTx.error = error.message || 'Unknown error occurred';
      payoutTx.updatedAt = new Date();

      throw error;
    }
  }

  /**
   * Check transaction status and update confirmations
   */
  public async checkTransactionStatus(
    transactionHash: string,
    network: NetworkType
  ): Promise<{ status: string; confirmations: number; blockNumber?: number }> {
    try {
      if (network === 'BITCOIN') {
        throw new Error('Bitcoin transaction checking not implemented');
      }

      const provider = this.providers.get(network);
      if (!provider) {
        throw new Error(`Provider not available for ${network}`);
      }

      const receipt = await provider.getTransactionReceipt(transactionHash);
      if (!receipt) {
        return { status: 'PENDING', confirmations: 0 };
      }

      const currentBlock = await provider.getBlockNumber();
      const confirmations = currentBlock - receipt.blockNumber + 1;

      let status = 'COMPLETED';
      if (receipt.status === 0) {
        status = 'FAILED';
      } else if (confirmations < 3) {
        status = 'PROCESSING';
      }

      return {
        status,
        confirmations,
        blockNumber: receipt.blockNumber
      };

    } catch (error) {
      console.error(`Error checking transaction status for ${transactionHash}:`, error);
      return { status: 'UNKNOWN', confirmations: 0 };
    }
  }

  /**
   * Validate treasury wallet has sufficient balance for payouts
   */
  public async validateTreasuryBalance(
    requiredAmount: string,
    network: NetworkType
  ): Promise<{ sufficient: boolean; balance: string; required: string }> {
    if (!this.treasuryWallet) {
      throw new Error('Treasury wallet not initialized');
    }

    try {
      const balance = await getTAICBalance(this.treasuryWallet.address, network);
      const sufficient = parseFloat(balance) >= parseFloat(requiredAmount);

      return {
        sufficient,
        balance,
        required: requiredAmount
      };
    } catch (error) {
      console.error(`Error validating treasury balance on ${network}:`, error);
      throw error;
    }
  }

  /**
   * Get treasury wallet address
   */
  public getTreasuryAddress(): string | null {
    return this.treasuryWallet?.address || null;
  }

  /**
   * Batch process multiple payouts (for automated processing)
   */
  public async batchProcessPayouts(
    payouts: Array<{
      payoutRequestId: number;
      merchantId: string;
      toAddress: string;
      amount: string;
      network: NetworkType;
    }>
  ): Promise<PayoutTransaction[]> {
    const results: PayoutTransaction[] = [];

    for (const payout of payouts) {
      try {
        const result = await this.executePayout(
          payout.payoutRequestId,
          payout.merchantId,
          payout.toAddress,
          payout.amount,
          payout.network
        );
        results.push(result);
      } catch (error) {
        console.error(`Batch payout failed for request ${payout.payoutRequestId}:`, error);
        // Continue with other payouts even if one fails
      }
    }

    return results;
  }
}

// Singleton instance for server-side use
export const cryptoWalletService = new CryptoWalletService();
