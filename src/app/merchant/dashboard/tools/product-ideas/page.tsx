'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Lightbulb, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Define the types based on the schemas in product-idea-generator.ts
type ProductIdea = {
  title: string;
  description: string;
  targetAudience?: string;
  estimatedPrice?: string;
  marketingTips?: string;
};

type ProductIdeaResponse = {
  ideas: ProductIdea[];
  summary: string;
  relatedProducts?: Array<{
    id: string;
    name: string;
    description?: string;
    price: number;
    image_url?: string;
    category_name?: string;
  }>;
};

export default function ProductIdeasPage() {
  const [description, setDescription] = useState('');
  const [generatorMode, setGeneratorMode] = useState('product');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProductIdeaResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description.trim()) {
      setError('Please provide a description of your product idea.');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/ai/product-ideas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description,
          generatorMode,
          // imageUrl is optional and not included in this basic implementation
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate product ideas');
      }
      
      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Lightbulb className="h-8 w-8 text-yellow-500" />
            Product Idea Generator
          </h1>
          <p className="text-muted-foreground mt-1">
            Get AI-powered suggestions to enhance your product ideas or discover new opportunities.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/merchant/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Generate Product Ideas</CardTitle>
            <CardDescription>
              Describe your product concept or market niche, and our AI will generate innovative ideas and suggestions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Tabs defaultValue="product" onValueChange={(value) => setGeneratorMode(value)}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="product">Product Enhancement</TabsTrigger>
                  <TabsTrigger value="gift">Gift Ideas</TabsTrigger>
                </TabsList>
                <TabsContent value="product" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="product-description">Describe your product idea or niche</Label>
                    <Textarea
                      id="product-description"
                      placeholder="E.g., I'm thinking of creating eco-friendly water bottles with built-in filtration..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={6}
                      className="resize-none"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="gift" className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label htmlFor="gift-description">Describe the gift recipient or occasion</Label>
                    <Textarea
                      id="gift-description"
                      placeholder="E.g., Looking for gift ideas for a tech-savvy 30-year-old who enjoys outdoor activities..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={6}
                      className="resize-none"
                    />
                  </div>
                </TabsContent>
              </Tabs>

              {error && (
                <Alert variant="destructive">
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Ideas...
                  </>
                ) : (
                  'Generate Ideas'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Tips for Best Results</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 list-disc pl-5">
              <li>Be specific about your target audience</li>
              <li>Include any unique features you have in mind</li>
              <li>Mention price points or quality level</li>
              <li>Specify any sustainability or ethical considerations</li>
              <li>Note any market trends you're trying to capitalize on</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {result && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Generated Ideas</CardTitle>
            <CardDescription>{result.summary}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {result.ideas.map((idea, index) => (
                <div key={index} className="border rounded-lg p-4 shadow-sm">
                  <h3 className="font-semibold text-lg mb-2">{idea.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4">{idea.description}</p>
                  
                  {idea.targetAudience && (
                    <div className="mb-2">
                      <span className="text-xs font-medium">Target Audience:</span>
                      <p className="text-sm">{idea.targetAudience}</p>
                    </div>
                  )}
                  
                  {idea.estimatedPrice && (
                    <div className="mb-2">
                      <span className="text-xs font-medium">Estimated Price:</span>
                      <p className="text-sm">{idea.estimatedPrice}</p>
                    </div>
                  )}
                  
                  {idea.marketingTips && (
                    <div>
                      <span className="text-xs font-medium">Marketing Tips:</span>
                      <p className="text-sm">{idea.marketingTips}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {result.relatedProducts && result.relatedProducts.length > 0 && (
              <div className="mt-8">
                <h3 className="font-semibold text-lg mb-4">Related Products in Catalog</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {result.relatedProducts.map((product) => (
                    <div key={product.id} className="border rounded-lg p-3 flex items-center space-x-3">
                      {product.image_url && (
                        <div className="h-12 w-12 rounded overflow-hidden flex-shrink-0">
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className="h-full w-full object-cover" 
                          />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-sm">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.price} TAIC</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button onClick={() => setResult(null)} variant="outline" className="mr-2">
              Generate New Ideas
            </Button>
            <Button asChild>
              <Link href="/merchant/products/new">
                Create New Product
              </Link>
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
