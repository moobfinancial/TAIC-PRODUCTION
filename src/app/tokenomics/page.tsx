
'use client';

import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Menu as MenuIcon,
  X as XIcon,
} from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ResponsiveContainer,
} from "recharts";
import { cn } from '@/lib/utils';

interface NavLink {
  id: string;
  label: string;
}

const navLinks: NavLink[] = [
  { id: 'introduction', label: 'Introduction' },
  { id: 'core-utility', label: 'Utility' },
  { id: 'token-supply', label: 'Supply' },
  { id: 'token-distribution', label: 'Distribution' },
  { id: 'staking-program', label: 'Staking' },
  { id: 'blockchain-tech', label: 'Technology' },
  { id: 'disclaimer', label: 'Disclaimer'},
];

const Placeholder = ({ children }: { children: React.ReactNode }) => (
  <span className="text-red-500 font-medium">{children}</span>
);

const IconPlaceholder = ({ icon, bgColor, textColor }: { icon: string, bgColor: string, textColor: string }) => (
    <span className={cn("inline-flex items-center justify-center w-7 h-7 text-xl rounded-full mr-2 leading-7", bgColor, textColor)}>
        {icon}
    </span>
);

const chartData = [
  { name: 'Company Treasury ([30]%)', value: 30, color: '#3B82F6' }, 
  { name: 'Team & Advisors ([15]%)', value: 15, color: '#8B5CF6' }, 
  { name: 'Ecosystem Dev. ([20]%)', value: 20, color: '#14B8A6' }, 
  { name: 'Staking Pool ([15]%)', value: 15, color: '#60A5FA' }, 
  { name: 'Community Incent. ([10]%)', value: 10, color: '#A78BFA' }, 
  { name: 'Public Sale (Opt.) ([10]%)', value: 10, color: '#5EEAD4' }, 
];

const chartConfig = chartData.reduce((acc, item) => {
  acc[item.name.replace(/\s*\[.*?\]%?|\(|\)/g, '').trim()] = { label: item.name.replace(/\s*\[.*?\]%?/g, ''), color: item.color };
  return acc;
}, {} as any);


export default function TokenomicsPage() {
  const [activeSection, setActiveSection] = useState<string>('introduction');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  
  // Create a ref callback that properly handles the ref assignment
  const setSectionRef = (id: string) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el;
  };
  const navRef = useRef<HTMLElement | null>(null);

  const mainNavbarHeight = 64; 

  useEffect(() => {
    const handleScroll = () => {
      const pageYOffset = window.pageYOffset;
      let currentSectionId = navLinks[0].id; 
      const navHeight = navRef.current?.offsetHeight || 0;
      const effectiveOffset = mainNavbarHeight + navHeight + 20;


      for (const section of navLinks) {
        const element = sectionRefs.current[section.id];
        if (element && element.offsetTop - effectiveOffset <= pageYOffset) {
          currentSectionId = section.id;
        } else {
          if (pageYOffset < (sectionRefs.current[navLinks[0].id]?.offsetTop ?? 0) - effectiveOffset && section.id === navLinks[0].id) {
             // If before the first section, keep first section active
          } else {
             break;
          }
        }
      }
      setActiveSection(currentSectionId);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); 
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = sectionRefs.current[sectionId];
    if (element && navRef.current) {
      const navHeight = navRef.current.offsetHeight;
      const targetPosition = element.offsetTop - mainNavbarHeight - navHeight;
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth',
      });
    }
    setMobileMenuOpen(false);
  };
  
  const formatLegendLabel = (value: string, entry: any) => {
    const { color } = entry;
    const originalEntry = chartData.find(d => d.name.startsWith(value.split(" (")[0]));
    return <span style={{ color: '#4B5563' }}>{originalEntry ? originalEntry.name : value}</span>;
  };

  return (
    <div className="bg-gray-100 text-gray-800 font-inter">
      <nav ref={navRef} className="sticky top-16 z-40 bg-white/90 backdrop-blur-md shadow-md">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex-shrink-0">
              <a onClick={() => scrollToSection('introduction')} className="text-xl font-bold text-purple-600 cursor-pointer">
                TAIC Tokenomics Sections
              </a>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-3">
                {navLinks.map((link) => (
                  <a
                    key={link.id}
                    onClick={() => scrollToSection(link.id)}
                    className={cn(
                      "px-2 py-2 rounded-md text-sm font-medium cursor-pointer hover:text-blue-500",
                      "transition-colors duration-300 border-b-2",
                      activeSection === link.id ? 'text-blue-500 border-blue-500' : 'text-gray-700 border-transparent hover:border-blue-300'
                    )}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                {mobileMenuOpen ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
              </Button>
            </div>
          </div>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden absolute w-full bg-white shadow-lg pb-3">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              {navLinks.map((link) => (
                <a
                  key={link.id}
                  onClick={() => scrollToSection(link.id)}
                  className={cn(
                    "block px-3 py-2 rounded-md text-base font-medium cursor-pointer",
                    activeSection === link.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50 hover:text-blue-500'
                  )}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </nav>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <main>
          <section id="introduction" ref={setSectionRef('introduction')} className="pt-20 -mt-16 md:pt-24 md:-mt-24">
            <h1 className="text-4xl md:text-5xl font-bold text-purple-600 mb-6 text-center">TAIC Tokenomics: Fueling the Talkai247 Ecosystem</h1>
            <p className="text-base md:text-lg text-gray-600 mb-16 text-center max-w-2xl mx-auto">Last Updated: <Placeholder>[Date of Last Update]</Placeholder></p>
            <Card className="bg-white shadow-xl rounded-xl p-6 mb-6">
              <p className="text-gray-700 leading-relaxed">The Talk AI Coin (TAIC) is the native utility token of the Talkai247 platform, designed to seamlessly integrate cryptocurrency benefits into our AI-driven services and innovative e-commerce ecosystem. TAIC aims to provide tangible value to its holders through clear use cases, sustainable economic design, and by directly contributing to the growth and utility of the Talkai247 platform. This document outlines the core principles of TAIC's tokenomics, including its utility, supply, distribution, and staking mechanisms. Our approach prioritizes long-term sustainability, user benefit, and transparent operations, managed centrally by Talkai247 to ensure agility and strategic alignment.</p>
            </Card>
          </section>

          <section id="core-utility" ref={setSectionRef('core-utility')} className="pt-20 -mt-16 md:pt-24 md:-mt-24">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4 text-center">Core Utility of TAIC</h2>
            <p className="text-lg text-gray-600 mb-16 text-center max-w-2xl mx-auto">TAIC is engineered with multiple layers of utility to ensure it plays a vital role within the Talkai247 ecosystem.</p>
            
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-white shadow-xl rounded-xl p-6 mb-6">
                <h3 className="text-xl font-semibold text-purple-500 mb-3 flex items-center">
                    <IconPlaceholder icon="🛒" bgColor="bg-blue-100" textColor="text-blue-600" />
                    Payment for Goods & Services
                </h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li><strong>E-commerce Platform:</strong> TAIC will be the primary cryptocurrency for purchasing products and services offered through our integrated dropshipping e-commerce marketplace. Users can shop for a wide range of items and pay directly with TAIC.</li>
                  <li><strong>AI Service Subscriptions:</strong> TAIC will be used to subscribe to Talkai247's advanced AI voice products, applications, and premium features, potentially offering users discounts or enhanced access when paying with TAIC.</li>
                </ul>
              </Card>
              <Card className="bg-white shadow-xl rounded-xl p-6 mb-6">
                <h3 className="text-xl font-semibold text-purple-500 mb-3 flex items-center">
                    <IconPlaceholder icon="📈" bgColor="bg-purple-100" textColor="text-purple-600" />
                    Staking for Loyalty & Benefits (MVP Focus)
                </h3>
                <p className="text-gray-600">Users can stake TAIC to receive tangible benefits: percentage discounts on e-commerce purchases, early access to new product listings or sales, and reduced fees for premium AI features. This model promotes holding TAIC and directly rewards active participation.</p>
              </Card>
            </div>

            <Card className="bg-white shadow-xl rounded-xl p-6 mt-2 mb-6"> {/* Adjusted mt-8 to mt-2 as grid has mb-6 */}
              <h3 className="text-xl font-semibold text-purple-500 mb-6 text-center">Future Utility Considerations (Post-MVP)</h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-lg text-teal-600 mb-1">Access to Premium AI Features</h4>
                  <p className="text-gray-600 text-sm">Holding or staking TAIC could unlock advanced functionalities of the AI shopping assistant or other premium AI services.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-lg text-teal-600 mb-1">Governance Rights</h4>
                  <p className="text-gray-600 text-sm">In later stages, Talkai247 may explore granting TAIC token holders a role in platform governance (subject to legal review).</p>
                </div>
              </div>
            </Card>
             <Card className="bg-white shadow-xl rounded-xl p-6 mt-2 mb-6">
                <h3 className="text-xl font-semibold text-purple-500 mb-6 text-center">Summary of TAIC Token Utility</h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className="text-left p-3 bg-indigo-100 text-indigo-800 font-semibold border-b border-gray-200">Utility Type</th>
                                <th className="text-left p-3 bg-indigo-100 text-indigo-800 font-semibold border-b border-gray-200">Description within TAIC Ecosystem</th>
                                <th className="text-left p-3 bg-indigo-100 text-indigo-800 font-semibold border-b border-gray-200">Benefit to User</th>
                                <th className="text-left p-3 bg-indigo-100 text-indigo-800 font-semibold border-b border-gray-200">Benefit to TAIC Platform</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="even:bg-gray-50">
                                <td className="p-3 border-b border-gray-200 font-medium">Payment for Goods & AI Services</td>
                                <td className="p-3 border-b border-gray-200">Primary medium of exchange for e-commerce and AI subscriptions.</td>
                                <td className="p-3 border-b border-gray-200">Seamless crypto-native shopping & service access; potential discounts.</td>
                                <td className="p-3 border-b border-gray-200">Drives primary demand for TAIC; facilitates platform revenue cycle.</td>
                            </tr>
                            <tr className="even:bg-gray-50">
                                <td className="p-3 border-b border-gray-200 font-medium">Staking for Discounts/Perks</td>
                                <td className="p-3 border-b border-gray-200">Lock up TAIC for e-commerce discounts, early access, or other benefits.</td>
                                <td className="p-3 border-b border-gray-200">Reduced prices; exclusive access; enhanced user status.</td>
                                <td className="p-3 border-b border-gray-200">Increases token lock-up (reducing circulating supply); fosters user loyalty & engagement.</td>
                            </tr>
                             <tr className="even:bg-gray-50">
                                <td className="p-3 border-b border-gray-200 font-medium italic">(Future) Access to Premium AI</td>
                                <td className="p-3 border-b border-gray-200">Holding/staking TAIC unlocks advanced AI functionalities.</td>
                                <td className="p-3 border-b border-gray-200">Enhanced AI capabilities; superior shopping/service assistance.</td>
                                <td className="p-3 border-b border-gray-200">Monetization path for advanced AI; incentivizes TAIC holding.</td>
                            </tr>
                             <tr className="even:bg-gray-50">
                                <td className="p-3 font-medium italic border-b border-gray-200">(Future) Governance Rights</td>
                                <td className="p-3 border-b border-gray-200">Token holders vote on platform development or community initiatives.</td>
                                <td className="p-3 border-b border-gray-200">Voice in platform evolution; sense of ownership.</td>
                                <td className="p-3 border-b border-gray-200">Potentially decentralized decision-making (long-term); community engagement.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </Card>
          </section>

          <section id="token-supply" ref={setSectionRef('token-supply')} className="pt-20 -mt-16 md:pt-24 md:-mt-24">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4 text-center">Token Supply & Economic Strategy</h2>
            <p className="text-lg text-gray-600 mb-16 text-center max-w-2xl mx-auto">TAIC's economic model is designed for predictability and sustainable value accrual, managed centrally by Talkai247.</p>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-white shadow-xl rounded-xl p-6 text-center mb-6">
                <h3 className="text-xl font-semibold text-purple-500 mb-3">Total Token Supply</h3>
                <p className="text-5xl font-extrabold text-blue-600 my-4"><Placeholder>[1,000,000,000 TAIC]</Placeholder></p>
                <p className="text-gray-600">(One Billion TAIC)</p>
                <p className="mt-2 text-sm text-gray-500">A fixed maximum supply. No additional TAIC tokens will ever be minted beyond this initial pre-minted supply.</p>
              </Card>
              <Card className="bg-white shadow-xl rounded-xl p-6 mb-6">
                <h3 className="text-xl font-semibold text-purple-500 mb-3 flex items-center">
                    <IconPlaceholder icon="🔥" bgColor="bg-red-100" textColor="text-red-600" />
                    Inflation/Deflation Strategy
                </h3>
                <p className="text-gray-600 mb-2"><strong>No Programmatic Inflation:</strong> With a fixed total supply, there is no ongoing programmatic inflation.</p>
                <p className="text-gray-600"><strong>Deflationary Mechanism - Token Burn:</strong></p>
                <ul className="list-disc list-inside text-gray-600 space-y-1 text-sm mt-1">
                  <li><strong>Burn Trigger:</strong> A percentage, e.g., <Placeholder>[X]%</Placeholder>, of TAIC collected from specific platform activities (e-commerce transaction fees, AI service subscriptions) will be regularly and transparently sent to a burn address.</li>
                  <li><strong>Objective:</strong> Reduce circulating supply over time as platform adoption grows, potentially increasing scarcity and value.</li>
                  <li><strong>Transparency:</strong> All burn events will be publicly announced and verifiable on the blockchain.</li>
                </ul>
              </Card>
            </div>
          </section>

          <section id="token-distribution" ref={setSectionRef('token-distribution')} className="pt-20 -mt-16 md:pt-24 md:-mt-24">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4 text-center">Token Distribution & Allocation</h2>
            <p className="text-lg text-gray-600 mb-16 text-center max-w-2xl mx-auto">The initial distribution supports long-term development, incentivizes stakeholders, and fosters a vibrant ecosystem.</p>
            <div className="grid md:grid-cols-3 gap-6 items-start">
              <Card className="md:col-span-1 bg-white shadow-xl rounded-xl p-6 mb-6">
                <h3 className="text-xl font-semibold text-purple-500 text-center mb-4">Allocation Overview</h3>
                 <div className="w-full max-w-lg mx-auto h-[300px] md:h-[350px]">
                    <ChartContainer config={chartConfig as any} className="h-full w-full">
                        <PieChart>
                            <ChartTooltip
                                cursor={false}
                                content={<ChartTooltipContent hideLabel indicator="dot" />}
                            />
                            <Pie
                                data={chartData}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                outerRadius="80%"
                                labelLine={false}
                                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                                    const RADIAN = Math.PI / 180;
                                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                                    return ( (percent * 100) > 5 ? 
                                        <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="10px">
                                            {`${(percent * 100).toFixed(0)}%`}
                                        </text> : null
                                    );
                                }}
                            >
                                {chartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} stroke={entry.color} />
                                ))}
                            </Pie>
                             <RechartsLegend 
                                content={({ payload }) => (
                                    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-4 text-xs text-gray-500">
                                    {payload?.map((entry, index) => (
                                        <li key={`item-${index}`} className="flex items-center">
                                        <span style={{ backgroundColor: entry.color }} className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"></span>
                                        {entry.value?.replace(/\s*\[.*?\]%?/g, '')}
                                        </li>
                                    ))}
                                    </ul>
                                )}
                            />
                        </PieChart>
                    </ChartContainer>
                </div>
                <p className="text-xs text-gray-500 mt-4 text-center">Hover over chart segments for details. Note: Percentages are illustrative (<Placeholder>[value]</Placeholder>).</p>
              </Card>
              <Card className="md:col-span-2 bg-white shadow-xl rounded-xl p-6 mb-6">
                <h3 className="text-xl font-semibold text-purple-500 mb-4">Key Allocation Purposes & Vesting</h3>
                <div className="space-y-3 text-sm text-gray-600">
                  <p><strong>Company Treasury (<Placeholder>[30]%</Placeholder>):</strong> Ongoing operations, development, marketing, partnerships, liquidity, strategic reserves. Managed by Talkai247.</p>
                  <p><strong>Team & Key Advisors (<Placeholder>[15]%</Placeholder>):</strong> Reward and retain core team. Vesting: <Placeholder>[1-year]</Placeholder> cliff, then linear over <Placeholder>[3 years]</Placeholder> (total <Placeholder>[4 years]</Placeholder>).</p>
                  <p><strong>Ecosystem Development & Partnerships (<Placeholder>[20]%</Placeholder>):</strong> Fund merchant onboarding, AI integrations, partnerships, grants. Released by Talkai247 over <Placeholder>[3-5 years]</Placeholder>.</p>
                  <p><strong>Staking Rewards Pool (Bootstrap) (<Placeholder>[15]%</Placeholder>):</strong> Kickstart staking rewards. Gradual release managed by Talkai247.</p>
                  <p><strong>Community & User Incentives (<Placeholder>[10]%</Placeholder>):</strong> Airdrops, campaigns, referrals, early user rewards. Released over <Placeholder>[1-2 years]</Placeholder>.</p>
                  <p><strong>Public Sale/Launchpad (Optional) (<Placeholder>[10]%</Placeholder>):</strong> If pursued, for capital & distribution. Terms TBD. Requires legal review.</p>
                </div>
                <p className="mt-4 text-xs text-gray-500">Stringent vesting for Team, Advisors, and any early investors aligns long-term incentives and prevents market disruption.</p>
              </Card>
            </div>
          </section>

          <section id="staking-program" ref={setSectionRef('staking-program')} className="pt-20 -mt-16 md:pt-24 md:-mt-24">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4 text-center">TAIC Staking Program: Utility-Driven Rewards</h2>
            <p className="text-lg text-gray-600 mb-16 text-center max-w-2xl mx-auto">Rewarding user loyalty and participation primarily through utility-based benefits.</p>
            <Card className="bg-white shadow-xl rounded-xl p-6 mb-8">
              <h3 className="text-xl font-semibold text-purple-500 mb-3">Staking for Loyalty Rewards & Platform Benefits (MVP)</h3>
              <p className="text-gray-600 mb-4"><strong>Core Principle:</strong> Staking primarily unlocks tangible utility benefits for sustainability and lower regulatory risk.</p>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { title: "E-commerce Discounts", icon: "🛒", text: "Stake [Y amount of TAIC] for a [Z]% discount on platform purchases." },
                    { title: "Reduced AI Service Fees", icon: "🤖", text: "Preferential rates or discounts on premium AI voice service subscriptions." },
                    { title: "Early Access", icon: "🌟", text: "Early access to new merchant listings, exclusive product drops, or beta AI features." },
                    { title: "Stake-to-Shop", icon: "🎁", text: "Earned utility rewards (credits/TAIC) accumulate towards items on your e-commerce wish list." }
                ].map(item => (
                    <div key={item.title} className="bg-purple-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-purple-700 mb-1 flex items-center"><span className="text-lg mr-2">{item.icon}</span>{item.title}</h4>
                        <p className="text-sm text-purple-600"><Placeholder>{item.text}</Placeholder></p>
                    </div>
                ))}
              </div>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-white shadow-xl rounded-xl p-6 mb-6">
                <h3 className="text-xl font-semibold text-purple-500 mb-3">Reward Sources & APY Philosophy</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-2 text-sm">
                  <li><strong>Primary Source (Long-Term):</strong> Actual platform revenue (AI subscriptions, e-commerce fees/commissions, affiliate commissions).</li>
                  <li><strong>Bootstrap Rewards (Initial):</strong> "Staking Rewards Pool" from token allocation to kickstart benefits.</li>
                  <li><strong>APY Approach (If Direct Yield Offered):</strong> Dynamic and variable, reflecting platform revenue. No unsustainable fixed high APYs. Focus on "real yield."</li>
                </ul>
              </Card>
               <Card className="bg-white shadow-xl rounded-xl p-6 mb-6">
                <h3 className="text-xl font-semibold text-purple-500 mb-3">Management and Security</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-2 text-sm">
                  <li><strong>Centralized Management:</strong> Staking program managed by Talkai247.</li>
                  <li><strong>Smart Contracts:</strong> Secure, audited contracts for TAIC deposits, tracking, and benefit/reward distribution.</li>
                  <li><strong>User Interface:</strong> Clear, intuitive interface on the Talkai247 platform.</li>
                </ul>
              </Card>
            </div>
            <Card className="bg-white shadow-xl rounded-xl p-6 mt-2 mb-6"> {/* Adjusted from mt-8 */}
                 <h3 className="text-xl font-semibold text-purple-500 mb-6 text-center">Staking Model Comparison & TAIC's Approach</h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr>
                                <th className="text-left p-3 bg-indigo-100 text-indigo-800 font-semibold border-b border-gray-200">Staking Model Type</th>
                                <th className="text-left p-3 bg-indigo-100 text-indigo-800 font-semibold border-b border-gray-200">TAIC's Approach (MVP Focus)</th>
                                <th className="text-left p-3 bg-indigo-100 text-indigo-800 font-semibold border-b border-gray-200">Sustainability Rationale</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="even:bg-gray-50">
                                <td className="p-3 border-b border-gray-200 font-medium">Loyalty Staking for Discounts/Perks (Recommended)</td>
                                <td className="p-3 border-b border-gray-200"><strong>Primary model.</strong> Users stake TAIC for e-commerce discounts, AI service perks, "Stake-to-Shop" benefits, early access.</td>
                                <td className="p-3 border-b border-gray-200">Highly sustainable as benefits are tied to platform utility and costs can be managed as operational/marketing expenses.</td>
                            </tr>
                            <tr className="even:bg-gray-50">
                                <td className="p-3 border-b border-gray-200 font-medium">Staking for TAIC Token Rewards (Emission-Based)</td>
                                <td className="p-3 border-b border-gray-200"><strong>Avoided.</strong> No new TAIC emissions to fund staking rewards beyond the initial bootstrap pool.</td>
                                <td className="p-3 border-b border-gray-200">Avoids hyperinflation and unsustainable APYs seen in some projects.</td>
                            </tr>
                             <tr className="even:bg-gray-50">
                                <td className="p-3 font-medium border-b border-gray-200">Staking for Revenue Share ("Real Yield")</td>
                                <td className="p-3 border-b border-gray-200"><strong>Future consideration.</strong> If implemented, APY would be directly funded by a transparent share of platform-generated revenue.</td>
                                <td className="p-3 border-b border-gray-200">Sustainable if platform is profitable. Aligns staker and platform interests. Carries higher regulatory scrutiny.</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </Card>
          </section>

          <section id="blockchain-tech" ref={setSectionRef('blockchain-tech')} className="pt-20 -mt-16 md:pt-24 md:-mt-24">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-4 text-center">Blockchain and Technology</h2>
            <p className="text-lg text-gray-600 mb-16 text-center max-w-2xl mx-auto">Underpinning TAIC with scalable and efficient technology.</p>
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-white shadow-xl rounded-xl p-6 mb-6">
                <h3 className="text-xl font-semibold text-purple-500 mb-3 flex items-center">
                    <IconPlaceholder icon="🔗" bgColor="bg-teal-100" textColor="text-teal-600" />
                    Blockchain Platform
                </h3>
                <p className="text-gray-600">TAIC will be launched on a scalable and cost-effective blockchain, likely an <strong className="font-medium"><Placeholder>[EVM-compatible Layer 2 solution (e.g., Polygon) or a similar high-throughput chain (e.g., BNB Smart Chain)]</Placeholder></strong>. This prioritizes low transaction fees, fast confirmation times, and a robust developer ecosystem.</p>
              </Card>
              <Card className="bg-white shadow-xl rounded-xl p-6 mb-6">
                <h3 className="text-xl font-semibold text-purple-500 mb-3 flex items-center">
                    <IconPlaceholder icon="📜" bgColor="bg-teal-100" textColor="text-teal-600" />
                    Token Standard
                </h3>
                <p className="text-gray-600">TAIC will adhere to a widely recognized token standard <strong className="font-medium"><Placeholder>(e.g., ERC-20 if on Ethereum/Polygon, BEP-20 if on BNB Chain)</Placeholder></strong> to ensure compatibility with standard wallets and exchanges.</p>
              </Card>
            </div>
          </section>

          <section id="disclaimer" ref={setSectionRef('disclaimer')} className="pt-20 -mt-16 md:pt-24 md:-mt-24">
             <Card className="border-l-4 border-yellow-400 bg-yellow-50 p-6 shadow-xl rounded-xl mb-6">
                <h3 className="text-xl font-semibold text-yellow-700 mb-3">Disclaimer</h3>
                <p className="text-sm text-yellow-700">This tokenomics document is for informational purposes only and is subject to change based on further development, market conditions, and legal/regulatory guidance. The TAIC token is intended as a utility token for use within the Talkai247 ecosystem. It is not intended to be an investment vehicle. Potential users should carefully review all platform documentation and understand the risks involved before acquiring or using TAIC tokens.</p>
            </Card>
          </section>
        </main>
      </div>
    </div>
  );
}
