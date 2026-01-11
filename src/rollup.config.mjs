import { getBuild } from '@arpadroid/module';
const { build = {} } = getBuild('resources') || {};
export default build;
