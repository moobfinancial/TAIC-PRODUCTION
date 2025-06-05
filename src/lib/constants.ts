
import type { Product } from './types';

export const DEFAULT_TAIC_BALANCE = 1000;
export const SIMULATED_APY = 0.10; // 10% APY for staking simulations

export const MOCK_PRODUCTS: Product[] = [
  { 
    id: '1', 
    name: 'Innovator\'s Dream VR Headset', 
    description: 'Experience the next dimension of reality with ultra-high resolution and comfort.', 
    price: 350, 
    imageUrl: 'https://placehold.co/600x400.png', 
    category: 'Electronics',
    dataAiHint: 'vr headset'
  },
  { 
    id: '2', 
    name: 'AI-Powered Smart Garden', 
    description: 'Grow your own organic herbs and vegetables effortlessly with AI assistance.', 
    price: 180, 
    imageUrl: 'https://placehold.co/600x400.png', 
    category: 'Home & Garden',
    dataAiHint: 'smart garden'
  },
  { 
    id: '3', 
    name: 'Quantum Entanglement Communicator (Toy)', 
    description: 'A fun toy demonstrating principles of quantum communication. Not for actual FTL.', 
    price: 75, 
    imageUrl: 'https://placehold.co/600x400.png', 
    category: 'Gadgets & Toys',
    dataAiHint: 'toy communicator'
  },
  { 
    id: '4', 
    name: 'Sustainable Algae Leather Wallet', 
    description: 'A stylish and eco-conscious wallet made from innovative algae-based leather.', 
    price: 55, 
    imageUrl: 'https://placehold.co/600x400.png', 
    category: 'Fashion',
    dataAiHint: 'leather wallet'
  },
  { 
    id: '5', 
    name: 'Personalized Bio-Harmonic Soundtrack', 
    description: 'AI-generated music tuned to your unique biological rhythms for ultimate relaxation.', 
    price: 30, 
    imageUrl: 'https://placehold.co/600x400.png', 
    category: 'Wellness',
    dataAiHint: 'wellness music'
  },
  {
    id: '6',
    name: 'Holographic Desk Projector',
    description: 'Transform your workspace with interactive 3D holographic projections.',
    price: 250,
    imageUrl: 'https://placehold.co/600x400.png',
    category: 'Office Tech',
    dataAiHint: 'desk projector'
  },
  {
    id: '7',
    name: 'Modular Robotics Kit',
    description: 'Build and program your own robots with this versatile and expandable kit.',
    price: 120,
    imageUrl: 'https://placehold.co/600x400.png',
    category: 'Education & Hobby',
    dataAiHint: 'robotics kit'
  },
  {
    id: '8',
    name: 'Zero-G Coffee Mug',
    description: 'Enjoy your coffee in any orientation with this specially designed mug (for simulated zero-g environments).',
    price: 40,
    imageUrl: 'https://placehold.co/600x400.png',
    category: 'Novelty',
    dataAiHint: 'coffee mug'
  }
];
