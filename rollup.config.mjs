import { getBuild } from '@arpadroid/module/src/rollup/builds/rollup-builds.mjs';
const { build } = getBuild('resources', 'library');
export default build;
