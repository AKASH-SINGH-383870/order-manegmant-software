import React from 'react';
import { Packing } from './Packing.js';

export const Production: React.FC<{ onNavigate: (page: string) => void }> = ({ onNavigate }) => {
  return <Packing onNavigate={onNavigate} />;
};

export default Production;
