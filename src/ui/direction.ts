
import { createSlice } from '@reduxjs/toolkit';

export type Direction = 'ltr' | 'rtl';

export const DEFAULT_DIRECTION: Direction = 'ltr';

const INITIAL_STATE: { direction: Direction } = {
  direction: DEFAULT_DIRECTION,
};

export const directionSlice = createSlice({
  name: 'direction',
  initialState: INITIAL_STATE,
  reducers: {
    setDirection: (state, action) => {
      state.direction = action.payload.direction;
    },
  },
});
