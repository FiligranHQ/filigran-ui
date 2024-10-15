import {nightOwl} from '@codesandbox/sandpack-themes'
import {SandpackTheme} from '@codesandbox/sandpack-react'

export const indexCode = `
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "filigran-ui/index.css";
import "./styles.css";
const rootElement = document.getElementById("root");
const root = ReactDOM.createRoot(rootElement);
const style = document.createElement('style');
style.innerHTML = \`
  :root {
    --font-geologica: 'Geologica';
    --font-ibm-plex-sans: 'IBM Plex Sans';
  }

  * {
    font-family: var(--font-ibm-plex-sans), system-ui, sans-serif !important;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-geologica), system-ui, sans-serif !important;
  }
\`;

document.head.appendChild(style);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`.trim()

export const defaultApp = `
import { Button } from "filigran-ui";

export default function App() {
  return (
  <div className="p-s">
    <h2 className="txt-title">Hello world</h2>
    <div className="flex flex-wrap gap-s">
      <Button> Primary/Default </Button>
      <Button variant="secondary"> Secondary </Button>
      <Button variant="destructive"> Destructive </Button>
      <Button variant="outline"> Outline </Button>
      <Button variant="ghost"> Ghost </Button>
      <Button variant="link"> Link </Button>
    </div>
   </div>
  );
}
`

export const testsCode = `
  import { render, screen } from '@testing-library/react';
  import App from './App';
  import { fizzbuzz } from './utils';
  describe('App test', () => {
    test('Should find a title and a button', () => {
    render(<App/>);
    const heading = screen.getByRole('heading', { level: 2, name: /Hello world/i });
    expect(heading).toBeDefined(); 
    
    const primaryButton = screen.getByRole('button', { name: /primary\\/default/i });
    expect(primaryButton).toBeDefined();
    });
  });
  describe('Utils test', () => {
    test("should print 1 if receive 1", () => {
        const result = fizzbuzz(1);
        expect(1).toBe(result);
      });
  });
`.trim()

export const defaultUtils = `
  export const fizzbuzz = (num: number) => {
    return num;
  }
`

export const sandPackTheme: SandpackTheme = {
  ...nightOwl,
  colors: {
    ...nightOwl.colors,
  },
}
