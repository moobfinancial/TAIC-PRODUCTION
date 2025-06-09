import Link from 'next/link';
import { Youtube, Instagram, Twitter, Facebook } from 'lucide-react';

export function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="border-t">
      <div className="container mx-auto flex flex-col items-center gap-8 py-12 text-center">
        {/* Newsletter Form */}
        <div className="w-full max-w-md">
          <h3 className="text-lg font-semibold mb-3 text-foreground">Stay Updated With Our Newsletter</h3>
          <form className="flex flex-col sm:flex-row items-center gap-3">
            <label htmlFor="newsletter-email" className="sr-only">Email for newsletter</label>
            <input
              type="email"
              id="newsletter-email"
              name="email"
              placeholder="Enter your email address"
              className="flex-grow w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Email for newsletter"
              required
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full sm:w-auto shrink-0"
            >
              Subscribe
            </button>
          </form>
        </div>

        {/* Social Media Links */}
        <div className="flex items-center space-x-5">
          <Link href="#" aria-label="YouTube" className="text-muted-foreground hover:text-foreground transition-colors">
            <Youtube size={28} />
          </Link>
          <Link href="#" aria-label="Instagram" className="text-muted-foreground hover:text-foreground transition-colors">
            <Instagram size={28} />
          </Link>
          <Link href="#" aria-label="X (formerly Twitter)" className="text-muted-foreground hover:text-foreground transition-colors">
            <Twitter size={28} />
          </Link>
          <Link href="#" aria-label="Facebook" className="text-muted-foreground hover:text-foreground transition-colors">
            <Facebook size={28} />
          </Link>
        </div>
        
        {/* Page Links */}
        <div className="flex flex-wrap justify-center gap-x-4 sm:gap-x-6 gap-y-3 text-sm">
          <Link href="/legal/terms-of-service" className="text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
          <Link href="/legal/privacy-policy" className="text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
          <Link href="/legal/merchant-agreement" className="text-muted-foreground hover:text-foreground transition-colors">Merchant Agreement</Link>
          <Link href="/legal/refund-policy" className="text-muted-foreground hover:text-foreground transition-colors">Refund Policy</Link>
          <Link href="/legal/cookie-policy" className="text-muted-foreground hover:text-foreground transition-colors">Cookie Policy</Link>
          <Link href="/legal/risk-disclosure" className="text-muted-foreground hover:text-foreground transition-colors">Risk Disclosure</Link>
          <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors">About Us</Link>
          <Link href="/trust-and-safety" className="text-muted-foreground hover:text-foreground transition-colors">Trust & Safety</Link>
          <Link href="/help-center" className="text-muted-foreground hover:text-foreground transition-colors">Help Center</Link>
          <Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">Contact Us</Link>
          <Link href="/brand" className="text-muted-foreground hover:text-foreground transition-colors">Brand Assets</Link>
        </div>

        {/* Copyright */}
        <p className="text-xs text-muted-foreground">
          &copy; {currentYear} TAIC. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
