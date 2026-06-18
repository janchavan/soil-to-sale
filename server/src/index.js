import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import dotenv from 'dotenv'
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'  // add after authRoutes import
import orderRoutes from './routes/orders.js'   // add with other imports
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

app.use(helmet())
app.use(cors({ origin: process.env.CLIENT_URL }))
app.use(morgan('dev'))
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Soil-to-Sale API is running' })
})

app.use('/auth', authRoutes)
app.use('/products', productRoutes)  // add after app.use('/auth', authRoutes)
app.use('/orders', orderRoutes)   // add after products route

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})