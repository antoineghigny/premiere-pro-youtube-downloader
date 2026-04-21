import React from 'react';
import { LucideProps } from 'lucide-react';

interface IconProps extends LucideProps {
  icon: React.ComponentType<LucideProps>;
}

export const Icon: React.FC<IconProps> = ({ icon: LucideIcon, strokeWidth = 1.5, ...props }) => {
  return <LucideIcon strokeWidth={strokeWidth} {...props} />;
};
