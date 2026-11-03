/// <reference types="vite/client" />
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import type { ComponentType } from 'react';
import 'rsuite/dist/rsuite.min.css';
import packageJSON from '../../package.json';

type StoryComponent = ComponentType<Record<string, unknown>>;
type StoryModule = Record<string, StoryComponent | undefined>;

const stories = import.meta.glob('../../src/**/*.story.{tsx,jsx}');

const storyId = (file: string) =>
  `${packageJSON.name}/${file.replace(/^(\.\.\/)+src\//, '').replace(/\.story\.\w+$/, '')}`;

async function resolve(id: string): Promise<StoryComponent | undefined> {
  const sep = id.lastIndexOf('/');
  const storyPath = id.slice(0, sep);
  const name = id.slice(sep + 1);
  const file = Object.keys(stories).find(candidate => {
    const candidateId = storyId(candidate);
    return candidateId === storyPath || candidateId.endsWith(`/${storyPath}`);
  });
  if (!file)
    return undefined;
  const mod = await stories[file]() as StoryModule;
  return mod[name] ?? mod.default;
}

const rootEl = document.getElementById('root');
if (!rootEl)
  throw new Error('Gallery root element #root is missing');

let root: Root | undefined;

window.mount = async ({ story, props }) => {
  const Story = await resolve(story);
  if (!Story)
    throw new Error(`Unknown story: ${story}`);
  root ??= createRoot(rootEl);
  flushSync(() => {
    root!.render(<Story {...props} />);
  });
};

window.unmount = async () => {
  root?.unmount();
  root = undefined;
};

declare global {
  interface Window {
    mount: (params: { story: string; props?: Record<string, unknown> }) => Promise<void>;
    unmount: () => Promise<void>;
  }
}
