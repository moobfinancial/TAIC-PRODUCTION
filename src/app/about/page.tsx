import { Metadata } from 'next';
import { Globe, Cpu, ShieldCheck, Users, Zap, Lightbulb } from 'lucide-react'; // Example icons

export const metadata: Metadata = {
  title: 'About TAIC | Reimagining Global Commerce',
  description: 'Learn about TAIC, our vision to blend AI and blockchain for a personalized, efficient, and rewarding e-commerce ecosystem, and our parent company Talk Ai 247.com.',
};

const Section = ({ title, children, icon: Icon }: { title: string; children: React.ReactNode; icon?: React.ElementType }) => (
  <section className="mb-10 md:mb-12">
    <div className="flex items-center mb-4">
      {Icon && <Icon className="w-8 h-8 text-primary-600 dark:text-primary-400 mr-3" />}
      <h2 className="text-2xl md:text-3xl font-semibold text-gray-800 dark:text-gray-100">{title}</h2>
    </div>
    <div className="prose prose-lg dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 space-y-4">
      {children}
    </div>
  </section>
);

export default function AboutUsPage() {
  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <header className="text-center mb-12 md:mb-16">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 dark:text-white">About TAIC</h1>
        <p className="mt-3 text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
          Building the future of e-commerce through connection, intelligence, and shared value.
        </p>
      </header>

      <Section title="Our Vision: Reimagining Global Commerce" icon={Globe}>
        <p>At TAIC, we believe the future of e-commerce is more than just transactions—it's about connection, intelligence, and shared value. We are building a global marketplace where cutting-edge technology empowers everyone. Our vision is to seamlessly blend artificial intelligence and blockchain to create an e-commerce ecosystem that is more personalized, efficient, and rewarding for both shoppers and entrepreneurs.</p>
      </Section>

      <Section title="Our Story: The Genesis of TAIC" icon={Lightbulb}>
        <p>TAIC was born from the innovative spirit of our parent company, <strong>Talk Ai 247.com</strong>. With a deep background in artificial intelligence and communication technologies, we saw a unique opportunity to solve some of the biggest challenges in online retail. We asked: What if we could create a platform that not only makes shopping smarter with AI but also gives back real value to its users through a native digital currency?</p>
        <p>From that question, TAIC was conceptualized—a platform designed from the ground up to integrate a powerful AI Shopping Assistant with our own utility token, TAIC Coin, creating a positive feedback loop that benefits the entire community.</p>
      </Section>

      <Section title="Our Technology: AI & Blockchain at the Core" icon={Cpu}>
        <p>TAIC is not just another marketplace. We are a technology company dedicated to enhancing the e-commerce experience.</p>
        <div className="grid md:grid-cols-2 gap-8 mt-6">
          <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-2 text-primary-700 dark:text-primary-300">Artificial Intelligence</h3>
            <p>Our sophisticated AI agent architecture is the brain of the platform. For shoppers, it powers a personal shopping assistant for tailored recommendations and a revolutionary Virtual Try-On feature. For merchants, our AI provides tools to optimize listings, understand market trends, and streamline operations.</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg shadow">
            <h3 className="text-xl font-semibold mb-2 text-primary-700 dark:text-primary-300">Blockchain Integration</h3>
            <p>The TAIC Coin and our rewards programs are built on the secure and efficient Fantom blockchain. This allows for transparent, fast, and potentially lower-cost transactions, forming the backbone of our "Stake to Shop" loyalty program.</p>
          </div>
        </div>
      </Section>

      <Section title="Our Values: The Principles That Guide Us">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[ 
            { icon: Zap, title: 'Innovation', text: "We are committed to pushing the boundaries of what's possible in e-commerce." },
            { icon: ShieldCheck, title: 'Security', text: 'The safety of our users, their data, and their assets is our highest priority. We build trust through robust security measures and transparent practices.' },
            { icon: Users, title: 'Community', text: 'We believe in the power of community. TAIC is designed to be a collaborative ecosystem where feedback is valued, and everyone has a stake in our collective success.' },
            { icon: Lightbulb, title: 'Empowerment', text: 'We aim to empower entrepreneurs worldwide by giving them access to advanced tools and new markets, and to empower shoppers by giving them more rewarding and personalized experiences.' },
          ].map(value => (
            <div key={value.title} className="flex flex-col items-center text-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow">
              <value.icon className="w-12 h-12 text-primary-600 dark:text-primary-400 mb-4" />
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">{value.title}</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">{value.text}</p>
            </div>
          ))}
        </div>
      </Section>

    </div>
  );
}
