import Link from 'next/link';
import { Metadata } from 'next';
// Consider adding an Image component if you have a visual for the assistant
// import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Meet Your AI Shopping Assistant | TAIC',
  description: 'Discover how the TAIC AI Shopping Assistant can help you find products, get personalized recommendations, compare items, and enhance your shopping experience.',
};

interface Feature {
  id: number;
  title: string;
  description: string;
  icon: string; // Placeholder for icon
}

export default function AiAssistantPage() {
  const features: Feature[] = [
    {
      id: 1,
      title: 'Personalized Product Recommendations',
      description: "Tell our AI assistant what you're looking for, your preferences, or even your mood, and get tailored product suggestions just for you.",
      icon: '🎯',
    },
    {
      id: 2,
      title: 'Smart Product Search & Discovery',
      description: 'Go beyond simple keyword searches. Ask complex questions, describe features, or find items based on use-cases. Our AI understands natural language.',
      icon: '🔍',
    },
    {
      id: 3,
      title: 'Effortless Product Comparison',
      description: 'Struggling to choose between products? Ask the AI assistant to compare features, prices, and reviews side-by-side to help you make the best decision.',
      icon: '⚖️',
    },
    {
      id: 4,
      title: 'Trend Spotting & Gift Ideas',
      description: 'Not sure what to buy? Get inspired! Our AI can suggest trending products, unique gift ideas for any occasion, or help you discover items you never knew you needed.',
      icon: '💡',
    },
    {
      id: 5,
      title: 'Instant Answers & Support',
      description: 'Have quick questions about a product or our services? The AI assistant can provide instant answers and guide you to the right resources.',
      icon: '💬',
    },
    {
      id: 6,
      title: 'Seamless Shopping Journey',
      description: 'From finding the right item to adding it to your cart, our AI assistant is designed to make your shopping experience smoother and more enjoyable.',
      icon: '🛒',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <header className="text-center mb-16">
        {/* Optional: Add an image/icon for the AI assistant here */}
        {/* <Image src="/images/ai-assistant-hero.png" alt="AI Shopping Assistant" width={150} height={150} className="mx-auto mb-6" /> */}
        <h1 className="text-4xl font-bold text-purple-600 mb-4">Your Smart Shopping Companion</h1>
        <p className="text-xl text-muted-foreground">
          Let our AI Shopping Assistant revolutionize the way you discover and buy products.
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {features.map((feature) => (
          <div key={feature.id} className="p-6 bg-white shadow-xl rounded-lg">
            <div className="text-3xl mb-3">{feature.icon}</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">{feature.title}</h2>
            <p className="text-gray-700 leading-relaxed">{feature.description}</p>
          </div>
        ))}
      </div>
      
      <section className="p-8 bg-purple-50 rounded-lg text-center mb-12">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Ready to Experience Smarter Shopping?</h2>
        <p className="text-gray-700 leading-relaxed mb-6">
          The AI Shopping Assistant is integrated directly into your browsing experience. 
          Look for the assistant icon or prompt as you shop to get started.
        </p>
        {/* This link might go to a page where the assistant is prominently featured, or a general products page */}
        <Link href="/products" 
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300">
          Explore Products with AI Help
        </Link>
      </section>

      <div className="text-center">
        <p className="text-gray-600 mb-2">Want to learn more about the tech behind it?</p>
        <Link href="/about#technology" className="text-purple-600 hover:text-purple-800 font-medium">
          Our Technology &rarr;
        </Link>
      </div>
    </div>
  );
}
