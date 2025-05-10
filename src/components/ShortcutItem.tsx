
import React from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../app/store';

export const ShortcutItem = ({ href, icon, text, selected }: { href: string, icon: string, text: string, selected: boolean }) => {
  return (
    <a href={href} className={ selected ? "app-shortcut-item selected" : "app-shortcut-item" }>
      <span className="icon material-symbols-outlined">{icon}</span>
      <span className="text">{text}</span>
    </a>
  );
};
