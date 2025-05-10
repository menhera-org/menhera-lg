
import { createSlice } from '@reduxjs/toolkit';

export const drawerSlice = createSlice({
  name: 'drawer',
  initialState: {
    open: false,
  },
  reducers: {
    toggleDrawer: (state) => {
      state.open = !state.open;
    },
    openDrawer: (state) => {
      state.open = true;
    },
    closeDrawer: (state) => {
      state.open = false;
    },
  },
});
