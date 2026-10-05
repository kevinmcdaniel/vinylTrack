import app from './app.js';
import { getConfig } from './config.js';

const PORT = getConfig().port;

app.listen(PORT, () => {
  console.log(`vinylTrack API running on <http://localhost:${PORT}>`);
});
