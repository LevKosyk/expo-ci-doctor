import { gradients } from '../utils/logger.js';

const messages = [
  "Your CI will thank you.",
  "You're one config fix away from a green build.",
  "Ship it! Safely.",
  "EAS Build is ready when you are.",
  "Friends don't let friends push broken Expo upgrades.",
  "May your builds be fast and your caches hit.",
];

export async function motivateCommand(): Promise<void> {
  const msg = messages[Math.floor(Math.random() * messages.length)];
  
  // Decide a random gradient
  const gradientKeys = Object.keys(gradients);
  const randomKey = gradientKeys[Math.floor(Math.random() * gradientKeys.length)];
  
  const selectedGradient = gradients[randomKey];

  console.log('\n  ' + selectedGradient.multiline(msg) + '\n');
}
