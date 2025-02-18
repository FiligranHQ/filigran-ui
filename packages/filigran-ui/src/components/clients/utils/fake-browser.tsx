'use client'

import { type ReactNode } from 'react';

export const FakeBrowser = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      fontSize: '18px',
      padding: '2.1em 0 0 0',
      borderRadius: '0.25em',
      display: 'inline-block',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 0.25em 0.9em -0.1em rgba(0,0,0,.3)',
      width: '100%',
    }}
  >
    <div
      style={{
        display: 'block',
        boxSizing: 'border-box',
        height: '2.1em',
        position: 'absolute',
        top: '0',
        padding: '0.3em',
        width: '100%',
        background: 'linear-gradient(to bottom, #eee 0%, #ccc 100%)',
        borderBottom: '2px solid #cbcbcb',
      }}
    >
      {[0,1,2].map((i) => (
        <i
          style={{
            display: 'inline-block',
            height: '0.7em',
            width: '0.7em',
            borderRadius: '0.45em',
            margin: '0.4em 0.15em',
            backgroundColor: ['rgb(255, 86, 79)', 'rgb(255, 183, 42)', 'rgb(37, 198, 58)'][i]
          }}
        />
      ))}
      <input
        style={{
          fontSize: '0.75em',
          verticalAlign: 'top',
          display: 'inline-block',
          height: '1.6em',
          color: '#333',
          width: 'calc(100% - 6em)',
          border: '0.1em solid #E1E1E1',
          borderRadius: '0.25em',
          backgroundColor: '#eee',
          margin: '0.1em',
          padding: '0 0.4em',
        }}
        value="http://filigran.isawesome.io"
        disabled
      />
    </div>
    <div
      style={{
        height: '100%',
        width: '100%',
        overflowX: 'hidden',
        overflowY: 'auto',
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  </div>
);