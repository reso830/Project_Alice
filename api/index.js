import { config } from '../server/config.js';
import { createRepositories } from '../server/repositories/index.js';
import { createApp } from '../server/index.js';

const repositories = await createRepositories(config);

export default createApp({ repositories });
