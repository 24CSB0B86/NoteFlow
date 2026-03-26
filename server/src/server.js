import dotenv from 'dotenv'
dotenv.config()

import app from './app.js'

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`🚀 NoteFlow API running on http://localhost:${PORT}`)
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`   Health check: http://localhost:${PORT}/health`)
})
