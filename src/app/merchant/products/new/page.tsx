
'use client';

import { useState, type FormEvent, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { PackagePlus, ArrowLeft, UploadCloud, XCircle, Gem, Percent } from 'lucide-react';
import Image from 'next/image';

const productCategories = ["Electronics", "Home & Garden", "Fashion", "Gadgets & Toys", "Wellness", "Office Tech", "Education & Hobby", "Novelty", "Other"];

export default function AddNewProductPage() {
  const [productName, setProductName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [enableCashback, setEnableCashback] = useState(false);
  const [cashbackType, setCashbackType] = useState<'percentage' | 'fixed'>('percentage');
  const [cashbackValue, setCashbackValue] = useState('');

  const router = useRouter();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImagePreview = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!productName.trim() || !price.trim() || !category.trim()) {
      toast({
        title: 'Submission Failed',
        description: 'Please fill in all required product fields.',
        variant: 'destructive',
      });
      return;
    }

    // Simulate submission
    const formData = {
        productName, description, price, category, stockQuantity, 
        image: imageFile?.name || 'No image',
        cashback: {
            enabled: enableCashback,
            type: enableCashback ? cashbackType : null,
            value: enableCashback ? cashbackValue : null,
        }
    };
    console.log('Simulated Product Submission:', formData);

    toast({
      title: 'Product Submitted (Simulated)',
      description: `${productName} has been submitted for review.`,
    });

    // Reset form
    setProductName('');
    setDescription('');
    setPrice('');
    setCategory('');
    setStockQuantity('');
    removeImagePreview();
    setEnableCashback(false);
    setCashbackType('percentage');
    setCashbackValue('');
    // router.push('/merchant/products'); // Optionally redirect
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="flex items-center justify-start mb-8">
        <Button variant="outline" size="sm" asChild>
          <Link href="/merchant/products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Products
          </Link>
        </Button>
      </div>

      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <PackagePlus className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-headline">Add New Product</CardTitle>
          <CardDescription>Fill in the details for your new product listing.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            <div className="space-y-2">
              <Label htmlFor="productName" className="text-base">Product Name <span className="text-destructive">*</span></Label>
              <Input id="productName" value={productName} onChange={(e) => setProductName(e.target.value)} required className="text-base" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-base">Product Description</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="text-base min-h-[120px]" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="price" className="text-base">Price (Demo TAIC) <span className="text-destructive">*</span></Label>
                <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required className="text-base" placeholder="e.g., 99.99" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category" className="text-base">Category <span className="text-destructive">*</span></Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="text-base">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {productCategories.map(cat => (
                      <SelectItem key={cat} value={cat} className="text-base">{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stockQuantity" className="text-base">Stock Quantity</Label>
              <Input id="stockQuantity" type="number" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} className="text-base" placeholder="e.g., 100" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="imageUpload" className="text-base flex items-center gap-2">
                <UploadCloud className="h-5 w-5" /> Product Image (UI Only)
              </Label>
              <Input id="imageUpload" type="file" accept="image/*" onChange={handleImageChange} ref={fileInputRef} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" />
              {imagePreview && (
                <div className="mt-2 relative w-32 h-32 border rounded-md overflow-hidden shadow-sm">
                  <Image src={imagePreview} alt="Product Preview" layout="fill" objectFit="cover" />
                  <Button variant="ghost" size="icon" className="absolute top-1 right-1 bg-black/50 hover:bg-black/70 text-white h-6 w-6 rounded-full" onClick={removeImagePreview}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            
            <Card className="p-4 bg-secondary/30 border-secondary/50">
                <CardHeader className="p-0 pb-3">
                    <CardTitle className="text-xl flex items-center gap-2"><Gem className="h-5 w-5 text-accent"/>Cashback Configuration (Simulated)</CardTitle>
                    <CardDescription className="text-sm">Offer Demo TAIC cashback to shoppers.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 space-y-4">
                    <div className="flex items-center space-x-2">
                        <Checkbox id="enableCashback" checked={enableCashback} onCheckedChange={(checked) => setEnableCashback(Boolean(checked))} />
                        <Label htmlFor="enableCashback" className="text-base font-medium">Enable Cashback for this Product</Label>
                    </div>

                    {enableCashback && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end p-3 border-t border-secondary/60 pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="cashbackType" className="text-sm">Cashback Type</Label>
                                <Select value={cashbackType} onValueChange={(value) => setCashbackType(value as 'percentage' | 'fixed')}>
                                    <SelectTrigger className="text-base">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="percentage" className="text-base">Percentage (%)</SelectItem>
                                        <SelectItem value="fixed" className="text-base">Fixed Amount (TAIC)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cashbackValue" className="text-sm">
                                    {cashbackType === 'percentage' ? 'Percentage Value' : 'Fixed TAIC Amount'}
                                </Label>
                                <Input 
                                    id="cashbackValue" 
                                    type="number" 
                                    value={cashbackValue} 
                                    onChange={(e) => setCashbackValue(e.target.value)} 
                                    className="text-base"
                                    placeholder={cashbackType === 'percentage' ? "e.g., 5 for 5%" : "e.g., 10 for 10 TAIC"}
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>


            <Button type="submit" className="w-full text-lg py-6 font-semibold">
              <PackagePlus className="mr-2 h-5 w-5" /> Add Product (Simulated)
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
