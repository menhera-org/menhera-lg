
import React from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { drawerSlice } from '../ui/drawer';
import { RootState } from '../app/store';

export const DrawerToggleButton = () => {
  const dispatch = useDispatch();
  const drawerIsOpen = useSelector((state: RootState) => state.drawer.open);
  const direction = useSelector((state: RootState) => state.direction.direction);
  const sidePanel = direction == 'ltr' ? 'left_panel' : 'right_panel';

  return (
    <button
      className="app-drawer-toggle-button app-button material-symbols-outlined"
      onClick={() => {
        dispatch(drawerSlice.actions.toggleDrawer());
      }}
    >{sidePanel + (drawerIsOpen ? '_close' : '_open')}</button>
  );
};
