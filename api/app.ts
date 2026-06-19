import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { initDb } from './db.js'
import donorRoutes from './routes/donors.js'
import slotRoutes from './routes/slots.js'
import screeningRoutes from './routes/screenings.js'
import inventoryRoutes from './routes/inventory.js'
import hospitalRequestRoutes from './routes/hospital-requests.js'
import distributionRoutes from './routes/distributions.js'
import dashboardRoutes from './routes/dashboard.js'

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/donors', donorRoutes)
app.use('/api/slots', slotRoutes)
app.use('/api/screenings', screeningRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/hospital-requests', hospitalRequestRoutes)
app.use('/api/distributions', distributionRoutes)
app.use('/api/dashboard', dashboardRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export { initDb }
export default app
