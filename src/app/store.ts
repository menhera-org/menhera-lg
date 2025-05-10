import { configureStore } from '@reduxjs/toolkit';

import { drawerSlice } from '../ui/drawer';
import { directionSlice } from '../ui/direction';
import { consoleSlice } from '../ui/console';
import { useDispatch } from 'react-redux';

export const store = configureStore({
  reducer: {
    drawer: drawerSlice.reducer,
    direction: directionSlice.reducer,
    console: consoleSlice.reducer,
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>()
export default store;
