import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

// Only load .env in local development (when .env file exists)
// CI provides DATABASE_URL and other vars via environment
const envPath = path.resolve(__dirname, '.env')
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath })
}

// Ensure HMAC_KEY is set for auth tests (required for session crypto tests)
// Use a test default if not provided (CI environments may not have .env)
if (!process.env.HMAC_KEY) {
  process.env.HMAC_KEY = 'test_hmac_key_32_bytes_minimum__'
}
