import React from 'react';
import { MenuDropdown, MenuItem, MenuSeparator } from './MenuDropdown';

interface MenuStripBarProps {
  onOpenSettings: () => void;
  onQuit: () => void;
}

export const MenuStripBar: React.FC<MenuStripBarProps> = ({ onOpenSettings, onQuit }) => {
  return (
    <div className="h-[22px] bg-rv-raised border-b border-rv-border-inset flex items-center text-xs px-1 select-none">
      <MenuDropdown trigger="File">
        <MenuItem onClick={onOpenSettings} shortcut="Ctrl+,">Settings...</MenuItem>
        <MenuSeparator />
        <MenuItem onClick={onQuit} shortcut="Alt+F4">Quit</MenuItem>
      </MenuDropdown>
      
      <MenuDropdown trigger="Edit">
        <MenuItem disabled>Undo</MenuItem>
        <MenuItem disabled>Redo</MenuItem>
        <MenuSeparator />
        <MenuItem disabled>Cut</MenuItem>
        <MenuItem disabled>Copy</MenuItem>
        <MenuItem disabled>Paste</MenuItem>
      </MenuDropdown>

      <MenuDropdown trigger="View">
        <MenuItem disabled>Full Screen</MenuItem>
        <MenuItem disabled>Toggle Status Bar</MenuItem>
      </MenuDropdown>

      <MenuDropdown trigger="Workspace">
        <MenuItem disabled>Reset Layout</MenuItem>
      </MenuDropdown>

      <MenuDropdown trigger="Help">
        <MenuItem disabled>About YT2Premiere</MenuItem>
        <MenuItem disabled>Documentation</MenuItem>
      </MenuDropdown>
    </div>
  );
};
