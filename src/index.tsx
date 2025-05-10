import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import store from './app/store';
import { Provider } from 'react-redux';
import { directionSlice, Direction } from './ui/direction';

const root = createRoot(document.getElementById('root')!);
root.render(
  <Provider store={store}>
    <App />
  </Provider>
);

const _debugUtils = {
  setDirection(direction: Direction) {
    store.dispatch(directionSlice.actions.setDirection({ direction }));
  },
};

declare global {
  var debugUtils: typeof _debugUtils;
}

globalThis.debugUtils = _debugUtils;
