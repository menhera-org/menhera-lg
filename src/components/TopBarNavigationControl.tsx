
import React from 'react';

import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '../app/store';

export const TopBarNavigationControl = ({ title }: { title: string }) => {
  return (
    <div id="app-top-bar-navigation">
      <svg className='app-top-bar-navigation-start-edge' xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path d="M 0 100 C 75 100 25 0 100 0 L 100 100 Z"/>
      </svg>
      <div className='app-top-bar-navigation-content'>
        <div className='app-top-bar-navigation-item material-symbols-outlined'>public</div>
        <div className='app-top-bar-navigation-item'>{title}</div>
      </div>
      <svg className='app-top-bar-navigation-end-edge' xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <path d="M 0 0 C 75 0 25 100 100 100 L 0 100 Z"/>
      </svg>
    </div>
  );
};
