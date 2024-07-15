import { getBuild } from '@arpadroid/arpadroid/src/rollup/builds/rollup-builds.mjs';
const { build } = getBuild('resources', 'uiComponent');
export default build;
