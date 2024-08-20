import { getBuild, isSlim } from '@arpadroid/arpadroid/src/rollup/builds/rollup-builds.mjs';
const { build } = getBuild('resources', 'uiComponent', {
    external : isSlim() ? ['lists', 'application'] : ['application']
});
export default build;
