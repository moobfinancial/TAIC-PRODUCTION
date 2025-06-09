import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'TAIC Coin (TAIC) - Official Risk Disclosure | TAIC',
  description: 'Understand the key risks associated with purchasing, holding, and using TAIC Coin (TAIC) on our platform.',
};

const RiskSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-6 md:mb-8">
    <h2 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">{title}</h2>
    <div className="prose prose-md dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-3">
      {children}
    </div>
  </section>
);

export default function RiskDisclosurePage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <header className="text-center mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">TAIC Coin (TAIC) - Official Risk Disclosure</h1>
      </header>

      <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 dark:border-red-400 p-6 md:p-8 rounded-md mb-8 md:mb-12 shadow">
        <h2 className="text-xl font-semibold text-red-700 dark:text-red-300 mb-2">Introduction</h2>
        <p className="text-red-600 dark:text-red-200">
          This document outlines the key risks associated with purchasing, holding, and using TAIC Coin (TAIC) on our platform. The cryptocurrency market is highly volatile, and you should read this disclosure carefully and conduct your own research before transacting with TAIC. By using TAIC Coin, you acknowledge and accept these risks.
        </p>
      </div>

      <RiskSection title="Market & Price Volatility Risk">
        <p>The value of TAIC Coin can and will fluctuate significantly. It can be influenced by market trends, regulatory news, platform activity, and broader economic factors. You could lose some or all of the money you spend to acquire TAIC Coin. Past performance is not an indicator of future value. There is no guarantee that TAIC Coin will maintain or increase in value.</p>
      </RiskSection>

      <RiskSection title="Regulatory Risk">
        <p>The laws and regulations governing cryptocurrencies, digital assets, and blockchain technology are still evolving and vary significantly by jurisdiction. Future changes in legislation or regulatory actions in your jurisdiction or internationally could impact the legality, use, taxation, and value of TAIC Coin. This could include restrictions on buying, selling, or holding TAIC Coin, or changes that affect the operation of the TAIC platform.</p>
      </RiskSection>

      <RiskSection title="Security & Custody Risk">
        <p>You are solely responsible for the security of your cryptocurrency wallet, private keys, and any credentials used to access your TAIC Coin. TAIC will never ask for your private keys or passwords. Loss of access to your wallet (e.g., due to forgotten passwords, lost recovery phrases, or hardware failure) will result in the permanent loss of your TAIC Coin. While TAIC implements robust security measures on our platform to protect our systems, we cannot protect you from personal security failures, malware on your devices, or phishing attacks targeting you directly.</p>
      </RiskSection>

      <RiskSection title="Liquidity Risk">
        <p>Liquidity refers to the ease with which an asset can be converted into cash or other assets without significantly affecting its price. There may be limited ability to exchange TAIC Coin for traditional currency (like USD or EUR) or other cryptocurrencies. Market conditions, trading volumes, and the availability of exchanges or platforms supporting TAIC Coin could impact its liquidity. This means you may not be able to sell your TAIC Coin quickly or at your desired price.</p>
      </RiskSection>

      <RiskSection title="Smart Contract Risk">
        <p>TAIC Coin operates via smart contracts deployed on the Fantom blockchain. While these smart contracts are developed with care and may be audited by third parties, all smart contracts carry inherent risks. These risks include potential bugs, vulnerabilities, or programming errors that could be exploited by malicious actors, potentially leading to a loss of funds or an inability to access your TAIC Coin. Audits do not guarantee that a smart contract is free from all vulnerabilities.</p>
      </RiskSection>

      <RiskSection title="'Stake to Shop' Program Risk">
        <p>Participating in the "Stake to Shop" program involves locking your TAIC Coin in a smart contract for a specified period to earn potential rewards. This carries the same smart contract risks mentioned above. Furthermore, the value of your staked assets could decrease during the staking period due to market volatility. There may also be risks associated with the terms of the staking program, such as penalties for early withdrawal (if permitted) or changes to reward rates.</p>
      </RiskSection>

      <div className="mt-10 md:mt-12 p-6 bg-gray-100 dark:bg-gray-800 rounded-lg shadow">
        <h2 className="text-xl md:text-2xl font-semibold text-gray-800 dark:text-gray-100 mb-3">Disclaimer</h2>
        <p className="text-gray-700 dark:text-gray-300">
          TAIC Coin is a utility token designed for use within the TAIC e-commerce ecosystem to facilitate transactions, access features, and participate in reward programs. It is not intended to be a security, an investment vehicle, or a financial instrument. TAIC is not a registered financial advisor, broker, or dealer. The information provided in this disclosure or elsewhere on the TAIC platform does not constitute financial advice, investment advice, trading advice, or any other sort of advice. You should conduct your own due diligence and consult with an independent financial advisor before making any decisions related to TAIC Coin.
        </p>
        <p className="mt-3 text-gray-700 dark:text-gray-300">
          By acquiring, holding, or using TAIC Coin, you represent that you understand and accept all the risks outlined in this disclosure and any other risks not explicitly mentioned but inherent in dealing with cryptocurrencies and blockchain-based systems.
        </p>
      </div>

    </div>
  );
}
