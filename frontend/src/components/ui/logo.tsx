import React from 'react';
import logoImage from '@/assets/allcraft.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  imagePath?: string; // Allow custom image path
}

const Logo: React.FC<LogoProps> = ({ className = '', size = 'md', imagePath = logoImage }) => {
  const sizeClasses = {
    sm: 'h-6 w-auto',
    md: 'h-8 w-auto',
    lg: 'h-12 w-auto'
  };

  return (
    <div className={`flex items-center ${className}`}>
      {/* Logo Image with padding and rounded corners */}
      <div className="bg-white rounded-lg p-2 shadow-sm">
        <img 
          src={imagePath} 
          alt="Allcraft Logo" 
          className={`${sizeClasses[size]} object-contain`}
          onError={(e) => {
            // Fallback to text if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `
                <div class="bg-white rounded-lg flex items-center justify-center shadow-md px-3 py-2">
                  <span class="text-blue-600 font-bold text-xs">Allcraft</span>
                </div>
              `;
            }
          }}
        />
      </div>
    </div>
  );
};

export default Logo; 