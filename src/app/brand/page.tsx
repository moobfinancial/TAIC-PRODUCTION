'use client';

import Image from 'next/image';
import Link from 'next/link';

export default function BrandAssetsPage() {
  const colors = [
    { name: 'Primary Purple', hex: '#A020F0', hsl: 'hsl(276, 87%, 53%)', usage: 'Primary brand color, main actions' },
    { name: 'Primary Pink', hex: '#FF69B4', hsl: 'hsl(330, 100%, 71%)', usage: 'Accents, highlights, CTAs' },
    { name: 'Dark Gray', hex: '#333333', hsl: 'hsl(0, 0%, 20%)', usage: 'Primary text' },
    { name: 'Medium Gray', hex: '#CCCCCC', hsl: 'hsl(0, 0%, 80%)', usage: 'Borders, dividers' },
    { name: 'Light Gray', hex: '#E0E0E0', hsl: 'hsl(0, 0%, 87.8%)', usage: 'Backgrounds' },
  ];

  const typography = [
    { name: 'H1', size: '2.5rem (40px)', weight: '700', example: 'The quick brown fox' },
    { name: 'H2', size: '2rem (32px)', weight: '700', example: 'The quick brown fox' },
    { name: 'H3', size: '1.75rem (28px)', weight: '600', example: 'The quick brown fox' },
    { name: 'Body', size: '1rem (16px)', weight: '400', example: 'The quick brown fox jumps over the lazy dog.' },
    { name: 'Caption', size: '0.875rem (14px)', weight: '400', example: 'Supporting text and captions' },
  ];

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-4">TAIC Brand Assets</h1>
        <p className="text-lg text-muted-foreground">
          Guidelines and resources for using the TAIC brand
        </p>
      </header>

      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-6 pb-2 border-b">Logo</h2>
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div className="bg-white p-8 rounded-lg shadow-sm border flex flex-col items-center">
            <div className="w-48 h-48 relative mb-6">
              <Image 
                src="/brand/logo.svg" 
                alt="TAIC Logo" 
                width={192}
                height={192}
                className="object-contain"
                priority
              />
            </div>
            <div className="text-center">
              <h3 className="font-medium">Primary Logo</h3>
              <p className="text-sm text-muted-foreground">SVG</p>
              <div className="mt-2">
                <a 
                  href="/brand/logo.svg" 
                  download="taic-logo.svg"
                  className="text-sm text-primary hover:underline"
                >
                  Download SVG
                </a>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-2">Clear Space</h3>
              <p className="text-sm text-muted-foreground">
                Maintain a minimum clear space around the logo equal to the height of the 'T' in the logo.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Minimum Size</h3>
              <p className="text-sm text-muted-foreground">
                100px width for digital, 1" for print materials.
              </p>
            </div>
             <div>
              <h3 className="font-medium mb-2">Logo Don'ts</h3>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>Do not rotate the logo</li>
                <li>Do not change the colors</li>
                <li>Do not add effects like shadows or strokes</li>
                <li>Do not place on busy backgrounds</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-6 pb-2 border-b">Colors</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4">
          {colors.map((color) => (
            <div key={color.name} className="space-y-2">
              <div 
                className="w-full h-24 rounded-md border" 
                style={{ backgroundColor: color.hex }}
              />
              <div>
                <p className="font-medium">{color.name}</p>
                <p className="text-sm text-muted-foreground">{color.hex}</p>
                <p className="text-xs text-muted-foreground">{color.hsl}</p>
                <p className="text-xs mt-1 text-muted-foreground">{color.usage}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-6 pb-2 border-b">Typography</h2>
        <div className="space-y-6">
          {typography.map((type) => (
            <div key={type.name} className="border-b pb-4 last:border-0 last:pb-0">
              <div className="flex justify-between items-baseline mb-2">
                <h3 className="font-medium">{type.name}</h3>
                <div className="text-sm text-muted-foreground">
                  {type.size} • {type.weight}
                </div>
              </div>
              <p 
                className="whitespace-nowrap overflow-hidden text-ellipsis"
                style={{
                  fontSize: type.size.split(' ')[0],
                  fontWeight: parseInt(type.weight)
                }}
              >
                {type.example}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-semibold mb-6 pb-2 border-b">UI Components</h2>
        <div className="space-y-8">
          <div>
            <h3 className="font-medium mb-3">Buttons</h3>
            <div className="flex flex-wrap gap-4">
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90">
                Primary
              </button>
              <button className="px-4 py-2 bg-accent text-accent-foreground rounded-md font-medium hover:bg-accent/90">
                Accent
              </button>
              <button className="px-4 py-2 border rounded-md font-medium hover:bg-accent/10">
                Secondary
              </button>
              <button className="px-4 py-2 text-primary font-medium hover:underline">
                Text Link
              </button>
            </div>
          </div>
          
          <div>
            <h3 className="font-medium mb-3">Form Elements</h3>
            <div className="grid md:grid-cols-2 gap-6 max-w-2xl">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Text Input</label>
                  <input 
                    type="text" 
                    placeholder="Placeholder" 
                    className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Select</label>
                  <select className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none">
                    <option>Option 1</option>
                    <option>Option 2</option>
                  </select>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="checkbox" className="h-4 w-4 text-primary focus:ring-primary/50 border rounded" />
                  <label htmlFor="checkbox" className="text-sm">Checkbox</label>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="radio" id="radio" name="radio" className="h-4 w-4 text-primary focus:ring-primary/50" />
                  <label htmlFor="radio" className="text-sm">Radio button</label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
