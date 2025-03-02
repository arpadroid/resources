import { getBuild } from '@arpadroid/module';
const { build = {} } = getBuild('resources', 'library') || {};
export default build;
