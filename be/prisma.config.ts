import 'dotenv/config'
import { defineConfig } from 'prisma/config'
import { getDatabaseConfig } from './src/config.js'

export default defineConfig({
  schema: 'src/prisma',
  migrations: {
    path: 'src/prisma/migrations',
    seed: 'tsx src/prisma/seed.ts',
  },
  datasource: {
    // Built from config parts + the db_password secret (#65), same as the app.
    url: getDatabaseConfig().databaseUrl,
  },
})
