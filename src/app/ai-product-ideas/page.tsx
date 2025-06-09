import Link from 'next/link';
import { Metadata } from 'next';
// import Image from 'next/image'; // Optional: if you have a visual for this tool

export const metadata: Metadata = {
  title: 'AI Product Idea Generator | Discover Your Next Bestseller with TAIC',
  description: 'Unleash your creativity with the TAIC AI Product Idea Generator. Get data-driven suggestions, explore niche markets, and find inspiration for new products to sell.',
};

interface IdeaFeature {
  id: number;
  title: string;
  description: string;
  icon: string; // Placeholder for icon
}

export default function AiProductIdeasPage() {
  const features: IdeaFeature[] = [
    {
      id: 1,
      title: 'Spark Creativity & Innovation',
      description: 'Stuck in a creative rut? Our AI analyzes market trends, consumer needs, and emerging niches to provide you with fresh and innovative product ideas.',
      icon: '💡',
    },
    {
      id: 2,
      title: 'Data-Driven Suggestions',
      description: 'Move beyond guesswork. Get product ideas backed by insights, helping you identify potential bestsellers and underserved market segments.',
      icon: '📊',
    },
    {
      id: 3,
      title: 'Explore Niche Markets',
      description: 'Discover untapped opportunities. The AI can help you find niche products with high demand and low competition, giving you a competitive edge.',
      icon: '🎯',
    },
    {
      id: 4,
      title: 'Tailored to Your Interests',
      description: 'Provide keywords, categories, or describe your target audience, and our AI will generate ideas relevant to your business focus or passions.',
      icon: '⚙️',
    },
    {
      id: 5,
      title: 'Perfect for Entrepreneurs & Creators',
      description: 'Whether you\'re an established seller looking to expand or a new entrepreneur seeking your first product, our AI tool is designed to inspire.',
      icon: '🚀',
    },
    {
      id: 6,
      title: 'Easy to Use Interface',
      description: 'Simply input your criteria and let the AI do the hard work. Get a list of potential product ideas in moments, complete with brief explanations.',
      icon: '🖱️',
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <header className="text-center mb-16">
        {/* <Image src="/images/ai-product-ideas-hero.png" alt="AI Product Idea Generator" width={150} height={150} className="mx-auto mb-6" /> */}
        <h1 className="text-4xl font-bold text-purple-600 mb-4">Discover Your Next Big Idea</h1>
        <p className="text-xl text-muted-foreground">
          Fuel your entrepreneurial spirit with the TAIC AI Product Idea Generator.
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
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">Ready to Find Your Winning Product?</h2>
        <p className="text-gray-700 leading-relaxed mb-6">
          Our AI Product Idea Generator is a powerful tool for merchants and creators. 
          Access it through your merchant dashboard or explore its capabilities now.
        </p>
        {/* Link to the actual tool if it exists, or to merchant registration */}
        <Link href="/merchant/dashboard/tools/product-ideas" // Example link, adjust as needed
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition duration-300 mr-4">
          Try the AI Idea Generator
        </Link>
        <Link href="/sell" 
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-3 px-8 rounded-lg text-lg transition duration-300">
          Learn About Selling on TAIC
        </Link>
      </section>

      <div className="text-center">
        <p className="text-gray-600">
          Combine these ideas with our <Link href="/sell/features" className="text-purple-600 hover:text-purple-800 font-medium">merchant tools</Link> to build a successful online store.
        </p>
      </div>
    </div>
  );
}
